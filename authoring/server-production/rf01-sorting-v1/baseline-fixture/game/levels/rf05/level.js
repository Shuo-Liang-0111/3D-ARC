import { G1_LOCOMOTION } from "../../g1-locomotion.js";

export const ITEM_TYPES = Object.freeze(["towel", "cup", "trash"]);

export const ITEM_META = Object.freeze({
  towel: Object.freeze({ name: "白色毛巾", shortName: "毛巾", color: 0xd9d5c8 }),
  cup: Object.freeze({ name: "玻璃水杯", shortName: "水杯", color: 0x8ec5d6 }),
  trash: Object.freeze({ name: "地面垃圾", shortName: "垃圾", color: 0x69706d }),
});

export const TARGET_META = Object.freeze({
  laundry: Object.freeze({ name: "脏衣篮", accepts: "towel" }),
  cart: Object.freeze({ name: "清洁车回收格", accepts: "cup" }),
  bin: Object.freeze({ name: "垃圾桶", accepts: "trash" }),
});

export const LEVEL = Object.freeze({
  id: "rf05",
  title: "Hotel Room Reset",
  // Standard Chinese business-hotel twin room: 8.4m wide x 10.8m deep.
  bounds: Object.freeze({ minX: -4.2, maxX: 4.2, minZ: -5.4, maxZ: 5.4 }),
  playerStart: Object.freeze({ x: 0, z: 4.72, yaw: Math.PI }),
  playerRadius: 0.32,
  interactionRange: 2.15,
  ...G1_LOCOMOTION,
  items: Object.freeze({
    towel: Object.freeze({ x: -2.15, z: -2.2 }),
    cup: Object.freeze({ x: -1.0, z: -2.35 }),
    trash: Object.freeze({ x: 2.25, z: -0.15 }),
  }),
  targets: Object.freeze({
    laundry: Object.freeze({ x: -2.15, z: 2.35 }),
    cart: Object.freeze({ x: 1.0, z: 3.75 }),
    bin: Object.freeze({ x: 2.15, z: 4.55 }),
  }),
  itemTargets: Object.freeze({ towel: "laundry", cup: "cart", trash: "bin" }),
  progress: Object.freeze({ initial: 100, maximum: 100, actionDrainPerSecond: 1.5, interactionCost: 5, pickupReward: 15, correctDeliveryReward: 15 }),
  staticColliders: Object.freeze([
    { id: "north-wall", minX: -4.2, maxX: 4.2, minZ: -5.55, maxZ: -5.25 },
    { id: "west-wall", minX: -4.35, maxX: -4.05, minZ: -5.4, maxZ: 5.4 },
    { id: "east-wall", minX: 4.05, maxX: 4.35, minZ: -5.4, maxZ: 5.4 },
    { id: "south-wall-west", minX: -4.2, maxX: -0.65, minZ: 5.25, maxZ: 5.55 },
    { id: "south-wall-east", minX: 0.65, maxX: 4.2, minZ: 5.25, maxZ: 5.55 },
    { id: "bed-left", minX: -3.08, maxX: -1.22, minZ: -4.92, maxZ: -2.02 },
    { id: "bed-right", minX: -0.72, maxX: 1.14, minZ: -4.92, maxZ: -2.02 },
    { id: "nightstand", minX: -1.28, maxX: -0.72, minZ: -2.83, maxZ: -2.25 },
    { id: "desk", minX: 3.0, maxX: 3.9, minZ: -3.32, maxZ: -0.42 },
    { id: "tv-console", minX: 3.32, maxX: 3.98, minZ: -0.64, maxZ: 1.14 },
    { id: "wardrobe", minX: 2.45, maxX: 3.98, minZ: 2.68, maxZ: 3.45 },
    { id: "luggage-bench", minX: 2.3, maxX: 3.9, minZ: 1.82, maxZ: 2.48 },
    { id: "desk-chair", minX: 2.0, maxX: 2.84, minZ: -2.34, maxZ: -1.40 },
    { id: "bathroom-partition", minX: -1.18, maxX: -0.92, minZ: 3.08, maxZ: 5.25 },
    { id: "bathroom-partition-return", minX: -1.18, maxX: -0.92, minZ: 1.55, maxZ: 2.08 },
    { id: "bathroom-room-side-wall", minX: -4.05, maxX: -1.05, minZ: 1.78, maxZ: 1.94 },
    { id: "bathroom-vanity", minX: -4.02, maxX: -3.22, minZ: 3.32, maxZ: 4.58 },
    { id: "bathroom-shower", minX: -3.08, maxX: -1.48, minZ: 4.46, maxZ: 5.10 },
    { id: "laundry-basket", minX: -2.55, maxX: -1.75, minZ: 1.95, maxZ: 2.75 },
    { id: "cleaning-cart", minX: 0.48, maxX: 1.52, minZ: 3.42, maxZ: 4.08 },
    { id: "trash-bin", minX: 1.85, maxX: 2.45, minZ: 4.25, maxZ: 4.85 },
  ]),
});
