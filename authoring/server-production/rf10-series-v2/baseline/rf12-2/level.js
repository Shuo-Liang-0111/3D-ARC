import { LEVEL as BASE_LEVEL } from "../rf12/level.js";

export const LEVEL = Object.freeze({
  ...BASE_LEVEL,
  id: "rf12-2",
  title: "Kitchen Item Return",
  taskItem: Object.freeze({ x: -1.4, z: -2.55 }),
  taskTarget: Object.freeze({ x: -0.25, z: -1.28 }),
  progress: Object.freeze({ initial: 100, maximum: 100, actionDrainPerSecond: 0.8, interactionCost: 4, pickupReward: 8, placementReward: 18 }),
});
