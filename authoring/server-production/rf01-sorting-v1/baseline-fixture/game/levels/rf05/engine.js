import { ITEM_META, ITEM_TYPES, LEVEL, TARGET_META } from "./level.js";
import { applyRobotMovement } from "../../movement.js";

const EPSILON = 1e-6;
export function createInitialState() {
  return { player: { ...LEVEL.playerStart }, items: Object.fromEntries(ITEM_TYPES.map((type) => [type, { type, location: "room", ...LEVEL.items[type] }])), carriedItem: null, rewardedPickups: Object.fromEntries(ITEM_TYPES.map((type) => [type, false])), rewardedDeliveries: Object.fromEntries(ITEM_TYPES.map((type) => [type, false])), complete: false, failed: false, progress: LEVEL.progress.initial, motion: "idle", elapsed: 0, interactions: 0, lastEvent: "hotel_reset_started" };
}
export function cloneState(state) { return { ...state, player: { ...state.player }, items: Object.fromEntries(ITEM_TYPES.map((type) => [type, { ...state.items[type] }])), rewardedPickups: { ...state.rewardedPickups }, rewardedDeliveries: { ...state.rewardedDeliveries } }; }
export function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function circleOverlapsRect(x, z, radius, rect) { const nearX = Math.max(rect.minX, Math.min(x, rect.maxX)); const nearZ = Math.max(rect.minZ, Math.min(z, rect.maxZ)); return (x - nearX) ** 2 + (z - nearZ) ** 2 < radius ** 2; }
export function isWalkable(_state, x, z) { const { bounds, playerRadius } = LEVEL; if (x - playerRadius < bounds.minX || x + playerRadius > bounds.maxX || z - playerRadius < bounds.minZ || z + playerRadius > bounds.maxZ) return false; return !LEVEL.staticColliders.some((rect) => circleOverlapsRect(x, z, playerRadius, rect)); }
function failIfDepleted(state) { if (state.progress > EPSILON || state.complete) return state; state.progress = 0; state.failed = true; state.motion = "idle"; state.lastEvent = "progress_depleted"; return state; }
function targetCandidates(state) { return Object.entries(LEVEL.targets).map(([target, point]) => ({ type: "target", target, distance: distance(state.player, point) })).filter((candidate) => candidate.distance <= LEVEL.interactionRange); }
export function updateMovement(state, input, deltaSeconds) {
  const next = cloneState(state); const dt = Math.min(Math.max(deltaSeconds, 0), 0.05); next.elapsed += dt;
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
export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  if (!state.carriedItem) {
    const item = ITEM_TYPES.map((type) => ({ type: "item", itemType: type, distance: distance(state.player, state.items[type]) })).filter((candidate) => ["room", "floor"].includes(state.items[candidate.itemType].location) && candidate.distance <= LEVEL.interactionRange).sort((a, b) => a.distance - b.distance)[0];
    if (item) return { ...item, label: `拿起${ITEM_META[item.itemType].name}` };
  } else {
    const target = targetCandidates(state).sort((a, b) => a.distance - b.distance)[0];
    if (target) return { ...target, label: `放入${TARGET_META[target.target].name}` };
  }
  if (state.carriedItem) return { type: "drop", label: `放下${ITEM_META[state.carriedItem].shortName}` };
  return null;
}
export function interact(state) {
  if (state.complete || state.failed) return cloneState(state);
  const interaction = getInteraction(state); const next = cloneState(state); next.interactions += 1; next.progress = Math.max(0, next.progress - LEVEL.progress.interactionCost);
  if (!interaction) { next.lastEvent = "empty_interaction"; return failIfDepleted(next); }
  if (interaction.type === "item") {
    const item = interaction.itemType; next.carriedItem = item; next.items[item] = { type: item, location: "carried" }; next.motion = "carrying";
    const first = !next.rewardedPickups[item]; if (first) { next.rewardedPickups[item] = true; next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.pickupReward); }
    next.lastEvent = `${first ? "item_collected" : "item_recollected"}_${item}`;
  } else if (interaction.type === "drop") {
    const item = state.carriedItem; next.items[item] = { type: item, location: "floor", x: state.player.x, z: state.player.z }; next.carriedItem = null; next.motion = "idle"; next.lastEvent = `item_dropped_${item}`;
  } else if (interaction.type === "target") {
    const item = state.carriedItem; const expected = LEVEL.itemTargets[item];
    if (interaction.target !== expected) next.lastEvent = "wrong_target";
    else { next.items[item] = { type: item, location: interaction.target, ...LEVEL.targets[interaction.target] }; next.carriedItem = null; next.motion = "idle"; if (!next.rewardedDeliveries[item]) { next.rewardedDeliveries[item] = true; next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.correctDeliveryReward); } next.lastEvent = `item_delivered_${item}`; if (ITEM_TYPES.every((type) => ["laundry", "cart", "bin"].includes(next.items[type].location))) { next.complete = true; next.progress = LEVEL.progress.maximum; next.lastEvent = "room_reset_complete"; } }
  }
  return failIfDepleted(next);
}
export function closeTerminal(state) { return cloneState(state); }
export function getObjective(state) { if (state.failed) return { step: 0, title: "任务失败", detail: "状态余量已耗尽，客房整理终止。" }; if (state.complete) return { step: 4, title: "客房整理完成", detail: "毛巾、水杯和垃圾已分别归位。" }; if (state.carriedItem) return { step: 2, title: `归位${ITEM_META[state.carriedItem].shortName}`, detail: "将手中物品送到对应目标容器，靠近后按 F。" }; const remaining = ITEM_TYPES.filter((type) => !["laundry", "cart", "bin"].includes(state.items[type].location)).length; return { step: 1, title: "整理客房", detail: `房间内还有 ${remaining} 件物品需要归位。靠近后按 F 拾取。` }; }
export function itemName(type) { return ITEM_META[type].name; }
