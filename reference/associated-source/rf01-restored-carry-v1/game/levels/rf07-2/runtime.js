import {createSeriesRuntime} from '../rf07/series-runtime.js';
const runtime=createSeriesRuntime('rf07-2');
export const {LEVEL,ui,camera,audio,rendering,eventMessages,createInitialState,updateMovement,updateEnvironment,getInteraction,interact,isWalkable,closeTerminal,getObjective,createScene,syncVisuals,prepareView,createInteractionAnimation,createCargoModel,syncRobotCargo,isCarrying,getProgressSteps,getTelemetry,getTerminal,getSoundPosition,getDebugState,getFailureMessage}=runtime;
