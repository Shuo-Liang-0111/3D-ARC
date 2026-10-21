import { DEVICE_META, DEVICE_TYPES, LEVEL } from "./level.js";
import { applyRobotMovement } from "../../movement.js";

const EPSILON = 1e-6;

export function createInitialState() {
  return {
    player: { ...LEVEL.playerStart },
    devices: Object.fromEntries(DEVICE_TYPES.map((type) => [type, { type, location: "office", ...LEVEL.devices[type] }])),
    carriedItem: null,
    installedDevices: [],
    rewardedPickups: Object.fromEntries(DEVICE_TYPES.map((type) => [type, false])),
    rewardedInstalls: Object.fromEntries(DEVICE_TYPES.map((type) => [type, false])),
    terminalOpen: false,
    presentationReady: false,
    complete: false,
    failed: false,
    progress: LEVEL.progress.initial,
    motion: "idle",
    elapsed: 0,
    interactions: 0,
    lastEvent: "meeting_setup_started",
  };
}

export function cloneState(state) {
  return {
    ...state,
    player: { ...state.player },
    devices: Object.fromEntries(DEVICE_TYPES.map((type) => [type, { ...state.devices[type] }])),
    installedDevices: [...state.installedDevices],
    rewardedPickups: { ...state.rewardedPickups },
    rewardedInstalls: { ...state.rewardedInstalls },
  };
}

export function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function circleOverlapsRect(x, z, radius, rect) { const nearX = Math.max(rect.minX, Math.min(x, rect.maxX)); const nearZ = Math.max(rect.minZ, Math.min(z, rect.maxZ)); return (x - nearX) ** 2 + (z - nearZ) ** 2 < radius ** 2; }
export function isWalkable(_state, x, z) {
  const { bounds, playerRadius } = LEVEL;
  if (x - playerRadius < bounds.minX || x + playerRadius > bounds.maxX || z - playerRadius < bounds.minZ || z + playerRadius > bounds.maxZ) return false;
  return !LEVEL.staticColliders.some((rect) => circleOverlapsRect(x, z, playerRadius, rect));
}
function failIfDepleted(state) { if (state.progress > EPSILON || state.complete) return state; state.progress = 0; state.failed = true; state.motion = "idle"; state.terminalOpen = false; state.lastEvent = "progress_depleted"; return state; }
function nearby(state, point) { return distance(state.player, point) <= LEVEL.interactionRange; }
function exactOrder(devices) { return devices.length === LEVEL.requiredOrder.length && devices.every((type, index) => type === LEVEL.requiredOrder[index]); }

export function updateMovement(state, input, deltaSeconds) {
  const next = cloneState(state);
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
  next.elapsed += dt;
  if (state.complete || state.failed || state.terminalOpen) return next;
  const movement = applyRobotMovement(next, state, input, dt, LEVEL, isWalkable);
  if (!movement.active) {
    next.motion = state.carriedItem ? "carrying" : "idle";
    return next;
  }
  if (input.drain !== false) next.progress = Math.max(0, state.progress - LEVEL.progress.actionDrainPerSecond * dt);
  next.motion = movement.motionTurning ? "turning" : (state.carriedItem ? "carrying" : "moving");
  return failIfDepleted(next);
}

export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  if (state.terminalOpen) return { type: "presentation-start", label: "启动会议演示" };
  if (state.carriedItem) {
    if (nearby(state, LEVEL.podium)) return { type: "podium-install", itemType: state.carriedItem, label: `将${DEVICE_META[state.carriedItem].shortName}放到讲台` };
    return { type: "drop", itemType: state.carriedItem, label: `放下${DEVICE_META[state.carriedItem].shortName}` };
  }
  const device = DEVICE_TYPES.map((type) => ({ type: "device", itemType: type, distance: distance(state.player, state.devices[type]) }))
    .filter((candidate) => ["office", "floor"].includes(state.devices[candidate.itemType].location) && candidate.distance <= LEVEL.interactionRange)
    .sort((a, b) => a.distance - b.distance)[0];
  if (device) return { ...device, label: `拿起${DEVICE_META[device.itemType].name}` };
  if (nearby(state, LEVEL.terminal)) return { type: "terminal", label: state.presentationReady ? "打开会议控制终端" : "检查会议控制终端" };
  return null;
}

export function interact(state) {
  if (state.complete || state.failed) return cloneState(state);
  const interaction = getInteraction(state);
  const next = cloneState(state);
  next.interactions += 1;
  next.progress = Math.max(0, next.progress - LEVEL.progress.interactionCost);
  if (!interaction) { next.lastEvent = "empty_interaction"; return failIfDepleted(next); }
  if (interaction.type === "device") {
    const type = interaction.itemType;
    const first = !next.rewardedPickups[type];
    next.carriedItem = type;
    next.devices[type] = { type, location: "carried" };
    next.motion = "carrying";
    if (first) { next.rewardedPickups[type] = true; next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.pickupReward); }
    next.lastEvent = `item_${first ? "collected" : "recollected"}_${type}`;
  } else if (interaction.type === "drop") {
    const type = state.carriedItem;
    next.devices[type] = { type, location: "floor", x: state.player.x, z: state.player.z };
    next.carriedItem = null;
    next.motion = "idle";
    next.lastEvent = `item_dropped_${type}`;
  } else if (interaction.type === "podium-install") {
    const type = state.carriedItem;
    const required = LEVEL.requiredOrder[next.installedDevices.length];
    if (type !== required) next.lastEvent = "device_rejected_order";
    else {
      next.carriedItem = null;
      next.devices[type] = { type, location: "podium", ...LEVEL.podium };
      next.installedDevices.push(type);
      next.motion = "idle";
      if (!next.rewardedInstalls[type]) { next.rewardedInstalls[type] = true; next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.installReward); }
      next.presentationReady = exactOrder(next.installedDevices);
      next.lastEvent = `device_installed_${type}`;
    }
  } else if (interaction.type === "terminal") {
    if (!state.presentationReady) next.lastEvent = "terminal_not_ready";
    else { next.terminalOpen = true; next.lastEvent = "terminal_opened"; }
  } else if (interaction.type === "presentation-start") {
    next.terminalOpen = false;
    next.complete = true;
    next.progress = LEVEL.progress.maximum;
    next.motion = "idle";
    next.lastEvent = "presentation_started";
  }
  return failIfDepleted(next);
}

export function closeTerminal(state) { const next = cloneState(state); next.terminalOpen = false; next.lastEvent = "terminal_closed"; return next; }
export function getObjective(state) {
  if (state.failed) return { step: 0, title: "任务失败", detail: "状态余量耗尽，会议准备终止。" };
  if (state.complete) return { step: 5, title: "会议演示已启动", detail: "视频链路和无线演示器均已就绪。" };
  if (state.terminalOpen) return { step: 4, title: "启动会议演示", detail: "终端检查通过，再按 F 启动演示。" };
  if (state.presentationReady) return { step: 4, title: "打开会议终端", detail: "两件设备已按顺序就位。" };
  if (state.carriedItem) return { step: 3, title: `安装${DEVICE_META[state.carriedItem].shortName}`, detail: `送到会议室讲台；当前需要${DEVICE_META[LEVEL.requiredOrder[state.installedDevices.length]].shortName}。` };
  const required = LEVEL.requiredOrder[state.installedDevices.length];
  return { step: state.installedDevices.length + 1, title: `找到${DEVICE_META[required].shortName}`, detail: required === "adapter" ? "先在西侧行政用品柜取得 USB-C 视频转接器。" : "视频链路已连接，前往东侧 IT 柜取得无线演示器。" };
}
