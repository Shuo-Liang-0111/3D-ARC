import { G1_LOCOMOTION } from "../../g1-locomotion.js";
import { LEVEL as SHARED_LEVEL } from "../../level.js";

export const REVISION = "realism-v0.4.7";
export const UMPIRE_CHAIR = Object.freeze({ x: -7.35, z: 0, yaw: Math.PI / 2 });
export const BALLS = [
  [-3.8, 10], [3.2, 7.5], [-1.4, 3], [4.5, 13.5],
  [-3.5, -4], [3.6, -7], [-1.2, -11], [4.7, -14],
].map(([x, z], index) => ({ id: `ball-${index + 1}`, name: `网球 ${index + 1}`, x, y: Math.abs(x) <= 5.485 && Math.abs(z) <= 11.885 ? 0.004 : 0, z }));
export const LEVEL = Object.freeze({
  id: "rf14", title: "Tennis Court Collection", revision: REVISION,
  bounds: { minX: -10, maxX: 10, minZ: -19, maxZ: 22 },
  playerStart: { x: -2, z: 8, yaw: Math.PI },
  playerRadius: SHARED_LEVEL.playerRadius,
  playerForwardOffset: SHARED_LEVEL.playerForwardOffset,
  interactionRange: 1.05, ...G1_LOCOMOTION,
  cart: { x: 8.2, y: 0.85, z: 8 },
  gate: { x: 0, z: 19, width: 2.4 },
  progress: { initial: 100, maximum: 100, actionDrainPerSecond: 0.38, invalidInteractionDrain: 4 },
});
export const STRUCTURES = [
  { id: "west-fence", size: [0.08, 3, 38], position: [-10, 1.5, 0] },
  { id: "east-fence", size: [0.08, 3, 38], position: [10, 1.5, 0] },
  { id: "north-fence", size: [20, 3, 0.08], position: [0, 1.5, -19] },
  { id: "south-fence-west", size: [8.8, 3, 0.08], position: [-5.6, 1.5, 19] },
  { id: "south-fence-east", size: [8.8, 3, 0.08], position: [5.6, 1.5, 19] },
  { id: "net", size: [12.8, 0.91, 0.06], position: [0, 0.455, 0] },
  { id: "net-post-west", size: [0.14, 1.07, 0.14], position: [-6.4, 0.535, 0] },
  { id: "net-post-east", size: [0.14, 1.07, 0.14], position: [6.4, 0.535, 0] },
  { id: "bench", size: [0.642, 0.88, 1.405], position: [8.5, 0.44, 4.5] },
  { id: "tennis-bag", size: [0.72, 0.3493, 0.3267], position: [8.5, 0.17465, 5.5] },
  { id: "cart", size: [0.65, 0.95, 0.65], position: [8.2, 0.475, 8] },
  { id: "umpire-chair", size: [1.259, 2.3, 1.315], position: [UMPIRE_CHAIR.x, 1.15, UMPIRE_CHAIR.z] },
  ...[-16, 16].flatMap(z => [-9.6, 9.6].map(x => ({ id: `floodlight-${x}-${z}`, size: [0.18, 6, 0.18], position: [x, 3, z] }))),
];
export function boundsFor(box) {
  return { id: box.id, minX: box.position[0] - box.size[0] / 2, maxX: box.position[0] + box.size[0] / 2, minZ: box.position[2] - box.size[2] / 2, maxZ: box.position[2] + box.size[2] / 2 };
}
export const STATIC_COLLIDERS = STRUCTURES.map(boundsFor);
