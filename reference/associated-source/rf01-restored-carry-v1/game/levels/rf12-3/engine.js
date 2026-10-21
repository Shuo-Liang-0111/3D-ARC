import { dropPoint } from "../rf12/interaction-layout.js";
import { applyRobotMovement } from "../../movement.js";
import { LEVEL as BASE_LEVEL } from "../rf12/level.js";
import { LEVEL } from "./level.js";

const EPSILON = 1e-6;

export function createInitialState() {
  return {
    player: { ...LEVEL.playerStart },
    carriedItem: null,
    kettle: { location: "room", x: LEVEL.kettle.x, z: LEVEL.kettle.z },
    extinguisher: { location: "station", x: LEVEL.extinguisher.x, z: LEVEL.extinguisher.z },
    waterFilled: false,
    refillRequired: false,
    burnerOn: false,
    kettleOnBurner: false,
    fireActive: false,
    fireElapsed: 0,
    failureReason: null,
    extinguisherReleasePending: false,
    boilElapsed: 0,
    boilAttempts: 0,
    complete: false,
    failed: false,
    progress: LEVEL.progress.initial,
    motion: "idle",
    elapsed: 0,
    interactions: 0,
    lastEvent: "rf10_3_started",
  };
}

export function cloneState(state) { return { ...state, player: { ...state.player }, kettle: { ...state.kettle }, extinguisher: { ...state.extinguisher } }; }
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
  if (state.progress > EPSILON || state.complete || state.failed) return state;
  state.progress = 0;
  state.failed = true;
  state.motion = "idle";
  state.failureReason = "progress_depleted";
  state.lastEvent = "progress_depleted";
  return state;
}

export function updateMovement(state, input = {}, deltaSeconds = 0) {
  const next = cloneState(state);
  const delta = Math.min(Math.max(deltaSeconds, 0), 0.05);
  next.elapsed += input.environmentClock ? 0 : delta;
  if (state.complete || state.failed) return next;
  const movement = applyRobotMovement(next, state, input, delta, LEVEL, isWalkable);
  if (movement.active && input.drain !== false) next.progress = Math.max(0, state.progress - LEVEL.progress.actionDrainPerSecond * delta);
  next.motion = movement.active ? (movement.motionTurning ? "turning" : (state.carriedItem ? "carrying" : "moving")) : (state.carriedItem ? "carrying" : "idle");
  tickBoiling(next, state, Math.max(0,input.clockDelta ?? deltaSeconds));
  return failIfDepleted(next);
}

function tickBoiling(next, state, seconds) {
 if (state.complete || state.failed || state.settling) return;
 if (state.fireActive) next.fireElapsed = (state.fireElapsed ?? 0) + seconds;
 else if (state.burnerOn) {
  next.boilElapsed += seconds;
  if (next.boilElapsed > LEVEL.boilWindow.max + EPSILON) {
   next.burnerOn=false;next.fireActive=true;next.waterFilled=false;next.refillRequired=true;
   // Account for time beyond ignition, including a delayed/background frame.
   next.fireElapsed=next.boilElapsed-LEVEL.boilWindow.max;
   next.lastEvent="kitchen_fire_started";
  }
 }
 if (next.fireActive && next.fireElapsed >= LEVEL.fireLimitSeconds - EPSILON) {
  next.fireElapsed=LEVEL.fireLimitSeconds;
  next.failed=true;next.motion="idle";
  next.failureReason=next.lastEvent="fire_timeout";
 }
}
export function updateEnvironment(state, seconds=0) {
 const next=cloneState(state);
 if(state.complete||state.failed)return next;
 const dt=Math.max(0,seconds);next.elapsed+=dt;tickBoiling(next,state,dt);
 return next;
}

export function isBoiling(state) {
  return state.burnerOn && state.waterFilled && !state.fireActive
    && state.boilElapsed >= LEVEL.boilWindow.min - EPSILON
    && state.boilElapsed <= LEVEL.boilWindow.max + EPSILON;
}

export function getInteraction(state) {
  if (state.complete || state.failed || state.settling) return null;
  if (state.fireActive) {
    if (state.carriedItem === "extinguisher" && distance(state.player, LEVEL.burner) <= LEVEL.interactionRange) return { type: "extinguish", label: "使用灭火器灭火" };
    if (!state.carriedItem && ["station", "floor"].includes(state.extinguisher.location) && distance(state.player, state.extinguisher) <= LEVEL.interactionRange) return { type: "pickup-extinguisher", label: "拿起灭火器" };
    return state.carriedItem ? { type: "drop", label: "放下手中物品" } : null;
  }
  if (state.carriedItem === "kettle") {
    if (!state.waterFilled && distance(state.player, LEVEL.fill) <= LEVEL.interactionRange) return { type: "fill-kettle", label: state.refillRequired ? "重新装水" : "将水壶装满水" };
    if (state.waterFilled && distance(state.player, LEVEL.burner) <= LEVEL.interactionRange) return { type: "place-kettle", label: "将水壶放到炉头" };
    return { type: "drop", label: "放下水壶" };
  }
  if (state.carriedItem) return { type: "drop", label: "放下手中物品" };
  if (state.burnerOn && distance(state.player, LEVEL.burner) <= LEVEL.interactionRange) return { type: "burner-off", label: "关闭炉头" };
  if (state.kettleOnBurner && state.waterFilled && !state.burnerOn && distance(state.player, LEVEL.burner) <= LEVEL.interactionRange) return { type: "burner-on", label: "开启炉头烧水" };
  if (!state.burnerOn && ["room", "floor", "burner"].includes(state.kettle.location) && distance(state.player, state.kettle) <= LEVEL.interactionRange) return { type: "pickup-kettle", label: state.refillRequired ? "取下水壶，重新装水" : "拿起水壶" };
  return null;
}

export function interact(state, selected = null) {
  if (state.complete || state.failed || state.settling) return cloneState(state);
  const current = getInteraction(state);
  const interaction = selected && typeof selected === "object" ? selected : current;
  if (selected && typeof selected === "object" && selected.type !== current?.type) return cloneState(state);
  const next = cloneState(state);
  next.interactions += 1;
  // The automatic cylinder release completes the already charged extinguish action.
  const releaseAfterSpray = interaction?.type === "drop" && state.extinguisherReleasePending && state.carriedItem === "extinguisher";
  if (!releaseAfterSpray) next.progress = Math.max(0, next.progress - LEVEL.progress.interactionCost);
  if (!interaction) { next.lastEvent = "empty_interaction"; return failIfDepleted(next); }
  if (interaction.type === "pickup-kettle") {
    next.carriedItem = "kettle";
    next.kettleOnBurner = false;
    next.kettle = { location: "carried", x: next.player.x, z: next.player.z };
    next.lastEvent = "kettle_collected";
  } else if (interaction.type === "fill-kettle") {
    next.waterFilled = true;
    next.refillRequired = false;
    next.boilElapsed = 0;
    next.lastEvent = "kettle_filled";
  } else if (interaction.type === "place-kettle") {
    next.carriedItem = null;
    next.kettleOnBurner = true;
    next.kettle = { location: "burner", x: LEVEL.burner.x, z: LEVEL.burner.z };
    next.lastEvent = "kettle_on_burner";
  } else if (interaction.type === "burner-on") {
    next.burnerOn = true;
    next.boilElapsed = 0;
    next.boilAttempts += 1;
    next.lastEvent = "boiling_started";
  } else if (interaction.type === "burner-off") {
    next.burnerOn = false;
    if (next.boilElapsed < LEVEL.boilWindow.min - EPSILON) {
      next.boilElapsed = 0;
      next.lastEvent = "boiling_too_early_restart";
    } else if (next.boilElapsed <= LEVEL.boilWindow.max + EPSILON) {
      next.complete = true;
      next.progress = LEVEL.progress.maximum;
      next.lastEvent = "boiling_completed";
    }
  } else if (interaction.type === "pickup-extinguisher") {
    next.carriedItem = "extinguisher";
    next.extinguisher = { location: "carried", x: next.player.x, z: next.player.z };
    next.lastEvent = "extinguisher_collected";
  } else if (interaction.type === "extinguish") {
    // Spray completion owns fire recovery; the cylinder may be released afterwards.
    next.extinguisherReleasePending = Boolean(interaction.holdAfter);
    if (!interaction.holdAfter) {
      next.carriedItem = null;
      next.extinguisher = { location: "floor", ...(interaction.releasePoint ?? dropPoint(next,isWalkable)) };
    }
    next.fireActive = false;
    next.fireElapsed = 0;
    next.burnerOn = false;
    next.waterFilled = false;
    next.refillRequired = true;
    next.boilElapsed = 0;
    next.lastEvent = "fire_extinguished_refill_required";
  } else if (interaction.type === "drop") {
    next.extinguisherReleasePending = false;
    next[next.carriedItem] = { location: "floor", ...(interaction.releasePoint ?? dropPoint(next,isWalkable)) };
    next.carriedItem = null;
    next.lastEvent = "item_dropped";
  }
  return failIfDepleted(next);
}

export function closeTerminal(state) { return cloneState(state); }

export function getObjective(state) {
  if (state.failed) return { step: 0, title: "任务失败", detail: getFailureMessage(state) };
  if (state.complete || state.settling) return { step: 5, title: "烧水完成", detail: "水已烧开，炉头已在 55–65 秒内关闭。" };
  if (state.fireActive) return { step: 4, title: "厨房着火", detail: `剩余 ${Math.max(0,LEVEL.fireLimitSeconds-state.fireElapsed).toFixed(1)} 秒灭火，超时任务失败；灭火后重新装水再烧。` };
  if (!state.waterFilled) return { step: state.carriedItem === "kettle" ? 2 : 1, title: state.refillRequired ? "重新装水" : "取水壶并装水", detail: state.carriedItem === "kettle" ? "靠近水槽，按 F 持壶接水。" : state.refillRequired ? "从炉头取下水壶，到水槽重新装水。" : "拿起台面上的水壶，到水槽装水。" };
  if (!state.kettleOnBurner) return { step: 3, title: "放置水壶", detail: state.carriedItem === "kettle" ? "将装满水的水壶放到炉头。" : "拿起水壶，将它放到炉头。" };
  if (!state.burnerOn) return { step: 4, title: "开启炉头", detail: state.lastEvent === "boiling_too_early_restart" ? "关火过早，水仍在壶内；重新点火，从零计时。" : "开启炉头，开始烧水计时。" };
  return { step: 5, title: isBoiling(state) ? "水已沸腾 · 立即关火" : "等待水烧开", detail: `已加热 ${state.boilElapsed.toFixed(1)} 秒，必须在 55–65 秒内关火。` };
}

export function getTelemetry(state) {
  const timer = state.burnerOn ? `${state.boilElapsed.toFixed(1)}s` : state.fireActive ? `灭火 ${Math.max(0,LEVEL.fireLimitSeconds-state.fireElapsed).toFixed(1)}s` : state.complete ? "DONE" : "READY";
  return { system: state.failed ? "FAILED" : state.fireActive ? "FIRE" : isBoiling(state) ? "BOILING" : state.burnerOn ? "HEATING" : "KITCHEN", systemOnline: state.complete, cargo: state.carriedItem ? state.carriedItem.toUpperCase() : "EMPTY", gate: timer };
}

export function getDebugState(state) { return { burnerOn: state.burnerOn, kettleOnBurner: state.kettleOnBurner, waterFilled: state.waterFilled, refillRequired: state.refillRequired, boilElapsed: state.boilElapsed, boilAttempts: state.boilAttempts, boiling: isBoiling(state), fireActive: state.fireActive, fireElapsed: state.fireElapsed, failureReason: state.failureReason, carriedItem: state.carriedItem, complete: state.complete }; }

export function getFailureMessage(state) {
 return state.failureReason === "fire_timeout"
  ? "着火后 60 秒内未能灭火，任务失败。"
  : "状态余量耗尽，烧水任务终止。";
}
