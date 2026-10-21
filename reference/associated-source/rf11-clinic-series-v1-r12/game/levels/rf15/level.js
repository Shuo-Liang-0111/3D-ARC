import { G1_LOCOMOTION } from "../../g1-locomotion.js";
import { LEVEL as SHARED } from "../../level.js";

export const REVISION = "realism-v0.4.3";
export const PRODUCE = [
  { id: "tomato", name: "番茄", code: "T01", weight: 8.6, x: -7.45, y: 1.18, z: -1.35, collider: "crate-stack" },
  { id: "apple", name: "苹果", code: "A02", weight: 9.4, x: -6.82, y: 1.18, z: -1.35, collider: "crate-stack" },
];
export const LEVEL = Object.freeze({
  id: "rf15", title: "Harvest Cold Chain", revision: REVISION,
  bounds: { minX: -8.6, maxX: 8.6, minZ: -6.8, maxZ: 7.5 },
  playerStart: { x: -5.9, z: 2.5, yaw: Math.PI },
  playerRadius: SHARED.playerRadius, playerForwardOffset: SHARED.playerForwardOffset,
  interactionRange: 1.55, ...G1_LOCOMOTION,
  scale: { x: -2.6, y: 1.062, z: -4.2, collider: "scale-table" },
  pack: { x: 0.6, y: 0.84, z: -3.8, collider: "pack-table" },
  tail: { x: 5.3, y: 0.14, z: 1.45, collider: "tail-lift" },
  lift: { x: 7.15, y: 1.05, z: 1.45, collider: "lift-control" },
  dispatch: { x: -6.8, y: 1.1, z: 4.9, collider: "dispatch" },
  progress: { initial: 100, maximum: 100, movementPerMeter: 0.8, blockedPerSecond: 1.8, interactionCost: 1, errorCost: 5, milestoneReward: 2 },
});
export const STRUCTURES = [
  { id: "west-wall", size: [0.2, 3.8, 9], position: [-8.5, 1.9, -2.4] },
  { id: "north-wall", size: [10.1, 3.8, 0.2], position: [-3.55, 1.9, -6.7] },
  { id: "intake", size: [3.4, 0.82, 1.0], position: [-5.9, 0.41, -4.2] },
  { id: "scale-table", size: [1.4, 0.76, 1.1], position: [-2.6, 0.38, -4.2] },
  { id: "pack-table", size: [2.1, 0.84, 1.2], position: [0.6, 0.42, -3.8] },
  { id: "truck", size: [2.45, 3.15, 6.1], position: [5.3, 1.575, -3.0] },
  { id: "tail-lift", size: [2.3, 0.12, 1.85], position: [5.3, 0.06, 1.0] },
  { id: "lift-control", size: [0.18, 1.15, 0.18], position: [7.15, 0.575, 1.45] },
  { id: "dispatch", size: [1.1, 1.0, 0.55], position: [-6.8, 0.5, 4.9] },
  { id: "crate-stack", size: [1.3, 1.2, 0.85], position: [-7.4, 0.6, -1.3] },
  { id: "pallet-jack", size: [0.75, 1.25, 1.5], position: [1.5, 0.625, 4.9] },
  ...[-8.4, 2.0].map(x => ({ id: x < 0 ? "shed-post-west" : "shed-post-east", size: [0.16, 4.2, 0.16], position: [x, 2.1, 1.8] })),
];
export function boundsFor(structure) { return { id: structure.id, minX: structure.position[0] - structure.size[0] / 2, maxX: structure.position[0] + structure.size[0] / 2, minZ: structure.position[2] - structure.size[2] / 2, maxZ: structure.position[2] + structure.size[2] / 2 }; }
export const STATIC_COLLIDERS = STRUCTURES.map(boundsFor);
