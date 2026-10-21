import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { LEVEL, PARCEL_META, PARCEL_TYPES } from "./level.js";

const ASSET_ROOT = "/local-assets/cardinal/rf03/models/runtime";
const FLOOR_ROOT = "/local-assets/polyhaven/rf01/textures/hangar_concrete_floor";
const FLOOR_TEXTURES = Object.freeze({
  diffuse: `${FLOOR_ROOT}/hangar_concrete_floor_diff_2k.jpg`,
  normal: `${FLOOR_ROOT}/hangar_concrete_floor_nor_gl_2k.jpg`,
  roughness: `${FLOOR_ROOT}/hangar_concrete_floor_rough_2k.jpg`,
  ao: `${FLOOR_ROOT}/hangar_concrete_floor_ao_2k.jpg`,
  displacement: `${FLOOR_ROOT}/hangar_concrete_floor_disp_2k.jpg`,
});

const ASSETS = Object.freeze({
  automaticInfeed: `${ASSET_ROOT}/automatic_infeed_machine.glb`,
  beltConveyor: `${ASSET_ROOT}/belt_conveyor_module.glb`,
  dwsGantry: `${ASSET_ROOT}/dws_scanner_gantry.glb`,
  swingSorter: `${ASSET_ROOT}/swing_wheel_sorter.glb`,
  gravityChute: `${ASSET_ROOT}/gravity_roller_chute.glb`,
  routeCage: `${ASSET_ROOT}/route_roll_cage.glb`,
  parcel: `${ASSET_ROOT}/corrugated_parcel.glb`,
  terminal: `${ASSET_ROOT}/dws_control_terminal.glb`,
  electricalCabinet: `${ASSET_ROOT}/industrial_electrical_cabinet.glb`,
  palletStack: `${ASSET_ROOT}/palletized_carton_stack.glb`,
  fireStation: `${ASSET_ROOT}/fire_safety_station.glb`,
  ledFixture: `${ASSET_ROOT}/industrial_led_fixture.glb`,
  redParcel: `${ASSET_ROOT}/corrugated_parcel.glb`,
  yellowParcel: `${ASSET_ROOT}/corrugated_parcel.glb`,
  blueParcel: `${ASSET_ROOT}/corrugated_parcel.glb`,
  redBin: `${ASSET_ROOT}/route_roll_cage.glb`,
  yellowBin: `${ASSET_ROOT}/route_roll_cage.glb`,
  blueBin: `${ASSET_ROOT}/route_roll_cage.glb`,
});

function standard(color, metalness = 0.1, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

const surfaceTextureLoader = new THREE.TextureLoader();

function loadSurfaceTexture(url, colorSpace = THREE.NoColorSpace) {
  return new Promise((resolve) => surfaceTextureLoader.load(url, (texture) => {
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6.5, 4);
    texture.anisotropy = 8;
    resolve(texture);
  }, undefined, () => resolve(null)));
}

async function upgradeConcreteFloor(floor) {
  const entries = await Promise.all(Object.entries(FLOOR_TEXTURES).map(async ([channel, url]) => [
    channel,
    await loadSurfaceTexture(url, channel === "diffuse" ? THREE.SRGBColorSpace : THREE.NoColorSpace),
  ]));
  const maps = Object.fromEntries(entries);
  const material = floor.material;
  material.color.setHex(0xffffff);
  material.metalness = 0.02;
  material.roughness = 0.9;
  if (maps.diffuse) material.map = maps.diffuse;
  if (maps.normal) {
    material.normalMap = maps.normal;
    material.normalScale.setScalar(0.38);
  }
  if (maps.roughness) material.roughnessMap = maps.roughness;
  if (maps.ao) {
    material.aoMap = maps.ao;
    material.aoMapIntensity = 0.55;
    if (!floor.geometry.getAttribute("uv1")) {
      floor.geometry.setAttribute("uv1", floor.geometry.getAttribute("uv").clone());
    }
  }
  if (maps.displacement) {
    material.bumpMap = maps.displacement;
    material.bumpScale = 0.006;
  }
  material.needsUpdate = true;
  return { loaded: Object.values(maps).every(Boolean), channels: entries.length };
}

function box(parent, size, position, material, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radius, height, position, material, rotation = [0, 0, 0], segments = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createCodeTexture(code, color, subtitle = "快递面单") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  context.fillStyle = "#f3f1e9";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  context.fillRect(0, 0, 44, canvas.height);
  context.fillStyle = "#171a19";
  context.font = "700 82px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(code, 290, 78);
  context.font = "600 30px sans-serif";
  context.fillText(subtitle, 290, 143);
  for (let index = 0; index < 34; index += 1) {
    const width = index % 4 === 0 ? 6 : index % 3 === 0 ? 4 : 2;
    context.fillRect(92 + index * 9, 178, width, 54);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createRouteTexture(type) {
  const meta = PARCEL_META[type];
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 224;
  const context = canvas.getContext("2d");
  context.fillStyle = "#f4f2e9";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = `#${meta.color.toString(16).padStart(6, "0")}`;
  context.fillRect(0, 0, canvas.width, 34);
  context.fillStyle = "#1c2322";
  context.font = "800 88px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(meta.code, 256, 104);
  context.font = "700 32px sans-serif";
  context.fillText("人工复核路由笼车", 256, 180);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function sanitizeTransform(object) {
  if (![object.position.x, object.position.y, object.position.z].every(Number.isFinite)) object.position.set(0, 0, 0);
  if (![object.scale.x, object.scale.y, object.scale.z].every(Number.isFinite)) object.scale.set(1, 1, 1);
  if (![object.quaternion.x, object.quaternion.y, object.quaternion.z, object.quaternion.w].every(Number.isFinite) || object.quaternion.lengthSq() < Number.EPSILON) {
    object.quaternion.identity();
  } else {
    object.quaternion.normalize();
  }
  object.updateMatrix();
}

function prepareAsset(model) {
  model.traverse((object) => {
    sanitizeTransform(object);
    if (object.isCamera || object.isLight) object.visible = false;
    if (!object.isMesh) return;
    object.castShadow = !/(glass|lamp|label|screen)/i.test(`${object.name} ${object.material?.name ?? ""}`);
    object.receiveShadow = true;
    object.frustumCulled = false;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
      if (material.color) material.color.multiplyScalar(0.76);
      if ((material.metalness ?? 0) > 0.45) material.roughness = Math.max(material.roughness ?? 0.45, 0.42);
      material.needsUpdate = true;
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
    assetCache.set(url, new Promise((resolve) => assetLoader.load(url, (gltf) => {
      resolve(prepareAsset(gltf.scene));
    }, undefined, (error) => {
      console.warn(`[RF-03] Failed to load ${url}`, error);
      resolve(null);
    })));
  }
  return assetCache.get(url);
}

function cloneAsset(source) {
  const model = source.clone(true);
  model.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    object.material = Array.isArray(object.material)
      ? materials.filter(Boolean).map((material) => material.clone())
      : object.material?.clone();
  });
  return model;
}

function loadAsset(url, root) {
  return fetchAsset(url).then((source) => {
    if (!source) return { loaded: false, url, model: null };
    const model = cloneAsset(source);
    root.add(model);
    return { loaded: true, url, model };
  });
}

function loadAssetCopies(url, root, placements) {
  return fetchAsset(url).then((source) => {
    if (!source) return { loaded: false, url, count: 0 };
    placements.forEach((placement) => {
      const model = cloneAsset(source);
      model.position.set(...placement.position);
      model.rotation.set(...(placement.rotation ?? [0, 0, 0]));
      model.scale.set(...(placement.scale ?? [1, 1, 1]));
      root.add(model);
    });
    return { loaded: true, url, count: placements.length };
  });
}

function createParcelFallback(type) {
  const group = new THREE.Group();
  const meta = PARCEL_META[type];
  const [width, height, depth] = meta.dimensions;
  const cardboard = standard(0x9b744d, 0.01, 0.88);
  const tape = standard(0xc49a63, 0.01, 0.72);
  const carton = box(group, [width, height, depth], [0, height / 2, 0], cardboard);
  const strap = box(group, [width * 0.22, height + 0.008, depth + 0.012], [0, height / 2, 0], tape);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.58, depth * 0.5),
    new THREE.MeshBasicMaterial({ map: createCodeTexture(meta.code, meta.color), side: THREE.DoubleSide }),
  );
  label.position.set(width * 0.1, height + 0.006, 0);
  label.rotation.x = -Math.PI / 2;
  group.add(label);
  group.userData = { carton, strap, label, parcelType: type };
  return group;
}

function updateParcelFallback(fallback, type) {
  if (!fallback || fallback.userData.parcelType === type) return;
  const meta = PARCEL_META[type];
  const [width, height, depth] = meta.dimensions;
  fallback.userData.carton.scale.set(width / 0.52, height / 0.32, depth / 0.38);
  fallback.userData.strap.scale.set(width / 0.52, height / 0.32, depth / 0.38);
  fallback.userData.label.material.map.dispose();
  fallback.userData.label.material.map = createCodeTexture(meta.code, meta.color);
  fallback.userData.label.material.needsUpdate = true;
  fallback.userData.parcelType = type;
}

function createParcelBadge(type) {
  const meta = PARCEL_META[type];
  const [width, height, depth] = meta.dimensions;
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.58, depth * 0.5),
    new THREE.MeshBasicMaterial({ map: createCodeTexture(meta.code, meta.color), side: THREE.DoubleSide }),
  );
  badge.position.set(width * 0.1, height + 0.006, 0);
  badge.rotation.x = -Math.PI / 2;
  badge.visible = false;
  return badge;
}

export function createParcelModel(type = "red") {
  const root = new THREE.Group();
  const fallback = createParcelFallback(type);
  root.add(fallback);
  root.userData.fallback = fallback;
  root.userData.assetSlots = {};
  root.userData.activeType = type;
  const badge = createParcelBadge(type);
  root.add(badge);
  root.userData.badge = badge;
  root.userData.assetReady = Promise.all(PARCEL_TYPES.map((parcelType) => {
    const slot = new THREE.Group();
    slot.visible = false;
    root.add(slot);
    root.userData.assetSlots[parcelType] = slot;
    return loadAsset(ASSETS[`${parcelType}Parcel`], slot).then((result) => {
      if (root.userData.activeType === parcelType) setParcelModelType(root, parcelType);
      return result;
    });
  }));
  setParcelModelType(root, type);
  return root;
}

export function setParcelModelType(model, type) {
  if (!model || !PARCEL_TYPES.includes(type)) return;
  model.userData.activeType = type;
  const slots = model.userData.assetSlots ?? {};
  Object.entries(slots).forEach(([slotType, slot]) => {
    slot.visible = slotType === type && slot.children.length > 0;
  });
  const loaded = Boolean(slots[type]?.children.length);
  if (model.userData.badge) {
    const meta = PARCEL_META[type];
    model.userData.badge.material.map.dispose();
    model.userData.badge.material.map = createCodeTexture(meta.code, meta.color);
    model.userData.badge.material.needsUpdate = true;
    model.userData.badge.visible = loaded;
  }
  if (model.userData.fallback) {
    updateParcelFallback(model.userData.fallback, type);
    model.userData.fallback.visible = !loaded;
  }
}

function createRouteCageFallback(type) {
  const root = new THREE.Group();
  const steel = standard(0x58615f, 0.72, 0.3);
  const dark = standard(0x242a29, 0.4, 0.5);
  box(root, [1.12, 0.09, 0.82], [0, 0.13, 0], steel);
  for (const x of [-0.54, 0.54]) {
    for (const z of [-0.38, 0.38]) box(root, [0.035, 1.48, 0.035], [x, 0.85, z], steel);
  }
  for (const y of [0.35, 0.7, 1.05, 1.4, 1.65]) {
    box(root, [1.08, 0.025, 0.025], [0, y, 0.38], steel);
    [-0.54, 0.54].forEach((x) => box(root, [0.025, 0.025, 0.76], [x, y, 0], steel));
  }
  for (const x of [-0.4, 0, 0.4]) box(root, [0.022, 1.35, 0.022], [x, 0.98, 0.38], steel);
  for (const x of [-0.43, 0.43]) {
    for (const z of [-0.3, 0.3]) cylinder(root, 0.09, 0.055, [x, 0.07, z], dark, [Math.PI / 2, 0, 0]);
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 0.29),
    new THREE.MeshBasicMaterial({ map: createRouteTexture(type), side: THREE.DoubleSide }),
  );
  sign.position.set(0, 1.43, -0.405);
  sign.rotation.y = Math.PI;
  root.add(sign);
  const topSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 0.29),
    new THREE.MeshBasicMaterial({ map: createRouteTexture(type), side: THREE.DoubleSide }),
  );
  topSign.position.set(0, 1.705, -0.1);
  topSign.rotation.x = -Math.PI / 2;
  root.add(topSign);
  return root;
}

function createTerminalFallback() {
  const root = new THREE.Group();
  const steel = standard(0x343c3b, 0.58, 0.38);
  const plastic = standard(0x171d1c, 0.16, 0.52);
  box(root, [0.58, 0.72, 0.48], [0, 0.36, 0], steel);
  box(root, [0.46, 0.72, 0.34], [0, 1.03, 0], plastic);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.39, 0.48),
    new THREE.MeshBasicMaterial({ map: createCodeTexture("DWS", 0x3d9d79, "扫码称重控制终端") }),
  );
  screen.position.set(0, 1.05, -0.176);
  screen.rotation.y = Math.PI;
  root.add(screen);
  cylinder(root, 0.055, 0.035, [0.18, 0.72, -0.265], standard(0xd54336, 0.35, 0.35), [Math.PI / 2, 0, 0]);
  return root;
}

function createFallbackEnvironment() {
  const root = new THREE.Group();
  root.name = "rf03-fallback-environment";
  const concrete = standard(0x777c78, 0.04, 0.88);
  const wall = standard(0xb3b8b3, 0.2, 0.72);
  const steel = standard(0x303736, 0.72, 0.3);
  const galvanized = standard(0x697270, 0.68, 0.32);
  const safety = standard(0xe2b733, 0.32, 0.52);
  const belt = standard(0x171b1a, 0.08, 0.72);
  box(root, [26, 0.18, 16], [0, -0.09, 0], concrete, { castShadow: false });
  box(root, [26, 4.5, 0.22], [0, 2.25, -7.9], wall);
  box(root, [0.22, 4.5, 16], [-12.9, 2.25, 0], wall);
  box(root, [0.22, 4.5, 16], [12.9, 2.25, 0], wall);
  [-12, -6, 0, 6, 12].forEach((x) => {
    box(root, [0.22, 4.4, 0.22], [x, 2.2, -7.65], steel);
    box(root, [0.22, 4.4, 0.22], [x, 2.2, 7.65], steel);
  });
  box(root, [19, 0.16, 1.1], [0, 0.74, LEVEL.conveyor.z], steel);
  box(root, [19, 0.08, 0.98], [0, LEVEL.conveyor.beltHeight, LEVEL.conveyor.z], belt);
  [-0.57, 0.57].forEach((zOffset) => box(root, [19.2, 0.22, 0.08], [0, 0.92, LEVEL.conveyor.z + zOffset], galvanized));
  for (let x = -9; x <= 9; x += 2) {
    [-0.46, 0.46].forEach((zOffset) => box(root, [0.08, 0.72, 0.08], [x, 0.36, LEVEL.conveyor.z + zOffset], steel));
  }
  box(root, [2.4, 1.8, 1.85], [LEVEL.conveyor.infeedX, 0.9, LEVEL.conveyor.z], galvanized);
  box(root, [0.32, 0.9, 1.12], [-9.2, 1.25, LEVEL.conveyor.z], steel);
  const rollers = [];
  for (let x = -9.2; x <= -8.55; x += 0.13) {
    const roller = cylinder(root, LEVEL.conveyor.rollerRadius, 0.92, [x, LEVEL.conveyor.beltHeight + 0.02, LEVEL.conveyor.z], galvanized, [Math.PI / 2, 0, 0], 18);
    rollers.push(roller);
  }
  [-4.35].forEach((x) => {
    [-0.78, 0.78].forEach((zOffset) => box(root, [0.12, 2.1, 0.12], [x, 1.65, LEVEL.conveyor.z + zOffset], steel));
    box(root, [0.3, 0.28, 1.7], [x, 2.72, LEVEL.conveyor.z], steel);
    box(root, [0.28, 0.18, 0.28], [x, 2.48, LEVEL.conveyor.z], standard(0x202625, 0.12, 0.4));
  });
  [-4.6, 0, 4.6].forEach((x) => {
    box(root, [0.92, 0.14, 3.0], [x, 0.66, -3.12], galvanized);
    [-0.5, 0.5].forEach((xOffset) => box(root, [0.08, 0.28, 3.05], [x + xOffset, 0.84, -3.12], safety));
  });
  box(root, [1.0, 2.2, 0.65], [-11.72, 1.1, -4.4], standard(0x4f5b59, 0.48, 0.46));
  box(root, [2.2, 0.18, 2.8], [10.7, 0.12, 5.1], standard(0x79583b, 0.02, 0.78));
  [-0.62, 0.62].forEach((zOffset) => box(root, [24, 0.025, 0.08], [0, 0.015, LEVEL.conveyor.z + zOffset], safety, { castShadow: false }));
  return { root, rollers };
}

export function createSortingScene() {
  return createCardinalSortingScene();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8c0bd);
  scene.fog = new THREE.Fog(0xb8c0bd, 34, 62);
  scene.add(new THREE.HemisphereLight(0xf0f3ee, 0x515a57, 1.9));
  const sun = new THREE.DirectionalLight(0xf5eee1, 2.35);
  sun.position.set(-8, 18, 11);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 44;
  sun.shadow.bias = -0.00008;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  for (const x of [-9, -3, 3, 9]) {
    const light = new THREE.PointLight(0xe9fff8, 1.25, 10, 1.9);
    light.position.set(x, 4.1, 0);
    scene.add(light);
  }

  const fallbackEnvironment = createFallbackEnvironment();
  scene.add(fallbackEnvironment.root);
  const environmentRoot = new THREE.Group();
  scene.add(environmentRoot);
  const assetPromises = [loadAsset(ASSETS.environment, environmentRoot).then((result) => {
    if (result.loaded) {
      result.model.name = "rf03-final-environment";
      fallbackEnvironment.root.visible = false;
    }
    return result;
  })];

  const binRoots = {};
  for (const type of PARCEL_TYPES) {
    const placement = LEVEL.bins[type];
    const root = new THREE.Group();
    root.position.set(placement.modelX, 0, placement.modelZ);
    const fallback = createRouteCageFallback(type);
    root.add(fallback);
    scene.add(root);
    binRoots[type] = root;
    assetPromises.push(loadAsset(ASSETS[`${type}Bin`], root).then((result) => {
      if (result.loaded) fallback.visible = false;
      return result;
    }));
  }

  const terminalRoot = new THREE.Group();
  terminalRoot.position.set(LEVEL.terminal.modelX, 0, LEVEL.terminal.modelZ);
  const terminalFallback = createTerminalFallback();
  terminalRoot.add(terminalFallback);
  scene.add(terminalRoot);
  assetPromises.push(loadAsset(ASSETS.terminal, terminalRoot).then((result) => {
    if (result.loaded) terminalFallback.visible = false;
    return result;
  }));

  const parcelRoots = {};
  for (const type of PARCEL_TYPES) {
    const root = new THREE.Group();
    root.name = `${type}-parcel`;
    const model = createParcelModel(type);
    root.add(model);
    scene.add(root);
    parcelRoots[type] = root;
    assetPromises.push(model.userData.assetReady);
  }

  return {
    scene,
    parcelRoots,
    binRoots,
    terminalRoot,
    rollers: fallbackEnvironment.rollers,
    assetRoots: { environment: environmentRoot, bins: binRoots, terminal: terminalRoot },
    assetReady: Promise.all(assetPromises.flat()),
  };
}

function createCardinalShellFallback() {
  const root = new THREE.Group();
  const shell = new THREE.Group();
  const equipment = new THREE.Group();
  root.add(shell, equipment);
  const concrete = standard(0x777c78, 0.04, 0.88);
  const wall = standard(0xb3b8b3, 0.2, 0.72);
  const steel = standard(0x303736, 0.72, 0.3);
  const galvanized = standard(0x697270, 0.68, 0.32);
  const safety = standard(0xe2b733, 0.32, 0.52);
  const belt = standard(0x171b1a, 0.08, 0.72);
  const white = standard(0xc8ceca, 0.18, 0.58);
  const floor = box(shell, [26, 0.18, 16], [0, -0.09, 0], concrete, { castShadow: false });
  const floorJoint = standard(0x424744, 0.02, 0.96);
  [-8, -4, 0, 4, 8].forEach((x) => {
    box(shell, [0.018, 0.006, 15.6], [x, 0.003, 0], floorJoint, { castShadow: false });
  });
  [-4, 0, 4].forEach((z) => {
    box(shell, [25.6, 0.006, 0.018], [0, 0.003, z], floorJoint, { castShadow: false });
  });
  box(shell, [26, 4.5, 0.22], [0, 2.25, -7.9], wall);
  box(shell, [0.22, 4.5, 16], [-12.9, 2.25, 0], wall);
  box(shell, [0.22, 4.5, 16], [12.9, 2.25, 0], wall);
  [-12, -6, 0, 6, 12].forEach((x) => {
    box(shell, [0.22, 4.4, 0.22], [x, 2.2, -7.65], steel);
    box(shell, [0.22, 4.4, 0.22], [x, 2.2, 7.65], steel);
    box(shell, [0.16, 0.18, 15.4], [x, 4.35, 0], steel, { castShadow: false });
  });
  box(shell, [25.6, 0.12, 0.12], [0, 4.42, -7.72], galvanized, { castShadow: false });
  const conveyorZ = LEVEL.conveyor.z;
  box(equipment, [19, 0.16, 1.1], [0, 0.74, conveyorZ], steel);
  box(equipment, [19, 0.08, 0.98], [0, LEVEL.conveyor.beltHeight, conveyorZ], belt);
  [-0.57, 0.57].forEach((zOffset) => box(equipment, [19.2, 0.22, 0.08], [0, 0.92, conveyorZ + zOffset], galvanized));
  const rollers = [];
  for (let x = -9.2; x <= -8.55; x += 0.13) {
    rollers.push(cylinder(equipment, LEVEL.conveyor.rollerRadius, 0.92, [x, LEVEL.conveyor.beltHeight + 0.02, conveyorZ], galvanized, [Math.PI / 2, 0, 0], 18));
  }
  for (let x = -9; x <= 9; x += 2) {
    [-0.46, 0.46].forEach((zOffset) => box(equipment, [0.08, 0.72, 0.08], [x, 0.36, conveyorZ + zOffset], steel));
  }
  box(equipment, [2.4, 1.8, 1.85], [LEVEL.conveyor.infeedX, 0.9, conveyorZ], galvanized);
  [-4.35].forEach((x) => {
    [-0.78, 0.78].forEach((zOffset) => box(equipment, [0.12, 2.1, 0.12], [x, 1.65, conveyorZ + zOffset], steel));
    box(equipment, [0.3, 0.28, 1.7], [x, 2.72, conveyorZ], steel);
  });
  [-4.6, 0, 4.6].forEach((x) => {
    box(equipment, [1.65, 0.14, 1.12], [x, 0.88, conveyorZ], galvanized);
    box(equipment, [1.08, 0.95, 3], [x, 0.48, -3.12], galvanized);
  });
  [4.2, 5.65].forEach((z) => box(equipment, [1.2, 1.35, 1], [10.7, 0.675, z], white));
  [-5, -4, -3].forEach((z) => box(equipment, [0.72, 2.12, 0.72], [-11.72, 1.06, z], white));
  [[12.55, 0.9, -5.8, -Math.PI / 2], [-12.55, 0.9, 5.8, Math.PI / 2]].forEach(([x, y, z, rotation]) => {
    box(equipment, [0.85, 1.8, 0.35], [x, y, z], safety, 0, [0, rotation, 0]);
  });
  for (const x of [-9, -3, 3, 9]) {
    for (const z of [-4, 0, 4]) box(equipment, [1.2, 0.12, 0.24], [x, 4.25, z], white, { castShadow: false });
  }
  [-0.62, 0.62].forEach((zOffset) => box(shell, [24, 0.025, 0.08], [0, 0.015, conveyorZ + zOffset], safety, { castShadow: false }));
  return { root, equipment, rollers, surfaces: { floor, wall } };
}

function createRouteBadge(type) {
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 0.29),
    new THREE.MeshBasicMaterial({ map: createRouteTexture(type), side: THREE.DoubleSide }),
  );
  sign.position.set(0, 1.43, 0.421);
  return sign;
}

function createTerminalScreenOverlay() {
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.39, 0.48),
    new THREE.MeshBasicMaterial({ map: createCodeTexture("DWS", 0x3d9d79, "扫码称重控制终端"), side: THREE.DoubleSide }),
  );
  screen.position.set(0, 1.05, 0.311);
  return screen;
}

function createCardinalStaticLayer(root, fallback) {
  root.visible = false;
  const conveyorPlacements = Array.from({ length: 9 }, (_, index) => ({
    position: [-8 + index * 2, 0, LEVEL.conveyor.z],
    scale: [1.06, 1, 1],
  }));
  const sorterPlacements = [-4.6, 0, 4.6].map((x) => ({ position: [x, 0, LEVEL.conveyor.z] }));
  const chutePlacements = [-4.6, 0, 4.6].map((x) => ({ position: [x, 0, -3.12] }));
  const cabinetPlacements = [-5, -4, -3].map((z) => ({ position: [-12.55, 0, z], rotation: [0, Math.PI / 2, 0] }));
  const palletPlacements = [4.2, 5.65].map((z) => ({ position: [10.7, 0, z] }));
  const firePlacements = [
    { position: [12.55, 0, -5.8], rotation: [0, -Math.PI / 2, 0] },
    { position: [-12.55, 0, 5.8], rotation: [0, Math.PI / 2, 0] },
  ];
  const ledPlacements = [-9, -3, 3, 9].flatMap((x) => [-4, 0, 4].map((z) => ({ position: [x, 4.25, z] })));
  const promises = [
    loadAssetCopies(ASSETS.automaticInfeed, root, [{ position: [LEVEL.conveyor.infeedX, 0, LEVEL.conveyor.z] }]),
    loadAssetCopies(ASSETS.beltConveyor, root, conveyorPlacements),
    loadAssetCopies(ASSETS.dwsGantry, root, [{ position: [-4.35, 0, LEVEL.conveyor.z] }]),
    loadAssetCopies(ASSETS.swingSorter, root, sorterPlacements),
    loadAssetCopies(ASSETS.gravityChute, root, chutePlacements),
    loadAssetCopies(ASSETS.electricalCabinet, root, cabinetPlacements),
    loadAssetCopies(ASSETS.palletStack, root, palletPlacements),
    loadAssetCopies(ASSETS.fireStation, root, firePlacements),
    loadAssetCopies(ASSETS.ledFixture, root, ledPlacements),
  ];
  return Promise.all(promises).then((results) => {
    if (results.every((result) => result.loaded)) {
      root.visible = true;
      fallback.equipment.visible = false;
    }
    return results;
  });
}

function createCardinalSortingScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8c0bd);
  scene.fog = new THREE.Fog(0xb8c0bd, 42, 76);
  scene.add(new THREE.HemisphereLight(0xf0f3ee, 0x515a57, 2.2));
  const sun = new THREE.DirectionalLight(0xf5eee1, 2.4);
  sun.position.set(-8, 18, 11);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 46;
  sun.shadow.bias = -0.00008;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  for (const x of [-9, -3, 3, 9]) {
    const light = new THREE.PointLight(0xe9fff8, 1.3, 12, 1.9);
    light.position.set(x, 4.1, 0);
    scene.add(light);
  }

  const fallback = createCardinalShellFallback();
  scene.add(fallback.root);
  const staticRoot = new THREE.Group();
  scene.add(staticRoot);
  const assetPromises = [
    upgradeConcreteFloor(fallback.surfaces.floor),
    createCardinalStaticLayer(staticRoot, fallback),
  ];

  const binRoots = {};
  for (const type of PARCEL_TYPES) {
    const placement = LEVEL.bins[type];
    const root = new THREE.Group();
    root.position.set(placement.modelX, 0, placement.modelZ);
    const fallbackModel = createRouteCageFallback(type);
    root.add(fallbackModel, createRouteBadge(type));
    scene.add(root);
    binRoots[type] = root;
    assetPromises.push(loadAsset(ASSETS.routeCage, root).then((result) => {
      if (result.loaded) fallbackModel.visible = false;
      return result;
    }));
  }

  const terminalRoot = new THREE.Group();
  terminalRoot.position.set(LEVEL.terminal.modelX, 0, LEVEL.terminal.modelZ);
  const terminalFallback = createTerminalFallback();
  terminalRoot.add(terminalFallback, createTerminalScreenOverlay());
  scene.add(terminalRoot);
  assetPromises.push(loadAsset(ASSETS.terminal, terminalRoot).then((result) => {
    if (result.loaded) terminalFallback.visible = false;
    return result;
  }));

  const parcelRoots = {};
  for (const type of PARCEL_TYPES) {
    const root = new THREE.Group();
    root.name = `${type}-parcel`;
    root.add(createParcelModel(type));
    scene.add(root);
    parcelRoots[type] = root;
    assetPromises.push(root.children[0].userData.assetReady);
  }

  return {
    scene,
    parcelRoots,
    binRoots,
    terminalRoot,
    rollers: fallback.rollers,
    assetRoots: { static: staticRoot, bins: binRoots, terminal: terminalRoot },
    assetReady: Promise.all(assetPromises),
  };
}

export function syncSortingVisuals(world, state) {
  const angularSpeed = LEVEL.conveyor.speed / LEVEL.conveyor.rollerRadius;
  world.rollers.forEach((roller) => { roller.rotation.y = -state.elapsed * angularSpeed; });
  for (const type of PARCEL_TYPES) {
    const parcel = state.parcels[type];
    const root = world.parcelRoots[type];
    root.visible = parcel.location !== "carried";
    if (!root.visible) continue;
    if (parcel.location === "conveyor") {
      root.position.set(parcel.x, LEVEL.conveyor.beltHeight + 0.045, parcel.z);
      root.rotation.set(0, 0, 0);
    } else if (parcel.location === "ground") {
      root.position.set(parcel.x, 0.02, parcel.z);
      root.rotation.set(0, 0.16, 0);
    } else if (parcel.location === "sorted") {
      const bin = LEVEL.bins[type];
      root.position.set(bin.modelX, 0.18, bin.modelZ);
      root.rotation.set(0, type === "yellow" ? -0.12 : 0.1, 0);
    }
  }
}

export { ASSETS };
