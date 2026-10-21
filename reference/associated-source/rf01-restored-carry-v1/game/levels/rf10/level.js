import { G1_LOCOMOTION } from "../../g1-locomotion.js";

export const LEVEL = Object.freeze({
  id: "rf10",
  title: "Room Exploration",
  playerStart: Object.freeze({ x: 0, z: 0.8, yaw: Math.PI }),
  playerGroundY: -1.12,
  playerRadius: 0.28,
  playerHeight: 1.72,
  ...G1_LOCOMOTION,
  progress: Object.freeze({
    initial: 100,
    maximum: 100,
    movementDrainPerSecond: 0,
    rewards: Object.freeze({}),
  }),
});
