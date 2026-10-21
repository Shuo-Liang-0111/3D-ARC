import { LEVEL as BASE_LEVEL } from "../rf12/level.js";

export const LEVEL = Object.freeze({
  ...BASE_LEVEL,
  id: "rf12-3",
  title: "Timed Kitchen Cooking",
  pan: Object.freeze({ x: 0.9, z: -1.38 }),
  burner: Object.freeze({ x: 2.25, z: -2.78 }),
  hoodSwitch: Object.freeze({ x: 2.25, z: -2.45 }),
  extinguisher: Object.freeze({ x: -3.55, z: 1.55 }),
  cookWindow: Object.freeze({ min: 55, max: 65, target: 60 }),
  progress: Object.freeze({ initial: 100, maximum: 100, actionDrainPerSecond: 0.9, interactionCost: 4, pickupReward: 8, panReward: 8, hoodReward: 6 }),
});
