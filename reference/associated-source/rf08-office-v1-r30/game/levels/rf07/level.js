import { G1_LOCOMOTION } from "../../g1-locomotion.js";

export const SAMPLE_TYPES = Object.freeze(["sampleA", "sampleB", "sampleC"]);

export const SAMPLE_META = Object.freeze({
  sampleA: Object.freeze({ code: "A-17", name: "琥珀色样本 A-17", shortName: "A-17", color: 0xd99032 }),
  sampleB: Object.freeze({ code: "B-12", name: "蓝色样本 B-12", shortName: "B-12", color: 0x3f78b8 }),
  sampleC: Object.freeze({ code: "C-04", name: "绿色样本 C-04", shortName: "C-04", color: 0x4e956a }),
});

export const LEVEL = Object.freeze({
  id: "rf07",
  title: "Laboratory Cold-Chain Transfer",
  bounds: Object.freeze({ minX: -11.85, maxX: 11.85, minZ: -7.85, maxZ: 7.85 }),
  roomDimensions: Object.freeze({ width: 24, depth: 16, clearHeight: 3.3 }),
  aisleWidths: Object.freeze({ main: 1.5, secondary: 1.2 }),
  playerStart: Object.freeze({ x: 0, z: 6.65, yaw: Math.PI }),
  playerRadius: 0.32,
  interactionRange: 1.75,
  ...G1_LOCOMOTION,
  requiredOrder: Object.freeze(["sampleA", "sampleC", "sampleB"]),
  targetCabinet: "cold-02",
  samples: Object.freeze({
    sampleA: Object.freeze({ x: -9.25, z: -5.75, assetX: -9.25, assetZ: -6.62, y: 0.98 }),
    sampleB: Object.freeze({ x: -7.35, z: -5.75, assetX: -7.35, assetZ: -6.62, y: 0.98 }),
    sampleC: Object.freeze({ x: -5.45, z: -5.75, assetX: -5.45, assetZ: -6.62, y: 0.98 }),
  }),
  taskBoard: Object.freeze({ x: -10.35, z: -1.6 }),
  transportCase: Object.freeze({ x: 1.2, z: 2.55 }),
  transportCaseAsset: Object.freeze({ x: 1.2, y: 0.96, z: 1.1, yaw: 0 }),
  transportCaseCollider: Object.freeze({ id: "transport-case", minX: 0.84, maxX: 1.56, minZ: 0.84, maxZ: 1.36 }),
  coolingModule: Object.freeze({ x: 4.85, z: 1.1 }),
  coolingModuleAsset: Object.freeze({ x: 3.65, y: 0.98, z: 1.1, yaw: 0 }),
  coldCabinets: Object.freeze({
    "cold-01": Object.freeze({ x: 9.55, z: -2.15, assetX: 10.82, assetZ: -2.15, yaw: -Math.PI / 2, label: "医用冷藏柜 01" }),
    "cold-02": Object.freeze({ x: 9.55, z: 0, assetX: 10.82, assetZ: 0, yaw: -Math.PI / 2, label: "医用冷藏柜 02" }),
    "cold-03": Object.freeze({ x: 9.55, z: 2.15, assetX: 10.82, assetZ: 2.15, yaw: -Math.PI / 2, label: "医用冷藏柜 03" }),
  }),
  progress: Object.freeze({ initial: 100, maximum: 100, actionDrainPerSecond: 1.5, interactionCost: 5, pickupReward: 15, sampleLoadReward: 40, taskCompletionReward: 15 }),
  staticColliders: Object.freeze([
    { id: "north-wall", minX: -12.15, maxX: 12.15, minZ: -8.15, maxZ: -7.88 },
    { id: "south-wall-west", minX: -12.15, maxX: -1.05, minZ: 7.88, maxZ: 8.15 },
    { id: "south-wall-east", minX: 1.05, maxX: 12.15, minZ: 7.88, maxZ: 8.15 },
    { id: "west-wall", minX: -12.15, maxX: -11.88, minZ: -8.15, maxZ: 8.15 },
    { id: "east-wall", minX: 11.88, maxX: 12.15, minZ: -8.15, maxZ: 8.15 },
    { id: "sample-receiving-bench", minX: -11.32, maxX: -3.38, minZ: -7.62, maxZ: -6.52 },
    { id: "bsc-bank", minX: -3.12, maxX: 3.18, minZ: -7.64, maxZ: -6.38 },
    { id: "dry-reagent-cabinet", minX: 6.58, maxX: 8.92, minZ: -7.64, maxZ: -6.38 },
    { id: "transfer-cart-01", minX: -7.22, maxX: -6.08, minZ: -2.68, maxZ: -2.02 },
    { id: "transfer-cart-02", minX: -4.52, maxX: -3.38, minZ: -2.68, maxZ: -2.02 },
    { id: "packing-island", minX: -0.48, maxX: 4.48, minZ: 0.24, maxZ: 1.96 },
    { id: "wash-bench", minX: -11.75, maxX: -10.08, minZ: 2.62, maxZ: 5.58 },
    { id: "anteroom-left", minX: -1.76, maxX: -1.44, minZ: 5.08, maxZ: 8.0 },
    { id: "anteroom-right", minX: 1.44, maxX: 1.76, minZ: 5.08, maxZ: 8.0 },
    { id: "ppe-lockers", minX: 2.25, maxX: 5.15, minZ: 6.78, maxZ: 7.72 },
    { id: "task-board", minX: -11.88, maxX: -11.62, minZ: -2.48, maxZ: -0.72 },
    { id: "cold-01", minX: 10.35, maxX: 11.30, minZ: -2.58, maxZ: -1.72 },
    { id: "cold-02", minX: 10.35, maxX: 11.30, minZ: -0.43, maxZ: 0.43 },
    { id: "cold-03", minX: 10.35, maxX: 11.30, minZ: 1.72, maxZ: 2.58 },
  ]),
});
