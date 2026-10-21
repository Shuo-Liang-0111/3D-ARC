import { dropPoint } from "../rf12/interaction-layout.js";
import { applyRobotMovement } from "../../movement.js";
import { LEVEL as BASE_LEVEL } from "../rf12/level.js";
import { LEVEL } from "./level.js";

const EPSILON = 1e-6;

function cloneItems(items) {
  return Object.fromEntries(Object.entries(items).map(([type, item]) => [type, { ...item }]));
}

export function createInitialState() {
  return {
    player: { ...LEVEL.playerStart },
    carriedItem: null,
    items: {
      tomato: { location: "hidden", x: 0, z: 0 },
      tofu: { location: "hidden", x: 0, z: 0 },
      oil: { location: "room", x: LEVEL.taskItem.x, z: LEVEL.taskItem.z },
      pan: { location: "hidden", x: 0, z: 0 },
    },
    checklistRead: false,
    placed: false,
    complete: false,
    failed: false,
    progress: LEVEL.progress.initial,
    motion: "idle",
    elapsed: 0,
    interactions: 0,
    lastEvent: "rf10_2_started",
  };
}

export function cloneState(state) {
  return { ...state, player: { ...state.player }, items: cloneItems(state.items) };
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
  if (!movement.active) {
    next.motion = state.carriedItem ? "carrying" : "idle";
    return next;
  }
  if (input.drain !== false) next.progress = Math.max(0, state.progress - LEVEL.progress.actionDrainPerSecond * delta);
  next.motion = movement.motionTurning ? "turning" : (state.carriedItem ? "carrying" : "moving");
  return failIfDepleted(next);
}

export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  if (!state.checklistRead && distance(state.player, BASE_LEVEL.checklist) <= LEVEL.interactionRange) return { type: "checklist", label: "读取简易备餐提示" };
  if (state.carriedItem === "oil" && distance(state.player, LEVEL.taskTarget) <= LEVEL.interactionRange) return { type: "place", label: "将食用油放到备餐台" };
  if (!state.carriedItem && !state.placed && ["room", "floor"].includes(state.items.oil.location) && distance(state.player, state.items.oil) <= LEVEL.interactionRange) return { type: "pickup", label: "拿起食用油瓶" };
  if (!state.carriedItem && state.placed && distance(state.player, BASE_LEVEL.terminal) <= LEVEL.interactionRange) return { type: "terminal", label: "提交简易任务" };
  if (state.carriedItem) return { type: "drop", label: "放下食用油瓶" };
  return null;
}

export function interact(state, selected = null) {
  if (state.complete || state.failed) return cloneState(state);
  const current = getInteraction(state);
  const interaction = selected && typeof selected === "object" ? selected : current;
  if (selected && typeof selected === "object" && selected.type !== current?.type) return cloneState(state);
  const next = cloneState(state);
  next.interactions += 1;
  next.progress = Math.max(0, next.progress - LEVEL.progress.interactionCost);
  if (!interaction) { next.lastEvent = "empty_interaction"; return failIfDepleted(next); }
  if (interaction.type === "checklist") {
    next.checklistRead = true;
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + 4);
    next.lastEvent = "simple_checklist_read";
  } else if (interaction.type === "pickup") {
    next.carriedItem = "oil";
    next.items.oil = { location: "carried", x: next.player.x, z: next.player.z };
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.pickupReward);
    next.lastEvent = "oil_collected";
  } else if (interaction.type === "place") {
    next.carriedItem = null;
    next.placed = true;
    next.items.oil = { location: "prep", x: LEVEL.taskTarget.x, z: LEVEL.taskTarget.z };
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.placementReward);
    next.lastEvent = "oil_placed";
  } else if (interaction.type === "drop") {
    next.carriedItem = null;
    next.items.oil = { location: "floor", ...(interaction.releasePoint ?? dropPoint(next,isWalkable)) };
    next.lastEvent = "oil_dropped";
  } else if (interaction.type === "terminal") {
    next.complete = true;
    next.progress = LEVEL.progress.maximum;
    next.lastEvent = "simple_kitchen_complete";
  }
  return failIfDepleted(next);
}

export function closeTerminal(state) { return cloneState(state); }

export function getObjective(state) {
  if (state.failed) return { step: 0, title: "任务失败", detail: "状态余量耗尽，简易备餐任务终止。" };
  if (state.complete) return { step: 3, title: "简易任务完成", detail: "食用油已归位，厨房备餐台准备完成。" };
  if (!state.checklistRead) return { step: 1, title: "读取简易备餐提示", detail: "先读取入口旁的简易备餐提示。" };
  if (!state.placed) return { step: 2, title: "归位食用油", detail: state.carriedItem ? "把食用油放到备餐台。" : "从灶台西侧台面拿起食用油瓶。" };
  return { step: 3, title: "提交简易任务", detail: "回到入口终端提交任务。" };
}

export function getTelemetry(state) { return { system: state.complete ? "READY" : "SIMPLE PREP", systemOnline: state.complete, cargo: state.carriedItem ? "OIL BOTTLE" : "EMPTY", gate: state.placed ? "PLACED" : "PENDING" }; }
export function getDebugState(state) { return { checklistRead: state.checklistRead, placed: state.placed, item: state.items.oil.location, carriedItem: state.carriedItem }; }
