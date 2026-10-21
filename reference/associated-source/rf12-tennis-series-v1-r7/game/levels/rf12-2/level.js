import { KITCHEN } from "../rf12/interaction-layout.js";
import { LEVEL as BASE_LEVEL } from "../rf12/level.js";

export const LEVEL = Object.freeze({
  ...BASE_LEVEL,
  interactionRange: 1.15,
  id: "rf12-2",
  title: "Kitchen Item Return",
  taskItem: KITCHEN.oil,
  taskTarget: KITCHEN.prep,
  progress: Object.freeze({ initial: 100, maximum: 100, actionDrainPerSecond: 0.8, interactionCost: 4, pickupReward: 8, placementReward: 18 }),
});
