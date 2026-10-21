import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createKitchenScene, syncKitchenVisuals } from "./scene.js";
import { addKitchenViewLayers } from "./view-layers.js";
import { LEVEL as BASE_LEVEL } from "./level.js";
import { LEVEL as SIMPLE_LEVEL } from "../rf12-2/level.js";
import { LEVEL as COOK_LEVEL } from "../rf12-3/level.js";

const EXTINGUISHER_URL = "/local-assets/cardinal/rf03/models/runtime/fire_safety_station.glb";

function oilVisual() {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.34, 24), new THREE.MeshStandardMaterial({ color: 0xc98f2e, roughness: 0.32, metalness: 0.04 }));
  body.position.y = 0.19;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.08, 20), new THREE.MeshStandardMaterial({ color: 0xd5d5cf, roughness: 0.42, metalness: 0.05 }));
  neck.position.y = 0.4;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 20), new THREE.MeshStandardMaterial({ color: 0x3b403f, roughness: 0.52 }));
  cap.position.y = 0.46;
  root.add(body, neck, cap);
  return root;
}

function panVisual() {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.09, 32), new THREE.MeshStandardMaterial({ color: 0x252a2a, roughness: 0.34, metalness: 0.72 }));
  body.position.y = 0.06;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.25, 0.018, 32), new THREE.MeshStandardMaterial({ color: 0x111414, roughness: 0.62, metalness: 0.25 }));
  inner.position.y = 0.108;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.11), new THREE.MeshStandardMaterial({ color: 0x343a39, roughness: 0.5, metalness: 0.22 }));
  handle.position.set(0.54, 0.07, 0);
  root.add(body, inner, handle);
  return root;
}

function fireVisual() {
  const root = new THREE.Group();
  const flameMaterial = new THREE.MeshStandardMaterial({ color: 0xff8c24, emissive: 0xff4100, emissiveIntensity: 2.6, transparent: true, opacity: 0.9, roughness: 0.3 });
  [[0, 0.28, 0, 0.16], [-0.15, 0.2, 0.02, 0.11], [0.14, 0.22, -0.02, 0.12]].forEach(([x, y, z, radius]) => {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(radius, y * 2.2, 10), flameMaterial.clone());
    flame.position.set(x, y, z);
    root.add(flame);
  });
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), new THREE.MeshStandardMaterial({ color: 0x3d3831, transparent: true, opacity: 0.38, roughness: 1 }));
  smoke.position.set(0, 0.68, 0);
  smoke.scale.set(1.4, 1.9, 1.4);
  root.add(smoke);
  root.visible = false;
  return root;
}

function adaptBaseState(state) {
  return {
    ...state,
    cloth: state.cloth ?? { location: "floor", x: 0, z: 0 },
    hazards: state.hazards ?? { gasKnob: true, hood: true, cloth: true, window: true, gasValve: true },
  };
}

function normalizeModel(model, height = 1.1) {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (size.y > 0) model.scale.setScalar(height / size.y);
  model.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(model);
  model.position.y -= fitted.min.y;
}

function fallbackExtinguisher() {
  const root = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xb82f27, roughness: 0.42, metalness: 0.18 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24292a, roughness: 0.55, metalness: 0.42 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.58, 20), red);
  body.position.y = 0.36;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.12, 16), dark);
  neck.position.y = 0.71;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 8, 18, Math.PI), dark);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, 0.82, 0);
  const hose = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 8, 18, Math.PI * 0.9), dark);
  hose.rotation.z = Math.PI / 2;
  hose.position.set(0.13, 0.54, 0);
  root.add(body, neck, handle, hose);
  return root;
}

function addVariantRoots(world) {
  addKitchenViewLayers(world);
  world.variantRoot = new THREE.Group();
  world.variantRoot.name = "rf10-kitchen-variant-assets";
  world.scene.add(world.variantRoot);
  world.oilRoot = oilVisual();
  world.panRoot = panVisual();
  world.extinguisherRoot = new THREE.Group();
  world.fireRoot = fireVisual();
  world.variantRoot.add(world.oilRoot, world.panRoot, world.extinguisherRoot, world.fireRoot);
  world.assetRoots.variant = world.variantRoot;
}

function loadExtinguisher(world) {
  const loader = new GLTFLoader();
  return loader.loadAsync(EXTINGUISHER_URL).then(({ scene }) => {
    normalizeModel(scene, 1.0);
    world.extinguisherRoot.add(scene);
    return { loaded: true, name: "fire-extinguisher", url: EXTINGUISHER_URL, model: scene };
  }).catch((error) => {
    world.extinguisherRoot.add(fallbackExtinguisher());
    return { loaded: true, name: "fire-extinguisher", url: "procedural://fire-extinguisher-fallback", fallback: true, error };
  });
}

export function createSimpleKitchenScene() {
  const world = createKitchenScene();
  addVariantRoots(world);
  world.assetReady = world.assetReady.then((results) => [...results, { loaded: true, name: "simple-oil-bottle", url: "procedural://oil-bottle" }]);
  return world;
}

export function syncSimpleKitchenVisuals(world, state) {
  syncKitchenVisuals(world, adaptBaseState(state));
  const location = state.items.oil.location;
  world.oilRoot.visible = ["room", "floor", "prep"].includes(location);
  if (location === "room") world.oilRoot.position.set(SIMPLE_LEVEL.taskItem.x, 0.86, SIMPLE_LEVEL.taskItem.z);
  if (location === "prep") world.oilRoot.position.set(SIMPLE_LEVEL.taskTarget.x, 0.86, SIMPLE_LEVEL.taskTarget.z);
  if (location === "floor") world.oilRoot.position.set(state.items.oil.x, 0.2, state.items.oil.z);
  if (location === "carried") { world.oilRoot.visible = false; }
}

export function createCookingKitchenScene() {
  const world = createKitchenScene();
  addVariantRoots(world);
  const extinguisherReady = loadExtinguisher(world);
  world.assetReady = Promise.all([world.assetReady, extinguisherReady]).then(([results, extinguisher]) => [...results, extinguisher]);
  return world;
}

export function syncCookingKitchenVisuals(world, state) {
  syncKitchenVisuals(world, adaptBaseState(state));
  const panLocation = state.pan.location;
  world.panRoot.visible = ["room", "floor", "burner"].includes(panLocation);
  if (panLocation === "room") world.panRoot.position.set(COOK_LEVEL.pan.x, 0.86, COOK_LEVEL.pan.z);
  if (panLocation === "burner") world.panRoot.position.set(COOK_LEVEL.burner.x, 1.02, COOK_LEVEL.burner.z);
  if (panLocation === "floor") world.panRoot.position.set(state.pan.x, 0.08, state.pan.z);
  world.extinguisherRoot.visible = state.extinguisher.location === "station" || state.carriedItem === "extinguisher" || state.extinguisher.location === "floor";
  if (state.extinguisher.location === "station") world.extinguisherRoot.position.set(COOK_LEVEL.extinguisher.x, 0, COOK_LEVEL.extinguisher.z);
  if (state.extinguisher.location === "floor") world.extinguisherRoot.position.set(state.extinguisher.x, 0, state.extinguisher.z);
  if (state.carriedItem === "extinguisher") world.extinguisherRoot.position.set(state.player.x, 0.05, state.player.z);
  world.fireRoot.visible = state.fireActive;
  world.fireRoot.position.set(COOK_LEVEL.burner.x, 0.98, COOK_LEVEL.burner.z);
  world.fireRoot.rotation.y = state.elapsed * 1.8;
  world.fireRoot.scale.setScalar(0.94 + Math.sin(state.elapsed * 11) * 0.08);
}

export { EXTINGUISHER_URL };
