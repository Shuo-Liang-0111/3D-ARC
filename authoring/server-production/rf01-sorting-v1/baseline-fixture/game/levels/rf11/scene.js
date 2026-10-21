import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { LEVEL } from "./level.js";

const ROOT = "/local-assets/levels/rf11/models/runtime";
const SURFACE_ATLAS = "/local-assets/levels/rf11/textures/runtime/surface_atlas.png";
const ASSET_REVISION = "cardinal-realism-rf11-v4-20260902";
const revised = (path) => `${path}?v=${ASSET_REVISION}`;
const ASSETS = Object.freeze({
  environment: revised(`${ROOT}/rf11_final.glb`),
  collision: revised(`${ROOT}/rf11_collision.glb`),
  cargo: revised(`${ROOT}/interactables/servo_pump_case.optimized.glb`),
  carrier: revised(`${ROOT}/interactables/cooperative_dolly.optimized.glb`),
  target: revised(`${ROOT}/interactables/assembly_base_cardinal.optimized.glb`),
});
const ASSET_SCALES = Object.freeze({
  environment: [25.087, 6.545, 16.421],
  cargo: [0.92, 0.771, 0.855],
  carrier: [1.832, 0.309, 2.479],
  target: [3.4, 0.36, 1.8],
});
const CARDINAL_STATIC_FIXTURES = Object.freeze([
  Object.freeze({ id: "west-infeed-machine", path: "/local-assets/cardinal/rf03/models/runtime/automatic_infeed_machine.glb", position: [-8.9, 0, -0.35], yaw: Math.PI / 2 }),
  Object.freeze({ id: "east-control-cabinet", path: "/local-assets/cardinal/rf03/models/runtime/industrial_electrical_cabinet.glb", position: [10.8, 0, 4.7], yaw: -Math.PI / 2 }),
  Object.freeze({ id: "east-control-terminal", path: "/local-assets/cardinal/rf03/models/runtime/dws_control_terminal.glb", position: [9.65, 0, -1.5], yaw: Math.PI }),
  Object.freeze({ id: "north-pallet-stack", path: "/local-assets/cardinal/rf03/models/runtime/palletized_carton_stack.glb", position: [8.7, 0, 5.55], yaw: Math.PI }),
  Object.freeze({ id: "west-fire-station", path: "/local-assets/cardinal/rf03/models/runtime/fire_safety_station.glb", position: [-10.8, 0, 5.7], yaw: Math.PI / 2 }),
  Object.freeze({ id: "north-scanner-gantry", path: "/local-assets/cardinal/rf03/models/runtime/dws_scanner_gantry.glb", position: [4.3, 0, 5.45], yaw: 0 }),
  Object.freeze({ id: "ceiling-led-west", path: "/local-assets/cardinal/rf03/models/runtime/industrial_led_fixture.glb", position: [-7.2, 3.9, 0.8], yaw: 0 }),
  Object.freeze({ id: "ceiling-led-center", path: "/local-assets/cardinal/rf03/models/runtime/industrial_led_fixture.glb", position: [0, 3.9, 0.8], yaw: 0 }),
  Object.freeze({ id: "ceiling-led-east", path: "/local-assets/cardinal/rf03/models/runtime/industrial_led_fixture.glb", position: [7.2, 3.9, 0.8], yaw: 0 }),
]);
const CARDINAL_STATIC_HEIGHTS = Object.freeze({
  "west-infeed-machine": 2.04,
  "east-control-cabinet": 2.12,
  "east-control-terminal": 1.58,
  "north-pallet-stack": 1.35,
  "west-fire-station": 1.8,
  "north-scanner-gantry": 2.85,
  "ceiling-led-west": 0.12,
  "ceiling-led-center": 0.12,
  "ceiling-led-east": 0.12,
});
const material = (color, roughness = 0.72, metalness = 0.05, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

function tiledSurface(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  context.fillStyle = kind === "floor" ? "#697673" : "#c9d0cc";
  context.fillRect(0, 0, 256, 256);
  context.strokeStyle = kind === "floor" ? "rgba(30,40,38,.35)" : "rgba(86,99,95,.2)";
  context.lineWidth = kind === "floor" ? 2 : 1;
  const step = kind === "floor" ? 64 : 128;
  for (let index = 0; index <= 256; index += step) {
    context.beginPath();
    context.moveTo(index, 0);
    context.lineTo(index, 256);
    context.stroke();
    context.beginPath();
    context.moveTo(0, index);
    context.lineTo(256, index);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === "floor" ? 18 : 8, kind === "floor" ? 12 : 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.canvas = canvas;
  texture.userData.context = context;
  return texture;
}

const floorTexture = tiledSurface("floor");
const wallTexture = tiledSurface("wall");
const floorMaterial = material(0x9ba5a0, 0.9, 0.04, { map: floorTexture });
const wallMaterial = material(0xd0d6d2, 0.78, 0.02, { map: wallTexture });
const steelMaterial = material(0x586568, 0.42, 0.68);
const darkSteelMaterial = material(0x283338, 0.38, 0.8);
const safetyMaterial = material(0xd3a52d, 0.5, 0.28);
const rubberMaterial = material(0x20282a, 0.86, 0.05);
const lightMaterial = material(0xf2f4dd, 0.28, 0.08, { emissive: 0xdde6c5, emissiveIntensity: 2.2 });

function loadCardinalSurfaceAtlas() {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const halfWidth = image.naturalWidth / 2;
      [{ texture: floorTexture, sourceX: 0 }, { texture: wallTexture, sourceX: halfWidth }].forEach(({ texture, sourceX }) => {
        const canvas = texture.userData.canvas;
        const context = texture.userData.context;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, sourceX, 0, halfWidth, image.naturalHeight, 0, 0, canvas.width, canvas.height);
        texture.needsUpdate = true;
      });
      resolve({ loaded: true, name: "surface-atlas", url: SURFACE_ATLAS });
    };
    image.onerror = () => resolve({ loaded: false, name: "surface-atlas", url: SURFACE_ATLAS, error: new Error("Unable to load Cardinal surface atlas") });
    image.src = `${SURFACE_ATLAS}?v=${ASSET_REVISION}`;
  });
}

function box(parent, size, position, entryMaterial, name, rotationY = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), entryMaterial);
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addWorkcell(root, side) {
  const x = side * 8.35;
  const name = side < 0 ? "WEST" : "EAST";
  box(root, [3.7, 0.12, 3.5], [x, 0.06, -0.55], rubberMaterial, `RF11_${name}_CELL_PAD`);
  box(root, [3.25, 1.05, 1.05], [x, 0.58, -0.55], steelMaterial, `RF11_${name}_WORKBENCH`);
  box(root, [2.9, 0.08, 0.95], [x, 1.12, -0.55], darkSteelMaterial, `RF11_${name}_BENCH_TOP`);
  [-1.25, 1.25].forEach((offset) => box(root, [0.12, 2.7, 0.12], [x + offset, 1.35, -1.85], darkSteelMaterial, `RF11_${name}_FRAME_FRONT`));
  [-1.25, 1.25].forEach((offset) => box(root, [0.12, 2.7, 0.12], [x + offset, 1.35, 0.75], darkSteelMaterial, `RF11_${name}_FRAME_BACK`));
  box(root, [2.7, 0.12, 0.12], [x, 2.68, -1.85], darkSteelMaterial, `RF11_${name}_FRAME_TOP`);
  box(root, [2.7, 0.12, 0.12], [x, 2.68, 0.75], darkSteelMaterial, `RF11_${name}_FRAME_TOP_BACK`);
  box(root, [2.55, 0.95, 0.08], [x, 1.73, -1.83], wallMaterial, `RF11_${name}_MACHINE_PANEL`);
  box(root, [0.72, 0.58, 0.12], [x, 1.52, -1.72], safetyMaterial, `RF11_${name}_CONTROL_PANEL`);
  box(root, [0.18, 0.18, 0.18], [x - side * 0.68, 1.57, -1.68], safetyMaterial, `RF11_${name}_STATUS_LAMP`);
}

function addRack(root) {
  const x = 0;
  const z = 5.72;
  box(root, [7.8, 0.12, 1.25], [x, 0.06, z], rubberMaterial, "RF11_NORTH_RACK_PAD");
  [-3.55, -1.2, 1.2, 3.55].forEach((offset) => {
    box(root, [0.12, 3.3, 0.12], [offset, 1.65, z], darkSteelMaterial, "RF11_RACK_POST");
    box(root, [0.18, 0.1, 1.05], [offset, 0.85, z], steelMaterial, "RF11_RACK_SHELF");
    box(root, [0.18, 0.1, 1.05], [offset, 1.75, z], steelMaterial, "RF11_RACK_SHELF");
    box(root, [0.18, 0.1, 1.05], [offset, 2.65, z], steelMaterial, "RF11_RACK_SHELF");
  });
  box(root, [7.8, 0.14, 0.14], [0, 3.25, z], darkSteelMaterial, "RF11_RACK_TOP");
  [-2.6, -0.9, 0.9, 2.6].forEach((offset, index) => box(root, [1.2, 0.62, 0.82], [offset, 1.17 + (index % 2) * 0.9, z], index % 2 ? safetyMaterial : steelMaterial, "RF11_RACK_BIN"));
}

function addSafetyDoor(root) {
  box(root, [3.2, 0.08, 0.45], [0, 0.04, -1.0], safetyMaterial, "RF11_SAFE_DOOR_THRESHOLD");
  [-1.35, 1.35].forEach((x) => box(root, [0.14, 3.1, 0.14], [x, 1.55, -1.0], safetyMaterial, "RF11_SAFE_DOOR_POST"));
  box(root, [2.84, 0.14, 0.14], [0, 3.05, -1.0], safetyMaterial, "RF11_SAFE_DOOR_HEADER");
  box(root, [2.62, 2.55, 0.05], [0, 1.35, -1.0], wallMaterial, "RF11_SAFE_DOOR_PANEL");
}

function addTargetBase(root) {
  box(root, [3.6, 0.12, 1.8], [LEVEL.target.x, 0.06, LEVEL.target.z], rubberMaterial, "RF11_TARGET_PAD");
  box(root, [3.0, 0.12, 1.4], [LEVEL.target.x, 0.18, LEVEL.target.z], steelMaterial, "RF11_TARGET_GUIDE");
  box(root, [2.35, 0.08, 0.7], [LEVEL.target.x, 0.28, LEVEL.target.z], safetyMaterial, "RF11_TARGET_LOCK_PLATE");
  [-0.92, 0.92].forEach((x) => box(root, [0.12, 0.7, 0.12], [x, 0.55, LEVEL.target.z], darkSteelMaterial, "RF11_TARGET_POST"));
}

function fallbackEnvironment(scene) {
  const root = new THREE.Group();
  root.name = "rf11-graybox-visuals";
  scene.add(root);
  box(root, [24, 0.16, 16], [0, -0.08, 0], floorMaterial, "RF11_GRAYBOX_FLOOR");
  box(root, [24, 4.2, 0.3], [0, 2.1, 8], wallMaterial, "RF11_GRAYBOX_NORTH_WALL");
  box(root, [0.3, 4.2, 16], [-12, 2.1, 0], wallMaterial, "RF11_GRAYBOX_WEST_WALL");
  box(root, [0.3, 4.2, 16], [12, 2.1, 0], wallMaterial, "RF11_GRAYBOX_EAST_WALL");
  box(root, [10.3, 4.2, 0.3], [-6.85, 2.1, -8], wallMaterial, "RF11_GRAYBOX_SOUTH_WALL_WEST");
  box(root, [10.3, 4.2, 0.3], [6.85, 2.1, -8], wallMaterial, "RF11_GRAYBOX_SOUTH_WALL_EAST");
  [-11.85, 11.85].forEach((x) => box(root, [0.12, 4.2, 0.12], [x, 2.1, 7.72], darkSteelMaterial, "RF11_CORNER_TRIM"));
  [-1.8, 1.8].forEach((x) => box(root, [0.08, 0.012, 11.6], [x, 0.012, -0.2], safetyMaterial, "RF11_CENTER_SAFETY_LANE"));
  [-7.2, 0, 7.2].forEach((x) => {
    const point = new THREE.PointLight(0xf1f4db, 1.8, 10, 2);
    point.position.set(x, 3.75, 0.8);
    root.add(point);
  });
  const fixtureRoot = new THREE.Group();
  fixtureRoot.name = "rf11-graybox-fixtures-removed";
  fixtureRoot.visible = false;
  root.add(fixtureRoot);
  root.userData.fixtureRoot = fixtureRoot;
  return root;
}

function fallbackProp(name, size, color) {
  const root = new THREE.Group();
  root.name = `rf11-graybox-${name}`;
  box(root, size, [0, size[1] / 2, 0], material(color, 0.5, 0.34), `${name}-graybox-mesh`);
  return root;
}

function prepare(model) {
  model.traverse((object) => {
    if (object.isLight || object.isCamera) object.visible = false;
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = false;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((entry) => {
      if (entry.map) entry.map.colorSpace = THREE.SRGBColorSpace;
      entry.needsUpdate = true;
    });
  });
  return model;
}

const loader = new GLTFLoader();
loader.setDRACOLoader(new DRACOLoader().setDecoderPath("/vendor/draco/"));
const cache = new Map();

function fetchAsset(url) {
  if (!cache.has(url)) cache.set(url, new Promise((resolve) => loader.load(url, (gltf) => resolve(prepare(gltf.scene)), undefined, () => resolve(null))));
  return cache.get(url);
}

function loadAsset(url, parent, name) {
  return fetchAsset(url).then((source) => {
    if (!source) return { loaded: false, name, url, error: new Error(`Unable to load ${url}`) };
    const model = prepare(source.clone(true));
    const scale = ASSET_SCALES[name];
    if (name === "environment") {
      const sourceBounds = new THREE.Box3().setFromObject(model);
      const sourceSize = sourceBounds.getSize(new THREE.Vector3());
      const targetSize = new THREE.Vector3(24, 4.2, 16);
      const fitScale = Math.min(targetSize.x / Math.max(sourceSize.x, 0.001), targetSize.y / Math.max(sourceSize.y, 0.001), targetSize.z / Math.max(sourceSize.z, 0.001));
      model.scale.setScalar(fitScale);
    } else if (Array.isArray(scale)) model.scale.set(...scale);
    else if (scale) model.scale.setScalar(scale);
    model.userData.rf11Asset = name;
    model.updateMatrixWorld(true);
    if (name !== "collision") {
      const bounds = new THREE.Box3().setFromObject(model);
      model.position.x -= (bounds.min.x + bounds.max.x) / 2;
      model.position.z -= (bounds.min.z + bounds.max.z) / 2;
      model.position.y -= bounds.min.y;
    }
    parent.add(model);
    return { loaded: true, name, url, model };
  });
}

function loadStaticFixture(fixture, parent) {
  return fetchAsset(`${fixture.path}?v=${ASSET_REVISION}`).then((source) => {
    if (!source) return { loaded: false, name: fixture.id, url: fixture.path, static: true };
    const model = prepare(source.clone(true));
    model.name = fixture.id;
    const targetHeight = CARDINAL_STATIC_HEIGHTS[fixture.id];
    if (targetHeight) {
      const sourceBounds = new THREE.Box3().setFromObject(model);
      const sourceSize = sourceBounds.getSize(new THREE.Vector3());
      if (sourceSize.y > 0.001) model.scale.setScalar(targetHeight / sourceSize.y);
    }
    model.position.set(0, 0, 0);
    model.rotation.y = fixture.yaw;
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    model.position.x += fixture.position[0] - (bounds.min.x + bounds.max.x) / 2;
    model.position.z += fixture.position[2] - (bounds.min.z + bounds.max.z) / 2;
    model.position.y -= bounds.min.y;
    parent.add(model);
    return { loaded: true, name: fixture.id, url: fixture.path, model, static: true };
  });
}

function createCargoFallback() {
  const root = new THREE.Group();
  root.name = "rf11-cargo-procedural-detail";
  box(root, [0.92, 0.48, 0.64], [0, 0.25, 0], material(0xb8c4c3, 0.62, 0.2), "RF11_CARGO_CASE");
  box(root, [0.72, 0.025, 0.5], [0, 0.505, 0], safetyMaterial, "RF11_CARGO_LID");
  box(root, [0.08, 0.5, 0.03], [-0.32, 0.25, 0], darkSteelMaterial, "RF11_CARGO_BAND_LEFT");
  box(root, [0.08, 0.5, 0.03], [0.32, 0.25, 0], darkSteelMaterial, "RF11_CARGO_BAND_RIGHT");
  box(root, [0.16, 0.08, 0.025], [0, 0.32, -0.325], safetyMaterial, "RF11_CARGO_LABEL");
  return root;
}
function createCarrierFallback() {
  const root = new THREE.Group();
  root.name = "rf11-carrier-procedural-detail";
  box(root, [1.8, 0.16, 1.1], [0, 0.28, 0], rubberMaterial, "RF11_DOLLY_DECK");
  box(root, [1.56, 0.08, 0.86], [0, 0.4, 0], steelMaterial, "RF11_DOLLY_DECK_TOP");
  [-0.68, 0.68].forEach((x) => box(root, [0.08, 0.42, 0.08], [x, 0.5, -0.42], darkSteelMaterial, "RF11_DOLLY_HANDLE_POST"));
  box(root, [1.5, 0.08, 0.08], [0, 0.7, -0.42], darkSteelMaterial, "RF11_DOLLY_HANDLE");
  [-0.65, 0.65].forEach((x) => [-0.38, 0.38].forEach((z) => box(root, [0.22, 0.22, 0.12], [x, 0.12, z], rubberMaterial, "RF11_DOLLY_WHEEL")));
  return root;
}
function createTargetFallback() {
  const root = new THREE.Group();
  root.name = "rf11-target-procedural-detail";
  box(root, [3.4, 0.12, 1.8], [0, 0.06, 0], steelMaterial, "RF11_TARGET_BASE_PLATE");
  box(root, [3.0, 0.08, 0.14], [0, 0.16, -0.58], darkSteelMaterial, "RF11_TARGET_FRONT_RAIL");
  box(root, [3.0, 0.08, 0.14], [0, 0.16, 0.58], darkSteelMaterial, "RF11_TARGET_BACK_RAIL");
  box(root, [0.12, 0.42, 0.12], [-1.12, 0.37, 0], safetyMaterial, "RF11_TARGET_LEFT_STOP");
  box(root, [0.12, 0.42, 0.12], [1.12, 0.37, 0], safetyMaterial, "RF11_TARGET_RIGHT_STOP");
  box(root, [1.9, 0.035, 0.58], [0, 0.235, 0], safetyMaterial, "RF11_TARGET_LOCK_SURFACE");
  return root;
}

export function createRF11Scene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9aa7a6);
  scene.fog = new THREE.Fog(0x9aa7a6, 30, 64);
  scene.add(new THREE.HemisphereLight(0xf3f5f0, 0x33454b, 1.7));
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.4);
  sun.position.set(-8, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  const grayboxRoot = fallbackEnvironment(scene);
  const realAssetRoot = new THREE.Group();
  realAssetRoot.name = "rf11-cardinal-real-assets";
  scene.add(realAssetRoot);
  const cargoRoot = new THREE.Group();
  cargoRoot.name = "rf11-cargo-real";
  realAssetRoot.add(cargoRoot);
  const targetRoot = new THREE.Group();
  targetRoot.name = "rf11-target-real";
  realAssetRoot.add(targetRoot);
  const carrierRoot = new THREE.Group();
  carrierRoot.name = "rf11-carrier-real";
  realAssetRoot.add(carrierRoot);
  const staticRoot = new THREE.Group();
  staticRoot.name = "rf11-cardinal-static-fixtures";
  scene.add(staticRoot);
  const cargoFallback = createCargoFallback();
  cargoFallback.visible = false;
  cargoRoot.add(cargoFallback);
  const targetFallbackModel = createTargetFallback();
  targetFallbackModel.visible = false;
  targetRoot.add(targetFallbackModel);
  const carrierFallback = createCarrierFallback();
  carrierFallback.visible = false;
  carrierRoot.add(carrierFallback);

  const collisionRoot = new THREE.Group();
  collisionRoot.name = "RF11_COLLISION_VOLUME_HIDDEN";
  collisionRoot.visible = false;
  scene.add(collisionRoot);
  const collisionReady = loadAsset(ASSETS.collision, collisionRoot, "collision");
  const ready = Promise.all([
    collisionReady,
    loadCardinalSurfaceAtlas(),
    loadAsset(ASSETS.cargo, cargoRoot, "cargo"),
    loadAsset(ASSETS.carrier, carrierRoot, "carrier"),
    loadAsset(ASSETS.target, targetRoot, "target"),
    ...CARDINAL_STATIC_FIXTURES.map((fixture) => loadStaticFixture(fixture, staticRoot)),
  ]);
  const world = {
    scene,
    grayboxRoot,
    realAssetRoot,
    cargoRoot,
    targetRoot,
    carrierRoot,
    staticRoot,
    collisionRoot,
    cargoFallback,
    targetFallback: targetFallbackModel,
    carrierFallback,
    assetReady: ready,
    collisionReady,
    assetRoots: { environment: realAssetRoot, collision: collisionRoot, cargo: cargoRoot, carrier: carrierRoot, target: targetRoot, static: staticRoot },
  };
  ready.then((items) => {
    const byName = Object.fromEntries(items.map((item) => [item.name, item]));
    if (byName.cargo?.loaded) cargoFallback.visible = false;
    if (byName.carrier?.loaded) carrierFallback.visible = false;
    if (byName.target?.loaded) targetFallbackModel.visible = false;
    const staticItems = items.filter((item) => item.static);
    if (staticItems.length === CARDINAL_STATIC_FIXTURES.length && staticItems.every((item) => item.loaded)) grayboxRoot.userData.fixtureRoot.visible = false;
  });
  return world;
}

function place(root, x, y, z, yaw = 0) {
  root.position.set(x, y, z);
  root.rotation.y = yaw;
}

export function syncRF11Visuals(world, state) {
  const cargoVisible = ["floor", "carried"].includes(state.cargo.location);
  world.cargoRoot.visible = cargoVisible;
  if (state.cargo.location === "floor") {
    place(world.cargoRoot, state.cargo.x, 0, state.cargo.z, 0);
  } else {
    const midpoint = { x: (state.player.x + state.partner.x) / 2, z: (state.player.z + state.partner.z) / 2 };
    place(world.cargoRoot, midpoint.x, 1.02, midpoint.z, Math.atan2(state.partner.x - state.player.x, state.partner.z - state.player.z));
  }
  world.carrierRoot.visible = state.cargo.location === "carried";
  place(world.carrierRoot, (state.player.x + state.partner.x) / 2, 0, (state.player.z + state.partner.z) / 2, Math.atan2(state.partner.x - state.player.x, state.partner.z - state.player.z));
  world.targetRoot.visible = state.cargo.location === "installed" || !state.complete;
  place(world.targetRoot, LEVEL.target.x, 0, LEVEL.target.z, 0);
}

export function createCargoModel() {
  const root = new THREE.Group();
  root.userData.assetReady = Promise.resolve({ loaded: true });
  return root;
}

export function syncRobotCargo() {}
export const ASSET_PATHS = ASSETS;
