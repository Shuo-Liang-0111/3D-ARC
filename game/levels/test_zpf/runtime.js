import { CHECKPOINT_IDS, CHECKPOINT_META, LEVEL } from "./level.js";
import { closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement } from "./engine.js";
import { createTestZpfScene, syncTestZpfVisuals } from "./scene.js";

export { LEVEL, closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement };

export const ui = Object.freeze({
  id: "test_zpf",
  brand: "TEST_ZPF · SMALL OFFICE",
  unit: "SCENE 11 · VIDEO RECONSTRUCTION",
  systemLabel: "SURVEY",
  cargoLabel: "NEXT DETAIL",
  gateLabel: "CHECKPOINTS",
  startKicker: "SCENE 11 / TEST_ZPF",
  startTitle: "SMALL<br />OFFICE",
  startCopy: "在视频与照片还原的小办公室中完成三点巡检。",
  completeKicker: "OFFICE SURVEY COMPLETE",
  completeTitle: "巡检完成",
  completeCopy: "移动白板、曲面屏工作台与窗边空调均已核对，办公室空间还原巡检通过。",
  terminalHeading: "TEST_ZPF / SMALL OFFICE",
});

export const camera = Object.freeze({
  position: [4.15, 4.55, -5.25],
  lookAt: [1.72, 0.8, 1.78],
  fov: 40,
});

export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });

export const eventMessages = Object.freeze({
  checkpoint_inspected_whiteboard: "移动白板已核对 · 手写流程与框架完整",
  checkpoint_inspected_workbench: "工作台已核对 · 曲面屏与座椅布局完整",
  checkpoint_inspected_window_ac: "窗边空调已核对 · 排风管与卷帘关系完整",
  inspection_complete: "小办公室三点巡检完成",
  progress_depleted: "任务余量耗尽，巡检中断",
});

export function createScene() {
  return createTestZpfScene();
}

export function syncVisuals(world, state) {
  syncTestZpfVisuals(world, state);
}

export function isCarrying() {
  return false;
}

export function getTelemetry(state) {
  const count = state.inspectionOrder.length;
  const nextId = CHECKPOINT_IDS.find((id) => !state.inspected[id]);
  return {
    system: state.complete ? "PASSED" : "INSPECTING",
    systemOnline: state.complete,
    cargo: nextId ? CHECKPOINT_META[nextId].shortName : "NONE",
    gate: `${count}/3 CHECKED`,
  };
}

export function getProgressSteps(state) {
  return CHECKPOINT_IDS.map((id) => ({
    label: `检查${CHECKPOINT_META[id].shortName}`,
    done: state.inspected[id],
    active: !state.complete && !state.inspected[id] && id === CHECKPOINT_IDS.find((candidate) => !state.inspected[candidate]),
  }));
}

export function getTerminal(state) {
  return {
    title: state.complete ? "办公室巡检通过" : "办公室巡检进行中",
    copy: "场景依据实拍视频与八张照片，以米制程序化 Three.js 几何还原。",
    rows: CHECKPOINT_IDS.map((id) => [CHECKPOINT_META[id].shortName, state.inspected[id] ? "CHECKED" : "PENDING"]),
  };
}

export function getSoundPosition(_beforeState, state) {
  return state.player;
}

export function getDebugState(state) {
  return {
    inspected: { ...state.inspected },
    inspectionOrder: [...state.inspectionOrder],
    inspectedCount: state.inspectionOrder.length,
  };
}
