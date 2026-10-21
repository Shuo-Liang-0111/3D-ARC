import { LEVEL } from "./level.js";
import { createInitialState, getInteraction, getObjective, interact, updateMovement, closeTerminal, isReady } from "./engine.js";
import { createClinicScene, createClinicCargoModel, syncClinicVisuals, setClinicCargoModel } from "./scene.js";
export { LEVEL, createInitialState, getInteraction, getObjective, interact, updateMovement, closeTerminal };
export const camera = Object.freeze({ position: [0, 18.5, 16], lookAt: [0, 0.6, 0], fov: 43 });
export const ui = Object.freeze({
  id: "rf13", brand: "社区诊所 · 开诊准备", unit: "RF-13 · 真实化 v0.3",
  systemLabel: "诊所", cargoLabel: "携带", gateLabel: "清单",
  startKicker: "RF-13 / 社区卫生服务", startTitle: "社区诊所<br />开诊准备",
  startCopy: "从储物间领取四类用品并送到对应工位，回收四个空周转盒；归正候诊椅、移走通道推车，最后在前台确认开诊。WASD 移动，Q/E 转向，F 交互，上下方向键调整观察角度。",
  completeKicker: "CLINIC READY", completeTitle: "开诊准备完成",
  completeCopy: "四站补给、四盒回收、候诊椅和推车归位均已完成。",
  terminalHeading: "社区诊所 / 开诊清单",
});
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });
export const eventMessages = Object.freeze({
  battery_collected: "已拿起物品", battery_dropped: "物品已放到地面，可再次拾取", power_restored: "物品已正确交接",
  wrong_station: "物品与工位不匹配，请送往指定位置", wrong_return: "此处仅接收空周转盒",
  drop_blocked: "前方没有足够的放置空间", move_blocked: "请让开物品归位区域",
  clinic_prepared: "整理完成，通道已更新", terminal_not_ready: "清单尚未完成，请检查补给、空盒和整理任务",
  terminal_opened: "检查通过，再按 F 确认开诊", terminal_closed: "已关闭清单", clinic_opened: "诊所开诊准备完成",
  empty_interaction: "请靠近并面向可交互物品", progress_depleted: "准备余量耗尽，请重新开始",
});
export function createScene() { return createClinicScene(); }
export function createCargoModel() { return createClinicCargoModel(); }
export function syncVisuals(world, state) { syncClinicVisuals(world, state); }
export function syncRobotCargo(robot, state) { setClinicCargoModel(robot.userData.rackPayload, state); }
export function isCarrying(state) { return Boolean(state.carriedItem); }
export function getTelemetry(state) { return { system: state.complete ? "OPEN" : "SETUP", systemOnline: isReady(state), cargo: state.carriedItem ? state.items[state.carriedItem].name : "EMPTY", gate: `${state.delivered.length}/4 · ${state.returned.length}/4 · ${state.prepared.length}/2` }; }
export function getProgressSteps(state) { return [
  { label: "四站补给与空盒回收", done: state.delivered.length === 4 && state.returned.length === 4, active: state.delivered.length < 4 || state.returned.length < 4 },
  { label: "候诊椅和推车归位", done: state.prepared.length === 2, active: state.prepared.length < 2 },
  { label: "前台确认开诊", done: state.complete, active: isReady(state) },
]; }
export function getTerminal(state) { return { title: "开诊清单", copy: "按 F 确认开诊，Esc 返回。", rows: [["耗材补给", `${state.delivered.length}/4`], ["空盒回收", `${state.returned.length}/4`], ["环境整理", `${state.prepared.length}/2`]] }; }
export function getSoundPosition(_before, state) { return state.player; }
export function getDebugState(state) { return { carriedItem: state.carriedItem, delivered: state.delivered, returned: state.returned, prepared: state.prepared, items: state.items }; }
