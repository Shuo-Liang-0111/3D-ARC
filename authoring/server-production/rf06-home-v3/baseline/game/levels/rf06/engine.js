import { ITEM_META, ITEM_TYPES, LEVEL } from "./level.js";
import { applyRobotMovement } from "../../movement.js";

const EPSILON = 1e-6;

export function createInitialState() {
  return {
    player: { ...LEVEL.playerStart },
    items: Object.fromEntries(ITEM_TYPES.map((type) => [type, { type, location: "room", ...LEVEL.items[type] }])),
    rewardedPickups: Object.fromEntries(ITEM_TYPES.map((type) => [type, false])),
    carriedItem: null,
    valveClosed: false,
    bucketPlaced: false,
    puddleClean: false,
    returned: { wrench: false, mop: false },
    complete: false,
    failed: false,
    progress: LEVEL.progress.initial,
    motion: "idle",
    elapsed: 0,
    interactions: 0,
    lastEvent: "water_leak_started",
  };
}

export function cloneState(state) {
  return {
    ...state,
    player: { ...state.player },
    items: Object.fromEntries(ITEM_TYPES.map((type) => [type, { ...state.items[type] }])),
    rewardedPickups: { ...state.rewardedPickups },
    returned: { ...state.returned },
  };
}

export function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

function circleOverlapsRect(x, z, radius, rect) {
  const nearX = Math.max(rect.minX, Math.min(x, rect.maxX));
  const nearZ = Math.max(rect.minZ, Math.min(z, rect.maxZ));
  return (x - nearX) ** 2 + (z - nearZ) ** 2 < radius ** 2;
}

export function isWalkable(_state, x, z) {
  const { bounds, playerRadius: radius } = LEVEL;
  if (x - radius < bounds.minX || x + radius > bounds.maxX || z - radius < bounds.minZ || z + radius > bounds.maxZ) return false;
  return !LEVEL.staticColliders.some((rect) => circleOverlapsRect(x, z, radius, rect));
}

function failIfDepleted(state) {
  if (state.progress > EPSILON || state.complete) return state;
  state.progress = 0;
  state.failed = true;
  state.motion = "idle";
  state.lastEvent = "progress_depleted";
  return state;
}

export function updateMovement(state, input, deltaSeconds) {
  const next = cloneState(state);
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
  next.elapsed += dt;
  if (state.complete || state.failed) return next;
  const movement = applyRobotMovement(next, state, input, dt, LEVEL, isWalkable);
  if (!movement.active) {
    next.motion = state.carriedItem ? "carrying" : "idle";
    return next;
  }
  if (input.drain !== false) next.progress = Math.max(0, state.progress - LEVEL.progress.actionDrainPerSecond * dt);
  next.motion = movement.motionTurning ? "turning" : (state.carriedItem ? "carrying" : "moving");
  return failIfDepleted(next);
}

function nearby(state) {
  const candidates = [];
  if (!state.carriedItem) {
    for (const type of ITEM_TYPES) {
      const item = state.items[type];
      if (["room", "floor"].includes(item.location)) candidates.push({ type: "item", itemType: type, distance: distance(state.player, item) });
    }
    if (!state.valveClosed) candidates.push({ type: "valve", distance: distance(state.player, LEVEL.valve) });
    if (state.valveClosed && !state.bucketPlaced) candidates.push({ type: "bucket-place", distance: distance(state.player, LEVEL.bucketDrop) });
    if (state.bucketPlaced && !state.puddleClean) candidates.push({ type: "mop-clean", distance: distance(state.player, LEVEL.puddle) });
  } else {
    if (state.carriedItem === "wrench" && !state.valveClosed) candidates.push({ type: "valve", distance: distance(state.player, LEVEL.valve) });
    if (state.carriedItem === "bucket" && state.valveClosed && !state.bucketPlaced) candidates.push({ type: "bucket-place", distance: distance(state.player, LEVEL.bucketDrop) });
    if (state.carriedItem === "mop" && state.bucketPlaced && !state.puddleClean) candidates.push({ type: "mop-clean", distance: distance(state.player, LEVEL.puddle) });
    if ((state.carriedItem === "wrench" && state.valveClosed && !state.returned.wrench)
      || (state.carriedItem === "mop" && state.puddleClean && !state.returned.mop)) {
      candidates.push({ type: "tool-rack", distance: distance(state.player, LEVEL.toolRack) });
    }
    candidates.push({ type: "drop", distance: Infinity });
  }
  return candidates.filter((entry) => entry.distance <= LEVEL.interactionRange).sort((a, b) => a.distance - b.distance);
}

export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  const item = nearby(state)[0];
  if (!item) return state.carriedItem ? { type: "drop", label: `放下${ITEM_META[state.carriedItem].shortName}` } : null;
  if (item.type === "item") return { ...item, label: `拿起${ITEM_META[item.itemType].name}` };
  if (item.type === "valve") return { ...item, label: state.carriedItem === "wrench" ? "关闭漏水阀门" : "需要扳手关闭阀门" };
  if (item.type === "bucket-place") return { ...item, label: state.carriedItem === "bucket" ? "将水桶放到漏水点" : "需要水桶接住漏水" };
  if (item.type === "mop-clean") return { ...item, label: state.carriedItem === "mop" ? "用拖把清理积水" : "需要拖把清理积水" };
  if (item.type === "tool-rack") return { ...item, label: `将${ITEM_META[state.carriedItem].shortName}放回工具架` };
  return { type: "drop", label: `放下${ITEM_META[state.carriedItem].shortName}` };
}

export function interact(state) {
  if (state.complete || state.failed) return cloneState(state);
  const interaction = getInteraction(state);
  const next = cloneState(state);
  next.interactions += 1;
  next.progress = Math.max(0, next.progress - LEVEL.progress.interactionCost);
  if (!interaction) { next.lastEvent = "empty_interaction"; return failIfDepleted(next); }
  if (interaction.type === "item") {
    const type = interaction.itemType;
    const first = !next.rewardedPickups[type];
    next.carriedItem = type;
    next.items[type] = { type, location: "carried" };
    if (first) { next.rewardedPickups[type] = true; next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.itemPickupReward); }
    next.motion = "carrying";
    next.lastEvent = `${first ? "item_collected" : "item_recollected"}_${type}`;
  } else if (interaction.type === "drop") {
    const type = next.carriedItem;
    next.items[type] = { type, location: "floor", x: next.player.x, z: next.player.z };
    next.carriedItem = null; next.motion = "idle"; next.lastEvent = `item_dropped_${type}`;
  } else if (interaction.type === "valve") {
    if (next.carriedItem === "wrench" && !next.valveClosed) {
      next.valveClosed = true; next.carriedItem = null; next.items.wrench = { type: "wrench", location: "floor", x: next.player.x, z: next.player.z };
      next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.taskCompletionReward); next.lastEvent = "valve_closed";
    } else next.lastEvent = "valve_requires_wrench";
  } else if (interaction.type === "bucket-place") {
    if (next.carriedItem === "bucket" && next.valveClosed && !next.bucketPlaced) {
      next.bucketPlaced = true; next.carriedItem = null; next.items.bucket = { type: "bucket", location: "placed", x: LEVEL.bucketDrop.x, z: LEVEL.bucketDrop.z };
      next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.taskCompletionReward); next.lastEvent = "bucket_placed";
    } else next.lastEvent = "bucket_requires_closed_valve";
  } else if (interaction.type === "mop-clean") {
    if (next.carriedItem === "mop" && next.bucketPlaced && !next.puddleClean) {
      next.puddleClean = true; next.carriedItem = null; next.items.mop = { type: "mop", location: "floor", x: next.player.x, z: next.player.z };
      next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.taskCompletionReward); next.lastEvent = "puddle_cleaned";
    } else next.lastEvent = "mop_requires_bucket";
  } else if (interaction.type === "tool-rack") {
    const type = next.carriedItem;
    if ((type === "wrench" && next.valveClosed && !next.returned.wrench)
      || (type === "mop" && next.puddleClean && !next.returned.mop)) {
      next.returned[type] = true; next.items[type] = { type, location: "tool-rack", x: LEVEL.toolRack.x, z: LEVEL.toolRack.z }; next.carriedItem = null;
      next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.taskCompletionReward); next.lastEvent = `tool_returned_${type}`;
      if (next.returned.wrench && next.returned.mop && next.valveClosed && next.bucketPlaced && next.puddleClean) { next.complete = true; next.progress = LEVEL.progress.maximum; next.lastEvent = "leak_resolved"; }
    } else next.lastEvent = "tool_not_ready";
  }
  return failIfDepleted(next);
}

export function closeTerminal(state) { return cloneState(state); }

export function getObjective(state) {
  if (state.failed) return { step: 0, title: "任务失败", detail: "状态余量已耗尽，漏水处理终止。" };
  if (state.complete) return { step: 5, title: "漏水处理完成", detail: "阀门已关闭、积水已清理，工具已归还。" };
  if (!state.valveClosed) return { step: 1, title: "关闭漏水阀门", detail: state.carriedItem === "wrench" ? "携带扳手到水槽下阀门处按 F。" : "先找到扳手，再到水槽下关闭阀门。" };
  if (!state.bucketPlaced) return { step: 2, title: "放置水桶", detail: state.carriedItem === "bucket" ? "将水桶放到漏水点下方按 F。" : "找到蓝色水桶并放到漏水点下方。" };
  if (!state.puddleClean) return { step: 3, title: "清理积水", detail: state.carriedItem === "mop" ? "用拖把清理地面积水。" : "找到拖把，带到积水处按 F。" };
  if (state.carriedItem) return { step: 4, title: "归还工具", detail: "将扳手或拖把放回工具架。" };
  return { step: 4, title: "归还工具", detail: "扳手和拖把都要放回工具架。" };
}
