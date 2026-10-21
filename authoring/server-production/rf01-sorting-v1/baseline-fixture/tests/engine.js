import { LEVEL } from "./level.js";
import { applyRobotMovement } from "../../movement.js";
import { isRF10MeshMoveAllowed } from "./mesh-collision.js";

export function createInitialState() {
  return {
    player: { ...LEVEL.playerStart },
    battery: { location: "none" },
    powered: true,
    doorOpen: true,
    terminalOpen: false,
    complete: false,
    failed: false,
    progress: LEVEL.progress.maximum,
    rewardedMilestones: {},
    motion: "idle",
    elapsed: 0,
    interactions: 0,
    lastEvent: "free_exploration_started",
  };
}

export function cloneState(state) {
  return {
    ...state,
    player: { ...state.player },
    battery: { ...state.battery },
    rewardedMilestones: { ...state.rewardedMilestones },
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function isWalkable(state, x, z) {
  return isRF10MeshMoveAllowed(
    state.player.x,
    state.player.z,
    x,
    z,
    LEVEL.playerRadius,
    LEVEL.playerHeight,
  );
}

export function updateMovement(state, input, deltaSeconds) {
  const next = cloneState(state);
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
  next.elapsed += dt;
  const movement = applyRobotMovement(next, state, input, dt, LEVEL, isWalkable);
  next.motion = movement.active ? (movement.motionTurning ? "turning" : "moving") : "idle";
  return next;
}

export function getInteraction() {
  return null;
}

export function interact(state) {
  return cloneState(state);
}

export function closeTerminal(state) {
  return cloneState(state);
}

export function getObjective() {
  return { step: 1, title: "自由探索", detail: "使用 WASD 或方向键探索会议室重建场景。" };
}
