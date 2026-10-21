import { CLOTHING_META, CLOTHING_TYPES, LEVEL } from "./level.js";
import { applyRobotMovement } from "../../movement.js";

const EPSILON = 1e-6;

export function createInitialState() {
  return {
    player: { ...LEVEL.playerStart },
    clothes: Object.fromEntries(CLOTHING_TYPES.map((type) => [type, { type, location: "living-room", ...LEVEL.clothes[type] }])),
    rewardedPickups: Object.fromEntries(CLOTHING_TYPES.map((type) => [type, false])),
    carriedItem: null,
    wetBatch: null,
    washerPhase: "loading",
    washElapsed: 0,
    terminalOpen: false,
    complete: false,
    failed: false,
    progress: LEVEL.progress.initial,
    motion: "idle",
    elapsed: 0,
    interactions: 0,
    lastEvent: "home_laundry_started",
  };
}

export function cloneState(state) {
  return {
    ...state,
    player: { ...state.player },
    clothes: Object.fromEntries(CLOTHING_TYPES.map((type) => [type, { ...state.clothes[type] }])),
    rewardedPickups: { ...state.rewardedPickups },
    wetBatch: state.wetBatch ? { ...state.wetBatch } : null,
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

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

function advanceWasher(state, dt) {
  if (state.washerPhase !== "washing") return;
  state.washElapsed = Math.min(LEVEL.washDuration, state.washElapsed + dt);
  if (state.washElapsed >= LEVEL.washDuration) {
    state.washerPhase = "done";
    state.progress = Math.min(LEVEL.progress.maximum, state.progress + LEVEL.progress.taskCompletionReward);
    state.lastEvent = "washer_finished";
  }
}

export function updateMovement(state, input, deltaSeconds) {
  const next = cloneState(state);
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
  next.elapsed += dt;
  if (state.complete || state.failed) {
    next.motion = state.carriedItem ? "carrying" : "idle";
    return next;
  }

  advanceWasher(next, dt);
  const movement = applyRobotMovement(next, state, input, dt, LEVEL, isWalkable);
  if (!movement.active) {
    next.motion = state.carriedItem ? "carrying" : "idle";
    return next;
  }
  if (input.drain !== false) next.progress = Math.max(0, state.progress - LEVEL.progress.actionDrainPerSecond * dt);
  next.motion = movement.motionTurning ? "turning" : (state.carriedItem ? "carrying" : "moving");
  return failIfDepleted(next);
}

function loadedCount(state) {
  return CLOTHING_TYPES.filter((type) => state.clothes[type].location === "washer").length;
}

function nearbyCandidates(state) {
  const candidates = [];
  if (!state.carriedItem) {
    for (const type of CLOTHING_TYPES) {
      const item = state.clothes[type];
      if (item.location === "living-room" || item.location === "ground") {
        candidates.push({ type: "clothing", clothingType: type, distance: distance(state.player, item) });
      }
    }
    if (state.wetBatch) candidates.push({ type: "wet-batch", distance: distance(state.player, state.wetBatch) });
    if (state.washerPhase === "ready") {
      candidates.push({ type: "washer-start", distance: distance(state.player, { x: LEVEL.washer.panelX, z: LEVEL.washer.panelZ }) });
    } else if (state.washerPhase === "washing") {
      candidates.push({ type: "washer-busy", distance: distance(state.player, LEVEL.washer) });
    } else if (state.washerPhase === "done") {
      candidates.push({ type: "washer-unload", distance: distance(state.player, { x: LEVEL.washer.drumX, z: LEVEL.washer.drumZ }) });
    } else if (state.washerPhase === "loading" && loadedCount(state) > 0) {
      candidates.push({ type: "washer-not-ready", distance: distance(state.player, LEVEL.washer) });
    }
  } else if (state.carriedItem === "wet-batch") {
    candidates.push({ type: "drying-rack", distance: distance(state.player, LEVEL.dryingRack) });
  } else {
    candidates.push({ type: "washer-load", clothingType: state.carriedItem, distance: distance(state.player, { x: LEVEL.washer.drumX, z: LEVEL.washer.drumZ }) });
  }
  return candidates.filter((candidate) => candidate.distance <= LEVEL.interactionRange).sort((a, b) => a.distance - b.distance);
}

export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  const nearest = nearbyCandidates(state)[0];
  if (nearest?.type === "clothing") return { ...nearest, label: `拿起${CLOTHING_META[nearest.clothingType].name}` };
  if (nearest?.type === "wet-batch") return { ...nearest, label: "拿起湿衣服" };
  if (nearest?.type === "washer-load") return { ...nearest, label: `将${CLOTHING_META[nearest.clothingType].shortName}放入洗衣机` };
  if (nearest?.type === "washer-start") return { ...nearest, label: "启动洗衣机" };
  if (nearest?.type === "washer-busy") return { ...nearest, label: "洗衣机正在运行" };
  if (nearest?.type === "washer-not-ready") return { ...nearest, label: "还有衣物未装入" };
  if (nearest?.type === "washer-unload") return { ...nearest, label: "取出整批湿衣服" };
  if (nearest?.type === "drying-rack") return { ...nearest, label: "将湿衣服晾到衣架上" };
  if (state.carriedItem === "wet-batch") return { type: "drop-wet-batch", label: "放下湿衣服" };
  if (state.carriedItem) return { type: "drop-clothing", clothingType: state.carriedItem, label: "放下衣物" };
  return null;
}

export function interact(state) {
  if (state.complete || state.failed) return cloneState(state);
  const interaction = getInteraction(state);
  const next = cloneState(state);
  next.interactions += 1;
  next.progress = Math.max(0, next.progress - LEVEL.progress.interactionCost);

  if (!interaction) {
    next.lastEvent = "empty_interaction";
    return failIfDepleted(next);
  }
  if (interaction.type === "clothing") {
    const isFirstPickup = !next.rewardedPickups[interaction.clothingType];
    next.carriedItem = interaction.clothingType;
    next.clothes[interaction.clothingType] = { type: interaction.clothingType, location: "carried" };
    if (isFirstPickup) {
      next.rewardedPickups[interaction.clothingType] = true;
      next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.clothingPickupReward);
    }
    next.motion = "carrying";
    next.lastEvent = `${isFirstPickup ? "clothing_collected" : "clothing_recollected"}_${interaction.clothingType}`;
  } else if (interaction.type === "drop-clothing") {
    const type = state.carriedItem;
    next.clothes[type] = { type, location: "ground", x: state.player.x, z: state.player.z };
    next.carriedItem = null;
    next.motion = "idle";
    next.lastEvent = `clothing_dropped_${type}`;
  } else if (interaction.type === "washer-load") {
    const type = state.carriedItem;
    next.clothes[type] = { type, location: "washer" };
    next.carriedItem = null;
    next.motion = "idle";
    next.lastEvent = `clothing_loaded_${type}`;
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.clothingLoadReward);
    if (loadedCount(next) === CLOTHING_TYPES.length) {
      next.washerPhase = "ready";
      next.lastEvent = "all_clothes_loaded";
    }
  } else if (interaction.type === "washer-start") {
    next.washerPhase = "washing";
    next.washElapsed = 0;
    next.lastEvent = "washer_started";
  } else if (interaction.type === "washer-busy") {
    next.lastEvent = "washer_still_running";
  } else if (interaction.type === "washer-not-ready") {
    next.lastEvent = "washer_missing_clothes";
  } else if (interaction.type === "washer-unload") {
    next.washerPhase = "unloaded";
    next.carriedItem = "wet-batch";
    next.clothes = Object.fromEntries(CLOTHING_TYPES.map((type) => [type, { type, location: "wet-carried" }]));
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.taskCompletionReward);
    next.motion = "carrying";
    next.lastEvent = "washer_unloaded";
  } else if (interaction.type === "drop-wet-batch") {
    next.wetBatch = { x: state.player.x, z: state.player.z };
    next.carriedItem = null;
    next.clothes = Object.fromEntries(CLOTHING_TYPES.map((type) => [type, { type, location: "wet-ground" }]));
    next.motion = "idle";
    next.lastEvent = "wet_batch_dropped";
  } else if (interaction.type === "wet-batch") {
    next.wetBatch = null;
    next.carriedItem = "wet-batch";
    next.clothes = Object.fromEntries(CLOTHING_TYPES.map((type) => [type, { type, location: "wet-carried" }]));
    next.motion = "carrying";
    next.lastEvent = "wet_batch_collected";
  } else if (interaction.type === "drying-rack") {
    next.carriedItem = null;
    next.clothes = Object.fromEntries(CLOTHING_TYPES.map((type) => [type, { type, location: "hung" }]));
    next.motion = "idle";
    next.complete = true;
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.taskCompletionReward);
    next.progress = LEVEL.progress.maximum;
    next.lastEvent = "laundry_hung";
  }
  return failIfDepleted(next);
}

export function closeTerminal(state) {
  return cloneState(state);
}

export function getObjective(state) {
  if (state.failed) return { step: 0, title: "任务失败", detail: "状态余量已耗尽，洗衣任务终止。" };
  if (state.complete) return { step: 4, title: "晾晒完成", detail: "三件衣物已经清洗并晾在阳台。" };
  if (state.carriedItem === "wet-batch") return { step: 4, title: "前往阳台晾晒", detail: "将整批湿衣服送到阳台晾衣架，靠近后按 E。" };
  if (state.wetBatch) return { step: 3, title: "拿起湿衣服", detail: "靠近放在地面的湿衣服，按 E 拿起整批衣物。" };
  if (state.washerPhase === "done") return { step: 3, title: "取出湿衣服", detail: "洗涤已经完成，靠近洗衣机滚筒门按 E 取出整批衣物。" };
  if (state.washerPhase === "washing") {
    const remaining = Math.max(0, Math.ceil(LEVEL.washDuration - state.washElapsed));
    return { step: 2, title: "洗涤中", detail: `洗衣机正在运行，约剩 ${remaining} 秒。等待不会消耗状态余量。` };
  }
  if (state.washerPhase === "ready") return { step: 2, title: "启动洗衣机", detail: "三件衣物已装入，靠近洗衣机控制面板按 E 启动。" };
  if (state.carriedItem) return { step: 1, title: `装入${CLOTHING_META[state.carriedItem].shortName}`, detail: "把这件脏衣服送到卫生间，靠近洗衣机滚筒门按 E。" };
  const remaining = CLOTHING_TYPES.filter((type) => state.clothes[type].location !== "washer").length;
  return { step: 1, title: "收集客厅脏衣服", detail: `客厅还有 ${remaining} 件脏衣服。一次携带一件，逐件送入卫生间洗衣机。` };
}
