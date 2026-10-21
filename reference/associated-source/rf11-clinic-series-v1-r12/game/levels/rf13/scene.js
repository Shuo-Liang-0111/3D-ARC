import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { LEVEL, STATIONS, SUPPLIES, PREPARATIONS, REVISION } from "./level.js";

const ROOT = `/local-assets/levels/rf13/${REVISION}`;
const decoder = new DRACOLoader();
decoder.setDecoderPath("/vendor/draco/");
decoder.setWorkerLimit(2);
const loader = new GLTFLoader();
loader.setDRACOLoader(decoder);
const cache = new Map();
function fetchModel(name) {
  if (!cache.has(name)) cache.set(name, loader.loadAsync(`${ROOT}/${name}.glb`).then(gltf => gltf.scene));
  return cache.get(name);
}
function attach(name, parent) {
  return fetchModel(name).then(source => {
    const model = source.clone(true);
    model.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    parent.add(model);
    return { loaded: true, name, url: `${ROOT}/${name}.glb`, model };
  }).catch(error => ({ loaded: false, name, url: `${ROOT}/${name}.glb`, error: String(error) }));
}
function addSign(parent, text, position, yaw = 0, width = 1.2) {
  const canvas = document.createElement("canvas");
  canvas.width = 768; canvas.height = 160;
  const context = canvas.getContext("2d");
  context.fillStyle = "#eaf0eb"; context.fillRect(0, 0, 768, 160);
  context.fillStyle = "#285a53"; context.font = "bold 64px sans-serif"; context.textAlign = "center"; context.fillText(text, 384, 105);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 160 / 768), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  mesh.position.set(...position); mesh.rotation.y = yaw; parent.add(mesh);
}
export function createClinicScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#bac7c4");
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x68766e, 1.15));
  const sun = new THREE.DirectionalLight(0xfffaf0, 0.85);
  sun.position.set(-5, 12, 7); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
  sun.shadow.normalBias = 0.02; scene.add(sun);
  const environment = new THREE.Group(); environment.name = "RF13_ENVIRONMENT"; scene.add(environment);
  const collision = new THREE.Group(); collision.name = "RF13_COLLISION_HIDDEN"; collision.visible = false; scene.add(collision);
  const items = {};
  const preparations = {};
  const jobs = [attach("environment", environment), attach("collision", collision)];
  const terminal = new THREE.Group(); terminal.name = "opening-terminal"; terminal.position.set(LEVEL.terminal.x, 0.9, LEVEL.terminal.z); scene.add(terminal); jobs.push(attach("opening-terminal", terminal));
  for (const item of [...SUPPLIES, ...STATIONS.map(station => ({ id: `empty-${station.id}` }))]) {
    const group = new THREE.Group(); group.name = item.id; scene.add(group); items[item.id] = group;
    jobs.push(attach(item.id.startsWith("empty-") ? "empty-box" : item.id, group));
  }
  for (const preparation of PREPARATIONS) {
    const group = new THREE.Group(); group.name = preparation.id; scene.add(group); preparations[preparation.id] = group;
    jobs.push(attach(preparation.id, group));
  }
  addSign(environment, "储物间", [-5.25, 2.4, -0.925]);
  for (const station of STATIONS.slice(0, 3)) addSign(environment, station.name, [station.x + 0.3, 2.4, -0.925]);
  for (const station of STATIONS) addSign(environment, station.name, [station.x, 0.67, station.z + 0.365]);
  for (const supply of SUPPLIES) addSign(environment, supply.name, [supply.x + 0.333, 0.67, supply.z], Math.PI / 2, 0.65);
  addSign(environment, "空盒归还", [LEVEL.returns.x, 0.65, LEVEL.returns.z + 0.36]);
  addSign(environment, "候诊区", [-5.2, 1.8, 4.9], Math.PI);
  const world = { scene, assetRoots: { environment, collision, interactables: items }, items, preparations };
  world.assetReady = Promise.all(jobs).then(results => {
    const shell = document.querySelector("#game-shell");
    if (shell) { shell.dataset.worldAssetsTotal = String(results.length); shell.dataset.worldAssetsLoaded = String(results.filter(result => result.loaded).length); shell.dataset.productionStage = "cardinal-vertical-slice"; shell.dataset.levelRevision = REVISION; }
    return results;
  });
  world.collisionReady = world.assetReady.then(results => results.find(result => result.name === "collision"));
  return world;
}
export function syncClinicVisuals(world, state) {
  for (const [id, root] of Object.entries(world.items)) {
    const item = state.items[id];
    root.visible = item.location !== "carried";
    if (root.visible) root.position.set(item.x, item.y, item.z);
  }
  for (const preparation of PREPARATIONS) {
    const point = state.prepared.includes(preparation.id) ? preparation.destination : preparation;
    const root = world.preparations[preparation.id];
    root.position.set(point.x, 0, point.z);
    root.rotation.y = preparation.id === "chair" && !state.prepared.includes(preparation.id) ? 0.3 : 0;
  }
}
export function createClinicCargoModel() {
  const root = new THREE.Group(); root.userData.models = {};
  root.userData.assetReady = Promise.all([...SUPPLIES.map(item => item.id), "empty-box"].map(id => {
    const group = new THREE.Group(); group.visible = false; root.add(group); root.userData.models[id] = group;
    return attach(id, group);
  }));
  return root;
}
export function setClinicCargoModel(root, state) {
  if (!root?.userData.models) return;
  const selected = state.carriedItem?.startsWith("empty-") ? "empty-box" : state.carriedItem;
  for (const [id, model] of Object.entries(root.userData.models)) model.visible = id === selected;
}
