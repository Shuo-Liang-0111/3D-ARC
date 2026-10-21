import { installCartParking } from './cart-parking.js';
import { installOrangeStation, syncOrangeStation } from './orange-scene.js';
import { createScene as createBaseScene, createCargoModel as createBaseCargo, syncVisuals as syncBaseVisuals, syncCargo as syncBaseCargo } from "./scene.js";
import { installToolRoom, syncToolRoom, installCargoTools, syncCargoTools } from "./tool-room-scene.js";
import { installField, syncField, installFieldCargo, syncFieldCargo } from "./field-scene.js";
export function createScene(renderer) {
  const world = createBaseScene(renderer);
  installToolRoom(world);
  installField(world);
  installCartParking(world);
  installOrangeStation(world);
  world.fieldRenderer = renderer;
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
  if (state.cart && world.assetRoots.jack) {
    world.assetRoots.jack.position.set(state.cart.x, 0, state.cart.z);
    world.assetRoots.jack.rotation.y = state.cart.yaw;
  }

  syncField(world, state);
  syncToolRoom(world, state);
  syncOrangeStation(world, state);
  if (world.fieldRenderer && performance.now() - (world.fieldMetricsAt || 0) > 2000) {
    world.fieldMetricsAt = performance.now();
    const shell = document.querySelector("#game-shell");
    if (shell) shell.dataset.fieldRender = JSON.stringify(world.fieldRenderer.info.render);
  }
}
