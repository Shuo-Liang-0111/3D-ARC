import { G1_LOCOMOTION } from "../../g1-locomotion.js";

export const CHECKPOINT_IDS = Object.freeze(["whiteboard", "workbench", "window_ac"]);

export const CHECKPOINT_META = Object.freeze({
  whiteboard: Object.freeze({ name: "移动白板", shortName: "白板" }),
  workbench: Object.freeze({ name: "曲面屏工作台", shortName: "工作台" }),
  window_ac: Object.freeze({ name: "窗边空调与排风管", shortName: "窗边空调" }),
});

export const LEVEL = Object.freeze({
  id: "test_zpf",
  title: "Small Office Inspection",
  bounds: Object.freeze({ minX: 0, maxX: 3.5, minZ: 0, maxZ: 3.6 }),
  playerStart: Object.freeze({ x: 0.75, z: 0.35, yaw: 0 }),
  playerRadius: 0.26,
  playerHeight: 1.72,
  interactionRange: 0.72,
  ...G1_LOCOMOTION,
  checkpoints: Object.freeze({
    whiteboard: Object.freeze({ x: 0.9, z: 1.75 }),
    workbench: Object.freeze({ x: 1.22, z: 2.67 }),
    window_ac: Object.freeze({ x: 2.58, z: 1.72 }),
  }),
  progress: Object.freeze({
    initial: 100,
    maximum: 100,
    movementDrainPerSecond: 0.15,
  }),
  staticColliders: Object.freeze([
    { id: "mobile-whiteboard", minX: 0.08, maxX: 0.55, minZ: 0.62, maxZ: 2.88 },
    { id: "north-storage", minX: 0.1, maxX: 0.82, minZ: 3.05, maxZ: 3.5 },
    { id: "office-desk", minX: 1.56, maxX: 3.28, minZ: 2.24, maxZ: 3.08 },
    { id: "portable-ac", minX: 2.94, maxX: 3.44, minZ: 1.48, maxZ: 1.96 },
    { id: "folding-chaise", minX: 2.25, maxX: 3.44, minZ: 0.2, maxZ: 1.32 },
    { id: "south-low-storage", minX: 2.2, maxX: 3.46, minZ: 0.02, maxZ: 0.48 },
    { id: "monitor-boxes", minX: 1.52, maxX: 2.22, minZ: 0.18, maxZ: 0.95 },
  ]),
});
