import { createLaundryRuntime } from "../rf04/series-runtime.js";
const runtime=createLaundryRuntime("rf04-2");
export const {LEVEL,ui,camera,audio,rendering,eventMessages,createScene,syncVisuals,createCargoModel,syncRobotCargo,isCarrying,getTelemetry,getProgressSteps,getTerminal,getSoundPosition,getDebugState,createInteractionAnimation,createInitialState,cloneState,updateMovement,updateEnvironment,isWalkable,getInteraction,beginInteraction,interact,pointFor,getObjective,closeTerminal}=runtime;
