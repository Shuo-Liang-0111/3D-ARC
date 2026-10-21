import { isWorkshopParcelVisible } from "./rf01-workshop-rules.js";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { createFacilityScene, createRF01BatteryCargoModel, syncFacilityVisuals } from "./scene.js";
import { RF01_PRODUCTION_ASSETS } from "./rf01-production-assets.js";
import { applyWorkshopAmbientOcclusion, setWorkshopLighting, syncWorkshopShutter } from "./rf01-workshop.js";
import { fitRF01Battery } from "./rf01-battery.js";
import { SORTING, PARCEL_TYPES } from "./rf01-sorting-layout.js";
import { createSortingParcel, installSortingLine, syncSortingLine } from "./rf01-sorting-scene.js";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export function createScene() {
  const world = createFacilityScene();
  world.sorting = installSortingLine(world);
  const ready = world.assetReady;
  world.assetReady = Promise.all([ready, world.sorting.ready]).then(([results, sortingResults]) => {
    Object.values(world.sorting?.parcels ?? {}).forEach(model => { model.visible = false; });
    fitRF01Battery(world.battery);
    world.crates = world.productionAssets.children.filter(child => child.name === "rf01-cardinal-cargoCrate");
    applyWorkshopAmbientOcclusion(world.scene);
    if (world.crates.length !== 2) throw new Error("Shared RF-01 requires both cargo crates");
    world.scene.traverse(object => {
      if (/ParkingStripe|GateLaneMarking/i.test(object.name)) object.visible = false;
    });
    return [...results, ...sortingResults];
  });
  return world;
}
export function createCargoModel() {
  const root = new THREE.Group(); root.userData.robotScale = 1; root.userData.rf01Battery = true;
  const battery = createRF01BatteryCargoModel(); battery.name = "rf01-carried-battery"; root.add(battery);
  const parcels = PARCEL_TYPES.map(type => {
    const parcel = createSortingParcel(type);
    parcel.position.y = SORTING.parcelCarryOffsetY;
    root.add(parcel);
    return parcel.userData.assetReady;
  });
  const ready = loader.loadAsync(RF01_PRODUCTION_ASSETS.models.cargoCrate).then(gltf => {
    const crate = gltf.scene; crate.name = "rf01-carried-crate"; crate.scale.setScalar(.62);
    crate.position.y = -.27;
    crate.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    root.add(crate); return { loaded: true, name: "rf01-shared-cargo", url: RF01_PRODUCTION_ASSETS.models.cargoCrate };
  });
  root.userData.assetReady = Promise.all([battery.userData.assetReady,ready,...parcels]).then(results => { fitRF01Battery(battery); return { loaded: results.every(result=>result.loaded), name: "rf01-shared-cargo" }; });
  return root;
}
export function syncRobotCargo(robot,state) {
  const payload = robot.userData.rackPayload;
  if (!payload) return;
  payload.visible = Boolean(state.carriedItem) || state.battery.location === "carried";
  const battery = payload.getObjectByName("rf01-carried-battery");
  const crate = payload.getObjectByName("rf01-carried-crate");
  if (battery) battery.visible = state.battery.location === "carried";
  if (crate) crate.visible = Boolean(state.carriedItem?.startsWith("crate-"));
  PARCEL_TYPES.forEach(type => {
    const parcel = payload.getObjectByName("sorting-parcel-" + type);
    if (parcel) parcel.visible = state.carriedItem === "parcel-" + type;
  });
  robot.userData.rf01BatteryCarrying = state.battery.location === "carried";
}
export function syncVisuals(world,state,delta) {
  syncFacilityVisuals(world,state,delta);
  syncSortingLine(world,state);
  if (world.workshop) {
    syncWorkshopShutter(world.workshop,state.shutterLift);
    setWorkshopLighting(world.workshop,state.lightsOn);
  }
  if (world.sorting) {
    for (const [type, model] of Object.entries(world.sorting.parcels)) {
      model.visible = isWorkshopParcelVisible(state, state.parcels[type]);
    }
  }
  world.crates?.forEach((model,index) => {
    const crate = state.crates[index];
    model.visible = crate.location !== "carried";
    model.position.set(crate.x,crate.z < -2.1 ? .04 : .032,crate.z);
    model.rotation.y = 0;
  });
}
