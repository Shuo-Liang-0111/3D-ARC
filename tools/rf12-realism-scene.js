import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HAZARD_TYPES, LEVEL } from "./level.js";

const ROOT = "/local-assets/cardinal/rf12-v2/models/runtime";
const ASSETS = Object.freeze({
  environment: `${ROOT}/kitchen_environment_refined.glb`,
  collision: `${ROOT}/kitchen_collision.glb`,
  hood: `${ROOT}/range_hood.glb`,
  gasKnob: `${ROOT}/gas_knob.glb`,
  gasValve: `${ROOT}/gas_valve.glb`,
  cloth: `${ROOT}/wet_cloth.glb`,
  window: `${ROOT}/kitchen_window_refined.glb`,
  terminal: `${ROOT}/safety_terminal.glb`,
  refrigerator: `${ROOT}/refrigerator.glb`,
  sink: `${ROOT}/kitchen_sink.glb`,
  stove: `${ROOT}/stove_module.glb`,
  doorHandle: `${ROOT}/kitchen_door_handle.glb`,
});

const draco = new DRACOLoader();
draco.setWorkerLimit(2);
draco.setDecoderPath("/vendor/draco/");
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);
const textureLoader = new THREE.TextureLoader();
const assetCache = new Map();

function material(color, roughness = 0.72, metalness = 0.04, map = null) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, map });
}

function tileTexture(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const context = canvas.getContext("2d");
  context.fillStyle = kind === "floor" ? "#a8ada8" : "#e9e5df";
  context.fillRect(0, 0, 512, 512);
  context.strokeStyle = kind === "floor" ? "rgba(72,82,78,.28)" : "rgba(130,118,108,.24)";
  context.lineWidth = kind === "floor" ? 3 : 2;
  const step = kind === "floor" ? 128 : 256;
  for (let offset = 0; offset <= 512; offset += step) {
    context.beginPath(); context.moveTo(offset, 0); context.lineTo(offset, 512); context.stroke();
    context.beginPath(); context.moveTo(0, offset); context.lineTo(512, offset); context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === "floor" ? 6 : 3, kind === "floor" ? 5 : 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const floorMaterial = material(0xffffff, 0.9, 0.02, tileTexture("floor"));
const wallMaterial = material(0xffffff, 0.78, 0.01, tileTexture("wall"));
function upgradeTileMaterial(entryMaterial, kind) {
  const url = `/local-assets/levels/rf12/textures/${kind}_tile_cardinal.png`;
  textureLoader.load(url, (texture) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(kind === "floor" ? 6 : 3, kind === "floor" ? 5 : 2);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    entryMaterial.map = texture;
    entryMaterial.needsUpdate = true;
  });
}
upgradeTileMaterial(floorMaterial, "floor");
upgradeTileMaterial(wallMaterial, "wall");
const cabinetMaterial = material(0x9f8065, 0.56, 0.02);
const counterMaterial = material(0xe3ded3, 0.34, 0.03);
const steelMaterial = material(0xb6c0be, 0.34, 0.22);
const darkMaterial = material(0x252b2c, 0.74, 0.08);
const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0x9db9b7, roughness: 0.16, metalness: 0.08, transmission: 0.22, transparent: true, opacity: 0.72 });
const hazardMaterial = material(0xd04c3f, 0.45, 0.04);
const clearMaterial = material(0x4d9c6a, 0.4, 0.04);

function box(parent, size, position, entryMaterial, name, rotationY = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), entryMaterial);
  mesh.position.set(...position); mesh.rotation.y = rotationY; mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function cylinder(parent, radius, height, position, entryMaterial, name) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.94, height, 24), entryMaterial);
  mesh.position.set(...position); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function fallbackEnvironment(scene) {
  const root = new THREE.Group(); root.name = "rf12-graybox-baseline"; scene.add(root);
  const architecture = new THREE.Group(); architecture.name = "rf12-architecture"; root.add(architecture);
  box(architecture, [8.4, 0.12, 6.8], [0, -0.06, 0], floorMaterial, "RF12_FLOOR");
  box(architecture, [8.4, 2.8, 0.16], [0, 1.4, -3.32], wallMaterial, "RF12_BACK_WALL");
  box(architecture, [0.16, 2.8, 4.55], [-4.12, 1.4, -0.95], wallMaterial, "RF12_WEST_WALL_REAR");
  box(architecture, [0.16, 2.8, 0.72], [-4.12, 1.4, 3.04], wallMaterial, "RF12_WEST_WALL_FRONT");
  box(architecture, [0.16, 2.8, 6.8], [4.12, 1.4, 0], wallMaterial, "RF12_EAST_WALL");
  box(architecture, [3.25, 2.8, 0.16], [-2.58, 1.4, 3.32], wallMaterial, "RF12_SOUTH_WALL_WEST");
  box(architecture, [3.25, 2.8, 0.16], [2.58, 1.4, 3.32], wallMaterial, "RF12_SOUTH_WALL_EAST");
  box(architecture, [0.95, 2.16, 0.07], [-1.0, 1.08, 3.18], cabinetMaterial, "RF12_DOOR_FRAME_LEFT");
  box(architecture, [0.95, 2.16, 0.07], [1.0, 1.08, 3.18], cabinetMaterial, "RF12_DOOR_FRAME_RIGHT");
  box(architecture, [0.06, 2.02, 1.86], [0, 1.01, 3.18], glassMaterial, "RF12_GLASS_DOOR");
  box(architecture, [0.06, 0.06, 1.75], [0, 1.7, 3.11], steelMaterial, "RF12_DOOR_RAIL");
  box(architecture, [0.06, 0.08, 1.2], [-0.75, 1.62, -3.2], glassMaterial, "RF12_WINDOW_GLASS");
  box(architecture, [0.06, 0.06, 1.32], [-0.75, 2.25, -3.13], cabinetMaterial, "RF12_WINDOW_TOP");
  box(architecture, [0.06, 0.06, 1.32], [-0.75, 1.0, -3.13], cabinetMaterial, "RF12_WINDOW_SILL");
  box(architecture, [0.06, 1.28, 0.06], [-1.42, 1.62, -3.13], cabinetMaterial, "RF12_WINDOW_LEFT");
  box(architecture, [0.06, 1.28, 0.06], [-0.08, 1.62, -3.13], cabinetMaterial, "RF12_WINDOW_RIGHT");
  box(architecture, [0.04, 1.18, 0.04], [-0.75, 1.62, -3.08], cabinetMaterial, "RF12_WINDOW_MULLION");
  const cabinets = new THREE.Group(); cabinets.name = "rf12-cabinetry"; root.add(cabinets);
  box(cabinets, [3.65, 0.82, 0.72], [-2.0, 0.41, -2.58], cabinetMaterial, "RF12_BASE_CABINET_WEST");
  box(cabinets, [3.6, 0.82, 0.72], [1.55, 0.41, -2.58], cabinetMaterial, "RF12_BASE_CABINET_EAST");
  box(cabinets, [7.25, 0.08, 0.82], [-0.2, 0.86, -2.58], counterMaterial, "RF12_QUARTZ_COUNTER");
  for (const [center, count, width] of [[-2.0, 4, 3.42], [1.55, 4, 3.36]]) {
    for (let index = 0; index < count; index += 1) {
      const panelWidth = width / count - 0.04;
      const x = center - width / 2 + panelWidth / 2 + index * (width / count);
      box(cabinets, [panelWidth, 0.64, 0.035], [x, 0.46, -2.2], cabinetMaterial, `RF12_BASE_DOOR_${center}_${index}`);
      box(cabinets, [0.12, 0.025, 0.025], [x, 0.52, -2.16], steelMaterial, `RF12_BASE_HANDLE_${center}_${index}`);
    }
  }
  box(cabinets, [2.55, 0.72, 0.68], [-2.5, 1.68, -2.78], cabinetMaterial, "RF12_UPPER_CABINET");
  for (let index = 0; index < 3; index += 1) box(cabinets, [0.78, 0.62, 0.035], [-3.3 + index * 0.8, 1.68, -2.42], cabinetMaterial, `RF12_UPPER_DOOR_${index}`);
  box(cabinets, [0.85, 0.07, 0.58], [-0.45, 0.93, -2.58], steelMaterial, "RF12_SINK_BASIN");
  cylinder(cabinets, 0.04, 0.34, [-0.12, 1.14, -2.72], steelMaterial, "RF12_SINK_FAUCET");
  box(cabinets, [0.34, 0.05, 0.05], [-0.26, 1.3, -2.72], steelMaterial, "RF12_SINK_SPOUT");
  const fixtures = new THREE.Group(); fixtures.name = "rf12-fixtures"; root.add(fixtures);
  box(fixtures, [0.92, 1.9, 0.68], [-3.55, 0.95, -1.0], steelMaterial, "RF12_REFRIGERATOR");
  box(fixtures, [0.75, 0.02, 0.03], [-3.06, 1.42, -1.0], darkMaterial, "RF12_FRIDGE_HANDLE");
  box(fixtures, [1.65, 0.08, 0.7], [2.25, 0.93, -2.58], steelMaterial, "RF12_STOVE");
  for (const [x, z] of [[1.86, -2.78], [2.58, -2.78], [1.86, -2.37], [2.58, -2.37]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 24), darkMaterial); ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.99, z); fixtures.add(ring); }
  box(fixtures, [1.75, 0.46, 0.48], [2.25, 2.15, -2.98], steelMaterial, "RF12_RANGE_HOOD");
  box(fixtures, [0.18, 1.15, 0.18], [2.25, 1.65, -2.98], steelMaterial, "RF12_RANGE_HOOD_CHIMNEY");
  box(fixtures, [0.62, 0.04, 0.04], [2.25, 1.0, -2.12], hazardMaterial, "RF12_GAS_KNOB_PANEL");
  box(fixtures, [0.72, 1.08, 0.45], [-3.3, 0.54, 2.5], darkMaterial, "RF12_SAFETY_TERMINAL");
  box(fixtures, [0.5, 0.05, 0.03], [-3.3, 0.95, 2.28], clearMaterial, "RF12_TERMINAL_STATUS");
  return root;
}

function fallbackCloth() {
  const root = new THREE.Group(); root.name = "rf12-wet-cloth-fallback";
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.32), material(0x5b8c91, 0.9, 0.01));
  cloth.rotation.z = -0.08; cloth.position.y = 0.02; cloth.castShadow = true; cloth.receiveShadow = true; root.add(cloth); return root;
}

function loadAsset(url) {
  if (!assetCache.has(url)) assetCache.set(url, new Promise((resolve) => loader.load(url, (gltf) => resolve(gltf.scene), undefined, () => resolve(null))));
  return assetCache.get(url);
}

function attachAsset(url, parent, name, position = [0, 0, 0], yaw = 0) {
  const slot = new THREE.Group(); slot.name = name; slot.position.set(...position); slot.rotation.y = yaw; parent.add(slot);
  const ready = loadAsset(url).then((source) => {
    if (!source) return { loaded: false, name, url, model: null };
    const model = source.clone(true);
    model.traverse((object) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    slot.add(model); return { loaded: true, name, url, model };
  });
  return { slot, ready };
}

function hideFallbackForAsset(root, name) {
  const prefixes = {
    hood: ["RF12_RANGE_HOOD"],
    gasKnob: ["RF12_GAS_KNOB_PANEL"],
    gasValve: [],
    window: ["RF12_WINDOW_"],
    terminal: ["RF12_SAFETY_TERMINAL", "RF12_TERMINAL_STATUS"],
    refrigerator: ["RF12_REFRIGERATOR", "RF12_FRIDGE_HANDLE"],
    sink: ["RF12_SINK_"],
    stove: ["RF12_STOVE", "RF12_STOVE_", "RF12_GAS_KNOB_PANEL"],
  }[name] ?? [];
  root.traverse((object) => { if (object.name && prefixes.some((prefix) => object.name.startsWith(prefix))) object.visible = false; });
}

function applyEnvironmentMaterials(model) {
  const floorTexture = textureLoader.load("/local-assets/cardinal/rf12-v2/textures/floor_tile_cardinal.png");
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(6, 5); floorTexture.colorSpace = THREE.SRGBColorSpace; floorTexture.anisotropy = 8;
  const wallTexture = textureLoader.load("/local-assets/cardinal/rf12-v2/textures/wall_tile_cardinal.png");
  wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
  wallTexture.repeat.set(3, 2); wallTexture.colorSpace = THREE.SRGBColorSpace; wallTexture.anisotropy = 8;
  const oakTexture = textureLoader.load("/local-assets/cardinal/rf12-v2/textures/oak_cardinal.png");
  oakTexture.wrapS = oakTexture.wrapT = THREE.RepeatWrapping;
  oakTexture.repeat.set(2.4, 1.2); oakTexture.colorSpace = THREE.SRGBColorSpace; oakTexture.anisotropy = 8;
  model.traverse((object) => {
    if (!object.isMesh) return;
    const name = object.name.toLowerCase();
    object.material = Array.isArray(object.material) ? object.material.map((entry) => entry.clone()) : object.material.clone();
    const entryMaterial = Array.isArray(object.material) ? object.material[0] : object.material;
    if (!entryMaterial) return;
    entryMaterial.side = THREE.DoubleSide;
    if (name.includes("floor")) { entryMaterial.map = floorTexture; entryMaterial.color.set(0xffffff); entryMaterial.roughness = 0.82; }
    if (name.includes("wall") || name.includes("backsplash")) { entryMaterial.map = wallTexture; entryMaterial.color.set(0xffffff); entryMaterial.roughness = 0.7; }
    if ((name.includes("base_") || name.includes("upper_") || name.includes("backboard")) && !name.includes("handle") && !name.endsWith("_top")) { entryMaterial.map = oakTexture; entryMaterial.color.set(0xffffff); entryMaterial.roughness = 0.62; }
    if (name.includes("upper_east")) object.visible = false;
    entryMaterial.needsUpdate = true;
  });
}

function addKitchenDetails(scene) {
  const details = new THREE.Group(); details.name = "rf12-realism-details"; scene.add(details);
  const trim = material(0x7d6855, 0.52, 0.02);
  const edge = material(0xd7d0c3, 0.34, 0.03);
  const dark = material(0x353b39, 0.62, 0.08);
  const warm = new THREE.PointLight(0xffd9a8, 0.7, 5.5, 2); warm.position.set(0, 2.05, -2.25); details.add(warm);
  box(details, [7.2, 0.12, 0.08], [-0.2, 0.075, -2.22], dark, "RF12_CABINET_TOE_KICK");
    const ceiling = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.035, 32), material(0xf1e2c5, 0.35, 0.02));
  ceiling.position.set(0, 2.78, 0.3); ceiling.castShadow = true; details.add(ceiling);
  const ceilingGlow = new THREE.PointLight(0xffedcf, 0.45, 7, 2); ceilingGlow.position.set(0, 2.62, 0.3); details.add(ceilingGlow);
}

export function createKitchenScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8c0bc);
  scene.fog = new THREE.Fog(0xb8c0bc, 16, 32);
  scene.add(new THREE.HemisphereLight(0xfff7ea, 0x59645f, 1.65));
  const sun = new THREE.DirectionalLight(0xffe8c7, 2.1); sun.position.set(-4, 9, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
  const fallback = fallbackEnvironment(scene);
  addKitchenDetails(scene);
  const visualRoot = new THREE.Group(); visualRoot.name = "rf12-cardinal-runtime"; scene.add(visualRoot);
  const collisionRoot = new THREE.Group(); collisionRoot.name = "RF12_COLLISION_HIDDEN"; collisionRoot.visible = false; scene.add(collisionRoot);
  const itemRoot = new THREE.Group(); itemRoot.name = "rf12-interactables"; scene.add(itemRoot);
  const clothRoot = new THREE.Group(); clothRoot.name = "rf12-cloth"; clothRoot.add(fallbackCloth()); scene.add(clothRoot);
  const fixed = {};
  const fixedEntries = [
    ["environment", ASSETS.environment, visualRoot, [0, 0, 0], 0],
    ["collision", ASSETS.collision, collisionRoot, [0, 0, 0], 0],
    ["hood", ASSETS.hood, visualRoot, [LEVEL.hood.x, 1.65, -3.0], 0],
    ["gasKnob", ASSETS.gasKnob, visualRoot, [LEVEL.gasKnob.x, 0.90, LEVEL.gasKnob.z], 0],
    ["gasValve", ASSETS.gasValve, visualRoot, [LEVEL.gasValve.x, 0.78, LEVEL.gasValve.z], Math.PI / 2],
    ["window", ASSETS.window, visualRoot, [LEVEL.window.x, 1.15, -3.32], 0],
    ["terminal", ASSETS.terminal, visualRoot, [LEVEL.terminal.x, 0, LEVEL.terminal.z], 0],
    ["refrigerator", ASSETS.refrigerator, visualRoot, [-3.55, 0, -1.0], 0],
    ["sink", ASSETS.sink, visualRoot, [LEVEL.sink.x, 0.78, LEVEL.sink.z], 0],
    ["stove", ASSETS.stove, visualRoot, [2.25, 0.90, -2.58], 0],
    ["doorHandle", ASSETS.doorHandle, visualRoot, [1.18, 1.05, 3.02], Math.PI],
  ];
  const fixedReady = fixedEntries.map(([name, url, parent, position, yaw]) => { const entry = attachAsset(url, parent, name, position, yaw); fixed[name] = entry.slot; return entry.ready; });
  clothRoot.position.set(LEVEL.cloth.x, 0.9, LEVEL.cloth.z);
  const clothEntry = attachAsset(ASSETS.cloth, clothRoot, "cloth-cardinal");
  const assetReady = Promise.all([...fixedReady, clothEntry.ready]).then((results) => {
    if (results.find((result) => result.name === "environment")?.loaded) {
      fixed.environment.visible = true;
      fallback.visible = false;
      const environment = fixed.environment.children[0];
      if (environment) applyEnvironmentMaterials(environment);
    }
    for (const result of results) if (result.loaded && !["hood", "window", "refrigerator"].includes(result.name)) hideFallbackForAsset(fallback, result.name);
    if (fixed.refrigerator) fixed.refrigerator.visible = true;
    if (results.find((result) => result.name === "cloth-cardinal")?.loaded) clothRoot.children[0].visible = false;
    return results;
  });
  const world = { scene, fallback, visualRoot, collisionRoot, clothRoot, fixed, assetReady, collisionReady: assetReady.then((results) => results.find((result) => result.name === "collision") ?? { loaded: false }), assetRoots: { environment: visualRoot, collision: collisionRoot, interactables: { cloth: clothRoot }, fixed } };
  world.assetRoots.hazardIndicators = Object.fromEntries(HAZARD_TYPES.map((type) => [type, hazardIndicator(scene, type)]));
  return world;
}

function hazardIndicator(scene, type) {
  const positions = { gasKnob: [LEVEL.gasKnob.x, 1.08, LEVEL.gasKnob.z], hood: [LEVEL.hood.x, 1.38, LEVEL.hood.z], cloth: [LEVEL.sink.x, 1.06, LEVEL.sink.z], window: [LEVEL.window.x, 2.25, LEVEL.window.z], gasValve: [LEVEL.gasValve.x, 1.05, LEVEL.gasValve.z] };
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), hazardMaterial.clone()); mesh.name = `RF12_HAZARD_INDICATOR_${type}`; mesh.position.set(...positions[type]); mesh.castShadow = true; mesh.visible = false; scene.add(mesh); return mesh;
}

function setPose(root, pose) { root.position.set(pose.x, pose.y, pose.z); root.rotation.y = pose.yaw ?? 0; }

export function syncKitchenVisuals(world, state) {
  const cloth = world.clothRoot;
  const clothOnSurface = state.cloth.location === "counter" || state.cloth.location === "floor" || state.cloth.location === "sink";
  cloth.visible = clothOnSurface;
  if (state.cloth.location === "counter") setPose(cloth, { x: LEVEL.cloth.x, y: 0.9, z: LEVEL.cloth.z, yaw: 0 });
  if (state.cloth.location === "floor") setPose(cloth, { x: state.cloth.x, y: 0, z: state.cloth.z, yaw: 0 });
  if (state.cloth.location === "sink") setPose(cloth, { x: LEVEL.sink.x, y: 1.02, z: LEVEL.sink.z, yaw: 0 });
  const status = state.hazards;
  const windowSash = world.fixed.window?.getObjectByName("RF12_WINDOW_MOVING_SASH");
  if (windowSash) windowSash.position.x = status.window ? -0.56 : 0;
  for (const type of HAZARD_TYPES) { const indicator = world.assetRoots.hazardIndicators[type]; indicator.material.color.set(status[type] ? clearMaterial.color : hazardMaterial.color); }
  if (world.fixed.hood) world.fixed.hood.userData.active = status.hood;
}

export function createKitchenCargoModel() {
  const root = new THREE.Group(); root.name = "rf12-cargo"; const fallback = fallbackCloth(); root.add(fallback); root.userData.fallback = fallback;
  const slot = new THREE.Group(); slot.visible = false; root.add(slot); root.userData.slot = slot;
  root.userData.assetReady = loadAsset(ASSETS.cloth).then((source) => { if (!source) return { loaded: false, name: "cloth-cargo", url: ASSETS.cloth }; const model = source.clone(true); slot.add(model); fallback.visible = false; return { loaded: true, name: "cloth-cargo", url: ASSETS.cloth, model }; });
  return root;
}

export function syncKitchenCargoModel(root, state) { if (!root) return; const carrying = state.carriedItem === "cloth"; root.visible = carrying; if (root.userData.slot) root.userData.slot.visible = carrying; if (root.userData.fallback) root.userData.fallback.visible = carrying && root.userData.slot?.children.length === 0; }

export { ASSETS };
