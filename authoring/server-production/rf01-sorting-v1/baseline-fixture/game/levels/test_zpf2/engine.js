import { DOOR_COLLIDER, LEVEL, OPEN_DOOR_COLLIDER } from "./level.js";
import { applyRobotMovement } from "../../movement.js";

const EPSILON = 1e-6;

export function createInitialState() {
  return {
    player: { ...LEVEL.playerStart },
    whiteboardReviewed: false,
    workstationChecked: false,
    airconOn: false,
    doorOpen: false,
    terminalOpen: false,
    complete: false,
    failed: false,
    progress: LEVEL.progress.initial,
    rewardedMilestones: {},
    motion: "idle",
    elapsed: 0,
    interactions: 0,
    lastEvent: "office_entered",
  };
}

export function cloneState(state) {
  return {
    ...state,
    player: { ...state.player },
    rewardedMilestones: { ...state.rewardedMilestones },
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function checklistCount(state) {
  return [state.whiteboardReviewed, state.workstationChecked, state.airconOn].filter(Boolean).length;
}

export function allChecked(state) {
  return checklistCount(state) === LEVEL.checklist.length;
}

function circleOverlapsRect(x, z, radius, rect) {
  const nearX = Math.max(rect.minX, Math.min(x, rect.maxX));
  const nearZ = Math.max(rect.minZ, Math.min(z, rect.maxZ));
  return (x - nearX) ** 2 + (z - nearZ) ** 2 < radius ** 2;
}

export function isWalkable(state, x, z) {
  const { bounds, playerRadius: radius } = LEVEL;
  if (x - radius < bounds.minX || x + radius > bounds.maxX || z - radius < bounds.minZ || z + radius > bounds.maxZ) return false;
  if (LEVEL.staticColliders.some((rect) => circleOverlapsRect(x, z, radius, rect))) return false;
  const doorRect = state.doorOpen ? OPEN_DOOR_COLLIDER : DOOR_COLLIDER;
  return !circleOverlapsRect(x, z, radius, doorRect);
}

export function updateMovement(state, input, deltaSeconds) {
  const next = cloneState(state);
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
  next.elapsed += dt;
  if (state.complete || state.failed || state.terminalOpen) {
    next.motion = "idle";
    return next;
  }

  const movement = applyRobotMovement(next, state, input, dt, LEVEL, isWalkable);
  if (!movement.active) {
    next.motion = "idle";
    return next;
  }
  if (input.drain !== false) next.progress = Math.max(0, state.progress - LEVEL.progress.movementDrainPerSecond * dt);
  next.motion = movement.motionTurning ? "turning" : "moving";

  if (next.progress <= EPSILON) {
    next.progress = 0;
    next.failed = true;
    next.terminalOpen = false;
    next.motion = "idle";
    next.lastEvent = "progress_depleted";
    return next;
  }

  if (state.doorOpen && distance(next.player, LEVEL.exit) <= LEVEL.exit.radius) {
    next.complete = true;
    next.progress = LEVEL.progress.maximum;
    next.motion = "idle";
    next.lastEvent = "exit_reached";
  }
  return next;
}

function nearbyCandidates(state) {
  return [
    { type: "whiteboard", distance: distance(state.player, LEVEL.whiteboard) },
    { type: "workstation", distance: distance(state.player, LEVEL.workstation) },
    { type: "aircon", distance: distance(state.player, LEVEL.airConditioner) },
    { type: "door", distance: distance(state.player, LEVEL.door) },
  ]
    .filter((candidate) => candidate.distance <= LEVEL.interactionRange)
    .sort((a, b) => a.distance - b.distance);
}

export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  if (state.terminalOpen) return { type: "terminal-close", label: "关闭工作站" };
  const nearest = nearbyCandidates(state)[0];
  if (!nearest) return null;
  if (nearest.type === "whiteboard") return { ...nearest, label: state.whiteboardReviewed ? "再次查看白板" : "查看白板" };
  if (nearest.type === "workstation") return { ...nearest, label: "读取工作站" };
  if (nearest.type === "aircon") return { ...nearest, label: state.airconOn ? "关闭移动空调" : "启动移动空调" };
  if (!allChecked(state)) return { ...nearest, label: "检查房门" };
  return { ...nearest, label: state.doorOpen ? "关闭房门" : "打开房门" };
}

export function interact(state) {
  const interaction = getInteraction(state);
  if (!interaction) return cloneState(state);
  const next = cloneState(state);
  next.interactions += 1;

  if (interaction.type === "whiteboard") {
    next.whiteboardReviewed = true;
    next.lastEvent = "whiteboard_reviewed";
  } else if (interaction.type === "workstation") {
    next.workstationChecked = true;
    next.terminalOpen = true;
    next.motion = "idle";
    next.lastEvent = "workstation_checked";
  } else if (interaction.type === "aircon") {
    next.airconOn = !state.airconOn;
    next.lastEvent = next.airconOn ? "aircon_started" : "aircon_stopped";
  } else if (interaction.type === "door") {
    if (!allChecked(state)) {
      next.lastEvent = "door_locked";
    } else {
      next.doorOpen = !state.doorOpen;
      next.lastEvent = next.doorOpen ? "door_opened" : "door_closed";
    }
  } else if (interaction.type === "terminal-close") {
    next.terminalOpen = false;
    next.lastEvent = "terminal_closed";
  }

  const reward = LEVEL.progress.rewards[next.lastEvent] ?? 0;
  if (reward > 0 && !next.rewardedMilestones[next.lastEvent]) {
    next.rewardedMilestones[next.lastEvent] = true;
    next.progress = Math.min(LEVEL.progress.maximum, next.progress + reward);
  }
  return next;
}

export function closeTerminal(state) {
  if (!state.terminalOpen) return cloneState(state);
  const next = cloneState(state);
  next.terminalOpen = false;
  next.lastEvent = "terminal_closed";
  return next;
}

export function getObjective(state) {
  if (state.failed) return { step: 0, title: "任务失败", detail: "任务余量已耗尽，按 R 重新开始。" };
  if (state.complete) return { step: 5, title: "巡检完成", detail: "小办公室三项检查已记录，机器人已回到走廊。" };
  if (state.doorOpen) return { step: 5, title: "离开办公室", detail: "房门已打开，穿过门口进入走廊。" };
  if (allChecked(state)) return { step: 4, title: "打开房门", detail: "三项检查完成，靠近南侧房门并按 F。" };
  const step = checklistCount(state) + 1;
  if (!state.whiteboardReviewed) return { step, title: "查看白板", detail: "前往西侧玻璃隔断前的移动白板，按 F 记录评测计划。" };
  if (!state.workstationChecked) return { step, title: "读取工作站", detail: "走到办公桌前，按 F 读取显示器工作站状态。" };
  return { step, title: "启动移动空调", detail: "靠近窗边的白色移动空调，按 F 启动制冷。" };
}
