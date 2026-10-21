import { G1_LOCOMOTION } from "../../g1-locomotion.js";

export const ITEM_TYPES = Object.freeze(["tomato", "apple"]);
export const ITEM_META = Object.freeze({
  tomato: Object.freeze({ name: "番茄采摘筐", shortName: "番茄", color: 0xc84b3f, code: "T-01" }),
  apple: Object.freeze({ name: "苹果采摘筐", shortName: "苹果", color: 0xc69b3a, code: "A-02" }),
});
export const LEVEL = Object.freeze({
  id: "rf15", title: "Cold Chain Loading", bounds: Object.freeze({ minX: -9, maxX: 9, minZ: -6, maxZ: 6 }),
  playerStart: Object.freeze({ x: -7.1, z: 4.7, yaw: Math.PI / 2 }), playerRadius: 0.42, interactionRange: 1.55, ...G1_LOCOMOTION,
  scale: Object.freeze({ x: -4.8, z: 1.0 }), packTable: Object.freeze({ x: 0, z: -2.0 }), truck: Object.freeze({ x: 6.5, z: -1.0 }), terminal: Object.freeze({ x: -7.2, z: 4.8 }),
  items: Object.freeze({ tomato: Object.freeze({ x: -5.4, z: -2.5 }), apple: Object.freeze({ x: -3.8, z: -2.5 }) }),
  progress: Object.freeze({ initial: 100, maximum: 100, actionDrainPerSecond: 1.2, interactionCost: 4, weighReward: 8, packReward: 12, loadReward: 18 }),
  staticColliders: Object.freeze([
    { id: "north-wall", minX: -9, maxX: 9, minZ: -6, maxZ: -5.8 }, { id: "south-wall", minX: -9, maxX: 9, minZ: 5.8, maxZ: 6 },
    { id: "west-wall", minX: -9, maxX: -8.8, minZ: -6, maxZ: 6 }, { id: "east-wall", minX: 8.8, maxX: 9, minZ: -6, maxZ: 6 },
    { id: "scale", minX: -5.6, maxX: -4.0, minZ: 0.15, maxZ: 1.75 }, { id: "pack-table", minX: -1.6, maxX: 1.6, minZ: -2.8, maxZ: -1.4 },
    { id: "truck-body", minX: 4.8, maxX: 8.2, minZ: -3.5, maxZ: 1.6 },
  ]),
});
