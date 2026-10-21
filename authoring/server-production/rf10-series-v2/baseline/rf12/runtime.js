import { HAZARD_TYPES, LEVEL } from "./level.js";
import { closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement } from "./engine.js";
import { createKitchenCargoModel, createKitchenScene, syncKitchenCargoModel, syncKitchenVisuals } from "./scene.js";
import { addKitchenViewLayers } from "./view-layers.js";

export { LEVEL, closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement };

export const ui = Object.freeze({
  id: "rf12", levelLabel: "RF-10",
  brand: "HOUSEHOLD KITCHEN SAFETY",
  unit: "UNIT RF-10 · CHINESE HOME",
  systemLabel: "SAFETY STATUS",
  cargoLabel: "CARGO",
  gateLabel: "CHECKLIST",
  startKicker: "LEVEL RF-10 / CHINESE HOME",
  startTitle: "厨房安全<br />检查",
  startCopy: "进入一间正常使用的中国城市家庭厨房，先读取入口旁检查单，再处理五项风险：复位燃气旋钮、开启油烟机、把炉边湿抹布移入水槽、打开窗户通风、关闭燃气总阀。完成后回到入口终端确认。",
  completeKicker: "KITCHEN SAFETY COMPLETE",
  completeTitle: "检查完成",
  completeCopy: "五项厨房安全风险均已处理，入口终端确认完成。",
  terminalHeading: "HOUSEHOLD SAFETY / RF-10",
});

export const camera = Object.freeze({ position: [0, 11.8, 8.6], lookAt: [0, 0.55, -0.45], fov: 38 });
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });
export const eventMessages = Object.freeze({
  checklist_read: "厨房安全检查单已读取",
  cloth_collected: "已拿起炉边湿抹布",
  cloth_secured: "湿抹布已移入水槽 · 安全余量 +12",
  cloth_dropped: "湿抹布已放到地面",
  gas_knob_reset: "燃气旋钮已复位 · 安全余量 +12",
  hood_started: "油烟机已开启 · 安全余量 +12",
  window_opened: "厨房窗已打开 · 安全余量 +12",
  gas_valve_requires_knob: "请先复位灶台燃气旋钮",
  gas_valve_closed: "燃气总阀已关闭 · 安全余量 +12",
  terminal_confirmed: "入口终端确认完成",
  empty_interaction: "附近没有可操作对象 · 安全余量 -4",
  kitchen_safety_complete: "五项厨房安全风险已全部处理",
  progress_depleted: "安全余量耗尽，厨房检查终止",
});

export function createScene() { return addKitchenViewLayers(createKitchenScene()); }
export function syncVisuals(world, state) { syncKitchenVisuals(world, state); }
export function createCargoModel() { return createKitchenCargoModel(); }
export function syncRobotCargo(robot, state) { if (robot?.userData?.rackPayload) syncKitchenCargoModel(robot.userData.rackPayload, state); }
export function isCarrying(state) { return Boolean(state.carriedItem); }
export function getTelemetry(state) { const done = HAZARD_TYPES.filter((type) => state.hazards[type]).length; return { system: state.complete ? "SAFE" : `${done}/5 HAZARDS`, systemOnline: state.complete, cargo: state.carriedItem ? "WET CLOTH" : "EMPTY", gate: `${done}/5 CLEAR` }; }
export function getProgressSteps(state) { return HAZARD_TYPES.map((type) => ({ label: type, done: state.hazards[type], active: false })).concat({ label: "入口确认", done: state.complete, active: false }); }
export function getTerminal(state) { const done = HAZARD_TYPES.filter((type) => state.hazards[type]).length; return { title: state.complete ? "厨房安全检查完成" : `已处理 ${done}/5 项风险`, copy: "检查单、主界面和终端状态保持一致。", rows: [["CHECKLIST", state.checklistRead ? "READ" : "PENDING"], ["HAZARDS", `${done}/5 CLEAR`], ["CONFIRM", state.complete ? "DONE" : "PENDING"]] }; }
export function getSoundPosition(_before, state) { return state.player; }
export function getDebugState(state) { return { checklistRead: state.checklistRead, hazards: { ...state.hazards }, cloth: state.cloth.location, carriedItem: state.carriedItem }; }
export function prepareView(world, { firstPerson }) { if (world.ceilingRoot) world.ceilingRoot.visible = firstPerson; }
