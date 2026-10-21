import { LEVEL } from "./level.js";
import { createCourtScene, createCourtCargoModel, syncCourtVisuals } from "./scene.js";
export { LEVEL };
export { createInitialState, getInteraction, getObjective, interact, updateMovement, closeTerminal } from "./engine.js";
export const camera = Object.freeze({ position: [0, 18.5, 16], lookAt: [0, 0.6, 0], fov: 43 });
export const ui = Object.freeze({
  id: "rf14", levelLabel: "RF-12", brand: "网球场 · 捡球归筐", unit: "RF-12 · Court 01",
  systemLabel: "球场", cargoLabel: "携带", gateLabel: "归筐",
  startKicker: "RF-12 / AFTERNOON TENNIS", startTitle: "训练结束<br />捡球归筐",
  startCopy: "在这片蓝绿硬地球场寻找 8 颗散落网球，逐个送回东侧休息区的球车。WASD 移动，Q/E 转向，F 拾取或放下，方向键上下观察，R 重置。没有倒计时，放错位置可以重新拾取。",
  completeKicker: "COURT READY", completeTitle: "球场收拾完成", completeCopy: "8 颗网球已全部归筐，准备迎接下一场训练。",
  terminalHeading: "网球场 / 收集记录",
});
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });
export const eventMessages = Object.freeze({ battery_collected: "已捡起网球，请送往东侧球车", battery_dropped: "网球已放下，可重新拾取", power_restored: "网球已归筐", empty_interaction: "靠近并面向网球后按 F", drop_blocked: "前方没有安全的放球空间" });
export function createScene(renderer) { return createCourtScene(renderer); }
export function createCargoModel() { return createCourtCargoModel(); }
export function syncVisuals(world, state) { syncCourtVisuals(world, state); }
export function syncRobotCargo() {}
export function isCarrying(state) { return Boolean(state.carriedItem); }
export function getTelemetry(state) { return { system: state.complete ? "READY" : "COLLECT", systemOnline: state.complete, cargo: state.carriedItem ? state.items[state.carriedItem].name : "EMPTY", gate: `${state.delivered.length}/8` }; }
export function getProgressSteps(state) { return [{ label: "收集南半场网球", done: state.delivered.filter(id => Number(id.split("-")[1]) <= 4).length === 4, active: !state.complete }, { label: "绕过球网，收集北半场", done: state.delivered.filter(id => Number(id.split("-")[1]) > 4).length === 4, active: state.delivered.length > 0 && !state.complete }, { label: "8 颗网球全部归筐", done: state.complete, active: state.delivered.length > 0 }]; }
export function getTerminal(state) { return { title: "收集记录", copy: "将全部散球送回球车。", rows: [["已归筐", `${state.delivered.length}/8`]] }; }
export function getSoundPosition(_before, state) { return state.player; }
export function getDebugState(state) { return { carriedItem: state.carriedItem, delivered: state.delivered, items: state.items, revision: LEVEL.revision }; }
