import { ITEM_META, ITEM_TYPES, LEVEL } from "./level.js";
import { closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement } from "./engine.js";
import { createWaterLeakCargoModel, createWaterLeakScene, setWaterLeakCargoModel, syncWaterLeakVisuals } from "./scene.js";

export { LEVEL, closeTerminal, createInitialState, getInteraction, getObjective, interact, updateMovement };

export const ui = Object.freeze({
  id: "rf06", brand: "HOME LEAK RESPONSE", unit: "UNIT R-06 · HOUSEHOLD MAINTENANCE", systemLabel: "LEAK STATUS", cargoLabel: "TOOL", gateLabel: "RESPONSE", startKicker: "LEVEL RF-06 / ORDINARY HOME", startTitle: "LEAK<br />RESPONSE", startCopy: "找到扳手关闭水槽下的漏水阀门，放置水桶接水，用拖把清理积水，最后把扳手和拖把放回工具架。W/S 前后、A/D 平移和每次互动会消耗状态余量，Q/E 转向不消耗余量。", completeKicker: "HOUSEHOLD MAINTENANCE COMPLETE", completeTitle: "漏水已处理", completeCopy: "阀门已关闭、积水已清理，工具已归还。", terminalHeading: "LEAK RESPONSE / RF-06",
});
export const camera = Object.freeze({ position: [0, 15.5, 4.5], lookAt: [0, 0.3, 0], fov: 38 });
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });
export const eventMessages = Object.freeze({
  item_collected_wrench: "已拿起扳手 · 互动 -5 / 奖励 +15", item_collected_bucket: "已拿起水桶 · 互动 -5 / 奖励 +15", item_collected_mop: "已拿起拖把 · 互动 -5 / 奖励 +15", item_recollected_wrench: "再次拿起扳手 · 状态余量 -5", item_recollected_bucket: "再次拿起水桶 · 状态余量 -5", item_recollected_mop: "再次拿起拖把 · 状态余量 -5", valve_closed: "漏水阀门已关闭 · 阶段奖励 +15", bucket_placed: "水桶已放到漏水点 · 阶段奖励 +15", puddle_cleaned: "积水已清理 · 阶段奖励 +15", tool_returned_wrench: "扳手已归还工具架 · 阶段奖励 +15", tool_returned_mop: "拖把已归还工具架 · 阶段奖励 +15", leak_resolved: "漏水处理完成 · 状态余量恢复至 100", valve_requires_wrench: "关闭阀门需要扳手 · 状态余量 -5", bucket_requires_closed_valve: "请先关闭阀门 · 状态余量 -5", mop_requires_bucket: "请先放置水桶 · 状态余量 -5", tool_not_ready: "工具尚未完成使用 · 状态余量 -5", item_dropped_wrench: "扳手已放下 · 状态余量 -5", item_dropped_bucket: "水桶已放下 · 状态余量 -5", item_dropped_mop: "拖把已放下 · 状态余量 -5", empty_interaction: "附近没有可操作对象 · 状态余量 -5", progress_depleted: "状态余量耗尽，漏水处理终止",
});
export function createScene() { return createWaterLeakScene(); }
export function syncVisuals(world, state) { syncWaterLeakVisuals(world, state); }
export function createCargoModel() { return createWaterLeakCargoModel(); }
export function syncRobotCargo(robot, state) { if (state.carriedItem) setWaterLeakCargoModel(robot.userData.rackPayload, state.carriedItem); }
export function isCarrying(state) { return Boolean(state.carriedItem); }
export function getTelemetry(state) { return { system: state.complete ? "COMPLETE" : state.valveClosed ? (state.puddleClean ? "TOOLS RETURN" : "LEAK CONTROL") : "LEAK ACTIVE", systemOnline: state.valveClosed, cargo: state.carriedItem ? ITEM_META[state.carriedItem].shortName : "EMPTY", gate: `${Number(state.valveClosed) + Number(state.bucketPlaced) + Number(state.puddleClean)}/3 DONE` }; }
export function getProgressSteps(state) { return [{ label: "关闭漏水阀门", done: state.valveClosed, active: !state.valveClosed }, { label: "放置水桶接水", done: state.bucketPlaced, active: state.valveClosed && !state.bucketPlaced }, { label: "清理地面积水", done: state.puddleClean, active: state.bucketPlaced && !state.puddleClean }, { label: "归还扳手和拖把", done: state.complete, active: state.puddleClean }]; }
export function getTerminal(state) { return { title: "家庭漏水处理状态", copy: "所有信息均与主界面一致。", rows: [["VALVE", state.valveClosed ? "CLOSED" : "OPEN"], ["BUCKET", state.bucketPlaced ? "PLACED" : "PENDING"], ["PUDDLE", state.puddleClean ? "CLEAR" : "ACTIVE"], ["TOOLS", state.complete ? "RETURNED" : "PENDING"]] }; }
export function getSoundPosition(_before, state) { return state.player; }
export function getDebugState(state) { return { carriedItem: state.carriedItem, items: Object.fromEntries(ITEM_TYPES.map((type) => [type, state.items[type].location])), valveClosed: state.valveClosed, bucketPlaced: state.bucketPlaced, puddleClean: state.puddleClean, returned: state.returned }; }
