import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { LEVEL, PRODUCE, REVISION, STRUCTURES } from "./level.js";
import { getObjective, getInteraction } from "./engine.js";

const draco = new DRACOLoader(); draco.setDecoderPath("/vendor/draco/"); draco.setWorkerLimit(2);
const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
const cache = new Map();
function attach(name, parent) {
  const url = `/local-assets/levels/rf15/${REVISION}/${name}.glb`;
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url).then(result => result.scene));
  return cache.get(url).then(source => {
    const model = source.clone(true);
    model.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    parent.add(model);
    return { loaded: true, name, url, model };
  }).catch(error => ({ loaded: false, name, url, error: String(error) }));
}
function collisionCheck(result) {
  if (!result.loaded) return result;
  for (const structure of STRUCTURES) {
    const node = result.model.getObjectByName(`COLLIDER_${structure.id}`);
    if (!node || !node.userData.collision) return { ...result, loaded: false, error: `Missing collider ${structure.id}` };
    const bounds = new THREE.Box3().setFromObject(node);
    const minimum = structure.position.map((value, index) => value - structure.size[index] / 2);
    const maximum = structure.position.map((value, index) => value + structure.size[index] / 2);
    if (minimum.some((value, index) => Math.abs(value - bounds.min.toArray()[index]) > 0.005) || maximum.some((value, index) => Math.abs(value - bounds.max.toArray()[index]) > 0.005)) return { ...result, loaded: false, error: `Collider mismatch ${structure.id}` };
  }
  return result;
}
function printedLabel(lines, width, height, background = '#264c3c', foreground = '#f4f1df') {
  const canvas = document.createElement('canvas');
  canvas.width = 1536; canvas.height = Math.round(1536 * height / width);
  const context = canvas.getContext('2d');
  context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = foreground; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.font = `600 ${Math.floor(canvas.height / (lines.length * 1.65))}px sans-serif`;
  lines.forEach((line, index) => context.fillText(line, canvas.width / 2, canvas.height * (index + .5) / lines.length, canvas.width * .94));
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
}
function variants() {
  const root = new THREE.Group();
  root.userData.variants = {};
  const jobs = [];
  for (const item of PRODUCE) for (const kind of ['crate', 'box']) {
    const variant = new THREE.Group(); variant.visible = false; root.add(variant);
    root.userData.variants[`${item.id}-${kind}`] = variant;
    jobs.push(attach(`${item.id}-${kind}`, variant));
    if (kind === 'box') {
      const label = printedLabel([`${item.name} ${item.code}  ${item.weight.toFixed(1)} kg`, '乡野合作社 · 鲜品'], .35, .16, '#f1eee2', '#24523e');
      label.position.set(0, .22, .226); variant.add(label);
    }
  }
  root.userData.assetReady = Promise.all(jobs);
  return root;
}
function selectVariant(root, item) {
  const selected = `${item.id}-${item.packed ? 'box' : 'crate'}`;
  for (const [key, variant] of Object.entries(root.userData.variants)) variant.visible = key === selected;
}
export function createCargoModel() {
  const root = variants();
  root.userData.robotScale = 1;
  for (const variant of Object.values(root.userData.variants)) variant.position.y = -.25;
  return root;
}
export function syncCargo(robot, state) { if (state.carriedItem) selectVariant(robot.userData.rackPayload, state.items[state.carriedItem]); }
function scaleDisplay() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.16, .09), new THREE.MeshBasicMaterial({ map: texture }));
  mesh.position.set(LEVEL.scale.x, 1.55, LEVEL.scale.z - .205);
  return { canvas, texture, mesh, value: null };
}
export function createScene(renderer) {
  if (new URLSearchParams(location.search).get('qa') === 'rf15') import('./qa.js').then(module => module.installRouteQA());
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#c7d7d7'); scene.fog = new THREE.Fog('#c7d7d7', 35, 85);
  scene.add(new THREE.HemisphereLight(0xddeaf1, 0x81745a, 1.9));
  const sun = new THREE.DirectionalLight(0xffe3b5, 2.5); sun.position.set(-12, 18, 9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: .5, far: 60 }); sun.shadow.bias = -.00025; sun.shadow.normalBias = .025; scene.add(sun);
  if (renderer) { const generator = new THREE.PMREMGenerator(renderer); const room = new RoomEnvironment(); const reflection = generator.fromScene(room, .04); scene.environment = reflection.texture; scene.environmentIntensity = .4; scene.userData.reflection = reflection; generator.dispose(); room.dispose(); }
  const environment = new THREE.Group(); scene.add(environment);
  const collision = new THREE.Group(); collision.visible = false; scene.add(collision);
  const tail = new THREE.Group(); tail.position.set(5.3, 0, 1); scene.add(tail);
  const scale = new THREE.Group(); scale.position.set(LEVEL.scale.x, .76, LEVEL.scale.z); scale.rotation.y = -Math.PI / 2; scene.add(scale);
  const jack = new THREE.Group(); jack.position.set(1.5, 0, 4.9); scene.add(jack);
  const trees = [[-12, -9], [-12, 7], [11, -10], [17, -11]].map(([x, z], index) => { const tree = new THREE.Group(); tree.position.set(x, 0, z); tree.scale.setScalar(.65); tree.rotation.y = index * 1.4; scene.add(tree); return tree; });
  for (const sign of [
    { lines: ['01  收货 · 新鲜农产品'], size: [3.38, .42], position: [-5.9, 1.98, -5.908] },
    { lines: ['02  电子称重'], size: [1.39, .29], position: [-2.6, 1.60, -4.798] },
    { lines: ['03  装箱封签'], size: [1.39, .29], position: [.6, 1.60, -4.798] },
    { lines: ['乡野合作社 · 冷链装运站'], size: [6.48, .53], position: [-3.3, 3.91, 1.92] },
    { lines: ['冷链鲜达  02—08°C'], size: [2.35, .27], position: [5.3, 2.87, .158] },
  ]) {
    const label = printedLabel(sign.lines, ...sign.size); label.position.set(...sign.position); scene.add(label);
  }
  const display = scaleDisplay(); scene.add(display.mesh);
  const cargo = createCargoModel();
  const items = Object.fromEntries(PRODUCE.map(item => { const model = variants(); scene.add(model); return [item.id, model]; }));
  const jobs = [attach('rf15_final', environment), attach('rf15_collision', collision).then(collisionCheck), attach('tail-lift', tail), attach('platform-scale', scale), attach('pallet-jack', jack), ...trees.map(tree => attach('plane-tree', tree)), ...Object.values(items).map(model => model.userData.assetReady), cargo.userData.assetReady];
  const note = document.createElement('p'); note.id = 'rf15-task-instruction'; note.style.cssText = 'font-size:12px;line-height:1.6;color:#d0d9b9;margin:10px 0 0;max-width:34em'; document.querySelector('.mission-panel')?.append(note);
  const world = { scene, items, tail, display, note, cargo, assetRoots: { environment, collision, scale, jack }, frames: 0, startedAt: performance.now(), fps: 0 };
  world.assetReady = Promise.all(jobs).then(results => {
    const flat = results.flat();
    const shell = document.querySelector('#game-shell');
    if (shell) { shell.dataset.levelRevision = REVISION; shell.dataset.worldAssetErrors = JSON.stringify(flat.filter(result => !result.loaded).map(result => ({ name: result.name, error: result.error }))); shell.dataset.worldAssetsLoaded = String(flat.filter(result => result.loaded).length); shell.dataset.worldAssetsTotal = String(flat.length); }
    return flat;
  });
  world.collisionReady = world.assetReady.then(results => results.find(result => result.name === 'rf15_collision'));
  return world;
}
export function syncVisuals(world, state) {
  const raised = state.liftActive ? Math.min(state.liftTime / 2.3, 1) * .88 : 0;
  world.tail.position.y = raised;
  for (const [id, model] of Object.entries(world.items)) {
    const item = state.items[id]; model.visible = item.location !== 'carried'; selectVariant(model, item);
    model.position.set(item.x, item.y, item.z);
    if (item.location === 'tail') { model.position.y += raised; if (state.liftTime > 2.3) model.position.z -= (state.liftTime - 2.3) / 1.7 * 2.65; }
  }
  const reading = state.scaleItem ? `${state.items[state.scaleItem].weight.toFixed(1)} kg` : '0.0 kg';
  if (reading !== world.display.value) { const context = world.display.canvas.getContext('2d'); context.fillStyle = '#142922'; context.fillRect(0, 0, 512, 192); context.fillStyle = '#b3e681'; context.font = 'bold 92px monospace'; context.textAlign = 'center'; context.fillText(reading, 256, 134); world.display.texture.needsUpdate = true; world.display.value = reading; }
  const directive = getObjective(state); const interaction = getInteraction(state);
  const copy = `${directive.title} · ${directive.detail}${interaction ? '  [F] ' + interaction.label : ''}`;
  if (world.note.textContent !== copy) world.note.textContent = copy;
  const shell = document.querySelector('#game-shell');
  if (shell) {
    shell.dataset.rf15State = JSON.stringify({ player: state.player, carriedItem: state.carriedItem, scaleItem: state.scaleItem, packItem: state.packItem, loaded: state.loaded, liftActive: state.liftActive, progress: state.progress, lastEvent: state.lastEvent, errors: state.errors });
    world.frames += 1; const duration = performance.now() - world.startedAt;
    if (duration > 2000) { world.fps = Math.round(world.frames * 1000 / duration); shell.dataset.rf15Fps = String(world.fps); world.frames = 0; world.startedAt = performance.now(); }
  }
}
