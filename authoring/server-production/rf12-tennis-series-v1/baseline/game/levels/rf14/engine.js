import { LEVEL, BALLS, STATIC_COLLIDERS } from "./level.js";
import { applyRobotMovement } from "../../movement.js";

export function createInitialState() {
  return { player: { ...LEVEL.playerStart }, items: Object.fromEntries(BALLS.map(ball => [ball.id, { ...ball, location: "floor" }])), carriedItem: null, delivered: [], complete: false, failed: false, terminalOpen: false, progress: LEVEL.progress.initial, motion: "idle", elapsed: 0, interactions: 0, lastEvent: "court_started" };
}
function cloneState(state) {
  return { ...state, player: { ...state.player }, items: Object.fromEntries(Object.entries(state.items).map(([id, item]) => [id, { ...item }])), delivered: [...state.delivered] };
}
function overlaps(x, z, radius, rectangle) {
  return (x - Math.max(rectangle.minX, Math.min(x, rectangle.maxX))) ** 2 + (z - Math.max(rectangle.minZ, Math.min(z, rectangle.maxZ))) ** 2 < radius ** 2;
}
export function isWalkable(state, x, z) {
  const { playerRadius, playerForwardOffset, bounds } = LEVEL;
  const points = [{ x, z }, { x: x + Math.sin(state.player.yaw) * playerForwardOffset, z: z + Math.cos(state.player.yaw) * playerForwardOffset }];
  return points.every(point => point.x - playerRadius >= bounds.minX && point.x + playerRadius <= bounds.maxX && point.z - playerRadius >= bounds.minZ && point.z + playerRadius <= bounds.maxZ && !STATIC_COLLIDERS.some(rectangle => overlaps(point.x, point.z, playerRadius, rectangle)));
}
export function canReach(state, point) {
  const offsetX = point.x - state.player.x;
  const offsetZ = point.z - state.player.z;
  const distance = Math.hypot(offsetX, offsetZ);
  if (distance > LEVEL.interactionRange) return false;
  if (distance > 0.1 && (Math.sin(state.player.yaw) * offsetX + Math.cos(state.player.yaw) * offsetZ) / distance < 0.25) return false;
  return !STATIC_COLLIDERS.filter(rectangle => rectangle.id !== "cart").some(rectangle => {
    for (let step = 1; step < 32; step += 1) {
      const x = state.player.x + offsetX * step / 32;
      const z = state.player.z + offsetZ * step / 32;
      if (x > rectangle.minX && x < rectangle.maxX && z > rectangle.minZ && z < rectangle.maxZ) return true;
    }
    return false;
  });
}
export function updateMovement(state, input = {}, deltaSeconds = 0) {
  const next = cloneState(state);
  if (state.complete || state.failed) return next;
  const delta = Math.min(0.05, Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
  next.elapsed += delta;
  next.progress = Math.max(0, next.progress - delta * LEVEL.progress.actionDrainPerSecond);
  if (next.progress <= 0) { next.failed = true; next.lastEvent = "progress_depleted"; return next; }
  const movement = applyRobotMovement(next, state, input, delta, LEVEL, isWalkable);
  next.motion = movement.motionTurning ? "turning" : state.carriedItem ? "carrying" : movement.translating ? "moving" : "idle";
  return next;
}
export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  if (state.carriedItem) return canReach(state, LEVEL.cart) ? { type: "deliver", label: "将网球放入球车" } : { type: "drop", label: "放下网球" };
  const nearest = Object.values(state.items).filter(item => item.location === "floor" && canReach(state, item)).sort((left, right) => Math.hypot(left.x - state.player.x, left.z - state.player.z) - Math.hypot(right.x - state.player.x, right.z - state.player.z))[0];
  return nearest ? { type: "pickup", item: nearest.id, label: `捡起${nearest.name}` } : null;
}
export function interact(state) {
  const next = cloneState(state);
  const interaction = getInteraction(state);
  if (!interaction) {
    if (!state.complete) {
      next.progress = Math.max(0, next.progress - LEVEL.progress.invalidInteractionDrain);
      next.failed = next.progress <= 0;
      next.lastEvent = next.failed ? "progress_depleted" : "empty_interaction";
    }
    return next;
  }
  next.interactions += 1;
  next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.correctInteractionReward);
  if (interaction.type === "pickup") {
    next.carriedItem = interaction.item;
    next.items[interaction.item].location = "carried";
    next.lastEvent = "battery_collected";
  } else if (interaction.type === "deliver") {
    const index = next.delivered.length;
    Object.assign(next.items[state.carriedItem], { location: "delivered", x: LEVEL.cart.x + ((index % 3) - 1) * 0.09, y: 0.64, z: LEVEL.cart.z + (Math.floor(index / 3) - 1) * 0.09 });
    next.delivered.push(state.carriedItem);
    next.carriedItem = null;
    next.complete = next.delivered.length === BALLS.length;
    next.lastEvent = "power_restored";
  } else {
    const point = { x: state.player.x + Math.sin(state.player.yaw) * 0.78, z: state.player.z + Math.cos(state.player.yaw) * 0.78 };
    if (point.x < -9.8 || point.x > 9.8 || point.z < -18.8 || point.z > 21.8 || !canReach(state, point) || STATIC_COLLIDERS.some(rectangle => overlaps(point.x, point.z, 0.07, rectangle))) {
      next.lastEvent = "drop_blocked";
      return next;
    }
    Object.assign(next.items[state.carriedItem], { ...point, y: Math.abs(point.x) <= 5.485 && Math.abs(point.z) <= 11.885 ? 0.004 : 0, location: "floor" });
    next.carriedItem = null;
    next.lastEvent = "battery_dropped";
  }
  next.motion = next.carriedItem ? "carrying" : "idle";
  return next;
}
export function closeTerminal(state) { return cloneState(state); }
export function getObjective(state) {
  if (state.complete) return { step: 3, title: "球场收拾完成", detail: "8 颗网球全部归筐，球场可以再次使用。" };
  if (state.carriedItem) return { step: 2, title: `送回东侧球车 · ${state.delivered.length}/8`, detail: "靠近休息区的球车，面向球车按 F。球网两端均可绕行。" };
  return { step: 1, title: `收集散落网球 · ${state.delivered.length}/8`, detail: "沿球场寻找黄绿色网球，靠近并面向它按 F；方向键上下调整观察角度。" };
}
