import { LEVEL, PARCEL_META, PARCEL_TYPES } from "./level.js";
import { closeTerminal, createInitialState, getObjective, interact, parcelName, updateMovement } from "./engine.js";
import { createParcelModel, createSortingScene, setParcelModelType, syncSortingVisuals } from "./scene.js";

export { LEVEL, closeTerminal, createInitialState, getObjective, interact, updateMovement };

export const ui = Object.freeze({
  id: "rf03",
  brand: "智能快递分拨中心",
  unit: "UNIT RF-03 · DWS SORTING SHIFT",
  systemLabel: "SORTING STATUS",
  cargoLabel: "PARCEL",
  gateLabel: "BINS",
  startKicker: "LEVEL RF-03 / CHINESE PARCEL HUB",
  startTitle: "快递<br />分拣线",
  startCopy: "自动供包机持续将快递送上 1 米宽 DWS 分拣线。截取 A-01、B-02、C-03 三件异常件，并按路由代码送入南侧对应镀锌笼车。WASD 移动和互动会消耗状态余量，左右方向键转向不消耗余量，正确投递会补充余量。",
  completeKicker: "SHIFT COMPLETE",
  completeTitle: "分拣完成",
  completeCopy: "三件异常快递已按路由代码进入对应笼车，DWS 分拣线本轮人工复核完成。",
  terminalHeading: "DWS CONTROL TERMINAL / RF-03",
});

export const camera = Object.freeze({ position: [0, 30, 12], lookAt: [0, 0.45, 0.4], fov: 38 });
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });

export const eventMessages = Object.freeze({
  parcel_collected_red: "已取下红色快递 A-01 · 状态余量 -5",
  parcel_collected_yellow: "已取下黄色快递 B-02 · 状态余量 -5",
  parcel_collected_blue: "已取下蓝色快递 C-03 · 状态余量 -5",
  parcel_dropped_red: "红色快递 A-01 已放置在地面 · 状态余量 -5",
  parcel_dropped_yellow: "黄色快递 B-02 已放置在地面 · 状态余量 -5",
  parcel_dropped_blue: "蓝色快递 C-03 已放置在地面 · 状态余量 -5",
  parcel_sorted_red: "A-01 正确投递 · 互动 -5 / 奖励 +15",
  parcel_sorted_yellow: "B-02 正确投递 · 互动 -5 / 奖励 +15",
  parcel_sorted_blue: "C-03 正确投递 · 互动 -5 / 奖励 +15",
  wrong_bin: "颜色或编号不匹配 · 状态余量 -5",
  empty_interaction: "附近没有可操作对象 · 状态余量 -5",
  terminal_closed: "DWS 终端已关闭 · 状态余量 -5",
  all_parcels_sorted: "全部快递已正确分类，分拣任务完成",
  progress_depleted: "状态余量耗尽，分拣行动终止",
});

export function createScene() {
  return createSortingScene();
}

export function syncVisuals(world, state) {
  syncSortingVisuals(world, state);
}

export function createCargoModel() {
  return createParcelModel("red");
}

export function syncRobotCargo(robot, state) {
  if (state.carriedParcel) setParcelModelType(robot.userData.rackPayload, state.carriedParcel);
}

export function isCarrying(state) {
  return Boolean(state.carriedParcel);
}

export function getTelemetry(state) {
  const sorted = PARCEL_TYPES.filter((type) => state.parcels[type].location === "sorted").length;
  return {
    system: state.complete ? "COMPLETE" : `${sorted}/3 SORTED`,
    systemOnline: state.complete,
    cargo: state.carriedParcel ? PARCEL_META[state.carriedParcel].code : "EMPTY",
    gate: `${sorted}/3 COMPLETE`,
  };
}

export function getProgressSteps(state) {
  return PARCEL_TYPES.map((type) => ({
    label: PARCEL_META[type].code,
    done: state.parcels[type].location === "sorted",
    active: state.carriedParcel === type,
  })).concat({ label: "分拣完成", done: state.complete, active: false });
}

function parcelStatus(state, type) {
  return ({ conveyor: "ON CONVEYOR", ground: "ON FLOOR", carried: "IN TRANSIT", sorted: "IN BIN" })[state.parcels[type].location];
}

export function getTerminal(state) {
  const sorted = PARCEL_TYPES.filter((type) => state.parcels[type].location === "sorted").length;
  return {
    title: state.complete ? "本轮分拣完成" : `待分类快递 ${3 - sorted} 件`,
    copy: "按路由牌投递：红色 A-01、黄色 B-02、蓝色 C-03。未取走快递会由回流机构送回西端自动供包机。",
    rows: PARCEL_TYPES.map((type) => [parcelName(type).toUpperCase(), parcelStatus(state, type)]),
  };
}

export function getSoundPosition(beforeState, state) {
  const type = state.carriedParcel ?? beforeState.carriedParcel;
  return type ? (state.parcels[type] ?? beforeState.parcels[type]) : state.player;
}

export function getDebugState(state) {
  return {
    carriedParcel: state.carriedParcel,
    parcels: Object.fromEntries(PARCEL_TYPES.map((type) => [type, state.parcels[type].location])),
    sortedCount: PARCEL_TYPES.filter((type) => state.parcels[type].location === "sorted").length,
  };
}
