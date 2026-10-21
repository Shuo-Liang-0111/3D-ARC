import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { ITEM_META, ITEM_TYPES, LEVEL } from "./level.js";

const ASSETS = Object.freeze({
  environment: "/local-assets/embodiedgen/rf06/models/runtime/rf06_final.glb?v=3ad66591",
  wrench: "/local-assets/embodiedgen/rf06/models/runtime/interactables/wrench.glb",
  bucket: "/local-assets/embodiedgen/rf06/models/runtime/interactables/bucket.glb",
  mop: "/local-assets/embodiedgen/rf06/models/runtime/interactables/mop.glb",
  valve: "/local-assets/embodiedgen/rf06/models/runtime/interactables/valve.glb",
  leak: "/local-assets/embodiedgen/rf06/models/runtime/interactables/leak.glb",
  toolRack: "/local-assets/embodiedgen/rf06/models/runtime/interactables/tool_rack.glb",
});

const CARDINAL_INTERACTABLES = Object.freeze({
  wrench: "/local-assets/cardinal/rf06/runtime/models/wrench.glb",
  bucket: "/local-assets/cardinal/rf06/runtime/models/bucket.glb",
  mop: "/local-assets/cardinal/rf06/runtime/models/mop.glb",
  valve: "/local-assets/cardinal/rf06/runtime/models/shutoff_valve.glb",
  toolRack: "/local-assets/cardinal/rf06/runtime/models/tool_rack.glb",
});
const CARDINAL_SURFACES = Object.freeze({
  floor: "/local-assets/cardinal/rf06/runtime/textures/living_oak_floor.png",
  tile: "/local-assets/cardinal/rf06/runtime/textures/anti_slip_porcelain_tile.png",
  wall: "/local-assets/cardinal/rf06/runtime/textures/warm_white_painted_plaster.png",
});
const CARDINAL_SURFACE_FALLBACKS = Object.freeze({
  floor: "/local-assets/cardinal/rf04/textures/warm-oak-floor.png",
  tile: "/local-assets/cardinal/rf05/textures/source/bathroom_floor_tile.png",
  wall: "/local-assets/cardinal/rf04/textures/realistic-warm-plaster-wall.png",
});
const CARDINAL_FURNITURE = Object.freeze([
  { id: "sofa", asset: "/local-assets/cardinal/rf06/runtime/models/sofa.glb?v=cardinal-rf06-sofa-r4", position: [-2.85, 0, -3.0], yaw: -Math.PI / 2, legacy: /RF06_V13_Textured_Sofa/i },
  { id: "dining-set", asset: "/local-assets/cardinal/rf06/runtime/models/dining_set.glb", position: [0.75, 0, -1.25], yaw: 0, legacy: /dining|chair|table/i },
  { id: "coffee-table", asset: "/local-assets/cardinal/rf06/runtime/models/coffee_table.glb", position: [-2.85, 0, -1.75], yaw: 0, legacy: /coffee/i },
  { id: "tv-console", asset: "/local-assets/cardinal/rf06/runtime/models/tv_console.glb", fallbackAsset: "/local-assets/cardinal/rf05/models/runtime/television_console.glb", position: [-2.80, 0, -0.31], yaw: Math.PI, legacy: /RF06_V13_TV_Console|RF06_V13_55in_TV/i, proceduralFallback: true },
  { id: "refrigerator", asset: "/local-assets/cardinal/rf06/runtime/models/refrigerator.glb", position: [-4.77, 0, 1.15], yaw: Math.PI / 2, legacy: /refrigerator|fridge/i, disabled: true },
  { id: "washing-machine", asset: "/local-assets/cardinal/rf06/runtime/models/washing_machine.glb", fallbackAsset: "/local-assets/cardinal/rf04/models/runtime/washer.glb", position: [3.17, 0, 3.49], yaw: Math.PI, legacy: /washer|washing/i },
  { id: "shoe-cabinet", asset: "/local-assets/cardinal/rf06/runtime/models/shoe_cabinet.glb", position: [5.08, 0, -2.59], yaw: -Math.PI / 2, legacy: /shoe/i },
  { id: "entry-bench", asset: "/local-assets/cardinal/rf06/runtime/models/entry_bench.glb", fallbackAsset: "/local-assets/cardinal/rf05/models/runtime/luggage_bench.glb", fallbackScale: [0.52, 0.88, 0.62], position: [4.25, 0, -2.78], yaw: 0, legacy: /entry|bench/i },
  { id: "utility-cabinet", asset: "/local-assets/cardinal/rf06/runtime/models/utility_cabinet.glb", position: [4.86, 0, 3.28], yaw: -Math.PI / 2, legacy: /utility.?cabinet/i },
  { id: "wall-air-conditioner", asset: "/local-assets/cardinal/rf06/runtime/models/wall_air_conditioner.glb", position: [1.2, 2.28, -3.78], yaw: 0, legacy: /air.?condition|split.?unit/i, wallMounted: true },
]);
const CARDINAL_DINING_FALLBACK = Object.freeze([
  { asset: "/local-assets/cardinal/rf02/models/runtime/reading-table.glb", position: [0, 0, 0], yaw: 0, scale: [0.585, 1, 0.76] },
  { asset: "/local-assets/cardinal/rf02/models/runtime/reading-chair.glb", position: [0, 0, 0.66], yaw: Math.PI / 2 },
  { asset: "/local-assets/cardinal/rf02/models/runtime/reading-chair.glb", position: [0, 0, -0.66], yaw: -Math.PI / 2 },
  { asset: "/local-assets/cardinal/rf02/models/runtime/reading-chair.glb", position: [-0.72, 0, 0], yaw: 0 },
  { asset: "/local-assets/cardinal/rf02/models/runtime/reading-chair.glb", position: [0.72, 0, 0], yaw: -Math.PI },
]);

export const WASHROOM_WEST_WALL_REPAIR = Object.freeze({
  size: Object.freeze([0.12, 2.75, 0.87]),
  position: Object.freeze([2.68, 1.375, 1.915]),
});

export const KITCHEN_SOUTH_WALL_REPAIR = Object.freeze({
  size: Object.freeze([1.65, 2.75, 0.12]),
  position: Object.freeze([-2.475, 1.375, 0.62]),
});

const FIXED_ITEM_POSES = Object.freeze({
  bucket: Object.freeze({
    placed: Object.freeze({ x: LEVEL.bucketDrop.x, y: 0.02, z: LEVEL.bucketDrop.z, yaw: 0, roll: 0 }),
  }),
  wrench: Object.freeze({
    "tool-rack": Object.freeze({ x: LEVEL.toolRack.x - 0.28, y: 0.82, z: LEVEL.toolRack.z - 0.14, yaw: 0, roll: Math.PI / 2 }),
  }),
  mop: Object.freeze({
    "tool-rack": Object.freeze({ x: LEVEL.toolRack.x - 0.28, y: 0.04, z: LEVEL.toolRack.z + 0.18, yaw: 0, roll: 0 }),
  }),
});

const NON_SHADOW_NAME_PATTERN = /(?:RF06_(?:North_Wall|Kitchen_Divider|Utility_Divider|North_Wall_Panel|Kitchen_Upper_Cabinet)|KitchenSpaceFactory|OvenFactory)/i;
const NON_SHADOW_MATERIAL_PATTERN = /(?:glass|window_glass|glass_volume|translucent|lampshade|monocot)/i;
const FURNITURE_SHADOW_NAME_PATTERN = /(?:Dining|Coffee|Sofa|TV|Bench|Refrigerator|Fridge|Cabinet|Washer|Range_Hood|Living_Plant)/i;

function material(color, metalness = 0.05, roughness = 0.72) { return new THREE.MeshStandardMaterial({ color, metalness, roughness }); }
function box(parent, size, pos, mat, options = {}) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat); mesh.position.set(...pos); mesh.castShadow = options.castShadow ?? true; mesh.receiveShadow = true; parent.add(mesh); return mesh; }
function roundedBox(parent, size, pos, mat, radius = 0.06, options = {}) { const mesh = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 5, radius), mat); mesh.position.set(...pos); mesh.castShadow = options.castShadow ?? true; mesh.receiveShadow = true; parent.add(mesh); return mesh; }
function cylinder(parent, radius, height, pos, mat, segments = 24) { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), mat); mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; }

function fallbackItem(type) {
  const group = new THREE.Group();
  const mat = material(ITEM_META[type].color, type === "wrench" ? 0.75 : 0.05, 0.6);
  if (type === "wrench") { box(group, [0.12, 0.75, 0.12], [0, 0.38, 0], mat); cylinder(group, 0.2, 0.12, [0, 0.78, 0], mat, 16); }
  if (type === "bucket") { const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.48, 24, 1, true), mat); body.position.y = 0.24; group.add(body); }
  if (type === "mop") { box(group, [0.08, 1.35, 0.08], [0, 0.68, 0], mat); box(group, [0.55, 0.12, 0.18], [0, 0.08, 0], mat); }
  return group;
}

function createSofaFabricTexture(kind = "color") {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  context.fillStyle = kind === "color" ? "#c9c0b3" : "#808080";
  context.fillRect(0, 0, 256, 256);
  for (let index = 0; index < 256; index += 2) {
    const variation = ((index * 37) % 9) - 4;
    context.strokeStyle = kind === "color" ? `rgba(88, 75, 62, ${0.05 + Math.abs(variation) * 0.006})` : `rgba(255, 255, 255, ${0.08 + Math.abs(variation) * 0.008})`;
    context.lineWidth = 0.55;
    context.beginPath(); context.moveTo(index, 0); context.lineTo(index, 256); context.stroke();
    context.beginPath(); context.moveTo(0, index); context.lineTo(256, index); context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 4);
  texture.anisotropy = 8;
  if (kind === "color") texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSofaFallback() {
  const group = new THREE.Group();
  group.name = "rf06-sofa-fallback";
  const fabricMap = createSofaFabricTexture("color");
  const fabricBump = createSofaFabricTexture("bump");
  const upholstery = new THREE.MeshStandardMaterial({ color: 0xd4ccc0, map: fabricMap, bumpMap: fabricBump, bumpScale: 0.008, metalness: 0.01, roughness: 0.91 });
  const cushionMaterial = upholstery.clone();
  cushionMaterial.color.setHex(0xe0d9ce);
  const piping = material(0xa99e90, 0.01, 0.96);
  const wood = material(0x3e2b20, 0.12, 0.58);

  roundedBox(group, [2.12, 0.26, 0.78], [0, 0.31, -0.01], upholstery, 0.08);
  roundedBox(group, [1.88, 0.55, 0.18], [0, 0.625, -0.34], upholstery, 0.07);
  [-0.62, 0, 0.62].forEach((x, index) => {
    const seat = roundedBox(group, [0.59, 0.18, 0.68], [x, index === 1 ? 0.485 : 0.495, 0.055], cushionMaterial, 0.085);
    seat.rotation.x = -0.018;
    const back = roundedBox(group, [0.57, 0.43, 0.19], [x, index === 1 ? 0.713 : 0.72, -0.245], cushionMaterial, 0.085);
    back.rotation.x = -0.075;
    roundedBox(group, [0.49, 0.018, 0.018], [x, index === 1 ? 0.582 : 0.592, 0.402], piping, 0.007, { castShadow: false });
  });
  [-1.055, 1.055].forEach((x) => {
    roundedBox(group, [0.24, 0.55, 0.82], [x, 0.555, 0], upholstery, 0.095);
    roundedBox(group, [0.20, 0.11, 0.57], [x, 0.835, 0.075], cushionMaterial, 0.045);
  });
  [-0.94, 0.94].forEach((x) => [-0.29, 0.29].forEach((z) => {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.057, 0.18, 16), wood);
    foot.position.set(x, 0.09, z);
    foot.castShadow = true;
    foot.receiveShadow = true;
    group.add(foot);
  }));
  group.userData.dimensions = [2.35, 0.94, 0.90];
  group.userData.source = "procedural-fallback";
  return group;
}

function createTvFallback() {
  const group = new THREE.Group();
  const frame = material(0x17191b, 0.72, 0.30);
  const screen = new THREE.MeshStandardMaterial({ color: 0x172b3b, metalness: 0.12, roughness: 0.24, emissive: 0x06131d, emissiveIntensity: 0.32 });
  const wood = material(0x6a4935, 0.08, 0.55);
  box(group, [1.68, 0.96, 0.08], [0, 1.58, 0], frame);
  box(group, [1.50, 0.78, 0.012], [0, 1.58, 0.048], screen, { castShadow: false });
  box(group, [1.82, 0.10, 0.38], [0, 0.28, 0], wood);
  box(group, [1.62, 0.08, 0.36], [0, 0.54, 0], wood);
  [-0.73, 0.73].forEach((x) => cylinder(group, 0.035, 0.16, [x, 0.08, 0], frame, 12));
  box(group, [0.06, 0.34, 0.04], [0, 1.07, -0.01], frame, { castShadow: false });
  group.userData.dimensions = [1.85, 2.10, 0.42];
  return group;
}

function shouldCastShadow(object) {
  if (NON_SHADOW_NAME_PATTERN.test(object.name)) return false;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  return !materials.filter(Boolean).some((entry) => NON_SHADOW_MATERIAL_PATTERN.test(entry.name));
}

function enableFurnitureShadows(model, namePattern = null) {
  model.traverse((object) => {
    if (!object.isMesh || (namePattern && !namePattern.test(object.name))) return;
    object.castShadow = shouldCastShadow(object);
  });
}

function sanitizeTransform(object) {
  if (![object.position.x, object.position.y, object.position.z].every(Number.isFinite)) object.position.set(0, 0, 0);
  if (![object.quaternion.x, object.quaternion.y, object.quaternion.z, object.quaternion.w].every(Number.isFinite) || object.quaternion.lengthSq() < Number.EPSILON) {
    object.quaternion.identity();
  } else {
    object.quaternion.normalize();
  }
  if (![object.scale.x, object.scale.y, object.scale.z].every(Number.isFinite)) object.scale.set(1, 1, 1);
  if (object.pivot !== null && object.pivot !== undefined && ![object.pivot.x, object.pivot.y, object.pivot.z].every(Number.isFinite)) {
    object.userData.assetPivot ??= object.pivot;
    object.pivot = null;
  }
  object.updateMatrix();
}

function prepareAsset(model) {
  model.traverse((object) => {
    sanitizeTransform(object);
    if (object.isLight || object.isCamera) object.visible = false;
    if (!object.isMesh) return;
    // RF-06 source meshes contain legacy long-thin primitives; receiving the scene shadow is safe, but
    // letting those primitives cast creates screen-spanning black lines in the runtime. Keep lighting soft.
    object.castShadow = false;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((entry) => {
      if (entry.map) entry.map.colorSpace = THREE.SRGBColorSpace;
      entry.needsUpdate = true;
    });
  });
  return model;
}

// Cardinal exports occasionally keep the source pivot on a depth axis. Re-anchor furniture
// from its evaluated bounds so the visible mesh is centered on its slot and rests on y = 0.
export function normalizeFloorFurniture(model) {
  if (!model?.isObject3D) return model;
  const parent = model.parent;
  if (parent) parent.remove(model);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  if (bounds.isEmpty()) {
    if (parent) parent.add(model);
    return model;
  }
  const values = [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z];
  if (!values.every(Number.isFinite)) {
    if (parent) parent.add(model);
    return model;
  }
  model.position.x -= (bounds.min.x + bounds.max.x) / 2;
  model.position.y -= bounds.min.y;
  model.position.z -= (bounds.min.z + bounds.max.z) / 2;
  model.updateMatrixWorld(true);
  if (parent) parent.add(model);
  return model;
}

const dracoLoader = new DRACOLoader();
dracoLoader.setWorkerLimit(2);
const assetLoader = new GLTFLoader();
assetLoader.setDRACOLoader(dracoLoader);
const textureLoader = new THREE.TextureLoader();
const assetCache = new Map();

function fetchAsset(url) {
  if (!assetCache.has(url)) {
    assetCache.set(url, new Promise((resolve) => assetLoader.load(url, (gltf) => {
      resolve(prepareAsset(gltf.scene));
    }, undefined, (error) => {
      console.warn(`[RF-06] Failed to load ${url}`, error);
      resolve(null);
    })));
  }
  return assetCache.get(url);
}

function loadAsset(url, root) {
  return fetchAsset(url).then((source) => {
    if (!source) return { loaded: false, url, model: null };
    const model = prepareAsset(source.clone(true));
    root.add(model);
    return { loaded: true, url, model };
  });
}

function loadAssetWithFallback(urls, root) {
  const candidates = Array.isArray(urls)
    ? (typeof window === "undefined" ? [urls[urls.length - 1]] : urls)
    : [urls];
  return candidates.reduce((promise, url) => promise.then((result) => result.loaded ? result : loadAsset(url, root)), Promise.resolve({ loaded: false, url: candidates[0], model: null }));
}

function loadDiningFallback(root) {
  const loads = CARDINAL_DINING_FALLBACK.map((entry) => {
    const slot = new THREE.Group();
    slot.position.set(...entry.position);
    slot.rotation.y = entry.yaw;
    if (entry.scale) slot.scale.set(...entry.scale);
    root.add(slot);
    return loadAsset(entry.asset, slot);
  });
  return Promise.all(loads).then((results) => {
    const loaded = results.every((result) => result.loaded);
    if (loaded) results.forEach((result) => enableFurnitureShadows(result.model));
    if (!loaded) {
      root.children.forEach(disposeRenderable);
      root.clear();
    }
    return { loaded, url: CARDINAL_DINING_FALLBACK[0].asset, model: loaded ? root : null };
  });
}

function loadFurnitureAsset(entry, root) {
  if (entry.disabled) return Promise.resolve({ loaded: false, url: entry.asset, model: null });
  return loadAsset(entry.asset, root).then((result) => {
    if (result.loaded) {
      if (entry.id === "sofa") normalizeFloorFurniture(result.model);
      enableFurnitureShadows(result.model);
      return result;
    }
    if (entry.id === "dining-set") return loadDiningFallback(root);
    if (!entry.fallbackAsset) return result;
    return loadAsset(entry.fallbackAsset, root).then((fallbackResult) => {
      if (fallbackResult.loaded) {
        if (entry.fallbackScale) fallbackResult.model.scale.set(...entry.fallbackScale);
        enableFurnitureShadows(fallbackResult.model);
      }
      return fallbackResult;
    });
  });
}

function loadSurfaceTexture(url, materialInstance, repeat, fallbackUrl = null) {
  if (typeof document === "undefined") return Promise.resolve(false);
  const applyTexture = (texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
    texture.colorSpace = THREE.SRGBColorSpace;
    materialInstance.map = texture;
    materialInstance.needsUpdate = true;
    return true;
  };
  const proceduralFallback = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 512;
    const context = canvas.getContext("2d");
    const isWall = /plaster/i.test(url);
    const isTile = /tile/i.test(url);
    context.fillStyle = isWall ? "#e4dfd5" : isTile ? "#c9c7bf" : "#9f7856";
    context.fillRect(0, 0, 512, 512);
    if (isTile) {
      context.strokeStyle = "#8f8d87"; context.lineWidth = 4;
      for (let i = 0; i <= 512; i += 128) { context.beginPath(); context.moveTo(i, 0); context.lineTo(i, 512); context.stroke(); context.beginPath(); context.moveTo(0, i); context.lineTo(512, i); context.stroke(); }
      context.fillStyle = "rgba(255,255,255,0.08)";
      for (let i = 0; i < 500; i += 17) context.fillRect((i * 37) % 512, (i * 73) % 512, 2, 2);
    } else if (isWall) {
      context.fillStyle = "rgba(120,105,90,0.08)";
      for (let i = 0; i < 900; i += 13) context.fillRect((i * 41) % 512, (i * 67) % 512, 2, 1);
    } else {
      context.strokeStyle = "rgba(70,38,20,0.32)"; context.lineWidth = 2;
      for (let y = 0; y < 512; y += 128) { context.beginPath(); context.moveTo(0, y); context.lineTo(512, y); context.stroke(); }
      context.strokeStyle = "rgba(244,206,157,0.24)"; context.lineWidth = 1;
      for (let i = 0; i < 80; i += 1) { const y = (i * 47) % 512; context.beginPath(); context.moveTo(0, y); context.bezierCurveTo(150, y - 8, 340, y + 8, 512, y); context.stroke(); }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]); texture.colorSpace = THREE.SRGBColorSpace;
    materialInstance.map = texture; materialInstance.needsUpdate = true;
    return false;
  };
  const load = (candidate) => new Promise((resolve) => textureLoader.load(candidate, resolve, undefined, () => resolve(null)));
  return load(url).then((texture) => {
    if (texture) return applyTexture(texture);
    if (!fallbackUrl) return proceduralFallback();
    return load(fallbackUrl).then((fallbackTexture) => fallbackTexture ? applyTexture(fallbackTexture) : proceduralFallback());
  });
}

function hideLegacyFurniture(environmentRoot, pattern) {
  environmentRoot.traverse((object) => {
    if (pattern.test(object.name)) object.visible = false;
  });
}

function applySurfaceToEnvironment(root, texture, pattern) {
  if (!texture) return;
  root.traverse((object) => {
    if (!object.isMesh || !pattern.test(object.name)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((entry) => {
      entry.map = texture;
      entry.needsUpdate = true;
    });
  });
}

function disposeRenderable(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((entry) => entry.dispose());
  });
}

function itemPose(type, item) {
  return FIXED_ITEM_POSES[type]?.[item.location] ?? {
    x: item.x,
    y: 0.03,
    z: item.z,
    yaw: type === "mop" ? -0.08 : 0,
    roll: 0,
  };
}

function applyPose(root, pose) {
  root.position.set(pose.x, pose.y, pose.z);
  root.rotation.set(pose.pitch ?? 0, pose.yaw ?? 0, pose.roll ?? 0);
}

export function createWaterLeakScene() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xb8c2c5); scene.fog = new THREE.Fog(0xb8c2c5, 28, 58);
  scene.add(new THREE.HemisphereLight(0xf2eee5, 0x526064, 2.15));
  const sun = new THREE.DirectionalLight(0xffe7c8, 1.95);
  sun.position.set(-8, 15, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.00008;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 2.5;
  scene.add(sun);
  const livingFill = new THREE.PointLight(0xffe4bf, 0.42, 7.5, 2);
  livingFill.position.set(-2.3, 2.35, -1.55);
  scene.add(livingFill);
  const kitchenFill = new THREE.PointLight(0xf1f5ff, 0.34, 6.5, 2);
  kitchenFill.position.set(-3.4, 2.25, 2.45);
  scene.add(kitchenFill);
  const fallback = new THREE.Group(); scene.add(fallback);
  const architecture = new THREE.Group(); fallback.add(architecture);
  const floorMaterial = material(0x8c765f, 0.02, 0.85);
  const tileMaterial = material(0xd3c7b0, 0.02, 0.82);
  box(architecture, [10.8, 0.12, 8], [0, -0.06, 0], floorMaterial).name = "RF06_Living_Oak_Floor";
  const wall = material(0xe3ded2, 0.02, 0.9);
  box(architecture, [10.8, 2.75, 0.12], [0, 1.375, 3.94], wall);
  box(architecture, [0.12, 2.75, 8], [-5.34, 1.375, 0], wall);
  box(architecture, [0.12, 2.75, 8], [5.34, 1.375, 0], wall);
  box(architecture, [8.95, 2.75, 0.12], [-0.925, 1.375, -3.94], wall);
  box(architecture, [0.85, 2.75, 0.12], [4.975, 1.375, -3.94], wall);
  box(architecture, [0.12, 2.75, 3.32], [-1.41, 1.375, 2.32], wall); box(architecture, [0.12, 2.75, 1.65], [2.68, 1.375, 3.175], wall); box(architecture, [0.12, 2.75, 0.38], [2.68, 1.375, 1.29], wall);
  const washroomWallRepairRoot = new THREE.Group(); washroomWallRepairRoot.name = "rf06-washroom-west-wall-repair"; scene.add(washroomWallRepairRoot);
  const washroomWallRepair = box(
    washroomWallRepairRoot,
    WASHROOM_WEST_WALL_REPAIR.size,
    WASHROOM_WEST_WALL_REPAIR.position,
    wall,
    { castShadow: false },
  ); washroomWallRepair.name = "RF06_Washroom_West_Wall_Repair";
  const kitchenWallRepairRoot = new THREE.Group(); kitchenWallRepairRoot.name = "rf06-kitchen-south-wall-repair"; scene.add(kitchenWallRepairRoot);
  const kitchenWallRepair = box(
    kitchenWallRepairRoot,
    KITCHEN_SOUTH_WALL_REPAIR.size,
    KITCHEN_SOUTH_WALL_REPAIR.position,
    wall,
    { castShadow: false },
  ); kitchenWallRepair.name = "RF06_Kitchen_South_Wall_Repair";
  box(architecture, [3.2, 0.82, 0.64], [-3.17, 0.41, 3.56], material(0x6d513f)); box(architecture, [0.22, 1.5, 0.72], [LEVEL.toolRack.x + 0.24, 0.75, LEVEL.toolRack.z], material(0x49545a));
  const leakVisual = cylinder(fallback, 0.9, 0.015, [LEVEL.puddle.x, 0.012, LEVEL.puddle.z], material(0x4e9bb2, 0.1, 0.22), 40);
  const valveVisual = cylinder(fallback, 0.26, 0.12, [LEVEL.valve.x, 0.62, LEVEL.valve.z], material(0xc7cdd0, 0.8, 0.35), 20); valveVisual.rotation.x = Math.PI / 2;
  const rack = box(fallback, [0.22, 1.5, 0.72], [LEVEL.toolRack.x + 0.24, 0.75, LEVEL.toolRack.z], material(0x49545a, 0.55, 0.4));
  const itemRoots = {}; ITEM_TYPES.forEach((type) => { itemRoots[type] = fallbackItem(type); scene.add(itemRoots[type]); });
  const wetRoot = fallbackItem("bucket"); wetRoot.visible = false; scene.add(wetRoot);
  const environmentRoot = new THREE.Group(); scene.add(environmentRoot);
  const furnitureRoot = new THREE.Group(); furnitureRoot.name = "rf06-cardinal-furniture"; scene.add(furnitureRoot);
  const sofaFallback = createSofaFallback();
  sofaFallback.position.set(-2.85, 0, -3.0);
  furnitureRoot.add(sofaFallback);
  const tvFallback = createTvFallback();
  tvFallback.position.set(-2.80, 0, -0.31);
  furnitureRoot.add(tvFallback);
  const valveRoot = new THREE.Group(); valveRoot.position.set(LEVEL.valve.x, 0.58, LEVEL.valve.z); scene.add(valveRoot);
  const rackIndicator = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshStandardMaterial({ color: 0xc34f45, emissive: 0x5b100c, emissiveIntensity: 1.4 }));
  rackIndicator.position.set(LEVEL.toolRack.x, 1.62, LEVEL.toolRack.z + 0.12); scene.add(rackIndicator);
  const leakRoot = new THREE.Group(); leakRoot.position.set(LEVEL.puddle.x, 0.02, LEVEL.puddle.z); scene.add(leakRoot);
  const rackRoot = new THREE.Group(); rackRoot.position.set(LEVEL.toolRack.x + 0.24, 0, LEVEL.toolRack.z); rackRoot.rotation.y = Math.PI / 2; scene.add(rackRoot);
  const furnitureRoots = {};
  CARDINAL_FURNITURE.forEach((entry) => {
    const root = new THREE.Group(); root.name = `rf06-cardinal-${entry.id}`;
    root.position.set(...entry.position); root.rotation.y = entry.yaw;
    furnitureRoot.add(root); furnitureRoots[entry.id] = root;
  });
  const assetRoots = { environment: environmentRoot, items: {}, valve: valveRoot, leak: leakRoot, toolRack: rackRoot, furniture: furnitureRoots };
  loadSurfaceTexture(CARDINAL_SURFACES.floor, floorMaterial, [10, 8], CARDINAL_SURFACE_FALLBACKS.floor).then(() => applySurfaceToEnvironment(environmentRoot, floorMaterial.map, /living.*floor|living_oak/i));
  loadSurfaceTexture(CARDINAL_SURFACES.tile, tileMaterial, [6, 6], CARDINAL_SURFACE_FALLBACKS.tile).then(() => applySurfaceToEnvironment(environmentRoot, tileMaterial.map, /kitchen.*floor|tile/i));
  loadSurfaceTexture(CARDINAL_SURFACES.wall, wall, [5, 3], CARDINAL_SURFACE_FALLBACKS.wall).then(() => applySurfaceToEnvironment(environmentRoot, wall.map, /wall|plaster/i));
  const assetReady = Promise.all([
    loadAsset(ASSETS.environment, environmentRoot).then((result) => {
      if (result.loaded) {
        result.model.name = "rf06-final-environment";
        result.model.traverse((object) => {
          if (["RF06_V13_Kitchen_Slider_A", "RF06_V13_Kitchen_Slider_B"].includes(object.name)) object.visible = false;
          if (object.isMesh && object.name === "RF06_V13_Utility_West_North") washroomWallRepair.material = object.material;
          if (object.isMesh && object.name === "RF06_V13_Kitchen_South_Wall_West") kitchenWallRepair.material = object.material;
        });
        enableFurnitureShadows(result.model, FURNITURE_SHADOW_NAME_PATTERN);
        architecture.visible = false;
        hideLegacyFurniture(environmentRoot, /RF06_V13_Textured_Sofa|RF06_V13_TV_Console|RF06_V13_55in_TV/i);
        CARDINAL_FURNITURE.forEach((entry) => { if (furnitureRoots[entry.id].children.length) hideLegacyFurniture(environmentRoot, entry.legacy); });
        applySurfaceToEnvironment(environmentRoot, floorMaterial.map, /living.*floor|living_oak/i);
        applySurfaceToEnvironment(environmentRoot, tileMaterial.map, /kitchen.*floor|tile/i);
        applySurfaceToEnvironment(environmentRoot, wall.map, /wall|plaster/i);
      }
      return result;
    }),
    ...ITEM_TYPES.map((type) => { const root = new THREE.Group(); scene.add(root); assetRoots.items[type] = root; return loadAssetWithFallback([CARDINAL_INTERACTABLES[type], ASSETS[type]], root).then((result) => { if (result.loaded) itemRoots[type].visible = false; return result; }); }),
    loadAssetWithFallback([CARDINAL_INTERACTABLES.valve, ASSETS.valve], valveRoot).then((result) => { if (result.loaded) valveVisual.visible = false; return result; }),
    loadAsset(ASSETS.leak, leakRoot).then((result) => { if (result.loaded) leakVisual.visible = false; return result; }),
    loadAssetWithFallback([CARDINAL_INTERACTABLES.toolRack, ASSETS.toolRack], rackRoot).then((result) => { if (result.loaded) rack.visible = false; return result; }),
    ...(typeof window === "undefined" ? [] : CARDINAL_FURNITURE.map((entry) => loadFurnitureAsset(entry, furnitureRoots[entry.id]).then((result) => {
      if (result.loaded) {
        hideLegacyFurniture(environmentRoot, entry.legacy);
        if (entry.id === "sofa") sofaFallback.visible = false;
        if (entry.id === "tv-console") tvFallback.visible = false;
      }
      return result;
    }))),
  ]);
  return { scene, itemRoots, wetRoot, leakVisual, rack, rackIndicator, assetRoots, assetReady };
}

export function syncWaterLeakVisuals(world, state) {
  ITEM_TYPES.forEach((type) => {
    const item = state.items[type];
    const visible = ["room", "floor", "placed", "tool-rack"].includes(item.location);
    const pose = itemPose(type, item);
    const root = world.itemRoots[type];
    const loadedRoot = world.assetRoots.items[type];
    const loaded = Boolean(loadedRoot?.children.length);
    root.visible = visible && !loaded;
    if (root.visible) applyPose(root, pose);
    if (loadedRoot) {
      loadedRoot.visible = visible && loaded;
      if (loadedRoot.visible) applyPose(loadedRoot, pose);
    }
  });
  world.wetRoot.visible = false;
  const generatedLeakLoaded = Boolean(world.assetRoots.leak?.children.length);
  world.leakVisual.visible = !state.puddleClean && !generatedLeakLoaded;
  world.assetRoots.leak.visible = !state.puddleClean && generatedLeakLoaded;
  world.assetRoots.valve.rotation.y = state.valveClosed ? Math.PI / 2 : 0;
  world.rack.material.color.setHex(state.returned.wrench && state.returned.mop ? 0x5b9a68 : 0x49545a);
  const toolsReturned = state.returned.wrench && state.returned.mop;
  world.rackIndicator.material.color.setHex(toolsReturned ? 0x58b66a : 0xc34f45);
  world.rackIndicator.material.emissive.setHex(toolsReturned ? 0x164f22 : 0x5b100c);
}

export function createWaterLeakCargoModel() {
  const root = new THREE.Group();
  const fallback = new THREE.Group();
  root.add(fallback);
  root.userData.fallback = fallback;
  root.userData.assetSlots = {};
  root.userData.activeType = null;

  const assetReady = ITEM_TYPES.map((type) => {
    const slot = new THREE.Group();
    slot.visible = false;
    if (type === "bucket") slot.scale.setScalar(0.72);
    if (type === "mop") slot.scale.setScalar(0.46);
    root.add(slot);
    root.userData.assetSlots[type] = slot;
    return loadAsset(ASSETS[type], slot).then((result) => {
      if (root.userData.activeType === type) setWaterLeakCargoModel(root, type);
      return result;
    });
  });
  root.userData.assetReady = Promise.all(assetReady);

  return root;
}

export function setWaterLeakCargoModel(model, type) {
  if (!model) return;
  model.userData.activeType = type;
  const slots = model.userData.assetSlots ?? {};
  Object.entries(slots).forEach(([slotType, slot]) => {
    slot.visible = slotType === type && slot.children.length > 0;
  });

  const fallback = model.userData.fallback;
  if (!fallback) return;
  const hasLoadedAsset = Boolean(slots[type]?.children.length);
  fallback.visible = !hasLoadedAsset;
  if (!hasLoadedAsset && fallback.userData.type !== type) {
    fallback.children.forEach(disposeRenderable);
    fallback.clear();
    fallback.add(fallbackItem(type));
    fallback.userData.type = type;
  }
}
export { ASSETS };
