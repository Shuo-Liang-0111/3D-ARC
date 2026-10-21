import { closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement } from "./engine.js";
import { createRF10Scene, syncRF10Visuals } from "./scene.js";

import { LEVEL } from "./level.js";
export { LEVEL, closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement };
export const ui = Object.freeze({
  id: "rf10",
  levelLabel: "真实场景验证",
  brand: "真实场景验证",
  unit: "实景验证 · ROOM",
  systemLabel: "SCENE",
  cargoLabel: "MODE",
  gateLabel: "COLLISION",
  startKicker: "真实场景验证",
  startTitle: "真实场景验证",
  startCopy: "在新 3DGS 会议室场景中自由探索。",
  completeKicker: "EXPLORATION",
  completeTitle: "探索进行中",
  completeCopy: "你可以继续在房间内移动。",
  terminalHeading: "真实场景验证",
});
export const camera = Object.freeze({ position: [2.5, 0.35, 0], lookAt: [4.2, -0.2, -0.2], fov: 58 });
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });
export const eventMessages = Object.freeze({});
export function createScene(renderer) { return createRF10Scene(renderer); }
export function syncVisuals(world, state, delta) { syncRF10Visuals(world, state, delta); }
export function getRobotGroundY() { return LEVEL.playerGroundY; }
export function isCarrying() { return false; }
export function getTelemetry() { return { system: "READY", systemOnline: true, cargo: "FREE EXPLORE", gate: "BOUNDS" }; }
export function getProgressSteps() { return [{ label: "自由探索", done: false, active: true }]; }
export function getTerminal() { return { title: "真实场景验证", copy: "PlayCanvas GSplat 渲染完整真实会议室 PLY。当前使用经场景包围盒校准的探索边界，精确碰撞体积稍后重建。", rows: [["SOURCE", "rf10-room-full.ply"], ["FORMAT", "PLY / PLAYCANVAS GSPLAT"], ["MODE", "FREE EXPLORATION"]] }; }
export function getSoundPosition(_beforeState, state) { return state.player; }
export function getDebugState(state) { return { mode: "free-exploration", player: state.player }; }
