import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ITEM_META, ITEM_TYPES, LEVEL } from "./level.js";

const ASSET_REVISION = "cardinal-20260818-d";
const revised = (path) => `${path}?v=${ASSET_REVISION}`;

const ASSETS = Object.freeze({
  twinBed: revised("/local-assets/cardinal/rf05/models/runtime/twin_bed.glb"),
  bedsideTable: revised("/local-assets/cardinal/rf05/models/runtime/bedside_table.glb"),
  writingDesk: revised("/local-assets/cardinal/rf05/models/runtime/writing_desk.glb"),
  deskChair: revised("/local-assets/cardinal/rf05/models/runtime/desk_chair.glb"),
  televisionConsole: revised("/local-assets/cardinal/rf05/models/runtime/television_console.glb"),
  wardrobe: revised("/local-assets/cardinal/rf05/models/runtime/wardrobe.glb"),
  luggageBench: revised("/local-assets/cardinal/rf05/models/runtime/luggage_bench.glb"),
  curtainWindow: revised("/local-assets/cardinal/rf05/models/runtime/curtain_window_module.glb"),
  bathroomVanity: revised("/local-assets/cardinal/rf05/models/runtime/bathroom_vanity.glb"),
  toilet: revised("/local-assets/cardinal/rf05/models/runtime/toilet.glb"),
  showerFixture: revised("/local-assets/cardinal/rf05/models/runtime/shower_fixture.glb"),
  ceilingLight: revised("/local-assets/cardinal/rf05/models/runtime/ceiling_light.glb"),
  towel: revised("/local-assets/cardinal/rf05/models/runtime/towel.glb"),
  cup: revised("/local-assets/cardinal/rf05/models/runtime/drinking_cup.glb"),
  trash: revised("/local-assets/cardinal/rf05/models/runtime/paper_trash.glb"),
  laundry: revised("/local-assets/cardinal/rf05/models/runtime/laundry_basket.glb"),
  cart: revised("/local-assets/cardinal/rf05/models/runtime/cleaning_cart.glb"),
  bin: revised("/local-assets/cardinal/rf05/models/runtime/trash_bin.glb"),
});

const SURFACES = Object.freeze({
  woodFloor: revised("/local-assets/cardinal/rf05/textures/source/guestroom_wood_floor.png"),
  wall: revised("/local-assets/cardinal/rf05/textures/source/warm_gray_wall.png"),
  bathroomFloor: revised("/local-assets/cardinal/rf05/textures/source/bathroom_floor_tile.png"),
  bathroomWall: revised("/local-assets/cardinal/rf05/textures/source/bathroom_wall_tile.png"),
});

const DELIVERED_ITEM_POSES = Object.freeze({
  towel: Object.freeze({ x: LEVEL.targets.laundry.x, y: 0.43, z: LEVEL.targets.laundry.z, yaw: 0.18 }),
  cup: Object.freeze({ x: LEVEL.targets.cart.x, y: 1.08, z: LEVEL.targets.cart.z, yaw: -0.12 }),
  trash: Object.freeze({ x: LEVEL.targets.bin.x, y: 0.40, z: LEVEL.targets.bin.z, yaw: 0.08 }),
});

const NON_SHADOW_NODE_PATTERN = /wall|floor|glass|mirror|window|curtain|shower|ceiling/i;
const NON_SHADOW_MATERIAL_PATTERN = /glass|mirror|window|translucent|sheer/i;

function material(color, roughness = 0.75, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(parent, size, position, mat, name = "") {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position);
  mesh.name = name;
  mesh.castShadow = !NON_SHADOW_NODE_PATTERN.test(name);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radiusTop, radiusBottom, height, position, mat, name = "") {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 28), mat);
  mesh.position.set(...position);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function configureTexture(texture, repeatX, repeatY) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  return texture;
}

function loadSurface(textureLoader, url, surfaceMaterial, repeatX, repeatY, bumpScale = 0) {
  return new Promise((resolve) => textureLoader.load(
    url,
    (texture) => {
      configureTexture(texture, repeatX, repeatY);
      surfaceMaterial.map = texture;
      if (bumpScale) {
        surfaceMaterial.bumpMap = texture;
        surfaceMaterial.bumpScale = bumpScale;
      }
      surfaceMaterial.needsUpdate = true;
      resolve({ loaded: true, url, texture });
    },
    undefined,
    () => resolve({ loaded: false, url, texture: null }),
  ));
}

function itemModel(type) {
  const group = new THREE.Group();
  const meta = ITEM_META[type];
  if (type === "cup") {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.04, 0.13, 24, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: meta.color,
        transparent: true,
        opacity: 0.55,
        roughness: 0.08,
        transmission: 0.35,
        thickness: 0.006,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    body.position.y = 0.065;
    group.add(body);
  } else if (type === "towel") {
    box(group, [0.52, 0.08, 0.34], [0, 0.04, 0], material(meta.color, 0.95), "fallback-towel");
  } else {
    const waste = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 2), material(meta.color, 0.9));
    waste.position.y = 0.09;
    group.add(waste);
  }
  return group;
}

function targetModel(parent, target, x, z) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  parent.add(root);
  const dark = material(0x333937, 0.42, 0.18);
  const accent = material(target === "laundry" ? 0xd8d0bf : target === "cart" ? 0x87918e : 0x252b2a, 0.58, target === "cart" ? 0.34 : 0.08);
  if (target === "cart") {
    box(root, [0.95, 0.12, 0.55], [0, 0.92, 0], accent, "fallback-cart-tray");
    box(root, [0.08, 0.75, 0.55], [-0.43, 0.51, 0], dark, "fallback-cart-frame");
    for (const wheelX of [-0.36, 0.36]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wheelX, 0.1, 0.2);
      root.add(wheel);
    }
  } else if (target === "laundry") {
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.62, 28, 1, true), accent);
    basket.position.y = 0.31;
    root.add(basket);
  } else {
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.62, 24, 1, true), dark);
    bin.position.y = 0.31;
    root.add(bin);
  }
  return root;
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
      if (entry.transparent || entry.transmission > 0) entry.depthWrite = false;
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
        console.warn(`[RF-05] failed to load ${url}`, error);
        resolve(null);
      },
    )));
  }
  return assetCache.get(url);
}

function loadAsset(url, parent) {
  return fetchAsset(url).then((source) => {
    if (!source) return { loaded: false, url, model: null };
    const model = prepareAsset(source.clone(true));
    parent.add(model);
    return { loaded: true, url, model };
  });
}

function applyPose(root, pose) {
  if (!root || !pose) return;
  root.position.set(pose.x, pose.y, pose.z);
  root.rotation.set(pose.pitch ?? 0, pose.yaw ?? 0, pose.roll ?? 0);
}

function itemPose(type, item) {
  if (["room", "floor"].includes(item.location)) {
    const surfaceY = item.location === "floor" ? 0.02 : type === "towel" ? 0.40 : type === "cup" ? 0.57 : 0.02;
    const surfaceZ = type === "towel" && item.location === "room" ? item.z - 0.30 : item.z;
    return { x: item.x, y: surfaceY, z: surfaceZ, yaw: type === "cup" ? 0.2 : type === "towel" ? 0.18 : 0 };
  }
  return DELIVERED_ITEM_POSES[type];
}

function buildRoomShell(scene) {
  const root = new THREE.Group();
  root.name = "rf05-meter-shell";
  scene.add(root);

  const woodFloor = material(0x765036, 0.7, 0.02);
  const wall = material(0xc7c1b7, 0.9, 0.01);
  const bathroomFloor = material(0xaaa9a4, 0.76, 0.02);
  const bathroomWall = material(0xd9d4ca, 0.72, 0.02);
  const walnut = material(0x4d3122, 0.62, 0.08);
  const brushedMetal = material(0x7f8785, 0.34, 0.72);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xc8dde0,
    transparent: true,
    opacity: 0.22,
    roughness: 0.08,
    transmission: 0.65,
    thickness: 0.008,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  box(root, [8.4, 0.12, 10.8], [0, -0.06, 0], woodFloor, "GuestroomWoodFloor");
  box(root, [3.0, 0.035, 3.35], [-2.55, 0.012, 3.52], bathroomFloor, "BathroomTileFloor");
  box(root, [8.4, 2.86, 0.22], [0, 1.43, -5.4], wall, "NorthWall");
  box(root, [0.22, 2.86, 10.8], [-4.2, 1.43, 0], wall, "WestWall");
  box(root, [0.22, 2.86, 10.8], [4.2, 1.43, 0], wall, "EastWall");
  box(root, [3.55, 2.86, 0.22], [-2.425, 1.43, 5.4], wall, "SouthWallWest");
  box(root, [3.55, 2.86, 0.22], [2.425, 1.43, 5.4], wall, "SouthWallEast");
  box(root, [1.30, 0.56, 0.22], [0, 2.58, 5.4], wall, "EntranceHeader");
  box(root, [0.22, 2.82, 2.17], [-1.05, 1.41, 4.165], bathroomWall, "BathroomPartition");
  box(root, [0.22, 2.82, 0.53], [-1.05, 1.41, 1.815], bathroomWall, "BathroomPartitionReturn");
  box(root, [3.0, 2.82, 0.18], [-2.55, 1.41, 1.86], bathroomWall, "BathroomRoomSideWall");
  box(root, [0.06, 2.15, 1.42], [-1.50, 1.075, 4.46], glass, "ShowerGlassPanel");
  box(root, [1.44, 0.07, 0.07], [-2.25, 2.15, 4.46], brushedMetal, "ShowerGlassTopRail");
  box(root, [0.07, 2.15, 0.07], [-2.96, 1.075, 4.46], brushedMetal, "ShowerGlassPost");

  for (const [name, size, position] of [
    ["NorthBaseboard", [8.0, 0.12, 0.04], [0, 0.06, -5.25]],
    ["WestBaseboard", [0.04, 0.12, 10.4], [-4.05, 0.06, 0]],
    ["EastBaseboard", [0.04, 0.12, 10.4], [4.05, 0.06, 0]],
    ["BathroomBaseboard", [2.9, 0.10, 0.04], [-2.55, 0.05, 2.00]],
  ]) box(root, size, position, walnut, name);

  const textureLoader = new THREE.TextureLoader();
  const surfaceReady = Promise.all([
    loadSurface(textureLoader, SURFACES.woodFloor, woodFloor, 4.2, 5.4, 0.012),
    loadSurface(textureLoader, SURFACES.wall, wall, 5, 2, 0.003),
    loadSurface(textureLoader, SURFACES.bathroomFloor, bathroomFloor, 3, 3.4, 0.008),
    loadSurface(textureLoader, SURFACES.bathroomWall, bathroomWall, 2.5, 2.5, 0.005),
  ]);

  return { root, materials: { woodFloor, wall, bathroomFloor, bathroomWall, walnut, brushedMetal, glass }, surfaceReady };
}

function buildStaticFallbacks(scene, materials) {
  const fallbacks = {};
  const make = (key) => {
    const root = new THREE.Group();
    root.name = `fallback-${key}`;
    scene.add(root);
    fallbacks[key] = root;
    return root;
  };
  const linen = material(0xe8e4da, 0.96);
  const textile = material(0x34484d, 0.92);
  const ceramic = material(0xe7e3da, 0.28);
  const dark = material(0x262c2c, 0.48, 0.18);

  for (const [key, x] of [["bedLeft", -2.15], ["bedRight", 0.15]]) {
    const root = make(key);
    box(root, [1.86, 0.46, 2.65], [x, 0.23, -3.45], materials.walnut, `${key}-base`);
    box(root, [1.76, 0.22, 2.50], [x, 0.57, -3.42], linen, `${key}-duvet`);
    box(root, [1.86, 0.92, 0.12], [x, 0.75, -4.72], textile, `${key}-headboard`);
  }
  box(make("bedsideTable"), [0.55, 0.55, 0.45], [-1.0, 0.275, -2.54], materials.walnut, "bedside-table");
  box(make("writingDesk"), [0.62, 0.76, 1.60], [3.45, 0.38, -1.87], materials.walnut, "writing-desk");
  box(make("deskChair"), [0.58, 0.46, 0.58], [2.42, 0.42, -1.87], textile, "desk-chair");
  box(make("televisionConsole"), [0.45, 0.58, 1.70], [3.70, 0.29, 0.25], materials.walnut, "television-console");
  box(fallbacks.televisionConsole, [0.08, 0.72, 1.08], [3.48, 0.94, 0.25], dark, "television-screen");
  box(make("wardrobe"), [1.55, 2.55, 0.72], [3.22, 1.275, 3.06], materials.walnut, "wardrobe");
  box(make("luggageBench"), [1.50, 0.52, 0.62], [3.10, 0.26, 2.15], textile, "luggage-bench");
  box(make("curtainWindow"), [2.60, 2.40, 0.08], [2.30, 1.35, -5.22], textile, "curtain-window");
  box(make("bathroomVanity"), [0.55, 0.85, 1.20], [-3.67, 0.425, 3.95], materials.walnut, "bathroom-vanity");
  cylinder(make("toilet"), 0.22, 0.24, 0.42, [-2.45, 0.21, 3.55], ceramic, "toilet");
  const shower = make("showerFixture");
  cylinder(shower, 0.025, 0.025, 1.75, [-2.25, 1.15, 5.16], materials.brushedMetal, "shower-rail");
  cylinder(shower, 0.14, 0.14, 0.035, [-2.25, 2.04, 5.07], materials.brushedMetal, "rain-shower");
  const light = make("ceilingLight");
  for (const [x, z] of [[0, -1.7], [0, 2.1], [-2.55, 3.6]]) {
    box(light, [0.80, 0.08, 0.80], [x, 2.78, z], linen, "ceiling-light");
  }
  return fallbacks;
}

function createStaticAssetSlot(scene, url, position, yaw, fallback, name) {
  const root = new THREE.Group();
  root.name = name;
  root.position.set(position[0], position[1], position[2]);
  root.rotation.y = yaw;
  scene.add(root);
  return {
    root,
    ready: loadAsset(url, root).then((result) => {
      if (result.loaded) fallback.visible = false;
      return result;
    }),
  };
}

function createStaticAssets(scene, fallbacks, ASSETS) {
  const roots = {};
  const promises = [];
  const add = (key, url, position, yaw = 0, fallbackKey = key) => {
    const slot = createStaticAssetSlot(scene, url, position, yaw, fallbacks[fallbackKey], `cardinal-${key}`);
    roots[key] = slot.root;
    promises.push(slot.ready);
  };
  add("bedLeft", ASSETS.twinBed, [-2.15, 0, -3.45], 0);
  add("bedRight", ASSETS.twinBed, [0.15, 0, -3.45], 0);
  add("bedsideTable", ASSETS.bedsideTable, [-1.0, 0, -2.54]);
  add("writingDesk", ASSETS.writingDesk, [3.45, 0, -1.87], Math.PI / 2);
  add("deskChair", ASSETS.deskChair, [2.42, 0, -1.87], Math.PI / 2);
  add("televisionConsole", ASSETS.televisionConsole, [3.70, 0, 0.25], -Math.PI / 2);
  add("wardrobe", ASSETS.wardrobe, [3.22, 0, 3.06], 0);
  add("luggageBench", ASSETS.luggageBench, [3.10, 0, 2.15], 0);
  add("curtainWindow", ASSETS.curtainWindow, [2.30, 0.12, -5.22], Math.PI);
  add("bathroomVanity", ASSETS.bathroomVanity, [-3.67, 0, 3.95], Math.PI / 2);
  add("toilet", ASSETS.toilet, [-2.45, 0, 3.55], Math.PI);
  add("showerFixture", ASSETS.showerFixture, [-2.25, 0, 5.15], Math.PI);

  const lightRoots = [];
  for (const [index, [x, z]] of [[0, -1.7], [0, 2.1], [-2.55, 3.6]].entries()) {
    const root = new THREE.Group();
    root.name = `cardinal-ceilingLight-${index}`;
    root.position.set(x, 2.72, z);
    scene.add(root);
    lightRoots.push(root);
    promises.push(loadAsset(ASSETS.ceilingLight, root).then((result) => {
      if (result.loaded) fallbacks.ceilingLight.visible = false;
      return result;
    }));
  }
  roots.ceilingLights = lightRoots;
  return { roots, promises };
}

export function createHotelRoomScene({ assets = ASSETS } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87918f);
  scene.fog = new THREE.Fog(0x87918f, 28, 52);
  scene.add(new THREE.HemisphereLight(0xeaf2f3, 0x333331, 1.2));
  scene.add(new THREE.AmbientLight(0xfff3df, 0.22));

  const windowLight = new THREE.DirectionalLight(0xffeed8, 2.2);
  windowLight.position.set(1.5, 7.5, -7.0);
  windowLight.castShadow = true;
  windowLight.shadow.mapSize.set(2048, 2048);
  windowLight.shadow.camera.left = -6;
  windowLight.shadow.camera.right = 6;
  windowLight.shadow.camera.top = 7;
  windowLight.shadow.camera.bottom = -7;
  windowLight.shadow.camera.near = 1;
  windowLight.shadow.camera.far = 24;
  windowLight.shadow.bias = -0.00008;
  windowLight.shadow.normalBias = 0.025;
  scene.add(windowLight);

  for (const [x, z, intensity] of [[0, -1.7, 22], [0, 2.1, 18], [-2.55, 3.6, 12]]) {
    const light = new THREE.PointLight(0xffdfae, intensity, 7.5, 2);
    light.position.set(x, 2.55, z);
    scene.add(light);
  }

  const shell = buildRoomShell(scene);
  const staticFallbacks = buildStaticFallbacks(scene, shell.materials);
  const staticAssets = createStaticAssets(scene, staticFallbacks, assets);

  const targets = {};
  Object.entries(LEVEL.targets).forEach(([target, point]) => {
    targets[target] = targetModel(scene, target, point.x, point.z);
  });

  const itemRoots = {};
  const assetRoots = { shell: shell.root, static: staticAssets.roots, items: {}, targets: {} };
  ITEM_TYPES.forEach((type) => {
    itemRoots[type] = itemModel(type);
    scene.add(itemRoots[type]);
  });

  const itemPromises = ITEM_TYPES.map((type) => {
    const root = new THREE.Group();
    scene.add(root);
    assetRoots.items[type] = root;
    return loadAsset(assets[type], root);
  });

  const targetPromises = Object.keys(LEVEL.targets).map((target) => {
    const root = new THREE.Group();
    root.position.set(LEVEL.targets[target].x, 0, LEVEL.targets[target].z);
    root.rotation.y = target === "cart" ? Math.PI / 2 : 0;
    scene.add(root);
    assetRoots.targets[target] = root;
    return loadAsset(assets[target], root).then((result) => {
      if (result.loaded) targets[target].visible = false;
      return result;
    });
  });

  const assetReady = Promise.all([
    shell.surfaceReady,
    ...staticAssets.promises,
    ...itemPromises,
    ...targetPromises,
  ]);

  return { scene, itemRoots, targets, assetRoots, assetReady };
}

export function syncHotelVisuals(world, state) {
  ITEM_TYPES.forEach((type) => {
    const item = state.items[type];
    const visible = ["room", "floor", LEVEL.itemTargets[type]].includes(item.location);
    const pose = itemPose(type, item);
    const fallback = world.itemRoots[type];
    const loaded = world.assetRoots?.items?.[type];

    fallback.visible = visible && !loaded?.children.length;
    if (fallback.visible) applyPose(fallback, pose);
    if (loaded) {
      loaded.visible = visible && loaded.children.length > 0;
      if (visible) applyPose(loaded, pose);
    }
  });

  Object.entries(world.targets).forEach(([target, root]) => {
    const deliveredType = Object.entries(LEVEL.itemTargets).find(([, value]) => value === target)?.[0];
    root.userData.filled = Boolean(deliveredType && state.items[deliveredType]?.location === target);
  });
}

export function createHotelCargoModel() {
  const root = new THREE.Group();
  const fallback = new THREE.Group();
  root.add(fallback);
  root.userData.fallback = fallback;
  root.userData.assetSlots = {};
  root.userData.activeType = null;

  ITEM_TYPES.forEach((type) => {
    const slot = new THREE.Group();
    slot.visible = false;
    if (type === "cup") slot.scale.setScalar(1.35);
    root.add(slot);
    root.userData.assetSlots[type] = slot;
    loadAsset(ASSETS[type], slot).then(() => {
      if (root.userData.activeType === type) setHotelCargoModel(root, type);
    });
  });

  return root;
}

export function setHotelCargoModel(model, type) {
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
    fallback.clear();
    fallback.add(itemModel(type));
    fallback.userData.type = type;
  }
}

export { ASSETS, SURFACES };
