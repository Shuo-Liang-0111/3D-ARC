import { G1_LOCOMOTION } from "../../g1-locomotion.js";

export const HAZARD_TYPES = Object.freeze(["gasKnob", "hood", "cloth", "window", "gasValve"]);

export const HAZARD_META = Object.freeze({
  gasKnob: Object.freeze({ label: "复位灶台燃气旋钮" }),
  hood: Object.freeze({ label: "开启油烟机" }),
  cloth: Object.freeze({ label: "移开炉边湿抹布" }),
  window: Object.freeze({ label: "打开厨房窗通风" }),
  gasValve: Object.freeze({ label: "关闭燃气总阀" }),
});

export const LEVEL = Object.freeze({
  id: "rf12",
  title: "Chinese Home Kitchen Safety",
  bounds: Object.freeze({ minX: -4.2, maxX: 4.2, minZ: -3.4, maxZ: 4.65 }),
  roomDimensions: Object.freeze({ width: 8.4, depth: 6.8, clearHeight: 2.8 }),
  playerStart: Object.freeze({ x: 0, z: 2.55, yaw: Math.PI }),
  playerRadius: 0.32,
  interactionRange: 1.45,
  ...G1_LOCOMOTION,
  checklist: Object.freeze({ x: -3.25, z: 2.25 }),
  cloth: Object.freeze({ x: 0.65, z: -2.55 }),
  hood: Object.freeze({ x: 2.25, z: -2.78 }),
  gasKnob: Object.freeze({ x: 2.25, z: -2.45 }),
  gasValve: Object.freeze({ x: 3.55, z: -2.3 }),
  window: Object.freeze({ x: -0.75, z: -3.12 }),
  sink: Object.freeze({ x: -0.45, z: -2.55 }),
  terminal: Object.freeze({ x: -3.35, z: 2.55 }),
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
    { id: "entry-return-left", minX: -4.2, maxX: -0.95, minZ: 3.4, maxZ: 4.65 },
    { id: "entry-return-right", minX: 0.95, maxX: 4.2, minZ: 3.4, maxZ: 4.65 },
  ]),
  progress: Object.freeze({ initial: 100, maximum: 100, actionDrainPerSecond: 1.1, interactionCost: 4, hazardReward: 12 }),
});
