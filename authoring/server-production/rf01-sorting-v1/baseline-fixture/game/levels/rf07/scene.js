import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RF07_CARDINAL_ASSETS, RF07_CARDINAL_FIXTURES } from "./cardinal-assets.js";
import { LEVEL, SAMPLE_META, SAMPLE_TYPES } from "./level.js";
import { applyLaboratorySurfaceMaterials, createCleanroomWallMaterial, createEpoxyFloorMaterial } from "./surfaces.js";

const ASSETS = Object.freeze({
  environment: "/local-assets/embodiedgen/rf07/models/runtime/rf07_realistic_bsl2_lab.glb?v=20260809",
  ...RF07_CARDINAL_ASSETS,
  sampleA: RF07_CARDINAL_ASSETS.secondaryCarrier,
  sampleB: RF07_CARDINAL_ASSETS.secondaryCarrier,
  sampleC: RF07_CARDINAL_ASSETS.secondaryCarrier,
  cold01: RF07_CARDINAL_ASSETS.medicalRefrigerator,
  cold02: RF07_CARDINAL_ASSETS.medicalRefrigerator,
  cold03: RF07_CARDINAL_ASSETS.medicalRefrigerator,
});

function material(color, roughness = 0.75, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(parent, size, position, entryMaterial, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), entryMaterial);
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radius, height, position, entryMaterial, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.94, height, 32), entryMaterial);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function labelTexture({ title, subtitle, accent = "#14748a", danger = false }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.fillStyle = danger ? "#fff5d5" : "#f7faf8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = danger ? "#b82720" : accent;
  context.fillRect(0, 0, 34, canvas.height);
  context.fillRect(0, 0, canvas.width, 22);
  context.fillRect(0, canvas.height - 22, canvas.width, 22);
  context.fillStyle = "#142529";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 150px 'Noto Sans SC', 'Microsoft YaHei', sans-serif";
  context.fillText(title, canvas.width / 2, 200);
  context.fillStyle = danger ? "#8d211c" : "#36555c";
  context.font = "700 72px 'Arial Narrow', sans-serif";
  context.fillText(subtitle, canvas.width / 2, 370);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function labelPlane(parent, content, size, position, rotation = [0, 0, 0], name = "rf07-label") {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(...size),
    new THREE.MeshBasicMaterial({ map: labelTexture(content), side: THREE.DoubleSide, toneMapped: false }),
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function createAreaLabels(scene) {
  const root = new THREE.Group();
  root.name = "rf07-chinese-laboratory-signage";
  scene.add(root);
  labelPlane(root, { title: "样本接收区", subtitle: "SPECIMEN RECEIVING" }, [3.0, 0.72], [-7.3, 2.55, -7.78]);
  labelPlane(root, { title: "生物安全操作区", subtitle: "CLASS II BSC · BSL-2" }, [3.25, 0.72], [0.3, 2.55, -7.78]);
  labelPlane(root, { title: "冷链打包区", subtitle: "COLD-CHAIN PACKING" }, [2.75, 0.68], [2.0, 2.18, 1.72], [-Math.PI / 2, 0, 0]);
  labelPlane(root, { title: "医用冷藏存储", subtitle: "2–8°C MEDICAL STORAGE" }, [3.25, 0.72], [11.78, 2.55, 0], [0, -Math.PI / 2, 0]);
  labelPlane(root, { title: "缓冲更衣", subtitle: "ANTEROOM / PPE" }, [2.35, 0.62], [0, 2.55, 7.78], [0, Math.PI, 0]);
  labelPlane(root, { title: "生物危害", subtitle: "AUTHORIZED PERSONNEL ONLY", accent: "#b82720", danger: true }, [1.55, 0.62], [-11.76, 1.75, -1.6], [0, Math.PI / 2, 0]);
  labelPlane(root, { title: "装箱顺序", subtitle: "A-17  →  C-04  →  B-12", accent: "#b33a2e" }, [1.5, 1.05], [-11.70, 1.62, -1.6], [0, Math.PI / 2, 0], "rf07-task-board-content");
  return root;
}

function ensureSampleLabel(root, type) {
  if (!root || root.getObjectByName(`rf07-label-${type}`)) return;
  labelPlane(
    root,
    { title: SAMPLE_META[type].code, subtitle: "生物样本 / SPECIMEN", accent: `#${SAMPLE_META[type].color.toString(16).padStart(6, "0")}` },
    [0.135, 0.052],
    [0, 0.075, 0.056],
    [0, 0, 0],
    `rf07-label-${type}`,
  );
}

function sampleModel(type) {
  const root = new THREE.Group();
  const shell = material(SAMPLE_META[type].color, 0.58, 0.03);
  box(root, [0.18, 0.075, 0.11], [0, 0.045, 0], shell);
  box(root, [0.17, 0.022, 0.10], [0, 0.094, 0], material(0xe8ece9, 0.45));
  ensureSampleLabel(root, type);
  root.userData.sampleType = type;
  return root;
}

function taskBoardModel() {
  const root = new THREE.Group();
  root.name = "rf07-task-board";
  box(root, [0.08, 1.7, 1.25], [0, 1.62, 0], material(0xb9c1c1, 0.38, 0.52));
  return root;
}

function ensureCaseVisual(root) {
  if (!root || root.getObjectByName("rf07-case-state")) return;
  const stateRoot = new THREE.Group();
  stateRoot.name = "rf07-case-state";
  const tray = new THREE.Group();
  tray.name = "rf07-case-samples";
  stateRoot.add(tray);
  [["sampleA", -0.19], ["sampleC", 0], ["sampleB", 0.19]].forEach(([type, x]) => {
    const slot = new THREE.Group();
    slot.name = `rf07-case-slot-${type}`;
    slot.position.set(x, 0.26, -0.025);
    const fallback = sampleModel(type);
    fallback.name = `rf07-case-fallback-${type}`;
    slot.add(fallback);
    slot.visible = false;
    tray.add(slot);
  });
  const module = box(stateRoot, [0.19, 0.035, 0.13], [0, 0.31, 0.135], material(0x2e8da6, 0.34, 0.28));
  module.name = "rf07-case-installed-cooling";
  module.visible = false;
  const openLid = box(stateRoot, [0.60, 0.04, 0.39], [0, 0.51, -0.195], material(0x36515a, 0.42, 0.28));
  openLid.name = "rf07-case-lid-open";
  openLid.rotation.x = -1.17;
  const closedLid = box(stateRoot, [0.60, 0.04, 0.39], [0, 0.385, 0], material(0x36515a, 0.42, 0.28));
  closedLid.name = "rf07-case-lid-closed";
  closedLid.visible = false;
  const indicatorMaterial = new THREE.MeshStandardMaterial({ color: 0x24383d, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.3, metalness: 0.18 });
  const indicator = box(stateRoot, [0.14, 0.035, 0.018], [0.19, 0.414, 0.202], indicatorMaterial);
  indicator.name = "rf07-case-active-indicator";
  root.add(stateRoot);
}

function attachSampleAssetToCase(root, type, model) {
  const slot = root?.getObjectByName(`rf07-case-slot-${type}`);
  if (!slot || slot.getObjectByName(`rf07-case-cardinal-${type}`)) return;
  const fallback = slot.getObjectByName(`rf07-case-fallback-${type}`);
  if (fallback) fallback.visible = false;
  const sample = model.clone(true);
  sample.name = `rf07-case-cardinal-${type}`;
  slot.add(sample);
}

function syncCaseVisual(root, state) {
  if (!root) return;
  ensureCaseVisual(root);
  const loadedTypes = state.caseSamples ?? [];
  root.getObjectByName("rf07-case-samples")?.children.forEach((slot) => {
    const type = SAMPLE_TYPES.find((sampleType) => slot.name.endsWith(sampleType));
    slot.visible = Boolean(type && loadedTypes.includes(type));
  });
  const cooled = ["cooled", "sealed", "active", "delivered"].includes(state.casePhase);
  const sealed = ["sealed", "active", "delivered"].includes(state.casePhase);
  const active = ["active", "delivered"].includes(state.casePhase);
  const module = root.getObjectByName("rf07-case-installed-cooling");
  const openLid = root.getObjectByName("rf07-case-lid-open");
  const closedLid = root.getObjectByName("rf07-case-lid-closed");
  const indicator = root.getObjectByName("rf07-case-active-indicator");
  if (module) module.visible = cooled;
  if (openLid) openLid.visible = !sealed;
  if (closedLid) closedLid.visible = sealed;
  if (indicator?.material) {
    indicator.material.color.setHex(active ? 0x7cf4ff : 0x24383d);
    indicator.material.emissive.setHex(active ? 0x19d9ef : 0x000000);
    indicator.material.emissiveIntensity = active ? 3.2 : 0;
  }
}

function caseModel() {
  const root = new THREE.Group();
  box(root, [0.62, 0.33, 0.42], [0, 0.17, 0], material(0x263c44, 0.46, 0.28));
  ensureCaseVisual(root);
  return root;
}

function coolingModuleModel() {
  const root = new THREE.Group();
  box(root, [0.19, 0.035, 0.13], [0, 0.022, 0], material(0x2d91ad, 0.38, 0.18));
  [-0.065, 0, 0.065].forEach((x) => box(root, [0.018, 0.044, 0.11], [x, 0.045, 0], material(0xb7c8cb, 0.28, 0.62)));
  return root;
}

function ensureCabinetStatus(root, id) {
  if (!root || root.getObjectByName(`rf07-status-${id}`)) return;
  labelPlane(
    root,
    { title: id.slice(-2), subtitle: id === LEVEL.targetCabinet ? "目标柜 / TARGET" : "2–8°C", accent: id === LEVEL.targetCabinet ? "#147ca1" : "#49656b" },
    [0.54, 0.28],
    [0, 1.70, 0.422],
    [0, 0, 0],
    `rf07-label-${id}`,
  );
  const statusMaterial = new THREE.MeshStandardMaterial({ color: 0x68d9eb, emissive: 0x168ebd, emissiveIntensity: 2.2, roughness: 0.25 });
  const status = box(root, [0.12, 0.04, 0.025], [0.25, 1.52, 0.425], statusMaterial);
  status.name = `rf07-status-${id}`;
}

function cabinetModel(parent, point, id) {
  const root = new THREE.Group();
  root.position.set(point.assetX, 0, point.assetZ);
  root.rotation.y = point.yaw;
  box(root, [0.76, 1.98, 0.82], [0, 0.99, 0], material(0xb8c1c1, 0.32, 0.48));
  box(root, [0.64, 1.42, 0.035], [0, 1.05, 0.425], material(0x24474f, 0.22, 0.24));
  ensureCabinetStatus(root, id);
  parent.add(root);
  return root;
}

function prepareAsset(model) {
  model.traverse((object) => {
    if (object.isLight || object.isCamera) {
      object.visible = false;
      return;
    }
    if (!object.isMesh) return;
    object.castShadow = !/glass|label|screen/i.test(`${object.name} ${object.material?.name ?? ""}`);
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
loader.setDRACOLoader(new DRACOLoader().setDecoderPath("/vendor/draco/"));
const assetCache = new Map();

function fetchAsset(url) {
  if (!assetCache.has(url)) {
    assetCache.set(url, new Promise((resolve) => loader.load(url, (gltf) => {
      resolve(prepareAsset(gltf.scene));
    }, undefined, (error) => {
      console.warn(`[RF-07] failed to load ${url}`, error);
      resolve(null);
    })));
  }
  return assetCache.get(url);
}

function loadAsset(url, parent) {
  return fetchAsset(url).then((source) => {
    if (!source) return { loaded: false, url, model: null, error: new Error(`Unable to load ${url}`) };
    const model = prepareAsset(source.clone(true));
    parent.add(model);
    parent.userData.assetLoaded = true;
    return { loaded: true, url, model, error: null };
  });
}

function hideEnvironmentNodes(root, prefixes) {
  root.traverse((object) => {
    if (prefixes.some((prefix) => object.name.startsWith(prefix))) object.visible = false;
  });
}

function fixtureRoot(parent, fixture) {
  const root = new THREE.Group();
  root.name = `rf07-cardinal-${fixture.id}`;
  root.position.set(...fixture.position);
  root.rotation.y = fixture.yaw;
  root.userData.supportY = fixture.supportY;
  parent.add(root);
  return root;
}

function fallbackEnvironment(scene) {
  const root = new THREE.Group();
  root.name = "rf07-meter-accurate-fallback-environment";
  scene.add(root);
  const steel = material(0x879293, 0.32, 0.62);
  const top = material(0x263538, 0.42, 0.12);
  box(root, [24, 0.16, 16], [0, -0.08, 0], createEpoxyFloorMaterial(), { castShadow: false });
  box(root, [24, 3.3, 0.24], [0, 1.65, -8.0], createCleanroomWallMaterial(20));
  box(root, [0.24, 3.3, 16], [-12.0, 1.65, 0], createCleanroomWallMaterial(13));
  box(root, [0.24, 3.3, 16], [12.0, 1.65, 0], createCleanroomWallMaterial(13));
  box(root, [10.9, 3.3, 0.24], [-6.55, 1.65, 8.0], createCleanroomWallMaterial(9));
  box(root, [10.9, 3.3, 0.24], [6.55, 1.65, 8.0], createCleanroomWallMaterial(9));
  box(root, [7.9, 0.88, 0.78], [-7.35, 0.44, -7.18], steel);
  box(root, [7.9, 0.08, 0.82], [-7.35, 0.92, -7.18], top);
  [-2.0, 0.0, 2.0].forEach((x) => {
    box(root, [1.55, 2.15, 0.78], [x, 1.075, -7.18], steel);
    box(root, [1.32, 0.78, 0.05], [x, 1.15, -6.765], material(0x3a6269, 0.2, 0.22));
  });
  box(root, [4.8, 0.86, 1.6], [2.0, 0.43, 1.1], steel);
  box(root, [4.9, 0.08, 1.68], [2.0, 0.91, 1.1], top);
  box(root, [1.4, 0.86, 2.8], [-10.95, 0.43, 4.1], steel);
  const board = taskBoardModel();
  board.position.set(-11.78, 0, -1.6);
  root.add(board);
  return root;
}

function fallbackInteractables(scene) {
  const sampleRoots = {};
  SAMPLE_TYPES.forEach((type) => {
    const root = sampleModel(type);
    scene.add(root);
    sampleRoots[type] = root;
  });
  const caseRoot = caseModel();
  scene.add(caseRoot);
  const module = coolingModuleModel();
  scene.add(module);
  const cabinets = {};
  Object.entries(LEVEL.coldCabinets).forEach(([id, point]) => {
    cabinets[id] = cabinetModel(scene, point, id);
  });
  return { sampleRoots, caseRoot, module, cabinets };
}

function samplePose(item) {
  if (item.location === "storage") return { x: item.assetX, y: item.y, z: item.assetZ, yaw: item.yaw ?? 0 };
  return { x: item.x, y: 0, z: item.z, yaw: 0 };
}

function applyPose(root, pose) {
  root.position.set(pose.x, pose.y, pose.z);
  root.rotation.set(0, pose.yaw ?? 0, 0);
}

export function createLaboratoryScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb9c5c4);
  scene.fog = new THREE.Fog(0xb9c5c4, 30, 52);
  scene.add(new THREE.HemisphereLight(0xf5f7f2, 0x465356, 2.05));
  const key = new THREE.DirectionalLight(0xfff2d9, 2.3);
  key.position.set(-8, 14, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -14;
  key.shadow.camera.right = 14;
  key.shadow.camera.top = 11;
  key.shadow.camera.bottom = -11;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 36;
  key.shadow.normalBias = 0.035;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcce8ee, 1.0);
  fill.position.set(10, 9, -7);
  scene.add(fill);

  const environmentFallback = fallbackEnvironment(scene);
  const fallback = fallbackInteractables(scene);
  createAreaLabels(scene);
  const world = {
    scene,
    environmentFallback,
    ...fallback,
    assetRoots: { environment: new THREE.Group(), fixtures: new THREE.Group(), samples: {}, cabinets: {}, case: new THREE.Group(), module: new THREE.Group() },
  };
  scene.add(world.assetRoots.environment, world.assetRoots.fixtures, world.assetRoots.case, world.assetRoots.module);
  SAMPLE_TYPES.forEach((type) => {
    world.assetRoots.samples[type] = new THREE.Group();
    scene.add(world.assetRoots.samples[type]);
  });
  Object.entries(LEVEL.coldCabinets).forEach(([id, point]) => {
    const root = new THREE.Group();
    root.position.set(point.assetX, 0, point.assetZ);
    root.rotation.y = point.yaw;
    world.assetRoots.cabinets[id] = root;
    scene.add(root);
  });
  world.cargo = caseModel();
  world.cargo.visible = false;
  scene.add(world.cargo);
  world.sampleCarry = sampleModel("sampleA");
  world.sampleCarry.visible = false;
  scene.add(world.sampleCarry);
  world.coolingCarry = coolingModuleModel();
  world.coolingCarry.visible = false;
  scene.add(world.coolingCarry);

  const environmentReady = loadAsset(ASSETS.environment, world.assetRoots.environment).then((result) => {
    if (result.loaded) {
      applyLaboratorySurfaceMaterials(result.model);
      environmentFallback.visible = false;
    }
    return result;
  });
  const fixtureReady = RF07_CARDINAL_FIXTURES.map((fixture) => {
    const root = fixtureRoot(world.assetRoots.fixtures, fixture);
    return loadAsset(ASSETS[fixture.asset], root).then(async (result) => {
      if (result.loaded) {
        const environmentResult = await environmentReady;
        if (environmentResult.loaded) hideEnvironmentNodes(world.assetRoots.environment, fixture.hidePrefixes);
      }
      return { ...result, name: fixture.id };
    });
  });
  const sampleReady = Object.fromEntries(SAMPLE_TYPES.map((type) => [
    type,
    loadAsset(ASSETS[type], world.assetRoots.samples[type]).then((result) => {
      if (result.loaded) ensureSampleLabel(result.model, type);
      return result;
    }),
  ]));
  const caseReady = loadAsset(ASSETS.transportCase, world.assetRoots.case).then((result) => {
    if (result.loaded) ensureCaseVisual(world.assetRoots.case);
    return result;
  });
  const caseSamplesReady = Promise.all([
    caseReady,
    ...SAMPLE_TYPES.map((type) => sampleReady[type]),
  ]).then(([caseResult, ...sampleResults]) => {
    sampleResults.forEach((result, index) => {
      if (!result.loaded) return;
      const type = SAMPLE_TYPES[index];
      attachSampleAssetToCase(world.caseRoot, type, result.model);
      if (caseResult.loaded) attachSampleAssetToCase(world.assetRoots.case, type, result.model);
    });
    return caseResult;
  });
  world.assetReady = Promise.all([
    environmentReady,
    ...fixtureReady,
    ...Object.values(sampleReady),
    caseSamplesReady,
    loadAsset(ASSETS.coolingModule, world.assetRoots.module),
    ...Object.entries(LEVEL.coldCabinets).map(([id]) => loadAsset(ASSETS[id.replace("-", "")], world.assetRoots.cabinets[id]).then((result) => {
      if (result.loaded) ensureCabinetStatus(world.assetRoots.cabinets[id], id);
      return result;
    })),
  ]);
  return world;
}

export function syncLaboratoryVisuals(world, state) {
  const carryX = state.player.x + Math.sin(state.player.yaw) * 0.42;
  const carryZ = state.player.z + Math.cos(state.player.yaw) * 0.42;
  SAMPLE_TYPES.forEach((type) => {
    const item = state.samples[type];
    const onSurface = ["storage", "floor"].includes(item.location);
    const carried = state.carriedItem === type;
    const pose = samplePose(item);
    const fallback = world.sampleRoots[type];
    const loadedRoot = world.assetRoots.samples[type];
    const loaded = Boolean(loadedRoot.children.length);
    fallback.visible = onSurface && !loaded;
    if (fallback.visible) applyPose(fallback, pose);
    loadedRoot.visible = loaded && (onSurface || carried);
    if (loadedRoot.visible) applyPose(loadedRoot, carried ? { x: carryX, y: 1.08, z: carryZ, yaw: state.player.yaw + Math.PI } : pose);
  });
  const carriedSample = SAMPLE_TYPES.includes(state.carriedItem) ? state.carriedItem : null;
  const carriedSampleLoaded = carriedSample && world.assetRoots.samples[carriedSample].children.length;
  world.sampleCarry.visible = Boolean(carriedSample && !carriedSampleLoaded);
  if (world.sampleCarry.visible) {
    world.sampleCarry.position.set(carryX, 1.08, carryZ);
    world.sampleCarry.rotation.y = state.player.yaw + Math.PI;
    world.sampleCarry.clear();
    world.sampleCarry.add(sampleModel(carriedSample));
  }

  const caseVisible = state.carriedItem !== "transport-case" && state.casePhase !== "delivered";
  const caseLoaded = Boolean(world.assetRoots.case.children.length);
  world.caseRoot.visible = caseVisible && !caseLoaded;
  applyPose(world.caseRoot, LEVEL.transportCaseAsset);
  world.assetRoots.case.visible = caseVisible && caseLoaded;
  applyPose(world.assetRoots.case, LEVEL.transportCaseAsset);
  syncCaseVisual(world.caseRoot, state);
  syncCaseVisual(world.assetRoots.case, state);

  const moduleOnSurface = ["prep-room", "floor"].includes(state.coolingModuleLocation);
  const moduleCarried = state.carriedItem === "cooling-module";
  const moduleLoaded = Boolean(world.assetRoots.module.children.length);
  const modulePose = state.coolingModuleLocation === "floor"
    ? { ...state.coolingModulePoint, y: 0, yaw: 0 }
    : LEVEL.coolingModuleAsset;
  world.module.visible = moduleOnSurface && !moduleLoaded;
  if (world.module.visible) applyPose(world.module, modulePose);
  world.coolingCarry.visible = moduleCarried && !moduleLoaded;
  if (world.coolingCarry.visible) applyPose(world.coolingCarry, { x: carryX, y: 1.08, z: carryZ, yaw: state.player.yaw });
  world.assetRoots.module.visible = moduleLoaded && (moduleOnSurface || moduleCarried);
  if (world.assetRoots.module.visible) applyPose(world.assetRoots.module, moduleCarried ? { x: carryX, y: 1.08, z: carryZ, yaw: state.player.yaw } : modulePose);

  Object.entries(world.cabinets).forEach(([id, cabinet]) => {
    cabinet.userData.active = id === LEVEL.targetCabinet && state.casePhase === "delivered";
  });
  Object.entries(world.assetRoots.cabinets).forEach(([id, cabinet]) => {
    cabinet.visible = true;
    cabinet.userData.active = id === LEVEL.targetCabinet && state.casePhase === "delivered";
  });
}

export function createLaboratoryCargoModel() {
  const root = new THREE.Group();
  const caseRoot = new THREE.Group();
  caseRoot.name = "rf07-robot-transport-case";
  const fallback = caseModel();
  caseRoot.add(fallback);
  root.add(caseRoot);
  root.userData.fallback = fallback;
  root.userData.caseRoot = caseRoot;
  root.userData.assetReady = loadAsset(ASSETS.transportCase, caseRoot).then((result) => {
    if (result.loaded) {
      fallback.visible = false;
      ensureCaseVisual(caseRoot);
    }
    return result;
  });
  return root;
}

export function setLaboratoryCargoModel(model, state) {
  if (!model) return;
  const caseRoot = model.userData.caseRoot;
  if (!caseRoot) return;
  caseRoot.visible = state.carriedItem === "transport-case";
  syncCaseVisual(caseRoot, state);
}

export { ASSETS };
