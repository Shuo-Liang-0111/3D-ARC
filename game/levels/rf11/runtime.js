import { CARGO_META, LEVEL, ROBOTS } from "./level.js";
import * as engine from "./engine.js";
import { createCargoModel, createRF11Scene, syncRF11Visuals } from "./scene.js";
export { LEVEL, ROBOTS, CARGO_META };
export const ui = Object.freeze({ id: "rf11", levelLabel: "RF-09", brand: "COOPERATIVE SERVO CELL", unit: "UNIT R-09 · TWO ROBOT LIFT", systemLabel: "CELL STATUS", cargoLabel: "PAYLOAD", gateLabel: "PAIR CONFIRM", startKicker: "LEVEL RF-09 / PRECISION MANUFACTURING", startTitle: "COOPERATIVE<br />LIFT", startCopy: "两台 G1 同时协作搬运精密伺服泵箱。", completeKicker: "CELL COMPLETE", completeTitle: "协作搬运完成", completeCopy: "伺服泵箱已稳定放置到装配基座。", terminalHeading: "SERVO CELL / RF-09" });
export const camera = Object.freeze({ position: [0, 5.8, 7.0], lookAt: [0, 0.8, 0.0], fov: 64 });
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });
export const eventMessages = engine.eventMessages;
export const createInitialState = engine.createInitialState;
export const cloneState = engine.cloneState;
export const updateMovement = engine.updateMovement;
export const getInteraction = engine.getInteraction;
export const interact = engine.interact;
export const isCarrying = engine.isCarrying;
export const getObjective = engine.getObjective;
export const getTelemetry = engine.getTelemetry;
export const getDebugState = engine.getDebugState;
export const isWalkable = engine.isWalkable;
export function createScene() { return createRF11Scene(); }
export function syncVisuals(world, state) { syncRF11Visuals(world, state); }
export { createCargoModel };
export function syncRobotCargo() {}
export function getSoundPosition(_before, state) { return state.player; }
export function getProgressSteps(state) { return [{ label: "两机确认抬起", done: state.cargo.location !== "floor", active: state.cargo.location === "floor" }, { label: "两机确认放置", done: state.complete, active: state.cargo.location === "carried" }]; }
export function closeTerminal(state) { return state; }
export function getTerminal(state) { return { title: state.complete ? "装配基座已锁定" : "双机器人协作搬运", copy: state.complete ? "任务完成。" : "两台机器人必须分别按交互键确认当前动作。", rows: [["ALPHA", state.confirms.alpha ? "CONFIRMED" : "WAITING"], ["BETA", state.confirms.beta ? "CONFIRMED" : "WAITING"], ["PAYLOAD", state.cargo.location.toUpperCase()]] }; }
