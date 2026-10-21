import { DEVICE_META, DEVICE_TYPES, LEVEL } from "./level.js";
import { closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement } from "./engine.js";
import { createOfficeCargoModel, createOfficeScene, setOfficeCargoModel, syncOfficeVisuals } from "./scene.js";

export { LEVEL, closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement };
export const ui = Object.freeze({
  id: "rf09",
  brand: "EXECUTIVE MEETING SETUP",
  unit: "UNIT R-09 · OFFICE SERVICES",
  systemLabel: "PRESENTATION",
  cargoLabel: "DEVICE",
  gateLabel: "SETUP ORDER",
  startKicker: "LEVEL RF-09 / MODERN OFFICE",
  startTitle: "MEETING<br />SETUP",
  startCopy: "使用 G1 的第一、第三或双视角，在办公室内先取得 USB-C 视频转接器并连接讲台，再取无线演示器。两件设备按顺序就位后，打开会议终端并启动演示。W/S 前进后退，A/D 左右平移，Q/E 转向且不消耗余量，上下方向键调整 D435 观察角度。",
  completeKicker: "MEETING READY",
  completeTitle: "演示已启动",
  completeCopy: "视频链路和无线演示器均已按顺序完成检查，会议室现已就绪。",
  terminalHeading: "CONFERENCE CONTROL / RF-09",
});
export const camera = Object.freeze({ position: [0, 28, 8.5], lookAt: [0, 0.4, -0.4], fov: 34 });
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });
export const eventMessages = Object.freeze({
  item_collected_adapter: "已拿起 USB-C 视频转接器 · 奖励 +10",
  item_collected_clicker: "已拿起无线演示器 · 奖励 +10",
  item_recollected_adapter: "再次拿起视频转接器",
  item_recollected_clicker: "再次拿起无线演示器",
  item_dropped_adapter: "视频转接器已放下",
  item_dropped_clicker: "无线演示器已放下",
  device_installed_adapter: "视频转接器已连接讲台 · 奖励 +14",
  device_installed_clicker: "无线演示器已放置讲台 · 奖励 +14",
  device_rejected_order: "会议准备顺序错误：请先连接 USB-C 视频转接器",
  terminal_not_ready: "会议终端检查未通过：设备尚未按顺序就位",
  terminal_opened: "会议控制终端已打开",
  terminal_closed: "会议控制终端已关闭",
  presentation_started: "会议演示已启动",
  empty_interaction: "附近没有可操作对象",
  progress_depleted: "状态余量耗尽，会议准备终止",
});
export function createScene() { return createOfficeScene(); }
export function syncVisuals(world, state) { syncOfficeVisuals(world, state); }
export function createCargoModel() { return createOfficeCargoModel(); }
export function syncRobotCargo(robot, state) { setOfficeCargoModel(robot.userData.rackPayload, state); }
export function isCarrying(state) { return Boolean(state.carriedItem); }
export function getTelemetry(state) { return { system: state.complete ? "LIVE" : state.presentationReady ? "READY" : "SETUP", systemOnline: state.presentationReady || state.complete, cargo: state.carriedItem ? DEVICE_META[state.carriedItem].shortName : "EMPTY", gate: `${state.installedDevices.length}/2 INSTALLED` }; }
export function getProgressSteps(state) { return [{ label: "连接 USB-C 视频转接器", done: state.installedDevices.includes("adapter"), active: !state.installedDevices.includes("adapter") }, { label: "放置无线演示器", done: state.installedDevices.includes("clicker"), active: state.installedDevices.includes("adapter") && !state.installedDevices.includes("clicker") }, { label: "启动会议演示", done: state.complete, active: state.presentationReady }]; }
export function getTerminal(state) { return { title: state.presentationReady ? "会议系统检查通过" : "会议系统未就绪", copy: state.presentationReady ? "视频输出与无线控制链路正常。按 F 启动演示。" : "请先按指定顺序完成讲台设备部署。", rows: [["USB-C VIDEO", state.installedDevices.includes("adapter") ? "CONNECTED" : "MISSING"], ["PRESENTER", state.installedDevices.includes("clicker") ? "READY" : "MISSING"], ["DISPLAY", state.complete ? "LIVE" : state.presentationReady ? "STANDBY" : "OFFLINE"]] }; }
export function getSoundPosition(_before, state) { return state.player; }
export function getDebugState(state) { return { carriedItem: state.carriedItem, devices: Object.fromEntries(DEVICE_TYPES.map((type) => [type, state.devices[type].location])), installedDevices: state.installedDevices, presentationReady: state.presentationReady }; }
