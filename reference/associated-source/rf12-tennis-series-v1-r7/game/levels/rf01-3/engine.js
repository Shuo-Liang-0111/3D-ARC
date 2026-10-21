import { LEVEL } from "./level.js";
import { createParkEngine } from "../../rf01-shared-engine.js";
export { isInside } from "../../rf01-shared-engine.js";
export const { createInitialState, cloneState, isWalkable, getColliders, isCarrying, updateMovement, updateEnvironment, getInteraction, interact, closeTerminal, getObjective } = createParkEngine(LEVEL);
