import { LEVEL } from "./level.js";
import { createVariantEngine } from "../rf15/variant-engine.js";
export const { createInitialState, cloneState, getColliders, isWalkable, updateEnvironment, updateMovement, getInteraction, interact, closeTerminal, getObjective, getTelemetry, getProgressSteps, getTerminal, getSoundPosition, getDebugState } = createVariantEngine(LEVEL);
