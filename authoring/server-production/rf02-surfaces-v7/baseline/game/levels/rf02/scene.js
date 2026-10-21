import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BOOK_COLORS, LEVEL } from "./level.js";

const ASSET_REVISION = "cardinal-realism-slice-20260817-v5";
const revised = (path) => `${path}?v=${ASSET_REVISION}`;
const CHAIR_FACE_POSITIVE_Z = -Math.PI / 2;
const CHAIR_FACE_NEGATIVE_Z = Math.PI / 2;

export const ASSETS = Object.freeze({
  environment: revised("/local-assets/cardinal/rf02/models/runtime/rf02-static-shell.glb"),
  returnSortingTable: revised("/local-assets/cardinal/rf02/models/runtime/return-sorting-table.glb"),
  catalogTerminal: revised("/local-assets/cardinal/rf02/models/runtime/catalog-terminal.glb"),
  securityGateModule: revised("/local-assets/cardinal/rf02/models/runtime/security-gate-module.glb"),
  circulationDesk: revised("/local-assets/cardinal/rf02/models/runtime/circulation-desk.glb"),
  returnCart: revised("/local-assets/cardinal/rf02/models/runtime/return-cart.glb"),
  indoorPlanter: revised("/local-assets/cardinal/rf02/models/runtime/indoor-planter.glb"),
  suspendedLinearLight: revised("/local-assets/cardinal/rf02/models/runtime/suspended-linear-light.glb"),
  readingTable: revised("/local-assets/cardinal/rf02/models/runtime/reading-table.glb"),
  readingChair: revised("/local-assets/cardinal/rf02/models/runtime/reading-chair.glb"),
  red: revised("/local-assets/cardinal/rf02/models/runtime/red-book.glb"),
  black: revised("/local-assets/embodiedgen/rf02/models/runtime/interactables/black_book.glb"),
  white: revised("/local-assets/embodiedgen/rf02/models/runtime/interactables/white_book.glb"),
});

const STATIC_SLICE_KEYS = Object.freeze([
  "returnSortingTable",
  "catalogTerminal",
  "securityGateModule",
  "circulationDesk",
  "returnCart",
  "indoorPlanter",
  "suspendedLinearLight",
  "readingTable",
  "readingChair",
]);

const BOOK_COLORS_HEX = Object.freeze({ red: 0x781c18, black: 0x15191a, white: 0xd8d1bd });
const NON_SHADOW_NODE_PATTERN = /wall|floor|glass|window|linear light|grout/i;
const NON_SHADOW_MATERIAL_PATTERN = /glass|light|screen/i;

function material(color, metalness = 0.05, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function box(parent, size, position, value, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), value);
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

function sanitizeTransform(object) {
  if (![object.position.x, object.position.y, object.position.z].every(Number.isFinite)) object.position.set(0, 0, 0);
  if (![object.quaternion.x, object.quaternion.y, object.quaternion.z, object.quaternion.w].every(Number.isFinite) || object.quaternion.lengthSq() < Number.EPSILON) {
    object.quaternion.identity();
  } else {
    object.quaternion.normalize();
  }
  if (![object.scale.x, object.scale.y, object.scale.z].every(Number.isFinite)) object.scale.set(1, 1, 1);
  object.updateMatrix();
}

function prepareAsset(model) {
  model.traverse((object) => {
    sanitizeTransform(object);
    if (object.isLight || object.isCamera) {
      object.visible = false;
      return;
    }
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    object.castShadow = !NON_SHADOW_NODE_PATTERN.test(object.name)
      && !materials.filter(Boolean).some((entry) => NON_SHADOW_MATERIAL_PATTERN.test(entry.name));
    object.receiveShadow = true;
    materials.filter(Boolean).forEach((entry) => {
      if (entry.map) entry.map.colorSpace = THREE.SRGBColorSpace;
      if (entry.transparent) entry.depthWrite = false;
      entry.needsUpdate = true;
    });
  });
  return model;
}

const dracoLoader = new DRACOLoader();
dracoLoader.setWorkerLimit(2);
const assetLoader = new GLTFLoader();
assetLoader.setDRACOLoader(dracoLoader);
dracoLoader.setDecoderPath("/vendor/draco/");
const assetCache = new Map();

function fetchAsset(url) {
  if (!assetCache.has(url)) {
    assetCache.set(url, new Promise((resolve) => assetLoader.load(
      url,
      (gltf) => resolve(prepareAsset(gltf.scene)),
      undefined,
      (error) => {
        console.warn(`[RF-02] failed to load ${url}`, error);
        resolve(null);
      },
    )));
  }
  return assetCache.get(url);
}

function loadAsset(url, parent, name = url) {
  return fetchAsset(url).then((source) => {
    if (!source) return { loaded: false, name, url, model: null };
    const model = prepareAsset(source.clone(true));
    model.name = name;
    parent.add(model);
    return { loaded: true, name, url, model };
  });
}

function placeRepeatedStaticModel(model, parent, placements) {
  placements.forEach(([positionX, positionY, positionZ, rotationY], index) => {
    const instance = index === 0 ? model : model.clone(true);
    instance.name = index === 0 ? model.name : `${model.name}-${index + 1}`;
    instance.position.set(positionX, positionY, positionZ);
    instance.rotation.y = rotationY;
    if (index > 0) parent.add(instance);
    instance.updateMatrixWorld(true);
  });
}

function placeStaticSliceModel(key, model, parent) {
  if (key === "returnSortingTable") {
    model.position.set(0, 0, 2.75);
  } else if (key === "catalogTerminal") {
    model.position.set(-10.35, 0, 4.45);
    model.rotation.y = Math.PI / 2;
  } else if (key === "securityGateModule") {
    placeRepeatedStaticModel(model, parent, [
      [-1.1, 0, 6.75, 0],
      [1.1, 0, 6.75, 0],
    ]);
  } else if (key === "circulationDesk") {
    model.position.set(-7.075, 0, 5.45);
  } else if (key === "returnCart") {
    model.position.set(2.45, 0, 4.55);
  } else if (key === "indoorPlanter") {
    placeRepeatedStaticModel(model, parent, [
      [-10.7, 0, 6.65, 0], [10.7, 0, 6.65, 0],
      [-9.7, 0, -6.8, 0], [9.7, 0, -6.8, 0],
    ]);
  } else if (key === "suspendedLinearLight") {
    const placements = [-9, -3, 3, 9].flatMap((positionX) => [-4.8, 0.2, 5.2]
      .map((positionZ) => [positionX, 3.24, positionZ, 0]));
    placeRepeatedStaticModel(model, parent, placements);
  } else if (key === "readingTable") {
    placeRepeatedStaticModel(model, parent, [
      [-5.0, 0, 2.35, 0],
      [5.4, 0, 2.35, 0],
    ]);
  } else if (key === "readingChair") {
    placeRepeatedStaticModel(model, parent, [
      [-5.76, 0, 1.49, CHAIR_FACE_POSITIVE_Z], [-4.24, 0, 1.49, CHAIR_FACE_POSITIVE_Z],
      [-5.76, 0, 3.21, CHAIR_FACE_NEGATIVE_Z], [-4.24, 0, 3.21, CHAIR_FACE_NEGATIVE_Z],
      [4.64, 0, 1.49, CHAIR_FACE_POSITIVE_Z], [6.16, 0, 1.49, CHAIR_FACE_POSITIVE_Z],
      [4.64, 0, 3.21, CHAIR_FACE_NEGATIVE_Z], [6.16, 0, 3.21, CHAIR_FACE_NEGATIVE_Z],
    ]);
  }
  model.updateMatrixWorld(true);
}

function disposeRenderable(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((entry) => entry.dispose());
  });
}

function createBookFallback(color) {
  const root = new THREE.Group();
  const cover = material(BOOK_COLORS_HEX[color], 0.02, 0.82);
  const pages = material(0xd6cfb8, 0, 0.94);
  box(root, [0.17, 0.005, 0.245], [0, 0.0025, 0], cover);
  box(root, [0.158, 0.03, 0.232], [0.003, 0.02, 0.002], pages);
  box(root, [0.17, 0.005, 0.245], [0, 0.0375, 0], cover);
  box(root, [0.008, 0.04, 0.245], [-0.083, 0.02, 0], cover);
  return root;
}

function createShelfFallback(parent, placement, color) {
  const root = new THREE.Group();
  root.position.set(placement.modelX, 0, placement.modelZ);
  root.rotation.y = placement.rotation;
  parent.add(root);
  const veneer = material(0x8e6840, 0.02, 0.7);
  const steel = material(0x303738, 0.58, 0.4);
  const book = material(BOOK_COLORS_HEX[color], 0.01, 0.82);
  [-1.47, 1.47].forEach((x) => box(root, [0.06, 1.8, 0.58], [x, 0.9, 0], veneer));
  [0.08, 0.43, 0.78, 1.13, 1.48, 1.78].forEach((y) => box(root, [3, 0.045, 0.58], [0, y, 0], steel));
  [0.1, 0.45, 0.8, 1.15, 1.5].forEach((y) => {
    for (let index = 0; index < 16; index += 1) {
      box(root, [0.09, 0.25, 0.2 + (index % 4) * 0.015], [-1.32 + index * 0.176, y + 0.11, -0.08], book);
    }
  });
}

function createFallbackEnvironment() {
  const root = new THREE.Group();
  const floor = material(0xa9a59d, 0.03, 0.58);
  const wall = material(0xd7d2c8, 0.01, 0.92);
  const oak = material(0x795232, 0.02, 0.68);
  const steel = material(0x303738, 0.58, 0.4);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x7da4a7, transparent: true, opacity: 0.3, roughness: 0.12, depthWrite: false });
  box(root, [24, 0.18, 16], [0, -0.09, 0], floor, { castShadow: false });
  box(root, [24, 3.6, 0.22], [0, 1.8, -8], wall);
  box(root, [0.22, 3.6, 16], [-12, 1.8, 0], wall);
  box(root, [0.22, 3.6, 16], [12, 1.8, 0], wall);
  box(root, [11, 3.6, 0.22], [-6.5, 1.8, 8], wall);
  box(root, [11, 3.6, 0.22], [6.5, 1.8, 8], wall);
  [-1.1, 1.1].forEach((x) => {
    box(root, [0.13, 1.56, 0.68], [x, 0.78, 6.75], steel);
    box(root, [0.018, 1.12, 0.5], [x, 0.73, 6.65], glass, { castShadow: false });
  });
  box(root, [4.2, 1.04, 0.78], [-7.4, 0.52, 5.45], oak);
  box(root, [2.1, 0.09, 0.9], [0, 0.75, 2.75], oak);
  createShelfFallback(root, LEVEL.shelves.red, "red");
  createShelfFallback(root, LEVEL.shelves.black, "black");
  createShelfFallback(root, LEVEL.shelves.white, "white");
  return root;
}

function applyBookPose(root, color, book) {
  if (book.location === "table") {
    root.position.set(book.x, 0.78, book.z);
    root.rotation.set(0, color === "red" ? -0.12 : color === "white" ? 0.12 : 0, 0);
  } else if (book.location === "ground") {
    root.position.set(book.x, 0.012, book.z);
    root.rotation.set(0, color === "black" ? 0.15 : -0.1, 0);
  } else if (book.location === "shelved") {
    const shelf = LEVEL.shelves[color];
    root.position.set(shelf.modelX, 1.16, shelf.modelZ);
    root.rotation.set(0, shelf.rotation, 0);
  }
}

export function createLibraryScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcdd6d3);
  scene.fog = new THREE.Fog(0xcdd6d3, 38, 68);
  scene.add(new THREE.HemisphereLight(0xf3f1e9, 0x53605e, 1.9));
  scene.add(new THREE.AmbientLight(0xfffbf0, 0.24));
  const sun = new THREE.DirectionalLight(0xffefd2, 2.15);
  sun.position.set(-9, 18, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 13;
  sun.shadow.camera.bottom = -13;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 45;
  sun.shadow.bias = -0.00008;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  for (const [x, z] of [[-7, -3], [0, -3], [7, -3], [-7, 3], [0, 3], [7, 3]]) {
    const light = new THREE.PointLight(0xfff2d5, 0.65, 8, 1.8);
    light.position.set(x, 3.2, z);
    scene.add(light);
  }

  const fallbackEnvironment = createFallbackEnvironment();
  scene.add(fallbackEnvironment);
  const environmentRoot = new THREE.Group();
  environmentRoot.visible = false;
  scene.add(environmentRoot);
  const staticSliceRoot = new THREE.Group();
  staticSliceRoot.name = "rf02-cardinal-static-slice";
  staticSliceRoot.visible = false;
  scene.add(staticSliceRoot);

  const bookRoots = {};
  const assetRoots = { environment: environmentRoot, staticSlice: staticSliceRoot, books: {} };
  const bookPromises = BOOK_COLORS.map((color) => {
    const root = new THREE.Group();
    root.name = `${color}-return-book`;
    const fallback = createBookFallback(color);
    const loaded = new THREE.Group();
    root.add(fallback, loaded);
    scene.add(root);
    root.userData.fallback = fallback;
    root.userData.loaded = loaded;
    bookRoots[color] = root;
    assetRoots.books[color] = loaded;
    return loadAsset(ASSETS[color], loaded, `${color}-book`).then((result) => {
      if (result.loaded) fallback.visible = false;
      return result;
    });
  });

  const environmentPromise = loadAsset(ASSETS.environment, environmentRoot, "staticShell").then((result) => {
      if (result.loaded) {
        result.model.name = "rf02-cardinal-static-shell";
      }
      return result;
    });
  const staticSlicePromises = STATIC_SLICE_KEYS.map((key) => loadAsset(ASSETS[key], staticSliceRoot, key).then((result) => {
    if (result.loaded) placeStaticSliceModel(key, result.model, staticSliceRoot);
    return result;
  }));

  const assetReady = Promise.all([
    environmentPromise,
    ...staticSlicePromises,
    ...bookPromises,
  ]).then((results) => {
    const staticResults = results.slice(0, 1 + STATIC_SLICE_KEYS.length);
    const staticSliceLoaded = staticResults.every((result) => result.loaded);
    fallbackEnvironment.visible = !staticSliceLoaded;
    environmentRoot.visible = staticSliceLoaded;
    staticSliceRoot.visible = staticSliceLoaded;
    return results;
  });

  return { scene, bookRoots, assetRoots, fallbackEnvironment, assetReady };
}

export function syncLibraryVisuals(world, state) {
  for (const color of BOOK_COLORS) {
    const book = state.books[color];
    const root = world.bookRoots[color];
    root.visible = book.location !== "carried";
    if (root.visible) applyBookPose(root, color, book);
  }
}

export function createLibraryCargoModel() {
  const root = new THREE.Group();
  const fallback = new THREE.Group();
  root.add(fallback);
  root.userData.fallback = fallback;
  root.userData.assetSlots = {};
  root.userData.activeColor = null;
  const assetReady = BOOK_COLORS.map((color) => {
    const slot = new THREE.Group();
    slot.visible = false;
    root.add(slot);
    root.userData.assetSlots[color] = slot;
    return loadAsset(ASSETS[color], slot).then((result) => {
      if (root.userData.activeColor === color) setLibraryCargoModel(root, color);
      return result;
    });
  });
  root.userData.assetReady = Promise.all(assetReady);
  return root;
}

export function setLibraryCargoModel(model, color) {
  if (!model || !color) return;
  model.userData.activeColor = color;
  const slots = model.userData.assetSlots ?? {};
  Object.entries(slots).forEach(([slotColor, slot]) => {
    slot.visible = slotColor === color && slot.children.length > 0;
  });
  const fallback = model.userData.fallback;
  if (!fallback) return;
  const hasLoadedAsset = Boolean(slots[color]?.children.length);
  fallback.visible = !hasLoadedAsset;
  if (!hasLoadedAsset && fallback.userData.color !== color) {
    fallback.children.forEach(disposeRenderable);
    fallback.clear();
    fallback.add(createBookFallback(color));
    fallback.userData.color = color;
  }
}
