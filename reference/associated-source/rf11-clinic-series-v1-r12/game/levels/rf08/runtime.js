import { createBinModel, syncOfficeBin } from './bin.js';
import { LEVEL } from "./level.js";
import { closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement } from "./engine.js";
import { createOfficeScan } from "./scan-scene.js";

export { LEVEL, closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement };

export const ui = Object.freeze({
  id: "rf08",
  brand: "SCANNED OFFICE",
  unit: "UNIT R-08 · LAYOUT REVIEW",
  systemLabel: "SCENE MODE",
  cargoLabel: "INTERACTION",
  gateLabel: "COLLISION",
  startKicker: "LEVEL RF-08 / SCANNED OFFICE",
  startTitle: "OPEN<br />OFFICE",
  startCopy: "探索 3DGS 实景办公室，靠近黑色垃圾桶按 F 拿起或放下。",
  completeKicker: "LAYOUT REVIEW",
  completeTitle: "自由探索模式",
  completeCopy: "当前版本不包含任务完成条件。",
  terminalHeading: "RF-08 SCAN STATUS",
});

export const camera = Object.freeze({ position: [0, 8.8, 6.2], lookAt: [0, 0.55, 0], fov: 39 });
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });
export const eventMessages = Object.freeze({ free_exploration_started: 'RF-08 扫描场景自由探索已开始', office_bin_picked_up: '已拿起垃圾桶', office_bin_placed: '已放下垃圾桶', office_bin_place_blocked: '前方空间不足，请面向空地再放下', bin_out_of_reach: '请靠近垃圾桶' });
export function createScene(renderer) { return createOfficeScan(renderer); }
export function syncVisuals(world, state) { syncOfficeBin(world,state); return world; }
export function createCargoModel() { const root=createBinModel(); root.children.forEach((child)=>{child.position.y-=0.155;}); return root; }
export function syncRobotCargo(robot,state) { robot.userData.rackPayload.visible=Boolean(state.carriedItem); }
export function isCarrying(state) { return Boolean(state.carriedItem); }
export function getTelemetry(state) { return { system: "3DGS", systemOnline: true, cargo: state.carriedItem ? '垃圾桶' : 'EMPTY', gate: "COLLISION ON" }; }
export function getProgressSteps() {
  return [
    { label: "检查玻璃入口", done: false, active: true },
    { label: "检查双排工位", done: false, active: false },
    { label: "检查两侧通道", done: false, active: false },
  ];
}
export function getTerminal() {
  return { title: "RF-08 实景办公室", copy: "办公室使用 3DGS 显示，垃圾桶为独立网格，支持按 F 拾放及碰撞。", rows: [["ROOM", "6.2 × 3.8 M（估算）"], ["WORKSTATIONS", "8"], ["COLLISION", "ENABLED"]] };
}
export function getSoundPosition(_before, state) { return state.player; }
export function getDebugState(state) { return { mode: "scan-free-roam", collision: true, player: state.player, bin: state.bin, carriedItem: state.carriedItem }; }
