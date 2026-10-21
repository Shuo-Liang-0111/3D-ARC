import * as THREE from "three";
import { RF01_YARD_LAYOUT } from "./rf01-yard-layout.js";
import { installWorkshopInterior } from "./rf01-workshop.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { installRF01CollisionProxies, LEVEL } from "./level.js";
import { createBatteryModel } from "./robot.js";
import {
  createRF01EnvironmentDetails,
  createRF01Sky,
  createRF01SurfaceLibrary,
  enhanceRF01Environment,
} from "./rf01-environment.js";
import {
  hideRF01LegacyAssets,
  loadRF01CollisionProxies,
  loadRF01ProductionModels,
  upgradeRF01SurfaceLibrary,
} from "./rf01-production-assets.js";

export const RF01_ASSETS = Object.freeze({
  environment: "/local-assets/embodiedgen/rf01/models/runtime/rf01_industrial_park.glb",
  battery: "/local-assets/cardinal/rf01/models/runtime/rf01_battery.glb",
  powerSlot: "/local-assets/cardinal/rf01/models/runtime/rf01_power_slot.glb",
  slidingGate: "/local-assets/cardinal/rf01/models/runtime/rf01_door_panel.glb",
  terminal: "/local-assets/cardinal/rf01/models/runtime/rf01_terminal.glb",
});

export function createRF01BatteryCargoModel() {
  const root = new THREE.Group();
  root.name = "rf01-cardinal-battery-cargo";
  root.userData.robotScale = 1;
  root.userData.assetReady = fetchAsset(RF01_ASSETS.battery).then((source) => {
    if (!source) return { loaded: false, name: root.name, url: RF01_ASSETS.battery, model: null };
    const model = prepareAsset(source.clone(true), "rf01-battery-cargo-model");
    root.add(model);
    return { loaded: true, name: root.name, url: RF01_ASSETS.battery, model };
  });
  return root;
}

function material(color, metalness = 0.08, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function box(parent, size, position, entry, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), entry);
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radius, height, position, entry) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), entry);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function prepareAsset(model, name) {
  model.name = name;
  model.traverse((object) => {
    if (object.isLight || object.isCamera) {
      object.visible = false;
      return;
    }
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((entry) => {
      if (entry.map) entry.map.colorSpace = THREE.SRGBColorSpace;
      entry.needsUpdate = true;
    });
  });
  return model;
}

const loader = new GLTFLoader();
const assetCache = new Map();

function fetchAsset(url) {
  if (!assetCache.has(url)) {
    assetCache.set(url, new Promise((resolve) => loader.load(
      url,
      (gltf) => resolve(prepareAsset(gltf.scene, url)),
      undefined,
      (error) => {
        console.warn(`[RF-01] Failed to load ${url}`, error);
        resolve(null);
      },
    )));
  }
  return assetCache.get(url);
}

function loadAsset(root, url, name, fallback, { scale = [1, 1, 1] } = {}) {
  return fetchAsset(url).then((source) => {
    if (!source) return { loaded: false, name, url, model: null };
    const model = prepareAsset(source.clone(true), name);
    model.scale.set(...scale);
    root.add(model);
    fallback.visible = false;
    return { loaded: true, name, url, model };
  });
}

function createEnvironmentFallback() {
  const root = new THREE.Group();
  root.name = "rf01-compact-industrial-yard-fallback";
  const asphalt = material(0x303433, 0.04, 0.94);
  const concrete = material(0x747a77, 0.03, 0.88);
  const panel = material(0x879494, 0.2, 0.62);
  const roof = material(0x24536a, 0.42, 0.48);
  const steel = material(0x384342, 0.68, 0.38);
  const glass = material(0x244c50, 0.14, 0.3);

  box(root, [20, 0.16, 16], [0, -0.08, 0], concrete, { castShadow: false });
  box(root, [20, 0.04, 3.7], [0, 0.01, 6.1], asphalt, { castShadow: false });
  box(root, [10.4, 4.2, 6], [0, 2.1, -4], panel);
  box(root, [10.9, 0.24, 6.4], [0, 4.32, -4], roof);
  box(root, [4.1, 2.9, 0.12], [-1.2, 1.55, -0.93], steel);
  box(root, [1.1, 2.15, 0.11], [3.7, 1.15, -0.93], steel);
  box(root, [1.3, 0.75, 0.04], [3.7, 1.55, -0.86], glass);
  box(root, [2.1, 2.2, 1.8], [6.5, 1.1, 5], panel);
  box(root, [2.3, 0.16, 2], [6.5, 2.28, 5], roof);
  [[-6, 6.8, 7.5], [6, 6.8, 7.5]].forEach(([x, z, length]) => box(root, [length, 2.1, 0.12], [x, 1.05, z], steel));
  return root;
}

function createGateFallback() {
  const root = new THREE.Group();
  const steel = material(0x6a7371, 0.72, 0.32);
  box(root, [4.0, 0.14, 0.12], [0, 1.94, 0], steel);
  box(root, [4.0, 0.16, 0.12], [0, 0.1, 0], steel);
  [-1.95, -1.3, -0.65, 0, 0.65, 1.3, 1.95].forEach((x) => box(root, [0.07, 1.9, 0.1], [x, 1.02, 0], steel));
  return root;
}

function createSlotFallback() {
  const root = new THREE.Group();
  box(root, [0.7, 1.2, 0.55], [0, 0.6, 0], material(0x697875, 0.42, 0.48));
  box(root, [0.58, 0.38, 0.03], [0, 0.64, 0.286], material(0x151d1d, 0.25, 0.72));
  return root;
}

function createTerminalFallback() {
  const root = new THREE.Group();
  box(root, [0.34, 1.12, 0.28], [0, 0.56, 0], material(0x4d5c5c, 0.38, 0.52));
  box(root, [0.48, 0.36, 0.34], [0, 1.18, 0], material(0x323c3c, 0.32, 0.58));
  return root;
}

export function createFacilityScene() {
  const surfaces = createRF01SurfaceLibrary();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaebfbe);
  scene.fog = new THREE.Fog(0xb7c6c4, 42, 82);
  scene.add(createRF01Sky());
  scene.add(new THREE.HemisphereLight(0xeaf4f5, 0x4f5f58, 1.18));
  scene.add(new THREE.AmbientLight(0xdfe9e5, 0.16));

  const sun = new THREE.DirectionalLight(0xffedd2, 2.55);
  sun.position.set(-13, 22, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -15;
  sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 15;
  sun.shadow.camera.bottom = -15;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 55;
  sun.shadow.bias = -0.0001;
  sun.shadow.normalBias = 0.045;
  scene.add(sun);
  const skyFill = new THREE.DirectionalLight(0x9fc1cf, 0.38);
  skyFill.position.set(12, 8, -10);
  scene.add(skyFill);

  const environmentDetails = createRF01EnvironmentDetails(surfaces);
  scene.add(environmentDetails);
  const productionAssets = new THREE.Group();
  productionAssets.name = "rf01-production-asset-layer";
  scene.add(productionAssets);

  const environmentFallback = createEnvironmentFallback();
  scene.add(environmentFallback);
  const environmentRoot = new THREE.Group();
  environmentRoot.name = "rf01-static-environment";
  scene.add(environmentRoot);

  const battery = new THREE.Group();
  battery.position.set(LEVEL.batteryStart.x, 0.04, LEVEL.batteryStart.z);
  scene.add(battery);
  const batteryFallback = createBatteryModel();
  batteryFallback.scale.set(0.78, 0.68, 0.78);
  battery.add(batteryFallback);

  const slotRoot = new THREE.Group();
  slotRoot.position.set(LEVEL.powerSlot.x, 0, LEVEL.powerSlot.z);
  slotRoot.rotation.y = Math.PI;
  scene.add(slotRoot);
  const slotFallback = createSlotFallback();
  slotRoot.add(slotFallback);

  const doorPanel = new THREE.Group();
  doorPanel.position.set(LEVEL.door.x, 0, LEVEL.door.z);
  scene.add(doorPanel);
  const gateFallback = createGateFallback();
  doorPanel.add(gateFallback);

  const terminalRoot = new THREE.Group();
  terminalRoot.position.set(LEVEL.terminal.x, 0, LEVEL.terminal.z);
  terminalRoot.rotation.y = -Math.PI / 2;
  scene.add(terminalRoot);
  const terminalFallback = createTerminalFallback();
  terminalRoot.add(terminalFallback);

  const doorLampMaterial = new THREE.MeshStandardMaterial({ color: 0xa13c2f, emissive: 0x721c16, emissiveIntensity: 1.1 });
  const doorLamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), doorLampMaterial);
  doorLamp.position.set(LEVEL.door.x + 2.35, 2.45, LEVEL.door.z - 0.2);
  scene.add(doorLamp);

  const slotGlowMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5221, emissive: 0x713b12, emissiveIntensity: 0.35 });
  const slotLamp = box(scene, [0.22, 0.08, 0.025], [LEVEL.powerSlot.x, 0.44, LEVEL.powerSlot.z - 0.46], slotGlowMaterial, { castShadow: false });
  slotLamp.rotation.y = Math.PI;

  const terminalScreenMaterial = new THREE.MeshStandardMaterial({ color: 0x194a4e, emissive: 0x0c5b60, emissiveIntensity: 0.65 });
  const terminalScreen = box(scene, [0.025, 0.16, 0.31], [LEVEL.terminal.x - 0.22, 1.22, LEVEL.terminal.z], terminalScreenMaterial, { castShadow: false });
  terminalScreen.rotation.z = -0.14;

  const exitMaterial = new THREE.MeshStandardMaterial({ color: 0xd9ddd6, emissive: 0x4d8b66, emissiveIntensity: 0.08, roughness: 0.82 });
  const exitPlate = box(scene, [2.2, 0.018, 1.1], [LEVEL.exit.x, 0.018, LEVEL.exit.z], exitMaterial, { castShadow: false });
  const beacon = new THREE.PointLight(0x79d79a, 0, 5.5, 2);
  beacon.position.set(LEVEL.exit.x, 0.65, LEVEL.exit.z);
  scene.add(beacon);

  const assetRoots = { environment: environmentRoot, battery, powerSlot: slotRoot, slidingGate: doorPanel, terminal: terminalRoot };
  const coreAssetReady = Promise.all([
    loadAsset(environmentRoot, RF01_ASSETS.environment, "rf01-industrial-park", environmentFallback).then((result) => {
      if (result.loaded) enhanceRF01Environment(result.model, surfaces);
      return result;
    }),
    loadAsset(battery, RF01_ASSETS.battery, "rf01-battery", batteryFallback),
    loadAsset(slotRoot, RF01_ASSETS.powerSlot, "rf01-power-slot", slotFallback),
    loadAsset(doorPanel, RF01_ASSETS.slidingGate, "rf01-sliding-gate", gateFallback, { scale: [4 / 3, 1, 1] }),
    loadAsset(terminalRoot, RF01_ASSETS.terminal, "rf01-terminal", terminalFallback),
  ]);
  const collisionReady = loadRF01CollisionProxies().then((result) => {
    if (result.loaded) installRF01CollisionProxies(result.colliders);
    return result;
  });
  const productionAssetReady = Promise.all([
    upgradeRF01SurfaceLibrary(surfaces),
    loadRF01ProductionModels(productionAssets),
    collisionReady,
  ]);
  let world;
  const assetReady = Promise.all([coreAssetReady, productionAssetReady]).then(async ([coreAssets, [, productionModels, collisionProxies]]) => {
    hideRF01LegacyAssets([coreAssets[0]?.model, environmentDetails], productionModels);
    world.workshop = await installWorkshopInterior(world);
    return [
      ...coreAssets,
      ...productionModels,
      ...world.workshop.controls,
      collisionProxies,
    ];
  });

  world = {
    scene,
    surfaces,
    battery,
    doorPanel,
    doorClosedX: LEVEL.door.x,
    doorOpenX: LEVEL.door.x - 4.35,
    doorLampMaterial,
    slotGlowMaterial,
    terminalScreenMaterial,
    exitMaterial,
    exitPlate,
    beacon,
    assetRoots,
    assetReady,
    collisionReady,
    proceduralEnvironment: environmentFallback,
    environmentDetails,
    productionAssets,
    productionAssetReady,
    visualRevision: RF01_YARD_LAYOUT.revision,
  };
  return world;
}

export function syncFacilityVisuals(world, state, delta) {
  const targetDoorX = state.doorOpen ? world.doorOpenX : world.doorClosedX;
  world.doorPanel.position.x += (targetDoorX - world.doorPanel.position.x) * (1 - Math.exp(-delta * 4.2));
  world.doorLampMaterial.color.setHex(state.powered ? (state.doorOpen ? 0x56a769 : 0xd79836) : 0xa13c2f);
  world.doorLampMaterial.emissive.setHex(state.powered ? (state.doorOpen ? 0x1f6a32 : 0x8f4e16) : 0x721c16);
  world.slotGlowMaterial.emissiveIntensity = state.powered ? 1.6 : 0.35;
  world.terminalScreenMaterial.emissiveIntensity = state.powered ? 1.4 : 0.65;
  world.exitMaterial.emissiveIntensity = state.doorOpen ? 0.52 : 0.08;
  world.beacon.intensity = state.doorOpen ? 1.5 : 0;

  world.battery.visible = state.battery.location !== "carried";
  if (!world.battery.visible) return;
  const onRack = state.battery.location === "ground"
    && Math.hypot(state.battery.x - LEVEL.batteryStart.x, state.battery.z - LEVEL.batteryStart.z) < 0.05;
  const y = state.battery.location === "slotted" ? 0.38 : (onRack ? 0.46 : 0);
  world.battery.position.set(state.battery.x, y, state.battery.z);
  world.battery.rotation.y = state.battery.location === "slotted" ? Math.PI : 0;
}
