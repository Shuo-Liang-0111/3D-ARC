import { G1_LOCOMOTION } from "../../g1-locomotion.js";

const chairX = Object.freeze([-1.98, -0.66, 0.66, 1.98]);

export const RF08_LAYOUT = Object.freeze({
  room: Object.freeze({ length: 6.6, width: 3.8, height: 2.9 }),
  entrance: Object.freeze({ wall: "west", minZ: 0.82, maxZ: 1.72 }),
  desks: Object.freeze(chairX.flatMap((x) => [
    Object.freeze({ x, z: -0.4, yaw: 0 }),
    Object.freeze({ x, z: 0.4, yaw: Math.PI }),
  ])),
  chairs: Object.freeze(chairX.flatMap((x) => [
    Object.freeze({ x, z: -1.08, yaw: 0 }),
    Object.freeze({ x, z: 1.08, yaw: Math.PI }),
  ])),
  fans: Object.freeze([
    Object.freeze({ x: -1.62, z: -1.58, yaw: 0.22 }),
    Object.freeze({ x: 1.78, z: 1.56, yaw: Math.PI - 0.25 }),
  ]),
  bins: Object.freeze([
    Object.freeze({ x: -2.72, z: -1.58 }),
    Object.freeze({ x: 0.15, z: -1.62 }),
    Object.freeze({ x: 2.72, z: 1.58 }),
  ]),
});

export const LEVEL = Object.freeze({
  id: "rf08",
  title: "Scanned Open Office",
  bounds: Object.freeze({ minX: -3.1, maxX: 3.12, minZ: -1.62, maxZ: 2.14 }),
  playerStart: Object.freeze({ x: 2.6, z: 1.65, yaw: -Math.PI / 2 }),
  playerRadius: 0.23,
  playerHeight: 1.35,
  interactionRange: 1.1,
  ...G1_LOCOMOTION,
  staticColliders: Object.freeze([
    Object.freeze({ id: "desk-island", minX: -2.62, maxX: 2.62, minZ: -0.76, maxZ: 0.76 }),
    ...chairX.flatMap((x, index) => [
      Object.freeze({ id: `chair-north-${index + 1}`, minX: x - 0.27, maxX: x + 0.27, minZ: -1.32, maxZ: -0.84 }),
      Object.freeze({ id: `chair-south-${index + 1}`, minX: x - 0.27, maxX: x + 0.27, minZ: 0.84, maxZ: 1.32 }),
    ]),
    Object.freeze({ id: "fan-north", minX: -1.84, maxX: -1.4, minZ: -1.8, maxZ: -1.36 }),
    Object.freeze({ id: "fan-south", minX: 1.56, maxX: 2, minZ: 1.34, maxZ: 1.78 }),
    Object.freeze({ id: "east-storage", minX: 2.72, maxX: 3.22, minZ: -1.74, maxZ: -0.92 }),
    Object.freeze({ id: "water-dispenser", minX: 2.84, maxX: 3.2, minZ: 0.72, maxZ: 1.08 }),
    Object.freeze({ id: "west-boxes", minX: -3.18, maxX: -2.65, minZ: -1.72, maxZ: -1.15 }),
  ]),
  progress: Object.freeze({ initial: 100, maximum: 100, movementDrainPerSecond: 0.1 }),
});
