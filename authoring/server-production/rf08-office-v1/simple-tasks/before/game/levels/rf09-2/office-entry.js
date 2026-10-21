import {createOfficeRuntime} from "../rf09/office-runtime.js";
const r=createOfficeRuntime("rf09-2");
export const {LEVEL,ui,camera,audio,eventMessages,createInitialState,cloneState,isWalkable,collisionRects,clearRay,updateMovement,getInteraction,interact,updateEnvironment,readiness,chairsReady,closeTerminal,getObjective,createScene,syncVisuals,prepareView,createInteractionAnimation,createCargoModel,syncRobotCargo,isCarrying,getProgressSteps,getTelemetry,getTerminal,getSoundPosition,getDebugState}=r;
