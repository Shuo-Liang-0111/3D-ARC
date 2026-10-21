import { KITCHEN } from "../rf12/interaction-layout.js";
import { LEVEL as BASE_LEVEL } from "../rf12/level.js";

export const LEVEL = Object.freeze({
  ...BASE_LEVEL,
  interactionRange: 1.15,
  id: "rf12-3",
  title: "Timed Kettle Boiling",
  kettle: KITCHEN.kettle,
  fill: KITCHEN.fill,
  burner: KITCHEN.burner,
  extinguisher: KITCHEN.extinguisher,
  fireLimitSeconds: 60,
  boilWindow: Object.freeze({ min: 55, max: 65, target: 60 }),
  progress: Object.freeze({ initial: 100, maximum: 100, actionDrainPerSecond: 0.9, interactionCost: 4 }),
});
