import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { mountClinicReviewMetrics } from "./review-metrics.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { LEVEL, STATIONS, SUPPLIES, PREPARATIONS, REVISION } from "./level.js";

const decoder = new DRACOLoader();
decoder.setDecoderPath("/vendor/draco/");
decoder.setWorkerLimit(2);
const loader = new GLTFLoader();
loader.setDRACOLoader(decoder);
const cache = new Map();
function assetUrl(name, revision) {
  if (!/^[a-z0-9.-]+$/.test(revision)) throw new Error("Invalid clinic asset revision");
  return `/local-assets/levels/rf13/${revision}/${name}.glb`;
}
function fetchModel(name, revision) {
  const url = assetUrl(name, revision);
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url).then(gltf => gltf.scene));
  return cache.get(url);
}
function attach(name, parent, revision) {
  return fetchModel(name, revision).then(source => {
    const model = source.clone(true);
    model.traverse(object => {
      if (!object.isMesh) return;
      let ceilingAncestor = object;
      while (ceilingAncestor && !ceilingAncestor.userData.cutawayCeiling) ceilingAncestor = ceilingAncestor.parent;
      const cutawayCeiling = Boolean(ceilingAncestor);
      object.castShadow = !cutawayCeiling;
      object.receiveShadow = true;
      if (cutawayCeiling) {
        const materials = (Array.isArray(object.material) ? object.material : [object.material]).map(material => {
          const copy = material.clone();
          copy.side = THREE.FrontSide;
          return copy;
        });
        object.material = Array.isArray(object.material) ? materials : materials[0];
      }
    });
    parent.add(model);
    return { loaded: true, name, url: assetUrl(name, revision), model };
  }).catch(error => ({ loaded: false, name, url: assetUrl(name, revision), error: String(error) }));
}
function addSign(parent, text, position, yaw = 0, width = 1.2, subtitle = "") {
  const canvas = document.createElement("canvas");
  canvas.width = 768; canvas.height = 176;
  const context = canvas.getContext("2d");
  context.fillStyle = "#f5f3e9"; context.fillRect(0, 0, 768, 176);
  context.fillStyle = "#527b70"; context.fillRect(0, 0, 18, 176);
  context.textAlign = "center";
  context.fillStyle = "#2e5048";
  context.font = "500 61px sans-serif"; context.fillText(text, 395, subtitle ? 91 : 112);
  if (subtitle) { context.font = "21px sans-serif"; context.fillStyle = "#6c7970"; context.fillText(subtitle, 395, 141); }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 176 / 768), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.72, side: THREE.DoubleSide }));
  mesh.position.set(...position); mesh.rotation.y = yaw; parent.add(mesh);
}
function addHealthBoard(parent) {
  const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 720;
  const context = canvas.getContext("2d");
  context.fillStyle = "#f2f0e7"; context.fillRect(0, 0, 1200, 720);
  context.fillStyle = "#436a61"; context.fillRect(0, 0, 1200, 144);
  context.fillStyle = "#fffdf3"; context.font = "bold 56px sans-serif"; context.fillText("社区健康 · 从日常做起", 52, 93);
  const cards = [["勤洗手", "保持双手清洁"], ["常通风", "营造舒适环境"], ["规律生活", "适量活动与休息"]];
  cards.forEach(([title, detail], index) => {
    const left = 48 + index * 382;
    context.fillStyle = "#dce7dd"; context.fillRect(left, 190, 344, 420);
    context.strokeStyle = "#658c7d"; context.lineWidth = 8;
    context.beginPath(); context.arc(left + 172, 308, 56, 0, Math.PI * 2); context.stroke();
    context.fillStyle = "#436a61"; context.font = "46px sans-serif"; context.textAlign = "center";
    context.fillText(String(index + 1).padStart(2, "0"), left + 172, 324);
    context.font = "bold 38px sans-serif"; context.fillText(title, left + 172, 440);
    context.font = "25px sans-serif"; context.fillText(detail, left + 172, 508);
  });
  context.textAlign = "left"; context.font = "25px sans-serif"; context.fillStyle = "#667b6f"; context.fillText("社区卫生服务中心  /  健康宣传栏", 52, 668);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.59, 0.954), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 }));
  mesh.position.set(-6.832, 1.73, 2.4); mesh.rotation.y = Math.PI / 2; parent.add(mesh);
}
function addEyeChart(parent, position) {
  const canvas = document.createElement("canvas"); canvas.width = 384; canvas.height = 540;
  const context = canvas.getContext("2d"); context.fillStyle = "#f7f6ec"; context.fillRect(0, 0, 384, 540);
  context.fillStyle = "#30433d"; context.textAlign = "center"; context.font = "23px sans-serif"; context.fillText("视 力 表", 192, 40);
  for (let row = 0; row < 7; row += 1) {
    const size = 75 - row * 9;
    for (let column = 0; column < Math.min(row + 1, 5); column += 1) {
      const count = Math.min(row + 1, 5);
      context.save(); context.translate(192 + (column - (count - 1) / 2) * (size + 20), 105 + row * 57);
      context.rotate(((row * 3 + column) % 4) * Math.PI / 2); context.font = `bold ${size}px sans-serif`; context.fillText("E", 0, size / 3); context.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.44), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
  mesh.position.set(...position); parent.add(mesh);
}
export function createClinicScene(renderer, revision = REVISION) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#b8c5c1");
  if (renderer) {
    mountClinicReviewMetrics(renderer);
    const generator = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const reflection = generator.fromScene(room, 0.04);
    scene.environment = reflection.texture;
    scene.environmentIntensity = 0.35;
    scene.userData.reflectionTarget = reflection;
    room.dispose(); generator.dispose();
  }
  scene.add(new THREE.HemisphereLight(0xfffbf3, 0x84978b, 0.6));
  const sun = new THREE.DirectionalLight(0xfff7e8, 1.2);
  sun.position.set(-3, 7, -10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 10, bottom: -10, near: 0.5, far: 35 });
  sun.shadow.normalBias = 0.012; sun.shadow.bias = -0.00015; sun.shadow.radius = 3; scene.add(sun);
  for (const [positionX, positionZ] of [[-5.25, -3], [-1.75, -3], [1.75, -3], [5.25, -3], [-3.5, 2], [3.5, 2], [0, 0.1]]) {
    const light = new THREE.PointLight(0xfff4e0, 4.5, 6, 2);
    light.position.set(positionX, 2.55, positionZ); scene.add(light);
  }
  const environment = new THREE.Group(); environment.name = "RF13_ENVIRONMENT"; scene.add(environment);
  const collision = new THREE.Group(); collision.name = "RF13_COLLISION_HIDDEN"; collision.visible = false; scene.add(collision);
  const items = {};
  const preparations = {};
  const jobs = [attach("environment", environment, revision), attach("collision", collision, revision)];
  const terminal = new THREE.Group(); terminal.name = "opening-terminal"; terminal.position.set(LEVEL.terminal.x, 0.9, LEVEL.terminal.z); scene.add(terminal); jobs.push(attach("opening-terminal", terminal, revision));
  for (const item of [...SUPPLIES, ...STATIONS.map(station => ({ id: `empty-${station.id}` }))]) {
    const group = new THREE.Group(); group.name = item.id; scene.add(group); items[item.id] = group;
    jobs.push(attach(item.id.startsWith("empty-") ? "empty-box" : item.id, group, revision));
  }
  for (const preparation of PREPARATIONS) {
    const group = new THREE.Group(); group.name = preparation.id; scene.add(group); preparations[preparation.id] = group;
    jobs.push(attach(preparation.id, group, revision));
  }
  addSign(environment, "储物间", [-5.25, 2.53, -0.925], 0, 1.15, "SUPPLIES");
  for (const [index, station] of STATIONS.slice(0, 3).entries()) addSign(environment, station.name, [station.x + 0.3, 2.53, -0.925], 0, 1.15, `${String(index + 1).padStart(2, "0")}  /  CONSULTATION`);
  for (const station of STATIONS) addSign(environment, station.name, [station.x, 0.64, station.z + 0.375], 0, 0.7);
  for (const supply of SUPPLIES) addSign(environment, supply.name, [supply.x + 0.337, 0.67, supply.z], Math.PI / 2, 0.6);
  addSign(environment, "空盒归还", [LEVEL.returns.x, 0.65, LEVEL.returns.z + 0.36], 0, 0.8);
  addSign(environment, "候诊区", [-5.2, 1.8, 4.90], Math.PI, 1.2, "WAITING AREA");
  addHealthBoard(environment);
  for (const positionX of [-2.88, 0.62, 4.12]) addEyeChart(environment, [positionX, 1.66, -4.876]);
  const world = { scene, assetRoots: { environment, collision, interactables: items }, items, preparations };
  world.assetReady = Promise.all(jobs).then(results => {
    const shell = document.querySelector("#game-shell");
    if (shell) { shell.dataset.worldAssetsTotal = String(results.length); shell.dataset.worldAssetsLoaded = String(results.filter(result => result.loaded).length); shell.dataset.productionStage = "integrated-realism"; shell.dataset.levelRevision = revision; }
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
export function createClinicCargoModel(revision = REVISION) {
  const root = new THREE.Group(); root.userData.models = {}; root.userData.robotScale = 1;
  root.userData.assetReady = Promise.all([...SUPPLIES.map(item => item.id), "empty-box"].map(id => {
    const group = new THREE.Group(); group.visible = false; root.add(group); root.userData.models[id] = group;
    return attach(id, group, revision);
  }));
  return root;
}
export function setClinicCargoModel(root, state) {
  if (!root?.userData.models) return;
  const selected = state.carriedItem?.startsWith("empty-") ? "empty-box" : state.carriedItem;
  for (const [id, model] of Object.entries(root.userData.models)) model.visible = id === selected;
}
