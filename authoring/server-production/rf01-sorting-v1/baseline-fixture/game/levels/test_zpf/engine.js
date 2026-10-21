import { CHECKPOINT_IDS, CHECKPOINT_META, LEVEL } from "./level.js";
import { applyRobotMovement } from "../../movement.js";

const EPSILON = 1e-6;

export function createInitialState() {
  return {
    player: { ...LEVEL.playerStart },
    inspected: Object.fromEntries(CHECKPOINT_IDS.map((id) => [id, false])),
    inspectionOrder: [],
    terminalOpen: false,
    complete: false,
    failed: false,
    progress: LEVEL.progress.initial,
    motion: "idle",
    elapsed: 0,
    interactions: 0,
    lastEvent: "office_inspection_started",
  };
}

export function cloneState(state) {
  return {
    ...state,
    player: { ...state.player },
    inspected: { ...state.inspected },
    inspectionOrder: [...state.inspectionOrder],
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function circleOverlapsRect(x, z, radius, rect) {
  const nearX = Math.max(rect.minX, Math.min(x, rect.maxX));
  const nearZ = Math.max(rect.minZ, Math.min(z, rect.maxZ));
  return (x - nearX) ** 2 + (z - nearZ) ** 2 < radius ** 2;
}

export function isWalkable(_state, x, z) {
  const { bounds, playerRadius } = LEVEL;
  if (x - playerRadius < bounds.minX || x + playerRadius > bounds.maxX) return false;
  if (z - playerRadius < bounds.minZ || z + playerRadius > bounds.maxZ) return false;
  return !LEVEL.staticColliders.some((rect) => circleOverlapsRect(x, z, playerRadius, rect));
}

export function updateMovement(state, input, deltaSeconds) {
  const next = cloneState(state);
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
  next.elapsed += dt;
  if (state.complete || state.failed || state.terminalOpen) return next;

  const movement = applyRobotMovement(next, state, input, dt, LEVEL, isWalkable);
  if (!movement.active) {
    next.motion = "idle";
    return next;
  }

  if (input.drain !== false) {
    next.progress = Math.max(0, state.progress - LEVEL.progress.movementDrainPerSecond * dt);
  }
  next.motion = movement.motionTurning ? "turning" : "moving";
  if (next.progress <= EPSILON) {
    next.progress = 0;
    next.failed = true;
    next.motion = "idle";
    next.lastEvent = "progress_depleted";
  }
  return next;
}

export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  return CHECKPOINT_IDS
    .filter((id) => !state.inspected[id])
    .map((id) => ({
      type: "checkpoint",
      checkpointId: id,
      distance: distance(state.player, LEVEL.checkpoints[id]),
      label: `检查${CHECKPOINT_META[id].name}`,
    }))
    .filter((candidate) => candidate.distance <= LEVEL.interactionRange)
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

export function interact(state) {
  const interaction = getInteraction(state);
  if (!interaction) return cloneState(state);

  const next = cloneState(state);
  const id = interaction.checkpointId;
  next.inspected[id] = true;
  next.inspectionOrder.push(id);
  next.interactions += 1;
  next.lastEvent = `checkpoint_inspected_${id}`;
  if (CHECKPOINT_IDS.every((checkpointId) => next.inspected[checkpointId])) {
    next.complete = true;
    next.progress = LEVEL.progress.maximum;
    next.motion = "idle";
    next.lastEvent = "inspection_complete";
  }
  return next;
}

export function closeTerminal(state) {
  const next = cloneState(state);
  next.terminalOpen = false;
  return next;
}

export function getObjective(state) {
  if (state.failed) return { step: 0, title: "巡检中断", detail: "任务余量已耗尽，按 R 重新开始。" };
  if (state.complete) return { step: 4, title: "小办公室巡检完成", detail: "白板、工作台和窗边空调均已核对。" };
  const nextId = CHECKPOINT_IDS.find((id) => !state.inspected[id]);
  return {
    step: state.inspectionOrder.length + 1,
    title: `检查${CHECKPOINT_META[nextId].name}`,
    detail: nextId === "whiteboard"
      ? "从入口左侧开始，靠近黑框移动白板并按 F。"
      : nextId === "workbench"
        ? "查看曲面屏、红色座椅与桌面设备。"
        : "检查便携空调、波纹排风管与落地窗卷帘。",
  };
}
