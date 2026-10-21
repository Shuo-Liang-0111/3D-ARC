import { createScene as createBaseScene, createCargoModel as createBaseCargo, syncVisuals as syncBaseVisuals, syncCargo as syncBaseCargo } from "./scene.js";
import { installToolRoom, syncToolRoom, installCargoTools, syncCargoTools } from "./tool-room-scene.js";
import { installField, syncField, installFieldCargo, syncFieldCargo } from "./field-scene.js";
export function createScene(renderer) {
  const world = createBaseScene(renderer);
  installToolRoom(world);
  installField(world);
  return world;
}
export function createCargoModel() { return installFieldCargo(installCargoTools(createBaseCargo())); }
export function syncRobotCargo(robot, state) {
  syncBaseCargo(robot, state);
  syncCargoTools(robot.userData.rackPayload, state.carriedCrop || state.cuttingCrop ? { ...state, carriedItem: state.carriedCrop || state.cuttingCrop } : state);
  syncFieldCargo(robot.userData.rackPayload, state);
}
export function syncVisuals(world, state) {
  syncBaseVisuals(world, state);
  syncField(world, state);
  syncToolRoom(world, state);
}
