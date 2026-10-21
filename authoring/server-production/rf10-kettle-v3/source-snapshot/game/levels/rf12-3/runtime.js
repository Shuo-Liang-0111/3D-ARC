import { createKitchenInteractionAnimation } from "../rf12/interaction-animation.js";
import { LEVEL } from "./level.js";
import { closeTerminal, createInitialState as createEngineState, getDebugState as getDebug, getInteraction, getObjective, getTelemetry as getStateTelemetry, interact, isWalkable, updateMovement as updateEngineMovement, updateEnvironment as updateEngineEnvironment } from "./engine.js";
import { createCookingKitchenScene, syncCookingKitchenVisuals } from "../rf12/variants-scene.js";

export { LEVEL, closeTerminal, getInteraction, getObjective, interact, isWalkable };

export const ui = Object.freeze({
  id: "rf12-3",
  levelLabel: "RF-10-3",
  brand: "TIMED KETTLE BOILING",
  unit: "UNIT RF-10-3 · CHINESE HOME",
  systemLabel: "WATER STATUS",
  cargoLabel: "CARGO",
  gateLabel: "TIMER",
  startKicker: "LEVEL RF-10-3 / HIGH",
  startTitle: "烧开水<br />精准关火",
  startCopy: "取水壶 → 装水 → 放到炉头 → 点火。55–65 秒水壶沸腾，须在此期间关火；提前关火需重新烧水，超时着火后须灭火、重新装水再烧。",
  completeKicker: "WATER BOILED",
  completeTitle: "烧水完成",
  completeCopy: "水已烧开，炉头已在 55–65 秒内关闭。",
  terminalHeading: "TIMED BOILING / RF-10-3",
});

export const camera = Object.freeze({ position: [0, 11.8, 8.6], lookAt: [0, 0.55, -0.45], fov: 38 });
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });
export const eventMessages = Object.freeze({
  kettle_collected: "已拿起水壶",
  kettle_on_burner: "水壶已放到炉头",
  kettle_filled: "水壶已装满水 · 请放到炉头",
  boiling_started: "炉头已开启 · 55–65 秒内关火",
  boiling_too_early_restart: "关火过早 · 重新点火烧水，从零计时",
  kitchen_fire_started: "厨房着火 · 请拿起灭火器灭火",
  extinguisher_collected: "已拿起灭火器",
  fire_extinguished_refill_required: "火势已扑灭 · 取下水壶，重新装水再烧",
  boiling_completed: "烧水完成 · 关火时间在 55–65 秒窗口内",
  item_dropped: "物品已放下",
  empty_interaction: "当前没有可操作对象 · 状态余量 -4",
  progress_depleted: "状态余量耗尽，烧水任务终止",
});

export function createScene() { return createCookingKitchenScene(); }
export function syncVisuals(world, state) { syncCookingKitchenVisuals(world, state); }
export function isCarrying(state) { return Boolean(state.carriedItem); }
export function getTelemetry(state) { return getStateTelemetry(state); }
export function getDebugState(state) { return getDebug(state); }
export function getSoundPosition(_before, state) { return state.player; }
export function prepareView(world, { firstPerson }) { if (world.ceilingRoot) world.ceilingRoot.visible = firstPerson; }

export const createInteractionAnimation = createKitchenInteractionAnimation;

let clockAt=null;
export function resetBoilingClock(){clockAt=null;}
export function createInitialState(){resetBoilingClock();return createEngineState();}
export function updateMovement(state,input={},delta=0){
 return updateEngineMovement(state,{...input,clockDelta:0,environmentClock:true},delta);
}
export function updateEnvironment(state,delta=0){
 const now=performance.now(),seconds=clockAt===null?delta:Math.max(0,(now-clockAt)/1000);
 clockAt=now;
 return updateEngineEnvironment(state,seconds);
}
