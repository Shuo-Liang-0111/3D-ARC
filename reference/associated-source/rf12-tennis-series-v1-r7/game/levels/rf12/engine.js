import { dropPoint } from "./interaction-layout.js";
import { HAZARD_META, HAZARD_TYPES, LEVEL } from "./level.js";
import { applyRobotMovement } from "../../movement.js";

const EPSILON = 1e-6;

export function createInitialState() {
  return {
    player: { ...LEVEL.playerStart },
    carriedItem: null,
    cloth: { location: "counter", x: LEVEL.cloth.x, z: LEVEL.cloth.z },
    hazards: { gasKnob: false, hood: false, cloth: false, window: false, gasValve: false },
    checklistRead: false,
    complete: false,
    failed: false,
    progress: LEVEL.progress.initial,
    motion: "idle",
    elapsed: 0,
    interactions: 0,
    lastEvent: "kitchen_safety_started",
  };
}

export function cloneState(state) {
  return { ...state, player: { ...state.player }, cloth: { ...state.cloth }, hazards: { ...state.hazards } };
}

export function distance(first, second) { return Math.hypot(first.x - second.x, first.z - second.z); }

function overlaps(x, z, radius, rect) {
  const nearX = Math.max(rect.minX, Math.min(x, rect.maxX));
  const nearZ = Math.max(rect.minZ, Math.min(z, rect.maxZ));
  return (x - nearX) ** 2 + (z - nearZ) ** 2 < radius ** 2;
}

export function isWalkable(_state, x, z) {
  const { bounds, playerRadius } = LEVEL;
  if (x - playerRadius < bounds.minX || x + playerRadius > bounds.maxX || z - playerRadius < bounds.minZ || z + playerRadius > bounds.maxZ) return false;
  return !LEVEL.staticColliders.some((rect) => overlaps(x, z, playerRadius, rect));
}

function failIfDepleted(state) {
  if (state.progress > EPSILON || state.complete) return state;
  state.progress = 0;
  state.failed = true;
  state.motion = "idle";
  state.lastEvent = "progress_depleted";
  return state;
}

export function updateMovement(state, input = {}, deltaSeconds = 0) {
  const next = cloneState(state);
  const delta = Math.min(Math.max(deltaSeconds, 0), 0.05);
  next.elapsed += delta;
  if (state.complete || state.failed) return next;
  const movement = applyRobotMovement(next, state, input, delta, LEVEL, isWalkable);
  if (!movement.active) {
    next.motion = state.carriedItem ? "carrying" : "idle";
    return next;
  }
  if (input.drain !== false) next.progress = Math.max(0, state.progress - LEVEL.progress.actionDrainPerSecond * delta);
  next.motion = movement.motionTurning ? "turning" : (state.carriedItem ? "carrying" : "moving");
  return failIfDepleted(next);
}

function candidates(state) {
  const entries = [];
  if (!state.checklistRead) entries.push({ type: "checklist", point: LEVEL.checklist });
  if (state.carriedItem === "cloth" && !state.hazards.cloth) entries.push({ type: "cloth-safe", point: LEVEL.sink });
  if (!state.carriedItem && ["counter", "floor"].includes(state.cloth.location) && !state.hazards.cloth) entries.push({ type: "cloth", point: state.cloth });
  if (!state.carriedItem && !state.hazards.gasKnob) entries.push({ type: "gasKnob", point: LEVEL.gasKnob });
  if (!state.carriedItem && !state.hazards.hood) entries.push({ type: "hood", point: LEVEL.hood });
  if (!state.carriedItem && !state.hazards.window) entries.push({ type: "window", point: LEVEL.window });
  if (!state.carriedItem && !state.hazards.gasValve) entries.push({ type: "gasValve", point: LEVEL.gasValve });
  return entries.map((entry) => ({ ...entry, distance: distance(state.player, entry.point) })).filter((entry) => entry.distance <= LEVEL.interactionRange).sort((first, second) => first.distance - second.distance);
}

export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  const entry = candidates(state)[0];
  if (entry) {
    if (entry.type === "checklist") return { ...entry, label: "读取厨房安全检查单" };
    if (entry.type === "cloth") return { ...entry, label: "拿起炉边湿抹布" };
    if (entry.type === "cloth-safe") return { ...entry, label: "将湿抹布放入水槽" };
    return { ...entry, label: HAZARD_META[entry.type].label };
  }
  if (state.carriedItem) return { type: "drop", label: "放下湿抹布" };
  if (HAZARD_TYPES.every((type) => state.hazards[type]) && state.checklistRead && distance(state.player, LEVEL.terminal) <= LEVEL.interactionRange) return { type: "terminal", point: LEVEL.terminal, distance: distance(state.player, LEVEL.terminal), label: "在入口终端确认完成" };
  return null;
}

export function interact(state, selected = null) {
  if (state.complete || state.failed) return cloneState(state);
  const current = getInteraction(state);
  const interaction = selected && typeof selected === "object" ? selected : current;
  if (selected && typeof selected === "object" && !candidates(state).some(entry=>entry.type===selected.type) && selected.type !== current?.type) return cloneState(state);
  const next = cloneState(state);
  next.interactions += 1;
  next.progress = Math.max(0, next.progress - LEVEL.progress.interactionCost);
  if (!interaction) { next.lastEvent = "empty_interaction"; return failIfDepleted(next); }
  if (interaction.type === "checklist") {
    next.checklistRead = true;
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + 4);
    next.lastEvent = "checklist_read";
  } else if (interaction.type === "cloth") {
    next.carriedItem = "cloth";
    next.cloth = { location: "carried", x: next.player.x, z: next.player.z };
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + 8);
    next.lastEvent = "cloth_collected";
  } else if (interaction.type === "cloth-safe") {
    next.carriedItem = null;
    next.cloth = { location: "sink", x: LEVEL.sink.x, z: LEVEL.sink.z };
    next.hazards.cloth = true;
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.hazardReward);
    next.lastEvent = "cloth_secured";
  } else if (interaction.type === "drop") {
    next.cloth = { location: "floor", ...(interaction.releasePoint ?? dropPoint(next,isWalkable)) };
    next.carriedItem = null;
    next.lastEvent = "cloth_dropped";
  } else if (interaction.type === "gasKnob") {
    next.hazards.gasKnob = true;
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.hazardReward);
    next.lastEvent = "gas_knob_reset";
  } else if (interaction.type === "hood") {
    next.hazards.hood = true;
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.hazardReward);
    next.lastEvent = "hood_started";
  } else if (interaction.type === "window") {
    next.hazards.window = true;
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.hazardReward);
    next.lastEvent = "window_opened";
  } else if (interaction.type === "gasValve") {
    if (!next.hazards.gasKnob) next.lastEvent = "gas_valve_requires_knob";
    else {
      next.hazards.gasValve = true;
      next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.hazardReward);
      next.lastEvent = "gas_valve_closed";
    }
  } else if (interaction.type === "terminal") {
    next.complete = true;
    next.progress = LEVEL.progress.maximum;
    next.lastEvent = "kitchen_safety_complete";
  }
  return failIfDepleted(next);
}

export function closeTerminal(state) { return cloneState(state); }

export function getObjective(state) {
  if (state.failed) return { step: 0, title: "任务失败", detail: "安全余量耗尽，厨房检查终止。" };
  if (state.complete) return { step: 6, title: "厨房安全检查完成", detail: "五项家庭厨房风险已全部消除。" };
  if (!state.checklistRead) return { step: 1, title: "读取安全检查单", detail: "先读取入口旁的厨房安全检查单。" };
  const nextType = HAZARD_TYPES.find((type) => !state.hazards[type]);
  if (nextType === "cloth") return { step: 4, title: "移开炉边湿抹布", detail: state.carriedItem ? "把湿抹布放入水槽，避免靠近明火。" : "先拿起灶台旁的湿抹布，再放入水槽。" };
  if (nextType) { const step = { gasKnob: 2, hood: 3, window: 5, gasValve: 6 }[nextType] ?? 2; return { step, title: HAZARD_META[nextType].label, detail: nextType === "gasValve" ? "确认灶台、排烟、抹布和通风均已处理后关闭总阀。" : "按安全检查单顺序靠近设施后按 F。" }; }
  return { step: 5, title: "回到入口确认", detail: "所有风险已处理，回到入口终端确认。" };
}

export function getTelemetry(state) {
  const count = HAZARD_TYPES.filter((type) => state.hazards[type]).length;
  return { system: state.complete ? "SAFE" : `${count}/5 HAZARDS`, systemOnline: state.complete, cargo: state.carriedItem ? "WET CLOTH" : "EMPTY", gate: `${count}/5 CLEAR` };
}

export function getDebugState(state) { return { checklistRead: state.checklistRead, hazards: { ...state.hazards }, cloth: state.cloth.location, carriedItem: state.carriedItem }; }
