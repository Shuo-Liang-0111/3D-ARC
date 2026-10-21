import { LEVEL, PARCEL_META, PARCEL_TYPES } from "./level.js";
import { applyRobotMovement } from "../../movement.js";

const EPSILON = 1e-6;

function conveyorPosition(type, elapsed) {
  const conveyor = LEVEL.conveyor;
  const length = conveyor.maxX - conveyor.minX;
  const parcel = LEVEL.parcels[type];
  return {
    x: conveyor.minX + ((parcel.phase + elapsed * conveyor.speed) % length),
    z: conveyor.z + parcel.laneZ,
  };
}

export function createInitialState() {
  return {
    player: { ...LEVEL.playerStart },
    parcels: Object.fromEntries(PARCEL_TYPES.map((type) => [type, { type, location: "conveyor", ...conveyorPosition(type, 0) }])),
    carriedParcel: null,
    terminalOpen: false,
    complete: false,
    failed: false,
    progress: LEVEL.progress.initial,
    rewardedParcels: {},
    motion: "idle",
    elapsed: 0,
    interactions: 0,
    lastEvent: "sorting_shift_started",
  };
}

export function cloneState(state) {
  return {
    ...state,
    player: { ...state.player },
    parcels: Object.fromEntries(PARCEL_TYPES.map((type) => [type, { ...state.parcels[type] }])),
    rewardedParcels: { ...state.rewardedParcels },
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function circleOverlapsRect(x, z, radius, rect) {
  const nearX = Math.max(rect.minX, Math.min(x, rect.maxX));
  const nearZ = Math.max(rect.minZ, Math.min(z, rect.maxZ));
  return (x - nearX) ** 2 + (z - nearZ) ** 2 < radius ** 2;
}

export function isWalkable(_state, x, z) {
  const { bounds, playerRadius: radius } = LEVEL;
  if (x - radius < bounds.minX || x + radius > bounds.maxX || z - radius < bounds.minZ || z + radius > bounds.maxZ) return false;
  return !LEVEL.staticColliders.some((rect) => circleOverlapsRect(x, z, radius, rect));
}

function failIfDepleted(state) {
  if (state.progress > EPSILON || state.complete) return state;
  state.progress = 0;
  state.failed = true;
  state.terminalOpen = false;
  state.motion = "idle";
  state.lastEvent = "progress_depleted";
  return state;
}

function advanceConveyor(state) {
  for (const type of PARCEL_TYPES) {
    if (state.parcels[type].location === "conveyor") {
      state.parcels[type] = { type, location: "conveyor", ...conveyorPosition(type, state.elapsed) };
    }
  }
}

export function updateMovement(state, input, deltaSeconds) {
  const next = cloneState(state);
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
  next.elapsed += dt;
  if (state.complete || state.failed) {
    next.motion = state.carriedParcel ? "carrying" : "idle";
    return next;
  }
  advanceConveyor(next);
  if (state.terminalOpen) {
    next.motion = state.carriedParcel ? "carrying" : "idle";
    return next;
  }

  const movement = applyRobotMovement(next, state, input, dt, LEVEL, isWalkable);
  if (!movement.active) {
    next.motion = state.carriedParcel ? "carrying" : "idle";
    return next;
  }
  if (input.drain !== false) next.progress = Math.max(0, state.progress - LEVEL.progress.actionDrainPerSecond * dt);
  next.motion = movement.motionTurning ? "turning" : (state.carriedParcel ? "carrying" : "moving");
  return failIfDepleted(next);
}

function nearbyCandidates(state) {
  const candidates = [];
  if (!state.carriedParcel) {
    for (const type of PARCEL_TYPES) {
      const parcel = state.parcels[type];
      if (parcel.location === "conveyor" || parcel.location === "ground") {
        candidates.push({ type: "parcel", parcelType: type, distance: distance(state.player, parcel) });
      }
    }
  } else {
    for (const type of PARCEL_TYPES) {
      candidates.push({ type: "bin", parcelType: type, distance: distance(state.player, LEVEL.bins[type]) });
    }
  }
  candidates.push({ type: "terminal", distance: distance(state.player, LEVEL.terminal) });
  return candidates.filter((candidate) => candidate.distance <= LEVEL.interactionRange).sort((a, b) => a.distance - b.distance);
}

export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  if (state.terminalOpen) return { type: "terminal-close", label: "关闭分拣终端" };
  const nearest = nearbyCandidates(state)[0];
  if (nearest?.type === "parcel") return { ...nearest, label: `取下快递 ${PARCEL_META[nearest.parcelType].code}` };
  if (nearest?.type === "bin") return { ...nearest, label: `放入快递栏 ${PARCEL_META[nearest.parcelType].code}` };
  if (nearest?.type === "terminal") return { ...nearest, label: "读取分拣终端" };
  if (state.carriedParcel) return { type: "drop", parcelType: state.carriedParcel, label: "放下快递" };
  return null;
}

export function interact(state) {
  if (state.complete || state.failed) return cloneState(state);
  const interaction = getInteraction(state);
  const next = cloneState(state);
  next.interactions += 1;
  next.progress = Math.max(0, next.progress - LEVEL.progress.interactionCost);

  if (!interaction) {
    next.lastEvent = "empty_interaction";
    return failIfDepleted(next);
  }
  if (interaction.type === "parcel") {
    next.carriedParcel = interaction.parcelType;
    next.parcels[interaction.parcelType] = { type: interaction.parcelType, location: "carried" };
    next.motion = "carrying";
    next.lastEvent = `parcel_collected_${interaction.parcelType}`;
  } else if (interaction.type === "drop") {
    const type = state.carriedParcel;
    next.parcels[type] = { type, location: "ground", x: state.player.x, z: state.player.z };
    next.carriedParcel = null;
    next.motion = "idle";
    next.lastEvent = `parcel_dropped_${type}`;
  } else if (interaction.type === "bin") {
    const carried = state.carriedParcel;
    if (carried !== interaction.parcelType) {
      next.lastEvent = "wrong_bin";
    } else {
      next.parcels[carried] = { type: carried, location: "sorted", ...LEVEL.bins[carried] };
      next.carriedParcel = null;
      next.motion = "idle";
      next.lastEvent = `parcel_sorted_${carried}`;
      if (!next.rewardedParcels[carried]) {
        next.rewardedParcels[carried] = true;
        next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.correctDeliveryReward);
      }
      if (PARCEL_TYPES.every((type) => next.parcels[type].location === "sorted")) {
        next.progress = LEVEL.progress.maximum;
        next.complete = true;
        next.lastEvent = "all_parcels_sorted";
      }
    }
  } else if (interaction.type === "terminal") {
    next.terminalOpen = true;
    next.motion = "idle";
    next.lastEvent = "terminal_opened";
  } else if (interaction.type === "terminal-close") {
    next.terminalOpen = false;
    next.lastEvent = "terminal_closed";
  }
  return failIfDepleted(next);
}

export function closeTerminal(state) {
  if (!state.terminalOpen || state.complete || state.failed) return cloneState(state);
  const next = cloneState(state);
  next.terminalOpen = false;
  next.interactions += 1;
  next.progress = Math.max(0, next.progress - LEVEL.progress.interactionCost);
  next.lastEvent = "terminal_closed";
  return failIfDepleted(next);
}

export function parcelName(type) {
  return `${PARCEL_META[type].name} ${PARCEL_META[type].code}`;
}

export function getObjective(state) {
  if (state.failed) return { step: 0, title: "任务失败", detail: "状态余量已耗尽，按 R 重新开始。" };
  if (state.complete) return { step: 4, title: "分拣完成", detail: "三件快递已进入对应颜色和编号的快递栏。" };
  if (state.carriedParcel) {
    const meta = PARCEL_META[state.carriedParcel];
    return { step: 2, title: `投递 ${meta.code}`, detail: `将${meta.name}快递送往同色的 ${meta.code} 快递栏。` };
  }
  const remaining = PARCEL_TYPES.filter((type) => state.parcels[type].location !== "sorted").length;
  return { step: 1, title: "截取流水线快递", detail: `传送带上还有 ${remaining} 件快递需要分类。靠近移动中的箱体按 E 取件。` };
}
