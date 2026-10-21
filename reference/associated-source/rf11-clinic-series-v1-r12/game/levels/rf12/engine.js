import { HAZARD_META, HAZARD_TYPES, LEVEL } from "./level.js";
import { applyRobotMovement } from "../../movement.js";

const EPSILON = 1e-6;

export function createInitialState() {
  return {
    player: { ...LEVEL.playerStart },
    carriedItem: null,
    cloth: { location: "counter", x: LEVEL.cloth.x, z: LEVEL.cloth.z },
    hazards: { window: false, gasKnob: false, gasValve: false },
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
  if (state.complete || state.failed || state.settling) return next;
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
  return HAZARD_TYPES.filter(type => !state.hazards[type])
    .map(type => ({ type, point: LEVEL[type], distance: distance(state.player, LEVEL[type]) }))
    .filter(entry => entry.distance <= LEVEL.interactionRange)
    .sort((a,b) => a.distance-b.distance);
}

export function getInteraction(state) {
  if (state.complete || state.failed || state.settling) return null;
  const entry = candidates(state)[0];
  return entry ? { ...entry, label: HAZARD_META[entry.type].label } : null;
}

export function interact(state, selected = null) {
  if (state.complete || state.failed || state.settling) return cloneState(state);
  const interaction = selected ?? getInteraction(state);
  if (selected && !candidates(state).some(entry => entry.type === selected.type)) return cloneState(state);
  const next = cloneState(state);
  next.interactions += 1;
  next.progress = Math.max(0, next.progress - LEVEL.progress.interactionCost);
  if (!interaction) { next.lastEvent = "empty_interaction"; return failIfDepleted(next); }
  if (interaction.type === "gasValve" && !state.hazards.gasKnob) {
    next.lastEvent = "gas_valve_requires_knob";
    return failIfDepleted(next);
  }
  next.hazards[interaction.type] = true;
  next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.hazardReward);
  next.lastEvent = {window:"window_opened",gasKnob:"gas_knob_reset",gasValve:"gas_valve_closed"}[interaction.type];
  if (HAZARD_TYPES.every(type => next.hazards[type])) {
    next.complete = true;
    next.progress = LEVEL.progress.maximum;
    next.lastEvent = "kitchen_safety_complete";
  }
  return failIfDepleted(next);
}

export function closeTerminal(state) { return cloneState(state); }

export function getObjective(state) {
  if (state.failed) return { step: 0, title: "任务失败", detail: "安全余量耗尽，厨房检查终止。" };
  if (state.complete || state.settling) return { step: 3, title: "厨房安全检查完成", detail: "窗户已打开，燃气炉与燃气阀门均已关闭。" };
  const nextType = HAZARD_TYPES.find(type => !state.hazards[type]);
  return { step: HAZARD_TYPES.indexOf(nextType)+1, title: HAZARD_META[nextType].label,
    detail: nextType === "window" ? "走到右侧墙面的推拉窗前，按 F 握住把手开窗。" : "靠近设施后按 F，完成三项检查即可通关。" };
}
export function getTelemetry(state) {
  const count = HAZARD_TYPES.filter(type => state.hazards[type]).length;
  return {system:state.complete ? "SAFE" : `${count}/3 CHECKS`,systemOnline:state.complete,cargo:"EMPTY",gate:`${count}/3 CLEAR`};
}
export function getDebugState(state) { return { hazards:{...state.hazards},complete:state.complete }; }
