import { LEVEL } from "./level.js";
import { closeTerminal, createInitialState, getDebugState as getDebug, getInteraction, getObjective, getTelemetry as getStateTelemetry, interact, updateMovement } from "./engine.js";
import { createSimpleKitchenScene, syncSimpleKitchenVisuals } from "../rf12/variants-scene.js";

export { LEVEL, closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement };

export const ui = Object.freeze({
  id: "rf12-2",
  levelLabel: "RF-10-2",
  brand: "SIMPLE KITCHEN PREP",
  unit: "UNIT RF-10-2 · CHINESE HOME",
  systemLabel: "TASK STATUS",
  cargoLabel: "CARGO",
  gateLabel: "PLACEMENT",
  startKicker: "LEVEL RF-10-2 / SIMPLE",
  startTitle: "简易备餐<br />归位",
  startCopy: "读取简易备餐提示，拿起食用油瓶并放到备餐台，再回到入口终端确认。",
  completeKicker: "SIMPLE TASK COMPLETE",
  completeTitle: "备餐台已准备",
  completeCopy: "食用油已放到指定位置，简易任务完成。",
  terminalHeading: "SIMPLE PREP / RF-10-2",
});

export const camera = Object.freeze({ position: [0, 11.8, 8.6], lookAt: [0, 0.55, -0.45], fov: 38 });
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });
export const eventMessages = Object.freeze({
  simple_checklist_read: "简易备餐提示已读取",
  oil_collected: "已拿起食用油瓶",
  oil_placed: "食用油已放到备餐台",
  oil_dropped: "食用油已放到地面",
  simple_kitchen_complete: "RF-10-2 简易任务完成",
  empty_interaction: "附近没有可操作对象 · 状态余量 -4",
  progress_depleted: "状态余量耗尽，简易任务终止",
});

export function createScene() { return createSimpleKitchenScene(); }
export function syncVisuals(world, state) { syncSimpleKitchenVisuals(world, state); }
export function isCarrying(state) { return Boolean(state.carriedItem); }
export function getTelemetry(state) { return getStateTelemetry(state); }
export function getDebugState(state) { return getDebug(state); }
export function getSoundPosition(_before, state) { return state.player; }
export function prepareView(world, { firstPerson }) { if (world.ceilingRoot) world.ceilingRoot.visible = firstPerson; }
