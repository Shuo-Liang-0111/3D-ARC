import { createHotelRuntime } from "./series-runtime.js";
const runtime=createHotelRuntime("rf05");
export const {LEVEL,ui,rendering,camera,audio,eventMessages,slots,createInitialState,cloneState,isWalkable,furnitureClear,updateMovement,updateEnvironment,getInteraction,interact,parked,ready,closeTerminal,getObjective,createScene,syncVisuals,createInteractionAnimation,createCargoModel,syncRobotCargo,isCarrying,getProgressSteps,getTelemetry,getTerminal,getSoundPosition,getDebugState}=runtime;
