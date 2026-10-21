import { LEVEL } from "./level.js";
import { allChecked, checklistCount, closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement } from "./engine.js";
import { createSmallOfficeScene, syncSmallOfficeVisuals } from "./scene.js";

export { LEVEL, closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement };

export const ui = Object.freeze({
  id: "test_zpf2",
  brand: "SMALL OFFICE SURVEY",
  unit: "UNIT TEST-ZPF2 · PRIVATE OFFICE",
  systemLabel: "AIR CONDITIONER",
  cargoLabel: "CHECKLIST",
  gateLabel: "OFFICE DOOR",
  startKicker: "LEVEL TEST-ZPF2 / SMALL OFFICE",
  startTitle: "OFFICE<br />SURVEY",
  startCopy: "在按照实景照片重建的小办公室中完成巡检：查看白板、读取工作站、启动移动空调，然后打开房门离开。",
  completeKicker: "SURVEY COMPLETE",
  completeTitle: "巡检完成",
  completeCopy: "白板、工作站和移动空调均已记录，办公室房门保持开放，机器人已回到走廊。",
  terminalHeading: "WORKSTATION / TEST-ZPF2",
});

export const camera = Object.freeze({ position: [0.3, 7.5, 4.1], lookAt: [0, 0.2, 0.25], fov: 40 });
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });

export const eventMessages = Object.freeze({
  office_entered: "已进入小办公室",
  whiteboard_reviewed: "白板评测计划已记录 · 任务余量 +8",
  workstation_checked: "工作站状态已读取 · 任务余量 +8",
  terminal_closed: "工作站已关闭",
  aircon_started: "移动空调已启动制冷 · 任务余量 +12",
  aircon_stopped: "移动空调已关闭",
  door_locked: "巡检未完成，房门仍处于锁定状态",
  door_opened: "房门已打开 · 任务余量 +12",
  door_closed: "房门已关闭",
  exit_reached: "已离开办公室，巡检完成",
  progress_depleted: "任务余量耗尽，巡检终止",
});

export function createScene(renderer) { return createSmallOfficeScene(renderer); }
export function syncVisuals(world, state, delta) { syncSmallOfficeVisuals(world, state, delta); }
export function isCarrying() { return false; }

export function getTelemetry(state) {
  return {
    system: state.airconOn ? "COOLING 24°C" : "STANDBY",
    systemOnline: state.airconOn,
    cargo: `${checklistCount(state)}/${LEVEL.checklist.length} CHECKED`,
    gate: state.doorOpen ? "OPEN" : allChecked(state) ? "UNLOCKED" : "LOCKED",
  };
}

export function getProgressSteps(state) {
  return [
    { label: "查看白板", done: state.whiteboardReviewed, active: !state.whiteboardReviewed },
    { label: "读取工作站", done: state.workstationChecked, active: state.whiteboardReviewed && !state.workstationChecked },
    { label: "启动移动空调", done: state.airconOn || state.complete, active: state.workstationChecked && !state.airconOn },
    { label: "打开房门离开", done: state.complete, active: allChecked(state) && !state.complete },
  ];
}

export function getTerminal(state) {
  const pending = LEVEL.checklist.length - checklistCount(state);
  return {
    title: pending === 0 ? "办公室巡检记录完整" : `办公室巡检剩余 ${pending} 项`,
    copy: pending === 0
      ? "白板、工作站和移动空调均已确认。房门已解锁，按 F 关闭工作站后前往南侧房门。"
      : "工作站记录了本次巡检进度。关闭后继续完成剩余检查项。",
    rows: [
      ["WHITEBOARD", state.whiteboardReviewed ? "REVIEWED" : "PENDING"],
      ["AIR CON", state.airconOn ? "COOLING 24°C" : "STANDBY"],
      ["OFFICE DOOR", state.doorOpen ? "OPEN" : allChecked(state) ? "UNLOCKED" : "LOCKED"],
    ],
  };
}

export function getSoundPosition(_beforeState, state) {
  if (state.lastEvent === "aircon_started" || state.lastEvent === "aircon_stopped") return LEVEL.airConditioner;
  if (state.lastEvent === "door_opened" || state.lastEvent === "door_closed") return LEVEL.door;
  return state.player;
}

export function getDebugState(state) {
  return {
    whiteboardReviewed: state.whiteboardReviewed,
    workstationChecked: state.workstationChecked,
    airconOn: state.airconOn,
    doorOpen: state.doorOpen,
  };
}
