import { applyRobotMovement } from "../../movement.js";
import { LEVEL as BASE_LEVEL } from "../rf12/level.js";
import { LEVEL } from "./level.js";

const EPSILON = 1e-6;

export function createInitialState() {
  return {
    player: { ...LEVEL.playerStart },
    carriedItem: null,
    pan: { location: "room", x: LEVEL.pan.x, z: LEVEL.pan.z },
    extinguisher: { location: "station", x: LEVEL.extinguisher.x, z: LEVEL.extinguisher.z },
    hoodOn: false,
    burnerOn: false,
    panOnBurner: false,
    fireActive: false,
    cookElapsed: 0,
    cookAttempts: 0,
    complete: false,
    failed: false,
    progress: LEVEL.progress.initial,
    motion: "idle",
    elapsed: 0,
    interactions: 0,
    lastEvent: "rf10_3_started",
  };
}

export function cloneState(state) { return { ...state, player: { ...state.player }, pan: { ...state.pan }, extinguisher: { ...state.extinguisher } }; }
export function distance(first, second) { return Math.hypot(first.x - second.x, first.z - second.z); }

function overlaps(x, z, radius, rect) {
  const nearX = Math.max(rect.minX, Math.min(x, rect.maxX));
  const nearZ = Math.max(rect.minZ, Math.min(z, rect.maxZ));
  return (x - nearX) ** 2 + (z - nearZ) ** 2 < radius ** 2;
}

export function isWalkable(_state, x, z) {
  const { bounds, playerRadius } = LEVEL;
  if (x - playerRadius < bounds.minX || x + playerRadius > bounds.maxX || z - playerRadius < bounds.minZ || z + playerRadius > bounds.maxZ) return false;
  return !BASE_LEVEL.staticColliders.some((rect) => overlaps(x, z, playerRadius, rect));
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
  if (movement.active && input.drain !== false) next.progress = Math.max(0, state.progress - LEVEL.progress.actionDrainPerSecond * delta);
  next.motion = movement.active ? (movement.motionTurning ? "turning" : (state.carriedItem ? "carrying" : "moving")) : (state.carriedItem ? "carrying" : "idle");
  if (state.burnerOn) {
    next.cookElapsed += delta;
    if (next.cookElapsed > LEVEL.cookWindow.max) {
      next.burnerOn = false;
      next.fireActive = true;
      next.carriedItem = null;
      next.lastEvent = "kitchen_fire_started";
    }
  }
  return failIfDepleted(next);
}

export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  if (state.fireActive) {
    if (state.carriedItem === "extinguisher" && distance(state.player, LEVEL.burner) <= LEVEL.interactionRange) return { type: "extinguish", label: "使用灭火器灭火" };
    if (!state.carriedItem && state.extinguisher.location === "station" && distance(state.player, LEVEL.extinguisher) <= LEVEL.interactionRange) return { type: "pickup-extinguisher", label: "拿起灭火器" };
    return state.carriedItem ? { type: "drop", label: "放下灭火器" } : null;
  }
  if (state.carriedItem === "pan" && distance(state.player, LEVEL.burner) <= LEVEL.interactionRange) return { type: "place-pan", label: "将平底锅放到炉头" };
  if (state.carriedItem) return { type: "drop", label: "放下平底锅" };
  if (!state.panOnBurner && state.pan.location === "room" && distance(state.player, LEVEL.pan) <= LEVEL.interactionRange) return { type: "pickup-pan", label: "拿起平底锅" };
  if (!state.hoodOn && distance(state.player, LEVEL.hoodSwitch) <= LEVEL.interactionRange) return { type: "hood", label: "开启油烟机" };
  if (state.hoodOn && state.panOnBurner && !state.burnerOn && distance(state.player, LEVEL.burner) <= LEVEL.interactionRange) return { type: "burner-on", label: "开启炉头" };
  if (state.burnerOn && distance(state.player, LEVEL.burner) <= LEVEL.interactionRange) return { type: "burner-off", label: "关闭炉头" };
  return null;
}

export function interact(state) {
  if (state.complete || state.failed) return cloneState(state);
  const interaction = getInteraction(state);
  const next = cloneState(state);
  next.interactions += 1;
  next.progress = Math.max(0, next.progress - LEVEL.progress.interactionCost);
  if (!interaction) { next.lastEvent = "empty_interaction"; return failIfDepleted(next); }
  if (interaction.type === "pickup-pan") {
    next.carriedItem = "pan";
    next.pan = { location: "carried", x: next.player.x, z: next.player.z };
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.pickupReward);
    next.lastEvent = "pan_collected";
  } else if (interaction.type === "place-pan") {
    next.carriedItem = null;
    next.panOnBurner = true;
    next.pan = { location: "burner", x: LEVEL.burner.x, z: LEVEL.burner.z };
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.panReward);
    next.lastEvent = "pan_on_burner";
  } else if (interaction.type === "hood") {
    next.hoodOn = true;
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.hoodReward);
    next.lastEvent = "hood_started";
  } else if (interaction.type === "burner-on") {
    next.burnerOn = true;
    next.cookElapsed = 0;
    next.cookAttempts += 1;
    next.lastEvent = "cooking_started";
  } else if (interaction.type === "burner-off") {
    next.burnerOn = false;
    if (next.cookElapsed < LEVEL.cookWindow.min) {
      next.cookElapsed = 0;
      next.lastEvent = "cooking_too_early_restart";
    } else if (next.cookElapsed <= LEVEL.cookWindow.max) {
      next.complete = true;
      next.progress = LEVEL.progress.maximum;
      next.lastEvent = "cooking_completed";
    }
  } else if (interaction.type === "pickup-extinguisher") {
    next.carriedItem = "extinguisher";
    next.extinguisher = { location: "carried", x: next.player.x, z: next.player.z };
    next.lastEvent = "extinguisher_collected";
  } else if (interaction.type === "extinguish") {
    next.carriedItem = null;
    next.extinguisher = { location: "station", x: LEVEL.extinguisher.x, z: LEVEL.extinguisher.z };
    next.fireActive = false;
    next.hoodOn = false;
    next.burnerOn = false;
    next.panOnBurner = true;
    next.pan = { location: "burner", x: LEVEL.burner.x, z: LEVEL.burner.z };
    next.cookElapsed = 0;
    next.lastEvent = "fire_extinguished_restart_required";
  } else if (interaction.type === "drop") {
    if (next.carriedItem === "pan") next.pan = { location: "floor", x: next.player.x, z: next.player.z };
    else next.extinguisher = { location: "floor", x: next.player.x, z: next.player.z };
    next.carriedItem = null;
    next.lastEvent = "item_dropped";
  }
  return failIfDepleted(next);
}

export function closeTerminal(state) { return cloneState(state); }

export function getObjective(state) {
  if (state.failed) return { step: 0, title: "任务失败", detail: "状态余量耗尽，烹饪任务终止。" };
  if (state.complete) return { step: 4, title: "烹饪完成", detail: "炉头已在 60 ± 5 秒窗口内关闭。" };
  if (state.fireActive) return { step: 3, title: "厨房着火", detail: "拿起灭火器扑灭火焰，然后重新开启油烟机并重新计时。" };
  if (!state.panOnBurner) return { step: 1, title: "放置平底锅", detail: state.carriedItem ? "把平底锅放到炉头。" : "拿起灶台旁的平底锅。" };
  if (!state.hoodOn) return { step: 2, title: "开启油烟机", detail: "点火前先开启油烟机。" };
  if (!state.burnerOn) return { step: 3, title: "开启炉头", detail: "开启炉头，开始 60 ± 5 秒烹饪计时。" };
  return { step: 3, title: "控制火候", detail: `已烹饪 ${state.cookElapsed.toFixed(1)} 秒，必须在 55–65 秒内关火。` };
}

export function getTelemetry(state) {
  const timer = state.burnerOn ? `${state.cookElapsed.toFixed(1)}s` : state.fireActive ? "FIRE" : state.complete ? "DONE" : "READY";
  return { system: state.fireActive ? "FIRE" : state.burnerOn ? "COOKING" : "KITCHEN", systemOnline: state.complete, cargo: state.carriedItem ? state.carriedItem.toUpperCase() : "EMPTY", gate: timer };
}

export function getDebugState(state) { return { hoodOn: state.hoodOn, burnerOn: state.burnerOn, panOnBurner: state.panOnBurner, cookElapsed: state.cookElapsed, cookAttempts: state.cookAttempts, fireActive: state.fireActive, carriedItem: state.carriedItem, complete: state.complete }; }
