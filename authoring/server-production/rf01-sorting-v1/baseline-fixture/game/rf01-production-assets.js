import * as THREE from "three";
import { RF01_YARD_LAYOUT } from "./rf01-yard-layout.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  collisionProxyId,
  RF01_COLLISION_ASSET_URL,
  RF01_COLLISION_PROXIES,
} from "./rf01-collision-proxies.js";

const ROOT = "/local-assets/polyhaven/rf01";
const CARDINAL_ROOT = "/local-assets/cardinal/rf01/models/runtime";

export const RF01_PRODUCTION_ASSETS = Object.freeze({
  environment: `${ROOT}/environment/factory_yard_8k.hdr`,
  collision: RF01_COLLISION_ASSET_URL,
  textures: Object.freeze({
    concrete: Object.freeze({
      diffuse: `${ROOT}/textures/hangar_concrete_floor/hangar_concrete_floor_diff_2k.jpg`,
      normal: `${ROOT}/textures/hangar_concrete_floor/hangar_concrete_floor_nor_gl_2k.jpg`,
      roughness: `${ROOT}/textures/hangar_concrete_floor/hangar_concrete_floor_rough_2k.jpg`,
      ao: `${ROOT}/textures/hangar_concrete_floor/hangar_concrete_floor_ao_2k.jpg`,
      displacement: `${ROOT}/textures/hangar_concrete_floor/hangar_concrete_floor_disp_2k.jpg`,
    }),
    asphalt: Object.freeze({
      diffuse: `${ROOT}/textures/aerial_asphalt_01/aerial_asphalt_01_diff_2k.jpg`,
      normal: `${ROOT}/textures/aerial_asphalt_01/aerial_asphalt_01_nor_gl_2k.jpg`,
      roughness: `${ROOT}/textures/aerial_asphalt_01/aerial_asphalt_01_rough_2k.jpg`,
      ao: `${ROOT}/textures/aerial_asphalt_01/aerial_asphalt_01_ao_2k.jpg`,
      displacement: `${ROOT}/textures/aerial_asphalt_01/aerial_asphalt_01_disp_2k.jpg`,
    }),
    cladding: Object.freeze({
      diffuse: `${ROOT}/textures/box_profile_metal_sheet/box_profile_metal_sheet_diff_2k.jpg`,
      normal: `${ROOT}/textures/box_profile_metal_sheet/box_profile_metal_sheet_nor_gl_2k.jpg`,
      roughness: `${ROOT}/textures/box_profile_metal_sheet/box_profile_metal_sheet_rough_2k.jpg`,
      ao: `${ROOT}/textures/box_profile_metal_sheet/box_profile_metal_sheet_ao_2k.jpg`,
      displacement: `${ROOT}/textures/box_profile_metal_sheet/box_profile_metal_sheet_disp_2k.jpg`,
    }),
  }),
  models: Object.freeze({
    batteryRack: `${CARDINAL_ROOT}/rf01_battery_storage_rack.glb`,
    controlCabinet: `${CARDINAL_ROOT}/rf01_control_cabinet.glb`,
    cargoCrate: `${CARDINAL_ROOT}/rf01_cargo_crate.glb`,
    pipeManifold: `${CARDINAL_ROOT}/rf01_pipe_manifold.glb`,
    pumpUnit: `${CARDINAL_ROOT}/rf01_industrial_pump_unit.glb`,
    lightFixture: `${CARDINAL_ROOT}/rf01_fluorescent_light_fixture.glb`,
    workshop: `${CARDINAL_ROOT}/rf01_factory_workshop.glb`,
    fenceModule: `${CARDINAL_ROOT}/rf01_security_fence_module.glb`,
    guardKiosk: `${CARDINAL_ROOT}/rf01_guard_kiosk.glb`,
    fireStation: `${CARDINAL_ROOT}/rf01_fire_safety_station.glb`,
    drainGrate: `${CARDINAL_ROOT}/rf01_drain_grate.glb`,
    hedgePlanter: `${CARDINAL_ROOT}/rf01_hedge_planter.glb`,
  }),
});

const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const hdrLoader = new HDRLoader();

const CARDINAL_TARGET_SIZES = Object.freeze({
  workshop: Object.freeze([10.4, 4.6, 6]),
  fenceModule: Object.freeze([3, 2.3, 0.12]),
  guardKiosk: Object.freeze([2.1, 2.2, 1.8]),
  fireStation: Object.freeze([1.4, 1.8, 0.5]),
  drainGrate: Object.freeze([1.25, 0.05, 0.42]),
  hedgePlanter: Object.freeze([1.6, 1, 0.75]),
});

const CARDINAL_UNIFORM_TARGET_SIZES = Object.freeze({
  pipeManifold: Object.freeze([2.6, 1.7, 0.42]),
  pumpUnit: Object.freeze([0.85, 1.05, 1.75]),
});

function loadTexture(url, colorSpace = THREE.NoColorSpace, repeat = [1, 1]) {
  return new Promise((resolve) => textureLoader.load(
    url,
    (texture) => {
      texture.colorSpace = colorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(...repeat);
      texture.anisotropy = 8;
      resolve(texture);
    },
    undefined,
    () => resolve(null),
  ));
}

function applyMaps(material, maps, { bumpScale = 0.02, normalScale = 1 } = {}) {
  if (maps.diffuse) material.map = maps.diffuse;
  if (maps.normal) {
    material.normalMap = maps.normal;
    material.normalScale.setScalar(normalScale);
  }
  if (maps.roughness) material.roughnessMap = maps.roughness;
  if (maps.ao) material.aoMap = maps.ao;
  if (maps.displacement) {
    material.bumpMap = maps.displacement;
    material.bumpScale = bumpScale;
  }
  material.needsUpdate = true;
}

async function loadSurfaceSet(definition, repeat) {
  const entries = await Promise.all(Object.entries(definition).map(async ([channel, url]) => [
    channel,
    await loadTexture(url, channel === "diffuse" ? THREE.SRGBColorSpace : THREE.NoColorSpace, repeat),
  ]));
  return Object.fromEntries(entries);
}

export async function upgradeRF01SurfaceLibrary(surfaces) {
  const [concrete, asphalt, cladding] = await Promise.all([
    loadSurfaceSet(RF01_PRODUCTION_ASSETS.textures.concrete, [9.8, 7.8]),
    loadSurfaceSet(RF01_PRODUCTION_ASSETS.textures.asphalt, [8.5, 3.2]),
    loadSurfaceSet(RF01_PRODUCTION_ASSETS.textures.cladding, [5.2, 2.1]),
  ]);
  applyMaps(surfaces.concrete, concrete, { bumpScale: 0.008, normalScale: 0.42 });
  applyMaps(surfaces.asphalt, asphalt, { bumpScale: 0.012, normalScale: 0.48 });
  applyMaps(surfaces.cladding, cladding, { bumpScale: 0.006, normalScale: 0.38 });
  return { loaded: [concrete, asphalt, cladding].every((maps) => Object.values(maps).every(Boolean)), channels: 15 };
}

export function loadRF01EnvironmentMap(renderer, scene) {
  return new Promise((resolve) => hdrLoader.load(
    RF01_PRODUCTION_ASSETS.environment,
    (source) => {
      source.mapping = THREE.EquirectangularReflectionMapping;
      const generator = new THREE.PMREMGenerator(renderer);
      generator.compileEquirectangularShader();
      const environment = generator.fromEquirectangular(source).texture;
      scene.environment = environment;
      scene.environmentIntensity = 0.78;
      source.dispose();
      generator.dispose();
      resolve({ loaded: true, url: RF01_PRODUCTION_ASSETS.environment });
    },
    undefined,
    () => resolve({ loaded: false, url: RF01_PRODUCTION_ASSETS.environment }),
  ));
}

function prepareModel(model, name) {
  model.name = name;
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.frustumCulled = false;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
      if (material.transparent) material.depthWrite = false;
      material.envMapIntensity = 0.7;
      if ((material.metalness ?? 0) >= 0.45) {
        material.roughness = Math.max(material.roughness ?? 0, 0.4);
      }
      material.needsUpdate = true;
    });
  });
  return model;
}

function loadModel(url, name) {
  return new Promise((resolve) => gltfLoader.load(
    url,
    (gltf) => resolve(prepareModel(gltf.scene, name)),
    undefined,
    () => resolve(null),
  ));
}

function tuneCardinalMaterial(model, key) {
  if (!["workshop", "drainGrate"].includes(key)) return;
  model.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      if (key === "workshop") {
        material.side = THREE.DoubleSide;
        material.shadowSide = THREE.DoubleSide;
      } else {
        material.color.setHex(0x30383a);
        material.metalness = 0.72;
        material.roughness = 0.48;
      }
      material.needsUpdate = true;
    });
  });
}

export function fitModelToSize(model, targetSize) {
  const fitted = new THREE.Group();
  const oriented = new THREE.Group();
  fitted.name = `${model.name}-meter-fitted`;
  fitted.add(oriented);
  oriented.add(model);
  fitted.updateMatrixWorld(true);

  const initialSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const footprintAxesAreSwapped = (targetSize[0] - targetSize[2]) * (initialSize.x - initialSize.z) < 0;
  if (footprintAxesAreSwapped) {
    model.rotation.y = Math.PI / 2;
    fitted.updateMatrixWorld(true);
  }

  const sourceBounds = new THREE.Box3().setFromObject(model);
  const sourceSize = sourceBounds.getSize(new THREE.Vector3());
  const sourceCenter = sourceBounds.getCenter(new THREE.Vector3());
  model.position.x -= sourceCenter.x;
  model.position.y -= sourceBounds.min.y;
  model.position.z -= sourceCenter.z;
  oriented.scale.set(
    targetSize[0] / Math.max(sourceSize.x, 1e-6),
    targetSize[1] / Math.max(sourceSize.y, 1e-6),
    targetSize[2] / Math.max(sourceSize.z, 1e-6),
  );
  fitted.userData.targetSize = [...targetSize];
  fitted.userData.sourceSize = sourceSize.toArray();
  return fitted;
}

export function fitModelUniformlyToSize(model, targetSize) {
  const normalizedRoot = model.getObjectByName("RuntimeNormalizedRoot");
  if (normalizedRoot) {
    normalizedRoot.position.set(0, 0, 0);
    normalizedRoot.scale.set(1, 1, 1);
  }

  const fitted = new THREE.Group();
  fitted.name = `${model.name}-uniform-meter-fitted`;
  fitted.add(model);
  fitted.updateMatrixWorld(true);

  const initialSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const footprintAxesAreSwapped = (targetSize[0] - targetSize[2]) * (initialSize.x - initialSize.z) < 0;
  if (footprintAxesAreSwapped) {
    model.rotation.y = Math.PI / 2;
    fitted.updateMatrixWorld(true);
  }

  const sourceBounds = new THREE.Box3().setFromObject(model);
  const sourceSize = sourceBounds.getSize(new THREE.Vector3());
  const sourceCenter = sourceBounds.getCenter(new THREE.Vector3());
  const uniformScale = Math.min(
    targetSize[0] / Math.max(sourceSize.x, 1e-6),
    targetSize[1] / Math.max(sourceSize.y, 1e-6),
    targetSize[2] / Math.max(sourceSize.z, 1e-6),
  );

  model.position.x -= sourceCenter.x;
  model.position.y -= sourceBounds.min.y;
  model.position.z -= sourceCenter.z;
  fitted.scale.setScalar(uniformScale);
  fitted.userData.targetSize = [...targetSize];
  fitted.userData.sourceSize = sourceSize.toArray();
  fitted.userData.uniformScale = uniformScale;
  return fitted;
}

function placeModel(root, model, { position, rotation = [0, 0, 0], scale = [1, 1, 1] }) {
  model.position.set(...position);
  model.rotation.set(...rotation);
  model.scale.set(...scale);
  root.add(model);
  return model;
}

function placeModelCopies(root, model, placements) {
  placements.forEach((placement, index) => {
    placeModel(root, index === 0 ? model : model.clone(true), placement);
  });
}

const LEGACY_REPLACEMENTS = Object.freeze([
  ["workshop", /^(EmbodiedGenWorkshop|geometry_0)$/],
  ["fenceModule", /^(Fence|ElectricalFence)/],
  ["guardKiosk", /^Guard(Kiosk|Window)/],
  ["fireStation", /^(FireCabinet|KioskBollard)/],
  ["drainGrate", /^rf01-procedural-drainage-grates$/],
  ["hedgePlanter", /^WorkshopHedge/],
]);

export function hideRF01LegacyAssets(roots, productionModels) {
  const loadedModels = new Set(productionModels.filter((entry) => entry.loaded).map((entry) => entry.name));

  roots.filter(Boolean).forEach((root) => {
    root.traverse((object) => {
      for (const [modelName, pattern] of LEGACY_REPLACEMENTS) {
        if (!loadedModels.has(modelName) || !pattern.test(object.name)) continue;
        object.visible = false;
        break;
      }
    });
  });
}


export function loadRF01CollisionProxies() {
  return new Promise((resolve) => gltfLoader.load(
    RF01_COLLISION_ASSET_URL,
    (gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const colliders = [];
      gltf.scene.traverse((object) => {
        if (!object.isMesh || !object.name.startsWith("COLLIDER_")) return;
        const bounds = new THREE.Box3().setFromObject(object);
        colliders.push(Object.freeze({
          id: collisionProxyId(object.name),
          minX: bounds.min.x,
          maxX: bounds.max.x,
          minZ: bounds.min.z,
          maxZ: bounds.max.z,
        }));
      });
      resolve({
        name: "collisionProxies",
        loaded: colliders.length === RF01_COLLISION_PROXIES.length,
        url: RF01_COLLISION_ASSET_URL,
        colliders: Object.freeze(colliders),
        model: gltf.scene,
      });
    },
    undefined,
    () => resolve({
      name: "collisionProxies",
      loaded: false,
      url: RF01_COLLISION_ASSET_URL,
      colliders: Object.freeze([]),
      model: null,
    }),
  ));
}

export async function loadRF01ProductionModels(parent) {
  const entries = await Promise.all(Object.entries(RF01_PRODUCTION_ASSETS.models).map(async ([key, url]) => {
    const source = await loadModel(url, `rf01-cardinal-${key}`);
    if (source) tuneCardinalMaterial(source, key);
    const model = source && CARDINAL_TARGET_SIZES[key]
      ? fitModelToSize(source, CARDINAL_TARGET_SIZES[key])
      : source && CARDINAL_UNIFORM_TARGET_SIZES[key]
        ? fitModelUniformlyToSize(source, CARDINAL_UNIFORM_TARGET_SIZES[key])
      : source;
    return [key, url, model];
  }));
  const models = Object.fromEntries(entries.map(([key, , model]) => [key, model]));

  if (models.batteryRack) placeModel(parent, models.batteryRack, { position: [-6.8, 0, -0.35] });
  if (models.controlCabinet) placeModel(parent, models.controlCabinet, { position: RF01_YARD_LAYOUT.cabinet });
  if (models.pumpUnit) placeModel(parent, models.pumpUnit, { position: RF01_YARD_LAYOUT.pump, rotation: [0, -Math.PI / 2, 0] });
  if (models.pipeManifold) placeModel(parent, models.pipeManifold, { position: RF01_YARD_LAYOUT.manifold, rotation: [0, -Math.PI / 2, 0] });
  if (models.cargoCrate) {
    RF01_YARD_LAYOUT.crates.forEach(([x, y, z, yaw], index) => {
      const crate = index === 0 ? models.cargoCrate : models.cargoCrate.clone(true);
      placeModel(parent, crate, { position: [x, y, z], rotation: [0, yaw, 0], scale: [0.62, 0.62, 0.62] });
    });
  }
  if (models.lightFixture) {
    [-3.2, 0, 3.2].forEach((x, index) => {
      const fixture = index === 0 ? models.lightFixture : models.lightFixture.clone(true);
      placeModel(parent, fixture, { position: [x, 3.82, -0.78] });
    });
  }

  if (models.workshop) placeModel(parent, models.workshop, { position: [0, 0, -4], rotation: [0, Math.PI, 0] });
  if (models.guardKiosk) placeModel(parent, models.guardKiosk, { position: [6.5, 0, 5] });
  if (models.fireStation) placeModel(parent, models.fireStation, { position: [8.8, 0, -0.9], rotation: [0, -Math.PI / 2, 0] });

  if (models.fenceModule) {
    const fencePlacements = [];
    [-6.25, -3.25, -0.25, 2.75, 5.3].forEach((z) => {
      fencePlacements.push({ position: [-9.8, 0, z], rotation: [0, Math.PI / 2, 0] });
      fencePlacements.push({ position: [9.8, 0, z], rotation: [0, Math.PI / 2, 0] });
    });
    [-8.55, -5.8, -3.1, 3.1, 5.8, 8.55].forEach((x) => fencePlacements.push({ position: [x, 0, 6.8] }));
    [-8.4, -5.6, -2.8, 0, 2.8, 5.6, 8.4].forEach((x) => fencePlacements.push({ position: [x, 0, -7.68] }));
    fencePlacements.push(
      { position: [6.6, 0, -2.75] },
      { position: [8.05, 0, -1.8], rotation: [0, Math.PI / 2, 0] },
    );
    placeModelCopies(parent, models.fenceModule, fencePlacements);
  }

  if (models.drainGrate) placeModelCopies(parent, models.drainGrate, [-4.7, 0, 4.7].map((x) => ({ position: [x, 0.018, 2.2] })));
  if (models.hedgePlanter) placeModelCopies(parent, models.hedgePlanter, RF01_YARD_LAYOUT.hedges.map(position => ({ position })));

  return entries.map(([name, url, model]) => ({ name, url, loaded: Boolean(model), model }));
}
