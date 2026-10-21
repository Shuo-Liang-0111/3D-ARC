import {createLeakRuntime} from "./series-runtime.js";
const r=createLeakRuntime("rf06");
export const {LEVEL,ui,camera,prepareView,rendering,audio,eventMessages,createScene,syncVisuals,createCargoModel,syncRobotCargo,isCarrying,getTelemetry,getProgressSteps,getTerminal,getSoundPosition,getDebugState,createInitialState,updateEnvironment,updateMovement,isWalkable,getInteraction,interact,closeTerminal,getObjective,createInteractionAnimation}=r;
