import { hasWorkshopDoorPower, isWorkshopParcelVisible } from "./rf01-workshop-rules.js";
import { applyRobotMovement } from "./movement.js";
import { DOOR_COLLIDER } from "./level.js";
import { WORKSHOP, DISPATCH } from "./rf01-shared-level.js";
import { RF01_YARD_LAYOUT } from "./rf01-yard-layout.js";
import { SORTING, PARCEL_TYPES, PARCEL_META, conveyorPosition, parcelCollider } from "./rf01-sorting-layout.js";

export function distance(first, second) { return Math.hypot(first.x - second.x, first.z - second.z); }
export function angleDelta(from, to) { return Math.atan2(Math.sin(to - from), Math.cos(to - from)); }
export function isInside(point) {
  const bounds = WORKSHOP.inside;
  return point.x > bounds.minX && point.x < bounds.maxX && point.z > bounds.minZ && point.z < bounds.maxZ;
}
function overlaps(point, rect) {
  const nearX = Math.max(rect.minX, Math.min(point.x, rect.maxX));
  const nearZ = Math.max(rect.minZ, Math.min(point.z, rect.maxZ));
  return (point.x - nearX) ** 2 + (point.z - nearZ) ** 2 < point.radius ** 2;
}
function cargoRect(cargo) {
  return { id: cargo.id, minX: cargo.x - .43, maxX: cargo.x + .43, minZ: cargo.z - .30, maxZ: cargo.z + .30 };
}
function intersects(first, second) {
  return first.minX < second.maxX && first.maxX > second.minX && first.minZ < second.maxZ && first.maxZ > second.minZ;
}
export function createParkEngine(LEVEL) {
  function createInitialState() {
    return {
      player: { ...LEVEL.playerStart }, battery: { location: "ground", ...LEVEL.batteryStart },
      crates: RF01_YARD_LAYOUT.crates.map((position, index) => ({ id: "crate-" + index, x: position[0], z: position[2], location: "ground" })),
      carriedItem: null, powered: false, doorOpen: false, terminalOpen: false, dispatchConfirmed: false,
      shutterRequested: false, shutterLift: 0, shutterPhase: "closed", shutterHold: 0, shutterBlocked: false,
      enteredWorkshop: false, lightsOn: false, conveyorPhase: 0, conveyorDirection: 1,
      parcels: Object.fromEntries(PARCEL_TYPES.map(type => [type, { type, location: "conveyor", ...conveyorPosition(type, 0) }])),
      complete: false, failed: false,
      progress: LEVEL.progress.initial, minimumReserve: LEVEL.progress.initial,
      rewardedMilestones: {}, motion: "idle", elapsed: 0, interactions: 0, distanceMoved: 0, lastEvent: "park_ready",
    };
  }
  function cloneState(state) {
    return { ...state, player: { ...state.player }, battery: { ...state.battery },
      crates: state.crates.map(crate => ({ ...crate })),
      parcels: Object.fromEntries(PARCEL_TYPES.map(type => [type, { ...state.parcels[type] }])),
      rewardedMilestones: { ...state.rewardedMilestones } };
  }
  function isCarrying(state) { return state.battery.location === "carried" || Boolean(state.carriedItem); }
  function bodyPoints(state, x, z) {
    const yaw = state.player.yaw;
    const points = [{ x, z, radius: LEVEL.playerRadius }, {
      x: x + Math.sin(yaw) * LEVEL.playerForwardOffset, z: z + Math.cos(yaw) * LEVEL.playerForwardOffset, radius: LEVEL.playerRadius,
    }];
    if (state.carriedItem) {
      const parcelType = state.carriedItem.startsWith("parcel-") ? state.carriedItem.slice(7) : null;
      const minY = parcelType ? .88 + SORTING.parcelCarryOffsetY * Math.cos(.12)
        - PARCEL_META[parcelType].dimensions[2] / 2 * Math.sin(.12) : 0;
      points.push({ x: x + Math.sin(yaw) * .65, z: z + Math.cos(yaw) * .65,
        radius: parcelType ? .30 : .44, minY });
    }
    return points;
  }
  function getColliders(state) {
    const blockers = [...LEVEL.staticColliders, ...state.crates.filter(crate => crate.location !== "carried").map(cargoRect)];
    blockers.push(...Object.values(state.parcels).filter(parcel => parcel.location === "ground").map(parcelCollider));
    if (!state.doorOpen) blockers.push(DOOR_COLLIDER);
    if (state.shutterLift < WORKSHOP.clearance) blockers.push(WORKSHOP.doorway);
    return blockers;
  }
  function isWalkable(state, x, z) {
    const blockers = getColliders(state);
    const bounds = LEVEL.bounds;
    return bodyPoints(state, x, z).every(point =>
      point.x - point.radius >= bounds.minX && point.x + point.radius <= bounds.maxX
      && point.z - point.radius >= bounds.minZ && point.z + point.radius <= bounds.maxZ
      && !blockers.some(rect => (rect.maxY === undefined || (point.minY ?? 0) < rect.maxY) && overlaps(point, rect)));
  }
  function checkCompletion(state) {
    const ready = LEVEL.id === "rf01"
      ? state.powered && state.doorOpen && distance(state.player, LEVEL.exit) <= LEVEL.exit.radius
      : LEVEL.id === "rf01-2"
        ? state.enteredWorkshop && state.lightsOn
        : state.powered && state.enteredWorkshop && state.lightsOn
          && PARCEL_TYPES.every(type => state.parcels[type].location === "sorted");
    if (ready) {
      state.complete = true; state.motion = "idle"; state.terminalOpen = false; state.lastEvent = "mission_complete";
    }
    return state;
  }
  function settle(next, previous, cost, milestone) {
    const first = milestone && !previous.rewardedMilestones[milestone];
    const balance = previous.progress - cost + (first ? LEVEL.progress.reward : 0);
    if (balance <= 0) {
      const failed = cloneState(previous);
      Object.assign(failed, { progress: 0, minimumReserve: 0, failed: true, motion: "idle", terminalOpen: false,
        lastEvent: "progress_depleted", interactions: next.interactions });
      return failed;
    }
    next.progress = Math.min(LEVEL.progress.maximum, balance);
    next.minimumReserve = Math.min(previous.minimumReserve, next.progress);
    if (first) next.rewardedMilestones[milestone] = true;
    return checkCompletion(next);
  }
  function updateMovement(state, input, deltaSeconds) {
    if (state.complete || state.failed || state.terminalOpen) return cloneState(state);
    const next = cloneState(state);
    const delta = Math.min(Math.max(deltaSeconds, 0), .05);
    next.elapsed += delta;
    const movement = applyRobotMovement(next, state, input, delta, LEVEL, isWalkable);
    const moved = distance(next.player, state.player);
    next.distanceMoved += moved;
    next.motion = movement.motionTurning ? "turning" : moved > 1e-6 ? "moving" : "idle";
    next.enteredWorkshop ||= state.shutterLift >= WORKSHOP.clearance && isInside(next.player);
    const cost = input.passiveMotion === true ? 0 : moved * LEVEL.progress.perMeter
      + (movement.translating && moved < 1e-6 && !movement.motionTurning ? LEVEL.progress.blockedPerSecond * delta : 0);
    return settle(next, state, cost);
  }
  function doorwayOccupied(state) {
    return bodyPoints(state, state.player.x, state.player.z).some(point => overlaps(point, WORKSHOP.doorway))
      || state.crates.some(crate => crate.location !== "carried" && intersects(cargoRect(crate), WORKSHOP.doorway));
  }
  function updateEnvironment(state, deltaSeconds) {
    if (state.complete || state.failed) return cloneState(state);
    const next = cloneState(state);
    const delta = Math.min(Math.max(deltaSeconds, 0), .1);
    next.shutterBlocked = false;
    if (state.powered) {
      next.conveyorPhase = state.conveyorPhase + SORTING.conveyor.speed * delta;
      for (const type of PARCEL_TYPES) {
        if (next.parcels[type].location === "conveyor") Object.assign(next.parcels[type], conveyorPosition(type, next.conveyorPhase));
      }
    }
    if (state.shutterPhase === "opening") {
      next.shutterLift = Math.min(WORKSHOP.height, state.shutterLift + delta * WORKSHOP.height / WORKSHOP.openingSeconds);
      if (next.shutterLift === WORKSHOP.height) { next.shutterPhase = "open"; next.shutterHold = WORKSHOP.holdSeconds; }
    } else if (state.shutterPhase === "open") {
      next.shutterHold = Math.max(0, state.shutterHold - delta);
      if (next.shutterHold === 0) next.shutterPhase = "closing";
    } else if (state.shutterPhase === "closing") {
      if (doorwayOccupied(state)) { next.shutterBlocked = true; return next; }
      next.shutterLift = Math.max(0, state.shutterLift - delta * WORKSHOP.height / WORKSHOP.openingSeconds);
      if (next.shutterLift === 0) { next.shutterPhase = "closed"; next.shutterRequested = false; }
    }
    return next;
  }
  function facing(state, target, range = LEVEL.interactionRange) {
    const dx = target.x - state.player.x, dz = target.z - state.player.z;
    const separation = Math.hypot(dx, dz);
    return separation <= range && (separation < .05
      || (Math.sin(state.player.yaw) * dx + Math.cos(state.player.yaw) * dz) / separation > .35);
  }
  function getInteraction(state) {
    if (state.complete || state.failed) return null;
    if (state.terminalOpen) return { type: "terminal-close", label: "关闭终端" };
    const inside = isInside(state.player);
    const control = inside ? WORKSHOP.innerDoorControl : WORKSHOP.doorControl;
    if ((inside || state.player.z > -1.3) && facing(state, control, LEVEL.interactionRange)) {
      return { type: "shutter", label: !hasWorkshopDoorPower(LEVEL.id, state) ? "卷帘门未通电" : state.shutterPhase === "opening" ? "卷帘门上升中" : "开启卷帘门（十秒后自动关闭）" };
    }
    if (inside && state.enteredWorkshop && facing(state, WORKSHOP.lightSwitch, LEVEL.interactionRange)) return { type: "lights", label: state.lightsOn ? "关闭照明" : "开启照明" };
    if (state.carriedItem?.startsWith("parcel-")) {
      const target = PARCEL_TYPES.filter(type => inside && facing(state, SORTING.bins[type], 1.8))
        .sort((first, second) => distance(state.player, SORTING.bins[first]) - distance(state.player, SORTING.bins[second]))[0];
      return target ? { type: "sort-parcel", parcelType: target, target: SORTING.bins[target], label: "F 互动" }
        : { type: "drop-parcel", label: "F 互动" };
    }
    if (state.carriedItem) {
      const bay = DISPATCH.bays[Number(state.carriedItem.split("-")[1])];
      if (facing(state, bay, 1.5)) return { type: "deliver", label: "货箱放入收货位", target: bay };
      return { type: "drop-crate", label: "放下货箱" };
    }
    const candidates = [];
    if (state.battery.location === "carried" && facing(state, LEVEL.powerSlot, 1.8)) candidates.push({ type: "slot", target: LEVEL.powerSlot });
    if (!isCarrying(state)) {
      if (state.battery.location === "ground" && facing(state, state.battery, 1.8)) candidates.push({ type: "battery", target: state.battery });
      state.crates.filter(crate => crate.location !== "carried" && facing(state, crate, LEVEL.interactionRange)).forEach(crate => candidates.push({ type: "crate", target: crate, id: crate.id }));
      Object.values(state.parcels).filter(parcel => parcel.location !== "carried" && (inside || parcel.location === "ground")
        && (parcel.location !== "conveyor" || parcel.onBelt !== false)
        && facing(state, parcel, parcel.location === "sorted" ? 1.8 : 1.75))
        .forEach(parcel => candidates.push({ type: "parcel", target: parcel, parcelType: parcel.type }));
    }
    if (facing(state, LEVEL.door, 1.8)) candidates.push({ type: "door", target: LEVEL.door });
    if (facing(state, LEVEL.terminal, 1.8)) candidates.push({ type: "terminal", target: LEVEL.terminal });
    const nearest = candidates.filter(candidate => candidate.type !== "parcel" || isWorkshopParcelVisible(state, candidate.target))
      .sort((first, second) => distance(state.player, first.target) - distance(state.player, second.target))[0];
    if (nearest) return { ...nearest, label: ({ battery: "拿取能源模块", slot: "接入电源", crate: "拿取货箱", parcel: "F 互动", door: "操作园区大门", terminal: "操作门岗终端" })[nearest.type] };
    if (state.battery.location === "carried") return { type: "drop", label: "放下能源模块" };
    return null;
  }
  function safePlacement(state, point, carriedId) {
    const rect = carriedId?.startsWith("parcel-") ? parcelCollider({ ...point, type: carriedId.slice(7) })
      : carriedId ? cargoRect(point) : { minX: point.x - .22, maxX: point.x + .22, minZ: point.z - .11, maxZ: point.z + .11 };
    const others = getColliders(state).filter(collider => collider.id !== carriedId);
    return rect.minX >= LEVEL.bounds.minX && rect.maxX <= LEVEL.bounds.maxX
      && rect.minZ >= LEVEL.bounds.minZ && rect.maxZ <= LEVEL.bounds.maxZ
      && !others.some(other => intersects(rect, other));
  }
  function interact(state) {
    if (state.complete || state.failed) return cloneState(state);
    const next = cloneState(state);
    next.interactions += 1;
    const action = getInteraction(state);
    let cost = LEVEL.progress.error, milestone;
    next.lastEvent = "invalid_interaction";
    if (action?.type === "shutter" && hasWorkshopDoorPower(LEVEL.id, state) && state.shutterPhase !== "opening" && state.shutterPhase !== "open") {
      next.shutterRequested = true; next.shutterPhase = "opening"; next.lastEvent = "shutter_opening"; milestone = "shutter"; cost = 0;
    } else if (action?.type === "lights") {
      next.lightsOn = !state.lightsOn; next.lastEvent = next.lightsOn ? "workshop_lit" : "workshop_dark"; milestone = next.lightsOn ? "lights" : null; cost = 0;
    } else if (action?.type === "parcel" && state.powered && state.lightsOn && state.enteredWorkshop) {
      next.carriedItem = "parcel-" + action.parcelType;
      next.parcels[action.parcelType].location = "carried";
      if (!isWalkable(next, state.player.x, state.player.z)) {
        const rejected = cloneState(state);
        rejected.interactions = next.interactions;
        rejected.lastEvent = "blocked_pickup";
        return settle(rejected, state, cost);
      }
      next.lastEvent = "crate_collected"; cost = 0;
    } else if (action?.type === "sort-parcel") {
      const type = state.carriedItem.slice(7);
      if (type === action.parcelType && state.powered && state.lightsOn) {
        Object.assign(next.parcels[type], action.target, { location: "sorted" });
        next.carriedItem = null; next.lastEvent = "crate_delivered"; milestone = "sorted-" + type; cost = 0;
      } else next.lastEvent = "wrong_bin";
    } else if (action?.type === "drop-parcel") {
      const point = { x: state.player.x + Math.sin(state.player.yaw) * 1.02,
        z: state.player.z + Math.cos(state.player.yaw) * 1.02 };
      if (safePlacement(state, point, state.carriedItem)) {
        Object.assign(next.parcels[state.carriedItem.slice(7)], point, { location: "ground" });
        next.carriedItem = null; next.lastEvent = "crate_dropped"; cost = 0;
      }
    } else if (action?.type === "battery") {
      next.battery = { location: "carried" }; next.lastEvent = "battery_collected"; milestone = "battery"; cost = 0;
    } else if (action?.type === "slot") {
      next.battery = { location: "slotted", ...LEVEL.powerSlot }; next.powered = true; next.lastEvent = "power_restored"; milestone = "power"; cost = 0;
    } else if (action?.type === "crate") {
      next.carriedItem = action.id; next.crates.find(crate => crate.id === action.id).location = "carried";
      next.lastEvent = "crate_collected"; cost = 0;
    } else if (action?.type === "deliver" || action?.type === "drop-crate") {
      const point = action.type === "deliver" ? action.target : {
        x: state.player.x + Math.sin(state.player.yaw) * 1.02, z: state.player.z + Math.cos(state.player.yaw) * 1.02,
      };
      if (safePlacement(state, point, state.carriedItem)) {
        const crate = next.crates.find(entry => entry.id === state.carriedItem);
        Object.assign(crate, point, { location: action.type === "deliver" ? "delivered" : "ground" });
        next.carriedItem = null; next.lastEvent = action.type === "deliver" ? "crate_delivered" : "crate_dropped";
        milestone = action.type === "deliver" ? "delivered-" + crate.id : null; cost = 0;
      }
    } else if (action?.type === "drop") {
      const point = { x: state.player.x + Math.sin(state.player.yaw), z: state.player.z + Math.cos(state.player.yaw) };
      if (safePlacement(state, point)) { next.battery = { location: "ground", ...point }; next.lastEvent = "battery_dropped"; cost = 0; }
    } else if (action?.type === "door" && state.powered) {
      const occupied = bodyPoints(state, state.player.x, state.player.z).some(point => overlaps(point, DOOR_COLLIDER));
      if (!state.doorOpen || !occupied) { next.doorOpen = !state.doorOpen; next.lastEvent = next.doorOpen ? "door_opened" : "door_closed"; milestone = next.doorOpen ? "gate" : null; cost = 0; }
    } else if (action?.type === "terminal") {
      if (state.powered && state.lightsOn && state.crates.every(crate => crate.location === "delivered")) {
        next.dispatchConfirmed = true; next.lastEvent = "dispatch_confirmed"; milestone = "dispatch";
      } else { next.terminalOpen = true; next.lastEvent = "terminal_opened"; }
      cost = 0;
    } else if (action?.type === "terminal-close") {
      next.terminalOpen = false; next.lastEvent = "terminal_closed"; cost = 0;
    }
    return settle(next, state, cost, milestone);
  }
  function closeTerminal(state) { const next = cloneState(state); next.terminalOpen = false; return next; }
  function getObjective(state) { return { step: state.complete ? 4 : 1, title: state.failed ? "任务失败" : LEVEL.title, detail: "" }; }
  return { createInitialState, cloneState, isWalkable, getColliders, isCarrying, updateMovement, updateEnvironment, getInteraction, interact, closeTerminal, getObjective };
}
