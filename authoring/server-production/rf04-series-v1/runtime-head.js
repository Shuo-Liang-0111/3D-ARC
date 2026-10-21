import { CLOTHING_META, CLOTHING_TYPES, LEVEL } from "./level.js";
import { closeTerminal, createInitialState, getObjective, interact, updateMovement } from "./engine.js";
import { createHomeLaundryScene, createLaundryCargoModel, setLaundryCargoMode, syncLaundryVisuals } from "./scene.js";

export { LEVEL, closeTerminal, createInitialState, getObjective, interact, updateMovement };

export const ui = Object.freeze({
  id: "rf04",
  brand: "HOME LAUNDRY CYCLE",
  unit: "UNIT R-04 · DOMESTIC ROUTINE",
  systemLabel: "WASHER STATUS",
  cargoLabel: "LAUNDRY",
  gateLabel: "CYCLE",
  startKicker: "LEVEL RF-04 / MODERN HOME",
  startTitle: "HOME<br />LAUNDRY",
  startCopy: "在客厅逐件拿起三件脏衣服，送进卫生间洗衣机。装完后启动洗涤，等待完成，取出整批湿衣服并送到阳台晾衣架。W/S 前后、A/D 平移会消耗状态余量，左右方向键转向不消耗余量；每次互动仍会消耗余量。",
  completeKicker: "HOUSEHOLD ROUTINE COMPLETE",
  completeTitle: "晾晒完成",
  completeCopy: "三件衣物已经完成洗涤，并整齐晾在阳台衣架上。",
  terminalHeading: "LAUNDRY STATUS / RF-04",
});

export const camera = Object.freeze({ position: [0, 31.5, 7.2], lookAt: [0, 0.25, 0], fov: 32 });
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });

export const eventMessages = Object.freeze({
  clothing_collected_shirt: "已拿起蓝色上衣 · 互动 -5 / 奖励 +30",
  clothing_collected_pants: "已拿起深色长裤 · 互动 -5 / 奖励 +30",
  clothing_collected_towel: "已拿起黄色毛巾 · 互动 -5 / 奖励 +30",
  clothing_recollected_shirt: "再次拿起蓝色上衣 · 状态余量 -5",
  clothing_recollected_pants: "再次拿起深色长裤 · 状态余量 -5",
  clothing_recollected_towel: "再次拿起黄色毛巾 · 状态余量 -5",
  clothing_dropped_shirt: "蓝色上衣已放在地面 · 状态余量 -5",
  clothing_dropped_pants: "深色长裤已放在地面 · 状态余量 -5",
  clothing_dropped_towel: "黄色毛巾已放在地面 · 状态余量 -5",
  clothing_loaded_shirt: "蓝色上衣已装入洗衣机 · 互动 -5 / 奖励 +80",
  clothing_loaded_pants: "深色长裤已装入洗衣机 · 互动 -5 / 奖励 +80",
  clothing_loaded_towel: "黄色毛巾已装入洗衣机 · 互动 -5 / 奖励 +80",
  all_clothes_loaded: "三件衣物已全部装入 · 洗衣机已就绪",
  washer_started: "洗衣机已启动 · 状态余量 -5",
  washer_still_running: "洗衣机仍在运行 · 状态余量 -5",
  washer_missing_clothes: "还有衣物未装入洗衣机 · 状态余量 -5",
  washer_finished: "洗涤任务完成 · 任务奖励 +15，状态灯已变为绿色",
  washer_unloaded: "已取出整批湿衣服 · 互动 -5 / 任务奖励 +15",
  wet_batch_dropped: "湿衣服已放在地面 · 状态余量 -5",
  wet_batch_collected: "已拿起整批湿衣服 · 状态余量 -5",
  laundry_hung: "晾晒任务完成 · 奖励 +15，状态余量恢复至 100",
  empty_interaction: "附近没有可操作对象 · 状态余量 -5",
  progress_depleted: "状态余量耗尽，洗衣任务终止",
});

export function createScene() {
  return createHomeLaundryScene();
}

export function syncVisuals(world, state) {
  syncLaundryVisuals(world, state);
}

export function createCargoModel() {
  return createLaundryCargoModel();
}

export function syncRobotCargo(robot, state) {
  if (state.carriedItem) setLaundryCargoMode(robot.userData.rackPayload, state.carriedItem);
}

export function isCarrying(state) {
  return Boolean(state.carriedItem);
}

export function getTelemetry(state) {
  const loaded = CLOTHING_TYPES.filter((type) => ["washer", "wet-carried", "wet-ground", "hung"].includes(state.clothes[type].location)).length;
  const status = {
    loading: `${loaded}/3 LOADED`,
    ready: "READY",
    washing: "WASHING",
    done: "WASH COMPLETE",
    unloaded: "UNLOADED",
  }[state.washerPhase];
  return {
    system: state.complete ? "COMPLETE" : status,
    systemOnline: state.washerPhase === "washing" || state.washerPhase === "done" || state.complete,
    cargo: state.carriedItem === "wet-batch" ? "WET BATCH" : state.carriedItem ? CLOTHING_META[state.carriedItem].shortName : "EMPTY",
    gate: state.complete ? "HUNG" : state.washerPhase === "washing" ? `${Math.max(0, Math.ceil(LEVEL.washDuration - state.washElapsed))}s` : `${loaded}/3`,
  };
}

export function getProgressSteps(state) {
  const loaded = CLOTHING_TYPES.every((type) => state.clothes[type].location !== "living-room" && state.clothes[type].location !== "ground" && state.clothes[type].location !== "carried");
  return [
    { label: "装入三件衣物", done: loaded, active: !loaded },
    { label: "完成洗涤", done: ["done", "unloaded"].includes(state.washerPhase) || state.complete, active: ["ready", "washing"].includes(state.washerPhase) },
    { label: "取出湿衣服", done: state.washerPhase === "unloaded" || state.complete, active: state.washerPhase === "done" },
    { label: "阳台晾晒", done: state.complete, active: state.carriedItem === "wet-batch" || Boolean(state.wetBatch) },
  ];
}

export function getTerminal(state) {
  return {
    title: "家庭洗衣状态",
    copy: "所有信息均与主界面一致。",
    rows: [
      ["LOADED", `${CLOTHING_TYPES.filter((type) => state.clothes[type].location === "washer").length}/3`],
      ["WASHER", state.washerPhase.toUpperCase()],
      ["DRYING", state.complete ? "COMPLETE" : "PENDING"],
    ],
  };
}

export function getSoundPosition(_beforeState, state) {
  return state.player;
}

export function getDebugState(state) {
  return {
    carriedItem: state.carriedItem,
    clothes: Object.fromEntries(CLOTHING_TYPES.map((type) => [type, state.clothes[type].location])),
    washerPhase: state.washerPhase,
    washElapsed: state.washElapsed.toFixed(2),
  };
}
