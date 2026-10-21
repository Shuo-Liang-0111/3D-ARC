import { createArchiveRuntime } from "../rf02/series-runtime.js";

const runtime = createArchiveRuntime("rf02-3");
export const {
  LEVEL, ui, camera, audio, rendering, createInteractionAnimation, eventMessages, createInitialState, isWalkable, getInteraction,
  interact, updateMovement, updateEnvironment, getObjective, closeTerminal, createScene,
  syncVisuals, createCargoModel, syncRobotCargo, isCarrying, getTelemetry, getProgressSteps,
  getTerminal, getSoundPosition, getDebugState,
} = runtime;
