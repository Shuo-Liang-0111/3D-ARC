import { applyRobotMovement } from "../../movement.js";
import { FIELD, FIELD_CROPS, FIELD_COLLIDERS, SHARED_PRODUCE } from "./field-layout.js";
import { TOOL_ROOM_WALLS, toolDoorCollider, toolRoomInteraction, doorSweepBlocked, advanceToolRoom } from "./tool-room-layout.js";
import { STATIC_COLLIDERS } from "./level.js";

import { CART, cartStand, cartDriverPose, cartBounds, cartClear, cartDocked, robotClearsCart, angleDelta } from "./cart-layout.js";
import { interactionStanceMessage } from './interaction-stance.js';
import { ORANGE_ID, ORANGE_TASK, createOrangeShipment, orangeInteraction, applyOrangeAction } from './orange-task.js';

export function createVariantEngine(LEVEL) {
  const distance = (left, right) => Math.hypot(left.x - right.x, left.z - right.z);
  const reach = (state, point, range = LEVEL.interactionRange) => distance(state.player, point) <= range;
  function createInitialState() {
    return { cart: { ...CART.start, travel: 0, gripped: false, parked: false }, player: { ...LEVEL.playerStart }, items: { ...Object.fromEntries(SHARED_PRODUCE.map(item => [item.id, { ...item, location: "intake" }])), [ORANGE_ID]: createOrangeShipment() }, crops: Object.fromEntries(FIELD_CROPS.map(crop => [crop.id, { ...crop, location: "field" }])), carriedItem: null, carriedCrop: null, scaleItem: null, packItem: null, loaded: [], sprayer: false, sprayed: [], harvested: [], records: [], weight: 0, rewards: [], complete: false, failed: false, toolRoomOpen: false, toolDoorAngle: 0, heldTool: null, progress: 100, minimumReserve: 100, distanceMoved: 0, elapsed: 0, interactions: 0, errors: 0, motion: "idle", lastEvent: "started" };
  }
  function cloneState(state) {
    return { ...state, cart: { ...state.cart }, player: { ...state.player }, items: Object.fromEntries(Object.entries(state.items).map(([key, value]) => [key, { ...value }])), crops: Object.fromEntries(Object.entries(state.crops).map(([key, value]) => [key, { ...value }])), loaded: [...state.loaded], sprayed: [...state.sprayed], harvested: [...state.harvested], records: [...state.records], rewards: [...state.rewards] };
  }
  function getColliders(state) { return [...STATIC_COLLIDERS.filter(collider => collider.id !== "pallet-jack"), cartBounds(state.cart || CART.start), ...TOOL_ROOM_WALLS, ...FIELD_COLLIDERS.filter(collider => !state.browserPhysics || collider.id !== "harvest-basket"), toolDoorCollider(state)]; }
  function isWalkable(state, x, z) {
    const radius = LEVEL.playerRadius;
    return x - radius >= LEVEL.bounds.minX && x + radius <= LEVEL.bounds.maxX && z - radius >= LEVEL.bounds.minZ && z + radius <= LEVEL.bounds.maxZ && robotClearsCart(state.cart || CART.start, x, z, radius) && !getColliders(state).filter(rect => rect.id !== "pallet-jack").some(rect => (x - Math.max(rect.minX, Math.min(x, rect.maxX))) ** 2 + (z - Math.max(rect.minZ, Math.min(z, rect.maxZ))) ** 2 < radius ** 2);
  }
  function settle(before, next, cost, reward) {
    const bonus = reward && !before.rewards.includes(reward) ? LEVEL.progress.milestoneReward : 0;
    const value = Math.min(100, before.progress - cost + bonus);
    if (value <= 0) return { ...cloneState(before), failed: true, progress: 0, minimumReserve: 0, lastEvent: "progress_depleted" };
    if (bonus) next.rewards.push(reward);
    next.progress = value;
    next.minimumReserve = Math.min(before.minimumReserve, value);
    return next;
  }
  function updateEnvironment(state, dt) {
    let next = advanceToolRoom(state, dt);
    if (next.complete || next.failed) return next;
    if (next.cuttingCrop) {
      next = { ...next, cutElapsed: (next.cutElapsed || 0) + Math.max(0, Math.min(.05, dt)) };
      if (next.cutElapsed >= .7) {
        const crop = next.crops[next.cuttingCrop];
        next = { ...next, crops: { ...next.crops, [crop.id]: { ...crop, location: "carried" } }, carriedCrop: crop.id, cuttingCrop: null, lastEvent: "crop_picked" };
      }
    }
    if (!next.scaleItem) return next;
    if (next.scaleItem === ORANGE_ID) {
      const item = next.items[ORANGE_ID];
      if (!item.weighing || item.stable) {
        const stableItem = { ...item, stable: Boolean(item.stable), weight: ORANGE_TASK.targetGrams / 1000 };
        return { ...next, items: { ...next.items, [ORANGE_ID]: stableItem }, weight: stableItem.weight };
      }
      const elapsed = (item.weighElapsed || 0) + Math.max(0, Math.min(.05, dt));
      const duration = item.weighDuration || ORANGE_TASK.stabilitySeconds;
      const progress = Math.min(1, elapsed / duration);
      const damping = 1 - progress;
      const weight = ORANGE_TASK.targetGrams / 1000 + Math.sin(elapsed * 7.1) * ORANGE_TASK.instabilityAmplitude * damping + Math.sin(elapsed * 15.7) * .08 * damping;
      const stable = progress >= 1;
      const nextItem = { ...item, weighElapsed: elapsed, stable, weighing: !stable, weight: stable ? ORANGE_TASK.targetGrams / 1000 : weight };
      return { ...next, items: { ...next.items, [ORANGE_ID]: nextItem }, weight: nextItem.weight, lastEvent: stable ? 'weight_stable' : next.lastEvent };
    }
    const elapsed = (next.scaleElapsed || 0) + Math.max(0, Math.min(.05, dt));
    const weight = 5 + Math.sin(elapsed * 4.2) * 1.4;
    return { ...next, scaleElapsed: elapsed, weight };
  }
  function updateMovement(state, input = {}, dt = 0) {
    if (state.complete || state.failed || state.cuttingCrop) return state;
    const next = cloneState(state);
    const delta = Math.min(.05, Math.max(0, dt));
    let motion;
    if (state.cart.gripped) {
      // Ignore ordinary walking while attached. Only explicit player input moves the cart.
      const clamp = value => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
      let move = input.cartDrive ? clamp(input.move) : 0;
      let strafe = input.cartDrive ? clamp(input.strafe) : 0;
      const turn = input.cartDrive ? clamp(input.turn) : 0;
      const norm = Math.max(1, Math.hypot(move, strafe)); move /= norm; strafe /= norm;
      next.lastEvent = 'cart_gripped';
      // Sweep both the chassis and the robot through small translation/rotation steps.
      const steps = Math.max(1, Math.ceil(delta / .01));
      for (let i = 0; i < steps && (move || strafe || turn); i++) {
        const step = delta / steps, yaw = next.cart.yaw + turn * CART.turnSpeed * step;
        const forward = move * CART.speed * step, lateral = strafe * CART.speed * .55 * step;
        const pose = { x: next.cart.x + Math.sin(yaw) * forward + Math.cos(yaw) * lateral,
          z: next.cart.z + Math.cos(yaw) * forward - Math.sin(yaw) * lateral, yaw };
        const candidate = { ...next, cart: { ...next.cart, ...pose } }, player = cartDriverPose(candidate.cart);
        if (!cartClear(pose, getColliders(next), LEVEL.bounds) || !isWalkable(candidate, player.x, player.z)) {
          next.lastEvent = 'cart_path_blocked'; break;
        }
        candidate.cart.travel += distance(next.player, player);
        next.cart = candidate.cart; next.player = player;
      }
      motion = { translating: distance(next.player, state.player) > .00001, motionTurning: Math.abs(next.cart.yaw - state.cart.yaw) > .00001 };
    } else {
      motion = applyRobotMovement(next, state, input, delta, LEVEL, isWalkable);
    }
    const moved = distance(next.player, state.player);
    next.elapsed += delta;
    next.distanceMoved += moved;
    next.motion = motion.motionTurning ? "turning" : motion.translating ? "moving" : "idle";
    return settle(state, next, moved * LEVEL.progress.movementPerMeter);
  }
  function getInteraction(state) {
    if (state.complete || state.failed || state.cuttingCrop) return null;
    const orangeAction = orangeInteraction(state);
    if (orangeAction || state.carriedItem === ORANGE_ID) return orangeAction;
    if (!state.carriedCrop && !state.carriedItem && !state.heldTool && !state.sprayer && !state.cart.parked && reach(state, cartStand(state.cart), 1.1)) return { type: state.cart.gripped ? "park-cart" : "push-cart", label: state.cart.gripped ? (cartDocked(state.cart) ? "松手并完成归位" : "松开车把") : "扶住车把" };
    if (state.carriedCrop) return reach(state, FIELD.basket, 1.2) ? { type: "harvest-drop", item: state.carriedCrop, label: "放入田边收集筐" } : null;
    const room = toolRoomInteraction(state);
    if (room) return room;
    if (!state.carriedItem) {
      const crop = Object.values(state.crops).filter(item => item.location === "field" && reach(state, item, 1.2)).sort((left, right) => distance(state.player, left) - distance(state.player, right))[0];
      if (crop) {
        if (state.heldTool === "harvest-knife") return { type: "pickup-crop", item: crop.id, label: `用收割刀收割${crop.name}` };
        if (state.sprayer) return { type: "spray", item: crop.id, label: "喷洒作物" };
        return { type: "knife-required", label: "需要收割刀" };
      }
    }
    const carried = state.items[state.carriedItem];
    if (carried && reach(state, LEVEL.scale)) return { type: "place-scale", item: carried.id };
    if (state.scaleItem && reach(state, LEVEL.scale)) return { type: state.items[state.scaleItem].weighed ? "take-scale" : "weigh", item: state.scaleItem };
    if (carried && reach(state, LEVEL.pack)) return { type: "place-pack", item: carried.id };
    if (state.packItem && reach(state, LEVEL.pack)) return { type: state.items[state.packItem].packed ? "take-pack" : "pack", item: state.packItem };
    if (carried && reach(state, LEVEL.tail)) return { type: "place-tail", item: carried.id };
    if (carried) return { type: "drop", item: carried.id };
    const item = Object.values(state.items)
      .filter(candidate => (LEVEL.variant !== "rf15-3" || !SHARED_PRODUCE.some(shared => shared.id === candidate.id)) && ["intake", "floor"].includes(candidate.location) && reach(state, candidate))
      .sort((left, right) => distance(state.player, left) - distance(state.player, right))[0];
    return item ? { type: "pickup", item: item.id } : null;
  }
  function interact(state, options = {}) {
    if (state.complete || state.failed) return state;
    const next = cloneState(state);
    next.interactions++;
    const action = getInteraction(state);
    function error(event) { next.errors++; next.lastEvent = event; return settle(state, next, LEVEL.progress.errorCost); }
    if (!action) return error("nothing_in_reach");
    if (action.type === 'orange-weighing') return error('weight_stabilizing');
    if (action.type.startsWith('orange-')) {
      if (!options.animationComplete) return error('animation_required');
      const result = applyOrangeAction(next, action);
      if (result.error) return error(result.error);
      next.complete = LEVEL.variant === 'rf15-3' && next.loaded.includes(ORANGE_ID);
      return settle(state, next, LEVEL.progress.interactionCost, result.reward);
    }
    if (action.type === "knife-required") return error("harvest_knife_required");
    let reward = null;
    const item = next.items[action.item];
    const crop = next.crops[action.item];
    switch (action.type) {
      case "push-cart": {
        const stand = cartStand(state.cart);
        if (!options.animationComplete || interactionStanceMessage(state.player, stand, stand.yaw)) return error("cart_align_required");
        const deltaX = state.player.x - stand.x, deltaZ = state.player.z - stand.z;
        const cosine = Math.cos(state.cart.yaw), sine = Math.sin(state.cart.yaw);
        next.cart.gripOffset = { x: cosine * deltaX - sine * deltaZ, z: sine * deltaX + cosine * deltaZ, yaw: angleDelta(state.player.yaw, state.cart.yaw) };
        next.cart.gripped = true; next.lastEvent = "cart_gripped"; break;
      }
      case "park-cart":
        if (!options.animationComplete) return error("cart_release_required");
        next.cart.gripped = false; next.cart.parked = cartDocked(next.cart);
        next.lastEvent = next.cart.parked ? "cart_parked" : "cart_released";
        if (next.cart.parked) reward = "cart-parked"; break;
      case "open-tool-room": case "close-tool-room":
        if (doorSweepBlocked(state, LEVEL.playerRadius)) return error("tool_door_blocked");
        next.toolRoomOpen = action.type === "open-tool-room";
        next.lastEvent = next.toolRoomOpen ? "tool_room_opened" : "tool_room_closed";
        break;
      case "take-tool": case "return-tool":
        next.heldTool = action.type === "take-tool" ? action.tool : null;
        if (next.heldTool) next.sprayer = false;
        next.lastEvent = next.heldTool ? "harvest_tool_taken" : "harvest_tool_returned";
        break;
      case "take-sprayer": next.sprayer = true; next.heldTool = null; next.lastEvent = "sprayer_picked"; break;
      case "pickup-crop":
        if (options.animationComplete) { crop.location = "carried"; next.carriedCrop = crop.id; next.lastEvent = "crop_picked"; }
        else { next.cuttingCrop = crop.id; next.cutElapsed = 0; next.lastEvent = "harvest_started"; }
        break;
      case "harvest-drop": crop.location = "basket"; next.carriedCrop = null; next.harvested.push(crop.id); next.lastEvent = "crop_basketed"; reward = `harvest-${crop.id}`; break;
      case "spray":
        if (next.sprayed.includes(crop.id)) return error("already_sprayed");
        next.sprayed.push(crop.id); next.lastEvent = "crop_sprayed"; reward = `spray-${crop.id}`; break;
      case "pickup": next.carriedItem = item.id; item.location = "carried"; next.lastEvent = "cargo_picked"; break;
      case "place-scale":
        if (next.scaleItem) return error("station_occupied");
        next.scaleItem = item.id; next.carriedItem = null; item.location = "scale"; Object.assign(item, LEVEL.scale); next.scaleElapsed = 0; next.weight = 5; next.lastEvent = "on_scale"; break;
      case "weigh":
        if (Math.abs(next.weight - 5) > .18) return error("weight_not_ready");
        item.weighed = true; next.records.push({ id: item.id, kg: next.weight }); next.lastEvent = "weight_ok"; reward = `weigh-${item.id}`; break;
      case "take-scale": next.scaleItem = null; next.carriedItem = item.id; item.location = "carried"; next.lastEvent = "cargo_picked"; break;
      case "place-pack":
        if (!item.weighed || next.packItem) return error("weight_required");
        next.packItem = item.id; next.carriedItem = null; item.location = "pack"; Object.assign(item, LEVEL.pack); next.lastEvent = "on_pack"; break;
      case "pack": item.packed = true; next.lastEvent = "packed"; reward = `pack-${item.id}`; break;
      case "take-pack": next.packItem = null; next.carriedItem = item.id; item.location = "carried"; next.lastEvent = "cargo_picked"; break;
      case "place-tail":
        if (!item.packed) return error("packing_required");
        item.location = "loaded"; Object.assign(item, LEVEL.tail); item.z += next.loaded.length * .65; next.loaded.push(item.id); next.carriedItem = null; next.lastEvent = "loaded"; reward = `load-${item.id}`; break;
      case "drop": item.location = "floor"; item.x = state.player.x; item.y = 0; item.z = state.player.z; next.carriedItem = null; next.lastEvent = "cargo_dropped"; break;
    }
    next.complete = LEVEL.variant === "rf15-1" ? next.cart.parked : LEVEL.variant === "rf15-2" ? next.harvested.length === FIELD_CROPS.length : next.loaded.includes(ORANGE_ID);
    return settle(state, next, LEVEL.progress.interactionCost, reward);
  }
  const getObjective = state => ({ step: state.complete ? 5 : 1, title: LEVEL.objective, detail: state.failed ? "余量耗尽，按 R 重置。" : state.complete ? "任务完成。" : "" });
  const getTelemetry = state => ({ system: state.complete ? "已完成" : "处理中", systemOnline: state.complete, cargo: state.carriedCrop ? state.crops[state.carriedCrop].name : state.carriedItem ? state.items[state.carriedItem].name : state.heldTool === "harvest-knife" ? "收割刀" : state.heldTool === "hand-trowel" ? "手铲" : state.sprayer ? "农药喷剂" : "空载", gate: LEVEL.variant === "rf15-1" ? (state.cart.parked ? "已归位" : state.cart.gripped ? "推行中" : "未归位") : LEVEL.variant === "rf15-2" ? `${state.harvested.length}/${FIELD_CROPS.length}` : `${state.loaded.includes(ORANGE_ID) ? 1 : 0}/1` });
  return { createInitialState, cloneState, getColliders, isWalkable, updateEnvironment, updateMovement, getInteraction, interact, closeTerminal: cloneState, getObjective, getTelemetry, getProgressSteps: state => [{ label: "任务进度", done: state.complete, active: true }], getTerminal: state => ({ title: LEVEL.objective, copy: state.complete ? "任务完成" : "任务尚未完成", rows: [["进度", `${state.progress.toFixed(0)}%`], ["已处理", getTelemetry(state).gate]] }), getSoundPosition: (_before, state) => state.player, getDebugState: state => ({ revision: LEVEL.revision, variant: LEVEL.variant, lastEvent: state.lastEvent, cart: state.cart, harvested: state.harvested, sprayed: state.sprayed, loaded: state.loaded }) };
}
