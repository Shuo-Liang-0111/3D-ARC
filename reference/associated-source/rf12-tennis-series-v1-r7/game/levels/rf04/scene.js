import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CLOTHING_META, CLOTHING_TYPES, LEVEL } from "./level.js";

const RF04_CARDINAL_WASHER_HEIGHT = 0.85;
const RF04_CARDINAL_WASHER_ROTATION = Math.PI;
const RF04_HOME_ASSET = "/local-assets/embodiedgen/rf04/models/runtime/rf04_final.glb";
const RF04_CARDINAL_WOOD_FLOOR_TEXTURE = "/local-assets/cardinal/rf04/textures/realistic-walnut-oak-floor.png";
const RF04_CARDINAL_WALL_TEXTURE = "/local-assets/cardinal/rf04/textures/realistic-warm-plaster-wall.png";

const RF04_CLOTHING_LONGEST = Object.freeze({
  shirt: 0.62,
  pants: 0.85,
  towel: 0.72,
});

const RF04_INTERACTABLE_ASSETS = Object.freeze({
  washer: "/local-assets/cardinal/rf04/models/runtime/washer.glb",
  dryingRack: "/local-assets/cardinal/rf04/models/runtime/drying-rack.glb",
  wetLaundryBundle: "/local-assets/cardinal/rf04/models/runtime/wet-bundle.glb",
  dirtyShirt: "/local-assets/cardinal/rf04/models/runtime/shirt.glb",
  dirtyPants: "/local-assets/cardinal/rf04/models/runtime/pants.glb",
  dirtyTowel: "/local-assets/cardinal/rf04/models/runtime/towel.glb",
  bed: "/local-assets/cardinal/rf04/models/runtime/bed.glb",
});

const RF04_BED_PLACEMENTS = Object.freeze([
  Object.freeze({
    x: 7.1033,
    z: 2.3436,
    longest: 2.1,
    rotationY: -Math.PI / 2,
  }),
  Object.freeze({
    x: 4.1475,
    z: 4.7093,
    longest: 2.1,
    rotationY: 0,
  }),
  Object.freeze({
    x: -2.6641,
    z: 1.5566,
    longest: 2.1,
    rotationY: Math.PI,
  }),
  Object.freeze({
    x: -2.7902,
    z: -0.7569,
    longest: 2.1,
    rotationY: Math.PI,
  }),
]);

const RF04_HOME_PLAYABLE_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-12.8, -0.25, -8.8),
  new THREE.Vector3(12.8, 4.0, 8.8),
);

const RF04_HOME_IGNORED_NODE_PATTERNS = Object.freeze([
  /infinigen/i,
  /carnivorefactory|herbivorefactory/i,
  /hoof_parent_temp/i,
  /camrig/i,
  /ceiling|roof/i,
]);

const RF04_WOOD_FLOOR_PATTERN = /living[-_ ]room.*floor|floor.*living[-_ ]room|bedroom.*floor|floor.*bedroom/i;
const RF04_FLOOR_PATTERN = /floor/i;
const RF04_WALL_NODE_PATTERN = /\.wall$/i;
const RF04_WALL_PLASTER_MATERIAL_PATTERN = /plaster/i;
const RF04_WALL_TILE_METERS = 1.5;
const rf04WoodFloorTextureLoader = new THREE.TextureLoader();
const rf04WallTextureLoader = new THREE.TextureLoader();

function sizedWoodFloorTexture(size) {
  const texture = rf04WoodFloorTextureLoader.load(RF04_CARDINAL_WOOD_FLOOR_TEXTURE);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(Math.max(1, size.x / 1.8), Math.max(1, size.z / 1.8));
  texture.anisotropy = 8;
  return texture;
}

function createWoodFloorMaterial(source, size) {
  const map = sizedWoodFloorTexture(size);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    name: `${source.name || "rf04-floor"}-cardinal-warm-oak`,
    color: 0xffffff,
    map,
    bumpMap: map,
    bumpScale: 0.012,
    metalness: 0.01,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
}

function metricWallTexture() {
  const texture = rf04WallTextureLoader.load(RF04_CARDINAL_WALL_TEXTURE);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function createWallMaterial(source) {
  const map = metricWallTexture();
  return new THREE.MeshStandardMaterial({
    name: `${source.name || "rf04-wall"}-cardinal-warm-plaster`,
    color: 0xffffff,
    map,
    bumpMap: map,
    bumpScale: 0.004,
    metalness: 0.01,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
}

function applyMetricWallUvs(geometry) {
  geometry.computeVertexNormals();
  geometry.attributes.normal.needsUpdate = true;
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const planarUv = new Float32Array(position.count * 2);
  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    const useDepthAxis = Math.abs(normal.getX(vertexIndex)) >= Math.abs(normal.getZ(vertexIndex));
    planarUv[vertexIndex * 2] = (useDepthAxis ? position.getZ(vertexIndex) : position.getX(vertexIndex)) / RF04_WALL_TILE_METERS;
    planarUv[vertexIndex * 2 + 1] = position.getY(vertexIndex) / RF04_WALL_TILE_METERS;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(planarUv, 2));
}

// The accepted RF-04 GLB contains procedural materials whose Blender node
// colors are not exported as glTF baseColorFactor values. Restore their
// semantic colors at load time while preserving embedded texture maps.
const RF04_HOME_MATERIAL_PALETTE = Object.freeze([
  { pattern: /living[-_ ]room.*floor|floor.*living[-_ ]room/i, color: 0xb88a59 },
  { pattern: /bedroom.*floor|floor.*bedroom/i, color: 0x9f754e },
  { pattern: /bathroom.*floor|floor.*bathroom/i, color: 0xb9c2be },
  { pattern: /dining.*floor|kitchen.*floor|floor.*dining|floor.*kitchen/i, color: 0xc1ad91 },
  { pattern: /wall|plaster|shelves_white/i, color: 0xd8d3c8 },
  { pattern: /shelves_black_wood|black_wood|dark_wood/i, color: 0x5b4735 },
  { pattern: /wood|oak|hardwood/i, color: 0x9a7046 },
  { pattern: /mattress/i, color: 0xe2ddd3 },
  { pattern: /pillow/i, color: 0xd2d7d1 },
  { pattern: /blanket|comforter|duvet/i, color: 0x7d908f },
  { pattern: /sofa|fabric|knit|leather|upholstery/i, color: 0x758b82 },
  { pattern: /rug|carpet/i, color: 0x3f8190 },
  { pattern: /glass|mirror|window/i, color: 0x7998a0 },
  { pattern: /metal|steel|iron|galvanized/i, color: 0x4a5251 },
  { pattern: /ceramic|marble|stone|quartz/i, color: 0xc4c8c3 },
  { pattern: /plastic|rubber/i, color: 0x8f9795 },
  { pattern: /soil|dirt|sand/i, color: 0x765238 },
  { pattern: /monocot|greenery|spikes|plant/i, color: 0x58805a },
  { pattern: /text|art/i, color: 0x34383a },
]);

function standard(color, metalness = 0.05, roughness = 0.76) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function box(parent, size, position, material, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radiusTop, radiusBottom, height, segments, position, material, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function prepareHomeModel(model) {
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (RF04_HOME_IGNORED_NODE_PATTERNS.some((pattern) => pattern.test(object.name))) {
      object.visible = false;
      return;
    }
    if (/^TVFactory/i.test(object.name)) {
      object.position.x -= 0.13;
      object.updateWorldMatrix(true, true);
    }
    if (object.name.includes("LargePlantContainerFactory_9543294")) {
      object.visible = false;
      return;
    }
    if (object.isLight || object.isCamera) {
      object.visible = false;
      return;
    }
    if (!object.isMesh) return;
    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    if (bounds.min.y > 2.1 && size.x > 2 && size.z > 2) {
      object.visible = false;
      return;
    }
    if (!bounds.intersectsBox(RF04_HOME_PLAYABLE_BOUNDS)) {
      object.visible = false;
      return;
    }
    const hasMaterialArray = Array.isArray(object.material);
    const sourceMaterials = (hasMaterialArray ? object.material : [object.material]).filter(Boolean);
    const isFloor = sourceMaterials.some((sourceMaterial) => RF04_FLOOR_PATTERN.test(`${object.name} ${sourceMaterial.name ?? ""}`));
    const isWall = RF04_WALL_NODE_PATTERN.test(object.name) && sourceMaterials.some((sourceMaterial) => RF04_WALL_PLASTER_MATERIAL_PATTERN.test(sourceMaterial.name ?? ""));
    if (isFloor) {
      object.geometry = object.geometry.clone();
      object.geometry.computeVertexNormals();
      object.geometry.attributes.normal.needsUpdate = true;
      object.geometry.computeBoundingBox();
      const position = object.geometry.attributes.position;
      const localBounds = object.geometry.boundingBox;
      const localWidth = Math.max(localBounds.max.x - localBounds.min.x, 1e-3);
      const localDepth = Math.max(localBounds.max.z - localBounds.min.z, 1e-3);
      const planarUv = new Float32Array(position.count * 2);
      for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
        planarUv[vertexIndex * 2] = (position.getX(vertexIndex) - localBounds.min.x) / localWidth;
        planarUv[vertexIndex * 2 + 1] = (position.getZ(vertexIndex) - localBounds.min.z) / localDepth;
      }
      object.geometry.setAttribute("uv", new THREE.BufferAttribute(planarUv, 2));
    }
    if (isWall) {
      object.geometry = object.geometry.clone();
      applyMetricWallUvs(object.geometry);
    }
    object.castShadow = !isFloor;
    object.receiveShadow = true;
    const materials = sourceMaterials.map((sourceMaterial) => {
      const key = `${object.name} ${sourceMaterial.name ?? ""}`;
      const isWoodFloor = RF04_WOOD_FLOOR_PATTERN.test(key);
      const isWallPlaster = isWall && RF04_WALL_PLASTER_MATERIAL_PATTERN.test(sourceMaterial.name ?? "");
      const material = isWoodFloor
        ? createWoodFloorMaterial(sourceMaterial, size)
        : isWallPlaster
          ? createWallMaterial(sourceMaterial)
          : sourceMaterial;
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
      const paletteEntry = RF04_HOME_MATERIAL_PALETTE.find((entry) => entry.pattern.test(key));
      const color = material.color;
      const isNeutral = !color || Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b) < 0.055;
      if (!isWoodFloor && !isWallPlaster && paletteEntry && (!material.map || isNeutral)) {
        material.color.setHex(paletteEntry.color);
      }
      if (/mattress|pillow|blanket|comforter|duvet/i.test(key)) {
        material.metalness = 0;
        material.roughness = 0.9;
      }
      material.needsUpdate = true;
      return material;
    });
    object.material = hasMaterialArray ? materials : materials[0];
  });
  return model;
}

function loadGltf(loader, url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
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
    materials.filter(Boolean).forEach((material) => {
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
      material.needsUpdate = true;
    });
  });
  return model;
}

function placeAsset(model, target, name) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z, 1e-3);
  const scale = (target.longest ?? target.height ?? 1) / longest;
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);
  const placedBox = new THREE.Box3().setFromObject(model);
  const center = placedBox.getCenter(new THREE.Vector3());
  model.position.x += target.x - center.x;
  model.position.z += target.z - center.z;
  model.position.y += (target.y ?? 0.02) - placedBox.min.y;
  model.userData.assetName = name;
  model.userData.assetScale = scale;
  return model;
}

function loadModelAsset(scene, url, name, target, fallback = null, parent = scene) {
  return new Promise((resolve) => {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setWorkerLimit(2);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loadGltf(loader, url).then((gltf) => {
      const model = prepareAsset(gltf.scene, name);
      if (Number.isFinite(target.rotationY)) model.rotation.y = target.rotationY;
      placeAsset(model, target, name);
      parent.add(model);
      if (fallback) fallback.visible = false;
      resolve({ loaded: true, name, model });
    }).catch((error) => {
      console.warn(`RF-04 asset could not be loaded: ${name}`, error);
      resolve({ loaded: false, name, error });
    }).finally(() => dracoLoader.dispose());
  });
}

function loadRepeatedModelAsset(scene, url, name, placements) {
  return new Promise((resolve) => {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setWorkerLimit(2);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loadGltf(loader, url).then((gltf) => {
      const source = prepareAsset(gltf.scene, `${name}-source`);
      const models = placements.map((target, index) => {
        const model = index === 0 ? source : source.clone(true);
        model.name = `${name}-${index + 1}`;
        model.rotation.y = target.rotationY;
        placeAsset(model, target, model.name);
        scene.add(model);
        return model;
      });
      resolve({ loaded: true, name, models });
    }).catch((error) => {
      console.warn(`RF-04 repeated asset could not be loaded: ${name}`, error);
      resolve({ loaded: false, name, models: [], error });
    }).finally(() => dracoLoader.dispose());
  });
}

function hideHomeBedFallbacks(homeModel) {
  homeModel.traverse((object) => {
    if (/^BedFactory/i.test(object.name)) object.visible = false;
  });
}

function loadHomeAsset(scene, fallbackEnvironment, homeUrl = RF04_HOME_ASSET) {
  return new Promise((resolve) => {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setWorkerLimit(2);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loadGltf(loader, homeUrl).then((gltf) => {
      const model = prepareHomeModel(prepareAsset(gltf.scene, "rf04-final-home"));
      scene.add(model);
      fallbackEnvironment.visible = false;
      resolve({ loaded: true, name: model.name, model });
    }).catch((error) => {
      fallbackEnvironment.visible = true;
      console.warn("RF-04 final home asset could not be loaded", error);
      resolve({ loaded: false, name: "rf04-final-home", error });
    }).finally(() => dracoLoader.dispose());
  });
}

export function createClothingModel(type, folded = false) {
  const group = new THREE.Group();
  const fabric = standard(CLOTHING_META[type].color, 0.01, 0.96);
  if (folded) {
    box(group, [0.62, 0.12, 0.48], [0, 0.08, 0], fabric);
    box(group, [0.48, 0.09, 0.37], [0.04, 0.18, -0.01], fabric);
  } else if (type === "shirt") {
    box(group, [0.78, 0.08, 0.82], [0, 0.07, 0], fabric);
    box(group, [0.42, 0.07, 0.35], [-0.55, 0.065, 0.13], fabric).rotation.y = -0.45;
    box(group, [0.42, 0.07, 0.35], [0.55, 0.065, 0.13], fabric).rotation.y = 0.45;
  } else if (type === "pants") {
    box(group, [0.74, 0.08, 0.4], [0, 0.07, 0.32], fabric);
    box(group, [0.31, 0.08, 0.9], [-0.2, 0.07, -0.32], fabric).rotation.y = -0.08;
    box(group, [0.31, 0.08, 0.9], [0.2, 0.07, -0.32], fabric).rotation.y = 0.08;
  } else {
    box(group, [1.1, 0.075, 0.72], [0, 0.06, 0], fabric);
    [-0.36, 0, 0.36].forEach((x) => box(group, [0.025, 0.082, 0.72], [x, 0.065, 0], standard(0xb88e2d, 0, 0.95)));
  }
  group.userData.fabric = fabric;
  group.userData.clothingType = type;
  return group;
}

export function createLaundryCargoModel() {
  const group = new THREE.Group();
  const layers = CLOTHING_TYPES.map((type, index) => {
    const model = createClothingModel(type, false);
    model.position.y = index * 0.08;
    model.rotation.y = index % 2 ? 0.12 : -0.08;
    group.add(model);
    return model;
  });
  const assetUrls = {
    shirt: RF04_INTERACTABLE_ASSETS.dirtyShirt,
    pants: RF04_INTERACTABLE_ASSETS.dirtyPants,
    towel: RF04_INTERACTABLE_ASSETS.dirtyTowel,
    "wet-batch": RF04_INTERACTABLE_ASSETS.wetLaundryBundle,
  };
  const assetSlots = {};
  group.userData = { layers, assetSlots, mode: "wet-batch", assetReady: null };
  const assetReady = Object.entries(assetUrls).map(([type, url]) => {
    const slot = new THREE.Group();
    slot.visible = false;
    group.add(slot);
    assetSlots[type] = slot;
    const longest = type === "wet-batch" ? 0.85 : RF04_CLOTHING_LONGEST[type];
    return loadModelAsset(group, url, `rf04-cardinal-cargo-${type}`, {
      x: 0,
      y: 0,
      z: 0,
      longest,
      rotationY: 0,
    }, null, slot).then((result) => {
      if (group.userData.mode === type) setLaundryCargoMode(group, type);
      return result;
    });
  });
  group.userData.assetReady = Promise.all(assetReady);
  return group;
}

export function setLaundryCargoMode(model, mode) {
  if (!model?.userData?.layers) return;
  const slots = model.userData.assetSlots ?? {};
  const hasLoadedAsset = Boolean(slots[mode]?.children.length);
  Object.entries(slots).forEach(([slotType, slot]) => {
    slot.visible = slotType === mode && hasLoadedAsset;
  });
  model.userData.layers.forEach((layer, index) => {
    layer.visible = !hasLoadedAsset && (mode === "wet-batch" || CLOTHING_TYPES[index] === mode);
    layer.position.y = mode === "wet-batch" ? index * 0.08 : 0;
  });
  model.userData.mode = mode;
}

function createSofa(parent) {
  const root = new THREE.Group();
  root.position.set(-8.35, 0, -2.6);
  parent.add(root);
  const fabric = standard(0x6c807a, 0.01, 0.92);
  const dark = standard(0x46544f, 0.02, 0.88);
  box(root, [4.0, 0.55, 1.75], [0, 0.48, 0], dark);
  box(root, [3.55, 0.45, 1.45], [0, 0.82, -0.05], fabric);
  box(root, [3.7, 1.15, 0.32], [0, 1.25, -0.7], fabric).rotation.x = -0.14;
  [-1.85, 1.85].forEach((x) => box(root, [0.35, 0.72, 1.72], [x, 0.72, 0], fabric));
  [-0.92, 0.92].forEach((x) => box(root, [1.62, 0.12, 1.18], [x, 1.08, 0.12], standard(0x82958e, 0.01, 0.95)));
}

function createCoffeeArea(parent) {
  box(parent, [5.6, 0.035, 3.4], [-5.7, 0.03, -2.1], standard(0xc7b69e, 0, 0.98), { castShadow: false });
  const table = new THREE.Group();
  table.position.set(-4.45, 0, -2.3);
  parent.add(table);
  const wood = standard(0x8a684a, 0.03, 0.73);
  const legs = standard(0x363a38, 0.55, 0.38);
  box(table, [2.45, 0.14, 1.45], [0, 0.7, 0], wood);
  [-1, 1].forEach((x) => [-1, 1].forEach((z) => box(table, [0.1, 0.68, 0.1], [x * 1.0, 0.34, z * 0.5], legs)));
  box(table, [0.65, 0.06, 0.42], [0.3, 0.81, -0.1], standard(0xd9d2c2, 0, 0.9));
}

function createTelevision(parent) {
  const root = new THREE.Group();
  root.position.set(-8.8, 0, -6.6);
  parent.add(root);
  box(root, [3.4, 0.7, 0.75], [0, 0.35, 0], standard(0x70533d, 0.04, 0.74));
  box(root, [2.65, 1.55, 0.12], [0, 1.65, 0.12], standard(0x161b1c, 0.3, 0.24));
  box(root, [2.43, 1.31, 0.025], [0, 1.65, 0.19], new THREE.MeshBasicMaterial({ color: 0x263b40 }), { castShadow: false });
}

function createBathroomFixtures(parent) {
  const vanity = new THREE.Group();
  vanity.position.set(3.65, 0, -6.45);
  parent.add(vanity);
  box(vanity, [3.0, 0.85, 1.15], [0, 0.44, 0], standard(0xe1ddd3, 0.02, 0.66));
  box(vanity, [3.15, 0.11, 1.25], [0, 0.91, 0], standard(0xd4d1c8, 0.06, 0.42));
  cylinder(vanity, 0.48, 0.42, 0.16, 28, [0, 1.01, 0], standard(0xf1eee5, 0.03, 0.48));
  box(vanity, [1.9, 1.15, 0.06], [0, 1.8, -0.54], standard(0x9fb5b8, 0.12, 0.18), { castShadow: false });

  const toilet = new THREE.Group();
  toilet.position.set(10.45, 0, -1.75);
  parent.add(toilet);
  cylinder(toilet, 0.62, 0.5, 0.48, 28, [0, 0.38, 0], standard(0xe9e8e1, 0.02, 0.55));
  box(toilet, [1.05, 1.0, 0.62], [0, 0.72, -0.46], standard(0xe9e8e1, 0.02, 0.55));
}

function createWasher(parent) {
  const root = new THREE.Group();
  root.position.set(LEVEL.washer.modelX, 0, LEVEL.washer.modelZ);
  parent.add(root);
  const housing = new THREE.Group();
  root.add(housing);
  const shell = standard(0xe8e8e3, 0.18, 0.38);
  const trim = standard(0x353d40, 0.58, 0.3);
  box(housing, [0.95, 1.08, 0.68], [0, 0.54, 0], shell);
  box(housing, [0.86, 0.19, 0.04], [0, 0.95, 0.37], standard(0xd4d7d4, 0.16, 0.34));
  const screen = box(root, [0.26, 0.08, 0.018], [0.18, 0.96, 0.395], new THREE.MeshStandardMaterial({ color: 0x182225, emissive: 0x182225, emissiveIntensity: 0.5 }), { castShadow: false });
  cylinder(root, 0.06, 0.06, 0.04, 24, [-0.27, 0.96, 0.4], trim, [Math.PI / 2, 0, 0]);
  const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshStandardMaterial({ color: 0x737b78, emissive: 0x000000, emissiveIntensity: 1.8 }));
  indicator.scale.setScalar(0.55);
  indicator.position.set(0.34, 0.96, 0.41);
  root.add(indicator);

  const drumSpin = new THREE.Group();
  drumSpin.position.set(0, 0.52, 0.37);
  root.add(drumSpin);
  cylinder(drumSpin, 0.32, 0.32, 0.07, 40, [0, 0, 0], trim, [Math.PI / 2, 0, 0]);
  cylinder(drumSpin, 0.24, 0.24, 0.08, 40, [0, 0, 0.025], standard(0x273337, 0.35, 0.3), [Math.PI / 2, 0, 0]);
  [0, Math.PI * 2 / 3, Math.PI * 4 / 3].forEach((angle) => {
    const fin = box(drumSpin, [0.05, 0.14, 0.035], [Math.cos(angle) * 0.16, Math.sin(angle) * 0.16, 0.08], standard(0xc3c9c7, 0.35, 0.32));
    fin.rotation.z = angle;
  });
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.55, 40), new THREE.MeshPhysicalMaterial({ color: 0x78919a, transparent: true, opacity: 0.42, roughness: 0.12, metalness: 0.08 }));
  glass.scale.setScalar(0.46);
  glass.position.set(0, 0.52, 0.41);
  root.add(glass);
  return { root, housing, drumSpin, indicator, screen };
}

function createDryingRack(parent) {
  const root = new THREE.Group();
  root.position.set(LEVEL.dryingRack.modelX, 0, LEVEL.dryingRack.modelZ);
  parent.add(root);
  const structure = new THREE.Group();
  root.add(structure);
  const metal = standard(0x697574, 0.72, 0.28);
  [-1.65, 1.65].forEach((x) => {
    box(structure, [0.1, 2.2, 0.1], [x, 1.1, 0], metal);
    box(structure, [0.8, 0.08, 0.1], [x, 0.08, 0], metal);
  });
  box(structure, [3.4, 0.09, 0.09], [0, 2.15, 0], metal);
  const hangers = {};
  const hangerFallbacks = {};
  CLOTHING_TYPES.forEach((type, index) => {
    const hanger = new THREE.Group();
    hanger.position.set(-1.05 + index * 1.05, 1.8, 0);
    hanger.rotation.x = Math.PI / 2;
    hanger.visible = false;
    root.add(hanger);
    const fallback = createClothingModel(type, false);
    fallback.scale.setScalar(0.58);
    hanger.add(fallback);
    hangers[type] = hanger;
    hangerFallbacks[type] = fallback;
  });
  return { root, structure, hangers, hangerFallbacks };
}

function createPlant(parent, x, z) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  parent.add(root);
  cylinder(root, 0.42, 0.31, 0.65, 20, [0, 0.33, 0], standard(0xb55f3d, 0.02, 0.82));
  const leaf = standard(0x4f7959, 0, 0.92);
  for (let index = 0; index < 7; index += 1) {
    const blade = box(root, [0.15, 1.0, 0.08], [0, 0.95, 0], leaf);
    blade.rotation.z = (index - 3) * 0.18;
    blade.rotation.y = index * 1.7;
  }
}

export function createHomeLaundryScene(options = {}) {
  const assets = Object.fromEntries(Object.entries(RF04_INTERACTABLE_ASSETS).map(([key,url])=>[key,options.assetRoot ? options.assetRoot+"/"+url.split("/").pop() : url]));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb9c9cd);
  scene.fog = new THREE.Fog(0xb9c9cd, 56, 82);
  scene.add(new THREE.HemisphereLight(0xe8f2f1, 0x5d625b, 2.0));
  const sun = new THREE.DirectionalLight(0xfff0d4, 2.7);
  sun.position.set(-9, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 13;
  sun.shadow.camera.bottom = -13;
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 2;
  scene.add(sun);

  const fallbackEnvironment = new THREE.Group();
  fallbackEnvironment.name = "rf04-fallback-environment";
  fallbackEnvironment.visible = false;
  scene.add(fallbackEnvironment);
  const architecture = new THREE.Group();
  fallbackEnvironment.add(architecture);
  const wood = standard(0xffffff, 0.01, 0.78);
  wood.map = sizedWoodFloorTexture(new THREE.Vector3(13.1, 0, 15.6));
  const tile = standard(0xc8cbc6, 0.02, 0.62);
  const balcony = standard(0x9da7a3, 0.04, 0.7);
  const wall = standard(0xe7dfd2, 0.01, 0.9);
  const trim = standard(0x736657, 0.03, 0.75);
  box(architecture, [13.1, 0.16, 15.6], [-5.35, -0.09, 0], wood, { castShadow: false });
  box(architecture, [10.5, 0.16, 8.55], [6.65, -0.08, -3.7], tile, { castShadow: false });
  box(architecture, [10.5, 0.16, 6.85], [6.65, -0.08, 4.55], balcony, { castShadow: false });
  for (let x = -11; x <= 1; x += 0.8) box(architecture, [0.025, 0.015, 15.4], [x, 0.01, 0], trim, { castShadow: false });
  box(architecture, [24.4, 3.25, 0.35], [0, 1.63, -8.15], wall);
  box(architecture, [24.4, 1.05, 0.22], [0, 0.53, 8.1], standard(0xbec4bf, 0.2, 0.52));
  box(architecture, [0.35, 3.25, 16.1], [-12.15, 1.63, 0], wall);
  box(architecture, [0.35, 1.05, 16.1], [12.15, 0.53, 0], standard(0xbec4bf, 0.2, 0.52));
  box(architecture, [0.35, 3.25, 6.65], [1.35, 1.63, -4.68], wall);
  box(architecture, [0.35, 3.25, 6.75], [1.35, 1.63, 4.63], wall);
  box(architecture, [3.8, 3.25, 0.35], [3.25, 1.63, 0.85], wall);
  box(architecture, [4.7, 3.25, 0.35], [9.75, 1.63, 0.85], wall);
  [5.55, 6.45, 7.35].forEach((x) => box(architecture, [0.06, 2.7, 0.06], [x, 1.35, 0.85], standard(0x414b4b, 0.62, 0.33)));
  [-8.5, -4.8, -1.2].forEach((x) => box(architecture, [2.6, 1.5, 0.06], [x, 1.8, -7.95], standard(0x97b7bd, 0.08, 0.22), { castShadow: false }));

  createSofa(fallbackEnvironment);
  createCoffeeArea(fallbackEnvironment);
  createTelevision(fallbackEnvironment);
  createBathroomFixtures(fallbackEnvironment);
  const washer = createWasher(scene);
  const rack = createDryingRack(scene);
  createPlant(fallbackEnvironment, 3.1, 6.8);
  createPlant(fallbackEnvironment, -1.1, -6.5);

  const cabinet = new THREE.Group();
  cabinet.position.set(0, 0, 6.1);
  fallbackEnvironment.add(cabinet);
  box(cabinet, [1.55, 2.15, 1.8], [0, 1.08, 0], standard(0x8b6b4e, 0.03, 0.72));
  box(cabinet, [1.3, 0.06, 1.62], [0, 1.05, 0.06], standard(0x684c38, 0.04, 0.72));

  const clothingRoots = {};
  const clothingFallbacks = {};
  for (const type of CLOTHING_TYPES) {
    const root = new THREE.Group();
    const fallback = createClothingModel(type);
    root.add(fallback);
    scene.add(root);
    clothingRoots[type] = root;
    clothingFallbacks[type] = fallback;
  }
  const wetBatchRoot = createLaundryCargoModel();
  wetBatchRoot.visible = false;
  scene.add(wetBatchRoot);

  const world = {
    scene,
    clothingRoots,
    clothingFallbacks,
    wetBatchRoot,
    hangers: rack.hangers,
    hangerFallbacks: rack.hangerFallbacks,
    hangingAssets: {},
    rackFallback: rack.structure,
    rackAsset: null,
    washerFallback: washer.root,
    washerHousing: washer.housing,
    washerAsset: null,
    wetBatchAsset: null,
    clothingAssets: {},
    washerDrum: washer.drumSpin,
    washerIndicator: washer.indicator,
    washerScreen: washer.screen,
    assetReady: null,
    bedAssets: [],
  };

  world.assetReady = Promise.all([loadHomeAsset(scene, fallbackEnvironment, options.homeUrl),
    loadModelAsset(scene, assets.washer, "rf04-cardinal-washer", {
      x: LEVEL.washer.modelX,
      z: LEVEL.washer.modelZ,
      height: RF04_CARDINAL_WASHER_HEIGHT,
      rotationY: RF04_CARDINAL_WASHER_ROTATION,
    }),
    loadModelAsset(scene, assets.dryingRack, "rf04-cardinal-drying-rack", {
      x: LEVEL.dryingRack.modelX,
      z: LEVEL.dryingRack.modelZ,
      longest: 3.3,
    }, null),
    loadModelAsset(scene, assets.wetLaundryBundle, "rf04-cardinal-wet-laundry-bundle", {
      x: 0,
      z: 0,
      longest: 0.85,
    }, null, wetBatchRoot),
    ...CLOTHING_TYPES.map((type) => loadModelAsset(
      scene,
      assets[{ shirt: "dirtyShirt", pants: "dirtyPants", towel: "dirtyTowel" }[type]],
      `rf04-cardinal-dirty-${type}`,
      { x: 0, z: 0, longest: RF04_CLOTHING_LONGEST[type] },
      null,
      clothingRoots[type],
    )),
    loadRepeatedModelAsset(
      scene,
      assets.bed,
      "rf04-cardinal-bed-set",
      RF04_BED_PLACEMENTS,
    ),
  ]).then((results) => {
    const byName = Object.fromEntries(results.filter((entry) => entry?.name).map((entry) => [entry.name, entry]));
    const homeModel = byName["rf04-final-home"]?.model ?? null;
    world.washerAsset = byName["rf04-cardinal-washer"]?.model ?? null;
    world.washerHousing.visible = !world.washerAsset;
    if (world.washerAsset) world.washerFallback.scale.setScalar(RF04_CARDINAL_WASHER_HEIGHT / 1.08);
    world.rackAsset = byName["rf04-cardinal-drying-rack"]?.model ?? null;
    world.wetBatchAsset = byName["rf04-cardinal-wet-laundry-bundle"]?.model ?? null;
    world.rackFallback.visible = !world.rackAsset;
    world.bedAssets = byName["rf04-cardinal-bed-set"]?.models ?? [];
    if (homeModel && world.bedAssets.length === RF04_BED_PLACEMENTS.length) {
      hideHomeBedFallbacks(homeModel);
    }
    for (const type of CLOTHING_TYPES) {
      const loaded = byName[`rf04-cardinal-dirty-${type}`];
      world.clothingAssets[type] = loaded?.model ?? null;
      if (loaded?.model) {
        world.clothingFallbacks[type].visible = false;
        loaded.model.visible = true;
        const hangingAsset = loaded.model.clone(true);
        hangingAsset.name = `rf04-cardinal-hung-${type}`;
        world.hangers[type].add(hangingAsset);
        world.hangerFallbacks[type].visible = false;
        world.hangingAssets[type] = hangingAsset;
      }
    }
    return results;
  });
  return world;
}

export function syncLaundryVisuals(world, state) {
  for (const type of CLOTHING_TYPES) {
    const item = state.clothes[type];
    const root = world.clothingRoots[type];
    root.visible = item.location === "living-room" || item.location === "ground";
    if (root.visible) {
      root.position.set(item.x, 0.02, item.z);
      root.rotation.y = type === "pants" ? -0.35 : type === "towel" ? 0.28 : 0.12;
    }
    world.hangers[type].visible = item.location === "hung";
  }
  world.wetBatchRoot.visible = Boolean(state.wetBatch);
  if (state.wetBatch) world.wetBatchRoot.position.set(state.wetBatch.x, 0.03, state.wetBatch.z);

  if (state.washerPhase === "washing") world.washerDrum.rotation.z = -state.washElapsed * 5.5;
  const running = state.washerPhase === "washing";
  const done = state.washerPhase === "done";
  world.washerIndicator.material.color.setHex(running ? 0x4ba6df : done ? 0x58c77b : 0x737b78);
  world.washerIndicator.material.emissive.setHex(running ? 0x1872af : done ? 0x22864a : 0x000000);
  world.washerScreen.material.emissive.setHex(running ? 0x174f6c : done ? 0x1e6538 : 0x182225);
}
