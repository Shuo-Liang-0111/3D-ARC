import { KITCHEN } from "./interaction-layout.js";
import { G1_LOCOMOTION } from "../../g1-locomotion.js";

export const ITEM_TYPES = Object.freeze(["tomato", "tofu", "oil", "pan"]);
export const ITEM_META = Object.freeze({
  tomato: Object.freeze({ name: "番茄篮", shortName: "番茄篮", color: 0xb94b3e }),
  tofu: Object.freeze({ name: "豆腐盒", shortName: "豆腐盒", color: 0xe7e2d2 }),
  oil: Object.freeze({ name: "食用油瓶", shortName: "食用油", color: 0xd9a43b }),
  pan: Object.freeze({ name: "平底锅", shortName: "平底锅", color: 0x343b3c }),
});

export const HAZARD_TYPES = Object.freeze(["window", "gasKnob", "gasValve"]);

export const HAZARD_META = Object.freeze({
  gasKnob: Object.freeze({ label: "关闭燃气炉" }),
  hood: Object.freeze({ label: "开启油烟机" }),
  cloth: Object.freeze({ label: "移开炉边湿抹布" }),
  window: Object.freeze({ label: "打开厨房窗通风" }),
  gasValve: Object.freeze({ label: "关闭燃气总阀" }),
});

export const LEVEL = Object.freeze({
  id: "rf12",
  title: "Chinese Home Kitchen Safety",
  bounds: Object.freeze({ minX: -4.2, maxX: 4.2, minZ: -3.4, maxZ: 6.9 }),
  roomDimensions: Object.freeze({ width: 8.4, depth: 6.8, clearHeight: 2.8 }),
  playerStart: Object.freeze({ x: 0, z: 2.55, yaw: Math.PI }),
  playerRadius: 0.32,
  interactionRange: 1.45,
  ...G1_LOCOMOTION,
  checklist: Object.freeze({ x: -3.25, z: 2.25 }),
  recipeCard: Object.freeze({ x: -3.25, z: 2.25 }),
  cloth: KITCHEN.cloth,
  hood: KITCHEN.hood,
  hoodSwitch: Object.freeze({ x: 2.25, z: -2.45 }),
  gasKnob: KITCHEN.knob,
  gasValve: Object.freeze({ x: 3.94, z: -2.3 }),
  window: KITCHEN.window,
  sink: KITCHEN.sink,
  terminal: Object.freeze({ x: -3.35, z: 2.55 }),
  burner: Object.freeze({ x: 2.25, z: -2.78 }),
  trivet: Object.freeze({ x: 3.15, z: -1.42 }),
  items: Object.freeze({ tomato: Object.freeze({ x: -3.0, z: -2.55 }), tofu: Object.freeze({ x: -2.2, z: -2.55 }), oil: Object.freeze({ x: -1.4, z: -2.55 }), pan: Object.freeze({ x: 0.9, z: -1.38 }) }),
  prepTargets: Object.freeze({ tomato: Object.freeze({ x: -1.25, z: -1.28 }), tofu: Object.freeze({ x: -0.25, z: -1.28 }), oil: Object.freeze({ x: 0.75, z: -1.28 }) }),
  staticColliders: Object.freeze([
    { id: "north-wall", minX: -4.2, maxX: 4.2, minZ: -3.4, maxZ: -3.25 },
    { id: "west-wall-rear", minX: -4.2, maxX: -4.05, minZ: -3.4, maxZ: 1.55 },
    { id: "west-wall-front", minX: -4.2, maxX: -4.05, minZ: 2.35, maxZ: 3.4 },
    { id: "east-wall", minX: 4.05, maxX: 4.2, minZ: -3.4, maxZ: 3.4 },
    { id: "south-wall-west", minX: -4.2, maxX: -0.95, minZ: 3.25, maxZ: 3.4 },
    { id: "south-wall-east", minX: 0.95, maxX: 4.2, minZ: 3.25, maxZ: 3.4 },
    { id: "counter", minX: -3.825, maxX: 3.435, minZ: -3.24, maxZ: -2.165 },
    { id: "refrigerator", minX: -4.01, maxX: -3.09, minZ: -1.34, maxZ: -0.66 },
    { id: "entry-cabinet", minX: -3.71, maxX: -2.99, minZ: 2.325, maxZ: 2.775 },
    { id: "entry-return-left", minX: -1.11, maxX: -0.95, minZ: 3.4, maxZ: 6.9 },
    { id: "entry-return-right", minX: 0.95, maxX: 1.11, minZ: 3.4, maxZ: 6.9 },
    { id: "hall-end-wall", minX: -1.11, maxX: 1.11, minZ: 6.82, maxZ: 6.98 },
  ]),
  progress: Object.freeze({ initial: 100, maximum: 100, actionDrainPerSecond: 1.1, interactionCost: 4, hazardReward: 12 }),
});
