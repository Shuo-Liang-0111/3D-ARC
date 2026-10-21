import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { LEVEL, BALLS, REVISION, STRUCTURES, UMPIRE_CHAIR } from "./level.js";
import { mountCourtMetrics } from "./review-metrics.js";

const decoder = new DRACOLoader();
decoder.setDecoderPath("/vendor/draco/");
decoder.setWorkerLimit(2);
const loader = new GLTFLoader();
loader.setDRACOLoader(decoder);
const cache = new Map();
function attach(name, parent, revision) {
  const url = `/local-assets/levels/rf14/${revision}/${name}.glb`;
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url).then(gltf => gltf.scene));
  return cache.get(url).then(source => {
    const model = source.clone(true);
    model.traverse(object => { if (object.isMesh) { object.castShadow = !/acrylic|marking|paving|lawn/.test(object.name); object.receiveShadow = true; } });
    parent.add(model);
    return { loaded: true, name, url, model };
  }).catch(error => ({ loaded: false, name, url, error: String(error) }));
}
function validateCollision(result) {
  if (!result.loaded) return result;
  result.model.updateMatrixWorld(true);
  for (const structure of STRUCTURES) {
    let node;
    result.model.traverse(object => { if (object.name === `COLLIDER_${structure.id}` || object.userData.name === `COLLIDER_${structure.id}`) node = object; });
    if (!node || node.userData.collision !== true) return { ...result, loaded: false, error: `Missing collider ${structure.id}` };
    const bounds = new THREE.Box3().setFromObject(node);
    const expectedMin = structure.position.map((value, index) => value - structure.size[index] / 2);
    const expectedMax = structure.position.map((value, index) => value + structure.size[index] / 2);
    if (bounds.min.toArray().some((value, index) => Math.abs(value - expectedMin[index]) > 0.005) || bounds.max.toArray().some((value, index) => Math.abs(value - expectedMax[index]) > 0.005)) return { ...result, loaded: false, error: `Collider bounds mismatch ${structure.id}` };
  }
  return result;
}
export function createCourtScene(renderer, revision = REVISION) {
  const upgraded = !['graybox-v0.1', 'realism-v0.1', 'realism-v0.2', 'realism-v0.3'].includes(revision);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#a9cce0");
  scene.fog = new THREE.Fog("#a9cce0", 55, 110);
  if (upgraded) {
    scene.fog = new THREE.Fog('#c6d7d9', 55, 140);
  }
  if (renderer) {
    mountCourtMetrics(renderer);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const generator = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const reflection = generator.fromScene(room, 0.04);
    scene.environment = reflection.texture;
    scene.environmentIntensity = 0.45;
    scene.userData.reflectionTarget = reflection;
    room.dispose(); generator.dispose();
  }
  scene.add(new THREE.HemisphereLight(0xe4f3ff, 0x718369, 1.6));
  const sun = new THREE.DirectionalLight(0xfff3d8, 2.8);
  sun.position.set(-16, 25, 12); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 28, bottom: -28, near: 0.5, far: 75 });
  sun.shadow.normalBias = 0.04; sun.shadow.bias = -0.0008; sun.shadow.radius = 2;
  scene.add(sun);
  const environment = new THREE.Group(); environment.name = "RF14_ENVIRONMENT"; scene.add(environment);
  const collision = new THREE.Group(); collision.name = "RF14_COLLISION"; collision.visible = false; scene.add(collision);
  const items = {};
  const jobs = [attach("environment", environment, revision), attach("collision", collision, revision).then(validateCollision)];
  if (upgraded && !['realism-v0.4', 'realism-v0.4.1', 'realism-v0.4.2'].includes(revision)) {
    jobs.push(new RGBELoader().loadAsync(`/local-assets/levels/rf14/${revision}/daylight.hdr`).then(texture => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = texture;
      scene.backgroundIntensity = 0.32;
      scene.environment = texture;
      scene.environmentIntensity = 0.5;
      return { loaded: true, name: 'daylight' };
    }).catch(error => ({ loaded: false, name: 'daylight', error: String(error) })));
  }
  if (upgraded) {
    const chair = new THREE.Group(); chair.name = 'umpire-chair'; chair.position.set(UMPIRE_CHAIR.x, 0, UMPIRE_CHAIR.z); chair.rotation.y = UMPIRE_CHAIR.yaw; scene.add(chair);
    jobs.push(attach('umpire-chair', chair, revision));
    for (const side of [-1, 1]) for (let index = 0; index < 5; index += 1) {
      const tree = new THREE.Group(); tree.position.set(side * 13.3, -0.11, -21 + index * 10.5); tree.rotation.y = index * 1.61 + side; tree.scale.setScalar(0.95 + index % 3 * 0.09); scene.add(tree);
      jobs.push(attach('plane-tree', tree, revision));
    }
    for (const side of [-1, 1]) for (let index = 0; index < 8; index += 1) {
      const screen = new THREE.Group(); screen.position.set(-8.6 + index * 2.45, 0.4, side * 18.94); scene.add(screen);
      if (side > 0 && Math.abs(screen.position.x) < 2.5) { scene.remove(screen); continue; }
      jobs.push(attach('windscreen', screen, revision));
    }
  }
  const cart = new THREE.Group(); cart.name = "collection-cart"; cart.position.set(LEVEL.cart.x, 0, LEVEL.cart.z); scene.add(cart);
  jobs.push(attach("cart", cart, revision));
  if (!revision.startsWith("graybox") && revision !== "realism-v0.1") {
    const bench = new THREE.Group(); bench.name = "court-bench"; bench.position.set(8.5, 0, 4.5); bench.rotation.y = Math.PI / 2; scene.add(bench);
    jobs.push(attach("court-bench", bench, revision));
    const bag = new THREE.Group(); bag.name = "tennis-bag"; bag.position.set(8.5, 0, 5.5); scene.add(bag);
    jobs.push(attach("tennis-bag", bag, revision));
  }
  for (const ball of BALLS) {
    const root = new THREE.Group(); root.name = ball.id; scene.add(root); items[ball.id] = root;
    jobs.push(attach("ball", root, revision));
  }
  const world = { scene, items, cart, assetRoots: { environment, collision, interactables: items } };
  world.assetReady = Promise.all(jobs).then(results => {
    const shell = document.querySelector("#game-shell");
    if (shell) { shell.dataset.worldAssetsTotal = String(results.length); shell.dataset.worldAssetsLoaded = String(results.filter(result => result.loaded).length); shell.dataset.worldAssetErrors = JSON.stringify(results.filter(result => !result.loaded).map(result => ({ name: result.name, error: result.error }))); shell.dataset.levelRevision = revision; shell.dataset.productionStage = revision.startsWith("graybox") ? "graybox" : "integrated-realism"; }
    return results;
  });
  world.collisionReady = world.assetReady.then(results => results.find(result => result.name === "collision"));
  return world;
}
export function syncCourtVisuals(world, state) {
  for (const [id, root] of Object.entries(world.items)) {
    const item = state.items[id];
    root.visible = item.location !== "carried";
    root.position.set(item.x, item.y, item.z);
  }
}
export function createCourtCargoModel() {
  const root = new THREE.Group();
  root.userData.robotScale = 1;
  root.userData.assetReady = attach("ball", root, REVISION).then(result => [result]);
  return root;
}
