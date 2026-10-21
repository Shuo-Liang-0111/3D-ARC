import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RF09_CARDINAL_ASSETS, RF09_CARDINAL_FIXTURES } from "./cardinal-assets.js";
import { DEVICE_META, DEVICE_TYPES, LEVEL } from "./level.js";
import { createCarpetMaterial, createPaintedWallMaterial } from "./surfaces.js";

function material(color, roughness = 0.72, metalness = 0.04, options = {}) { return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...options }); }
function box(parent, size, position, entryMaterial, name = "") { const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), entryMaterial); mesh.position.set(...position); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; }
function cylinder(parent, radius, height, position, entryMaterial) { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 24), entryMaterial); mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; }

function labelTexture(title, subtitle, accent = "#2c6d8b") {
  const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 256;
  const context = canvas.getContext("2d"); context.fillStyle = "#f4f1e9"; context.fillRect(0, 0, 1024, 256); context.fillStyle = accent; context.fillRect(0, 0, 24, 256);
  context.fillStyle = "#17242a"; context.textAlign = "center"; context.font = "700 78px sans-serif"; context.fillText(title, 535, 112); context.fillStyle = "#52636b"; context.font = "700 34px sans-serif"; context.fillText(subtitle, 535, 188);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; return texture;
}
function label(parent, title, subtitle, size, position, rotation = [0, 0, 0], accent) { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ map: labelTexture(title, subtitle, accent), side: THREE.DoubleSide, toneMapped: false })); mesh.position.set(...position); mesh.rotation.set(...rotation); parent.add(mesh); return mesh; }

function deviceModel(type) {
  const root = new THREE.Group(); root.name = `rf09-${type}-fallback`;
  if (type === "adapter") {
    box(root, [0.34, 0.07, 0.2], [0, 0.035, 0], material(DEVICE_META[type].color, 0.28, 0.55));
    box(root, [0.12, 0.035, 0.055], [0.22, 0.035, 0], material(0x373d40, 0.45, 0.25));
    box(root, [0.045, 0.035, 0.11], [-0.19, 0.035, 0], material(0x202526, 0.35, 0.4));
  } else {
    const body = box(root, [0.13, 0.06, 0.42], [0, 0.03, 0], material(DEVICE_META[type].color, 0.36, 0.18)); body.rotation.y = 0.08;
    cylinder(root, 0.026, 0.012, [0, 0.068, -0.08], material(0x57a5c4, 0.3, 0.1));
  }
  return root;
}

function fallbackChair(parent, id, position, yaw) { const root = new THREE.Group(); root.name = `rf09-fallback-${id}`; root.position.set(...position); root.rotation.y = yaw; parent.add(root); const dark = material(0x303638, 0.58, 0.22); box(root, [0.62, 0.1, 0.62], [0, 0.58, 0], dark); box(root, [0.62, 0.72, 0.1], [0, 0.94, 0.28], dark); cylinder(root, 0.07, 0.5, [0, 0.28, 0], dark); return root; }
function fallbackDesk(parent, id, x, z) { const root = new THREE.Group(); root.name = `rf09-fallback-${id}`; root.position.set(x, 0, z); parent.add(root); box(root, [3.4, 0.12, 1.45], [0, 0.78, 0], material(0xb48a62, 0.62)); [-1.43, 1.43].forEach((offset) => box(root, [0.11, 0.76, 1.15], [offset, 0.38, 0], material(0x4b5557, 0.38, 0.58))); box(root, [0.62, 0.42, 0.04], [0, 1.07, -0.32], material(0x20282a, 0.3, 0.16)); return root; }

function fallbackOffice(scene) {
  const root = new THREE.Group(); root.name = "rf09-meter-accurate-fallback"; scene.add(root);
  const groups = {};
  const trim = material(0x3c494e, 0.48, 0.42); const glass = material(0x8fc0cf, 0.12, 0.05, { transparent: true, opacity: 0.27, depthWrite: false });
  box(root, [26, 0.18, 18], [0, -0.09, 0], createCarpetMaterial(), "rf09-carpet-floor");
  box(root, [26, 3.3, 0.3], [0, 1.65, -9.1], createPaintedWallMaterial(26)); box(root, [0.3, 3.3, 18], [-13.1, 1.65, 0], createPaintedWallMaterial(18)); box(root, [0.3, 3.3, 18], [13.1, 1.65, 0], createPaintedWallMaterial(18)); box(root, [10.7, 3.3, 0.3], [-7.65, 1.65, 9.1], createPaintedWallMaterial(10.7)); box(root, [10.7, 3.3, 0.3], [7.65, 1.65, 9.1], createPaintedWallMaterial(10.7));
  box(root, [10.7, 2.8, 0.06], [-7.65, 1.4, -2.1], glass); box(root, [10.7, 2.8, 0.06], [7.65, 1.4, -2.1], glass); box(root, [4.6, 0.12, 0.2], [0, 2.72, -2.1], trim);

  groups.conferenceTable = new THREE.Group(); groups.conferenceTable.name = "rf09-fallback-conference-table"; root.add(groups.conferenceTable); box(groups.conferenceTable, [8.8, 0.16, 2.8], [0, 0.7, -5.15], material(0x8b6443, 0.64)); [-3.8, 3.8].forEach((x) => box(groups.conferenceTable, [0.18, 0.7, 2.3], [x, 0.35, -5.15], trim));
  for (const x of [-3, -1, 1, 3]) { const index = [-3, -1, 1, 3].indexOf(x) + 1; groups[`chair-north-${index}`] = fallbackChair(root, `chair-north-${index}`, [x, 0, -7.05], 0); groups[`chair-south-${index}`] = fallbackChair(root, `chair-south-${index}`, [x, 0, -3.25], Math.PI); }
  groups.podium = new THREE.Group(); groups.podium.name = "rf09-fallback-podium"; root.add(groups.podium); box(groups.podium, [0.84, 0.18, 0.5], [0, 0.87, -6.05], material(0x4b4540, 0.48, 0.34));
  groups.terminal = new THREE.Group(); groups.terminal.name = "rf09-fallback-terminal"; root.add(groups.terminal); box(groups.terminal, [0.72, 0.18, 0.48], [2.1, 0.87, -6.05], trim);
  const terminalScreen = box(root, [0.56, 0.02, 0.3], [2.1, 0.972, -5.99], material(0x203f49, 0.22, 0.16), "rf09-live-terminal-screen"); terminalScreen.rotation.x = -0.06;
  [["workstation-west-1", -9.05], ["workstation-east-1", 4], ["workstation-east-2", 9.05]].forEach(([id, x]) => { groups[id] = fallbackDesk(root, id, x, 1.55); });
  groups.receptionDesk = new THREE.Group(); groups.receptionDesk.name = "rf09-fallback-reception-desk"; root.add(groups.receptionDesk); box(groups.receptionDesk, [5.4, 0.9, 0.95], [0, 0.45, 6.45], material(0x75614e, 0.72));
  groups.supplyCabinet = new THREE.Group(); groups.supplyCabinet.name = "rf09-fallback-supply-cabinet"; root.add(groups.supplyCabinet); box(groups.supplyCabinet, [3.1, 2.35, 1.3], [-10.2, 1.175, 5.7], material(0xa7aaa3, 0.52, 0.24)); box(root, [1.7, 0.12, 0.72], [-9.65, 0.9, 4.62], material(0xb7b4aa, 0.5, 0.32));
  groups.itLocker = new THREE.Group(); groups.itLocker.name = "rf09-fallback-it-locker"; root.add(groups.itLocker); box(groups.itLocker, [3, 2.4, 1.45], [9.25, 1.2, 5.3], material(0x4c5d63, 0.46, 0.48)); box(root, [1.7, 0.12, 0.72], [8.85, 0.9, 4.28], material(0x63747a, 0.44, 0.4));
  [["lounge-west", -9.7], ["lounge-east", 9.7]].forEach(([id, x]) => { const group = new THREE.Group(); group.name = `rf09-fallback-${id}`; root.add(group); box(group, [3.4, 0.68, 1.1], [x, 0.34, -0.9], material(0x627b75, 0.78)); groups[id] = group; });
  for (const x of [-10, -6, -2, 2, 6, 10]) for (const z of [-6.4, 0, 6.4]) { const id = `ceiling-light-${x}-${z}`; const group = new THREE.Group(); group.name = `rf09-fallback-${id}`; root.add(group); box(group, [1.2, 0.08, 0.3], [x, 3.26, z], material(0xf4f2e9, 0.35)); groups[id] = group; }
  return { root, groups, terminalScreen };
}

function prepareAsset(model) { model.traverse((object) => { if (object.isLight || object.isCamera) { object.visible = false; return; } if (!object.isMesh) return; object.castShadow = true; object.receiveShadow = true; const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.filter(Boolean).forEach((entry) => { if (entry.map) entry.map.colorSpace = THREE.SRGBColorSpace; entry.needsUpdate = true; }); }); return model; }
const loader = new GLTFLoader(); const assetCache = new Map();
function fetchAsset(url) { if (!assetCache.has(url)) assetCache.set(url, new Promise((resolve) => loader.load(url, (gltf) => resolve(prepareAsset(gltf.scene)), undefined, (error) => { console.warn(`[RF-09] failed to load ${url}`, error); resolve(null); }))); return assetCache.get(url); }
function loadAsset(url, parent) { return fetchAsset(url).then((source) => { if (!source) return { loaded: false, url, model: null, error: new Error(`Unable to load ${url}`) }; const model = prepareAsset(source.clone(true)); parent.add(model); parent.userData.assetLoaded = true; return { loaded: true, url, model, error: null }; }); }
function fixtureRoot(parent, fixture) { const root = new THREE.Group(); root.name = `rf09-cardinal-${fixture.id}`; root.position.set(...fixture.position); root.rotation.y = fixture.yaw; root.userData.supportY = fixture.supportY; parent.add(root); return root; }

export function createOfficeScene() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xaebdc2); scene.fog = new THREE.Fog(0xaebdc2, 36, 68);
  scene.add(new THREE.HemisphereLight(0xf4f2ea, 0x40505a, 1.65)); scene.add(new THREE.AmbientLight(0xf8f1df, 0.24));
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.15); sun.position.set(-8, 18, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -16; sun.shadow.camera.right = 16; sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12; scene.add(sun);
  const fallback = fallbackOffice(scene); const fixtures = new THREE.Group(); fixtures.name = "rf09-cardinal-fixtures"; scene.add(fixtures);
  const deviceFallbacks = {}; const cardinalDevices = {};
  DEVICE_TYPES.forEach((type) => { deviceFallbacks[type] = deviceModel(type); scene.add(deviceFallbacks[type]); cardinalDevices[type] = new THREE.Group(); cardinalDevices[type].name = `rf09-cardinal-${type}`; scene.add(cardinalDevices[type]); });
  const world = { scene, fallbackRoot: fallback.root, fallbackGroups: fallback.groups, deviceRoots: deviceFallbacks, cardinalDevices, terminalScreen: fallback.terminalScreen, fixtureRoots: {} };
  const fixtureReady = RF09_CARDINAL_FIXTURES.map((fixture) => { const root = fixtureRoot(fixtures, fixture); world.fixtureRoots[fixture.id] = root; return loadAsset(RF09_CARDINAL_ASSETS[fixture.asset], root).then((result) => { if (result.loaded) fallback.groups[fixture.fallback].visible = false; return { ...result, name: fixture.id }; }); });
  const deviceReady = DEVICE_TYPES.map((type) => loadAsset(RF09_CARDINAL_ASSETS[type], cardinalDevices[type]).then((result) => ({ ...result, name: type })));
  world.assetReady = Promise.all([...fixtureReady, ...deviceReady]);
  return world;
}

function poseFor(type, device) { if (device.location === "office") return { x: device.x, y: 0.96, z: device.z, yaw: type === "adapter" ? 0.15 : -0.3 }; if (device.location === "floor") return { x: device.x, y: 0, z: device.z, yaw: type === "adapter" ? 0.15 : -0.3 }; const index = LEVEL.requiredOrder.indexOf(type); return { x: -0.28 + index * 0.56, y: 0.78, z: -5.65, yaw: index ? -0.1 : 0.12 }; }
function applyPose(root, pose) { root.position.set(pose.x, pose.y, pose.z); root.rotation.set(0, pose.yaw, 0); }

export function syncOfficeVisuals(world, state) {
  DEVICE_TYPES.forEach((type) => { const device = state.devices[type]; const visible = ["office", "floor", "podium"].includes(device.location); const pose = poseFor(type, device); const cardinal = world.cardinalDevices[type]; const loaded = Boolean(cardinal.userData.assetLoaded); cardinal.visible = visible && loaded; world.deviceRoots[type].visible = visible && !loaded; if (visible) { applyPose(cardinal, pose); applyPose(world.deviceRoots[type], pose); } });
  world.terminalScreen.material.color.setHex(state.complete ? 0x65b989 : state.presentationReady ? 0x3b8dab : 0x203f49); world.terminalScreen.material.emissive?.setHex(state.presentationReady ? 0x153e49 : 0x000000); world.terminalScreen.material.emissiveIntensity = state.presentationReady ? 0.75 : 0;
}

export function createOfficeCargoModel() {
  const root = new THREE.Group(); root.userData.models = {};
  const assetReady = [];
  DEVICE_TYPES.forEach((type) => { const group = new THREE.Group(); const fallback = deviceModel(type); group.add(fallback); root.add(group); root.userData.models[type] = group; group.visible = false; assetReady.push(loadAsset(RF09_CARDINAL_ASSETS[type], group).then((result) => { if (result.loaded) fallback.visible = false; return { ...result, name: `cargo-${type}` }; })); });
  root.userData.assetReady = Promise.all(assetReady);
  return root;
}
export function setOfficeCargoModel(root, state) { DEVICE_TYPES.forEach((type) => { root.userData.models[type].visible = state.carriedItem === type; root.userData.models[type].rotation.y = Math.PI; }); }
