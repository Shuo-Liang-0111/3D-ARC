import { LEVEL } from "./level.js";
import { closeTerminal, createInitialState, getDebugState as getDebug, getInteraction, getObjective, getTelemetry as getStateTelemetry, interact, updateMovement } from "./engine.js";
import { createCookingKitchenScene, syncCookingKitchenVisuals } from "../rf12/variants-scene.js";

export { LEVEL, closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement };

export const ui = Object.freeze({
  id: "rf12-3",
  levelLabel: "RF-10-3",
  brand: "TIMED KITCHEN COOKING",
  unit: "UNIT RF-10-3 · CHINESE HOME",
  systemLabel: "COOKING STATUS",
  cargoLabel: "CARGO",
  gateLabel: "TIMER",
  startKicker: "LEVEL RF-10-3 / HIGH",
  startTitle: "限时烹饪<br />火候控制",
  startCopy: "放置平底锅，开启油烟机和炉头；必须在 55–65 秒内关火。过早关火需重烹，超时会着火，必须用灭火器灭火后重新计时。",
  completeKicker: "COOKING COMPLETE",
  completeTitle: "烹饪完成",
  completeCopy: "炉头已在 60 ± 5 秒窗口内关闭。",
  terminalHeading: "TIMED COOKING / RF-10-3",
});

export const camera = Object.freeze({ position: [0, 11.8, 8.6], lookAt: [0, 0.55, -0.45], fov: 38 });
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });
export const eventMessages = Object.freeze({
  pan_collected: "已拿起平底锅",
  pan_on_burner: "平底锅已放到炉头",
  hood_started: "油烟机已开启",
  cooking_started: "炉头已开启 · 计时开始",
  cooking_too_early_restart: "关火过早 · 必须重新烹饪并重新计时",
  kitchen_fire_started: "厨房着火 · 请拿起灭火器灭火",
  extinguisher_collected: "已拿起灭火器",
  fire_extinguished_restart_required: "火势已扑灭 · 请重新开启油烟机并重新计时",
  cooking_completed: "烹饪完成 · 关火时间在 55–65 秒窗口内",
  item_dropped: "物品已放下",
  empty_interaction: "当前没有可操作对象 · 状态余量 -4",
  progress_depleted: "状态余量耗尽，烹饪任务终止",
});

export function createScene() { return createCookingKitchenScene(); }
export function syncVisuals(world, state) { syncCookingKitchenVisuals(world, state); }
export function isCarrying(state) { return Boolean(state.carriedItem); }
export function getTelemetry(state) { return getStateTelemetry(state); }
export function getDebugState(state) { return getDebug(state); }
export function getSoundPosition(_before, state) { return state.player; }
export function prepareView(world, { firstPerson }) { if (world.ceilingRoot) world.ceilingRoot.visible = firstPerson; }
