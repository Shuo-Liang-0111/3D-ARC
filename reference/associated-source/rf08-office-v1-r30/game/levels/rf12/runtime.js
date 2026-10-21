import { createSeriesKitchenScene, syncSeriesKitchenVisuals } from "./variants-scene.js";
import { createKitchenInteractionAnimation } from "./interaction-animation.js";
import { HAZARD_META, HAZARD_TYPES, LEVEL } from "./level.js";
import { closeTerminal, createInitialState, getInteraction, getObjective, interact, isWalkable, updateMovement } from "./engine.js";
import { createKitchenCargoModel, createKitchenScene, syncKitchenCargoModel, syncKitchenVisuals } from "./scene.js";
import { addKitchenViewLayers } from "./view-layers.js";

export { LEVEL, closeTerminal, createInitialState, getInteraction, getObjective, interact, isWalkable, updateMovement };

export const ui = Object.freeze({
  id: "rf12", levelLabel: "RF-10",
  brand: "HOUSEHOLD KITCHEN SAFETY",
  unit: "UNIT RF-10 · CHINESE HOME",
  systemLabel: "SAFETY STATUS",
  cargoLabel: "CARGO",
  gateLabel: "CHECKLIST",
  startKicker: "LEVEL RF-10 / CHINESE HOME",
  startTitle: "厨房安全<br />检查",
  startCopy: "进入一间正常使用的中国城市家庭厨房，完成三项安全检查：打开右侧墙面的窗户、关闭燃气炉、关闭燃气阀门。三项完成后直接通关。",
  completeKicker: "KITCHEN SAFETY COMPLETE",
  completeTitle: "检查完成",
  completeCopy: "窗户已打开，燃气炉与燃气阀门均已关闭。",
  terminalHeading: "HOUSEHOLD SAFETY / RF-10",
});

export const camera = Object.freeze({ position: [0, 11.8, 8.6], lookAt: [0, 0.55, -0.45], fov: 38 });
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });
export const eventMessages = Object.freeze({
  checklist_read: "厨房安全检查单已读取",
  cloth_collected: "已拿起炉边湿抹布",
  cloth_secured: "湿抹布已移入水槽 · 安全余量 +12",
  cloth_dropped: "湿抹布已放到地面",
  gas_knob_reset: "燃气炉已关闭 · 安全余量 +12",
  hood_started: "油烟机已开启 · 安全余量 +12",
  window_opened: "厨房窗已打开 · 安全余量 +12",
  gas_valve_requires_knob: "请先关闭燃气炉",
  gas_valve_closed: "燃气总阀已关闭 · 安全余量 +12",
  terminal_confirmed: "入口终端确认完成",
  empty_interaction: "附近没有可操作对象 · 安全余量 -4",
  kitchen_safety_complete: "三项厨房安全检查已全部完成",
  progress_depleted: "安全余量耗尽，厨房检查终止",
});

export function createScene() { return createSeriesKitchenScene("rf12"); }
export function syncVisuals(world, state) { syncSeriesKitchenVisuals(world, state); }
export function createCargoModel() { return createKitchenCargoModel(); }
export function syncRobotCargo(robot, state) { if (robot?.userData?.rackPayload) syncKitchenCargoModel(robot.userData.rackPayload, state); }
export function isCarrying(state) { return Boolean(state.carriedItem); }
export function getTelemetry(state) { const done = HAZARD_TYPES.filter((type) => state.hazards[type]).length; return { system: state.complete ? "SAFE" : `${done}/3 CHECKS`, systemOnline: state.complete, cargo: state.carriedItem ? "WET CLOTH" : "EMPTY", gate: `${done}/3 CLEAR` }; }
export function getProgressSteps(state) { return HAZARD_TYPES.map((type) => ({ label: HAZARD_META[type].label, done: state.hazards[type], active: false })); }
export function getTerminal(state) { const done = HAZARD_TYPES.filter((type) => state.hazards[type]).length; return { title: state.complete ? "厨房安全检查完成" : `已处理 ${done}/3 项风险`, copy: "检查单、主界面和终端状态保持一致。", rows: HAZARD_TYPES.map(type => [HAZARD_META[type].label, state.hazards[type] ? "DONE" : "PENDING"]) }; }
export function getSoundPosition(_before, state) { return state.player; }
export function getDebugState(state) { return { checklistRead: state.checklistRead, hazards: { ...state.hazards }, cloth: state.cloth.location, carriedItem: state.carriedItem }; }
export function prepareView(world, { firstPerson }) { if (world.ceilingRoot) world.ceilingRoot.visible = firstPerson; }

export const createInteractionAnimation = createKitchenInteractionAnimation;
