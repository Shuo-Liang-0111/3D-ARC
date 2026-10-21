from pathlib import Path
root = Path('.')
files = {}
files['game/levels/rf15/scene.js'] = r'''import * as THREE from "three";
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
function variants() {
  const root = new THREE.Group();
  root.userData.variants = {};
  const jobs = [];
  for (const item of PRODUCE) for (const kind of ['crate', 'box']) {
    const variant = new THREE.Group(); variant.visible = false; root.add(variant);
    root.userData.variants[`${item.id}-${kind}`] = variant;
    jobs.push(attach(`${item.id}-${kind}`, variant));
  }
  root.userData.assetReady = Promise.all(jobs);
  return root;
}
function selectVariant(root, item) {
  const selected = `${item.id}-${item.packed ? 'box' : 'crate'}`;
  for (const [key, variant] of Object.entries(root.userData.variants)) variant.visible = key === selected;
}
export function createCargoModel() { const root = variants(); root.userData.robotScale = 1; return root; }
export function syncCargo(robot, state) { if (state.carriedItem) selectVariant(robot.userData.rackPayload, state.items[state.carriedItem]); }
function scaleDisplay() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.38, .143), new THREE.MeshBasicMaterial({ map: texture }));
  mesh.position.set(LEVEL.scale.x, 1.39, LEVEL.scale.z + .06);
  return { canvas, texture, mesh, value: null };
}
export function createScene(renderer) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#c7d7d7'); scene.fog = new THREE.Fog('#c7d7d7', 35, 85);
  scene.add(new THREE.HemisphereLight(0xddeaf1, 0x81745a, 1.9));
  const sun = new THREE.DirectionalLight(0xffe3b5, 2.5); sun.position.set(-12, 18, 9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: .5, far: 60 }); sun.shadow.bias = -.00025; sun.shadow.normalBias = .025; scene.add(sun);
  if (renderer) { const generator = new THREE.PMREMGenerator(renderer); const room = new RoomEnvironment(); const reflection = generator.fromScene(room, .04); scene.environment = reflection.texture; scene.environmentIntensity = .4; scene.userData.reflection = reflection; generator.dispose(); room.dispose(); }
  const environment = new THREE.Group(); scene.add(environment);
  const collision = new THREE.Group(); collision.visible = false; scene.add(collision);
  const tail = new THREE.Group(); tail.position.set(5.3, 0, 1); scene.add(tail);
  const scale = new THREE.Group(); scale.position.set(LEVEL.scale.x, .76, LEVEL.scale.z); scene.add(scale);
  const jack = new THREE.Group(); jack.position.set(1.5, 0, 4.9); scene.add(jack);
  const trees = [[-12, -9], [-12, 7], [11, -10], [17, -11]].map(([x, z], index) => { const tree = new THREE.Group(); tree.position.set(x, 0, z); tree.scale.setScalar(.65); tree.rotation.y = index * 1.4; scene.add(tree); return tree; });
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
'''
files['game/levels/rf15/runtime.js'] = r'''import { LEVEL, PRODUCE } from "./level.js";
export { LEVEL };
export { createInitialState, cloneState, updateMovement, getInteraction, interact, closeTerminal, getObjective, isWalkable } from "./engine.js";
export { createScene, createCargoModel, syncVisuals, syncCargo as syncRobotCargo } from "./scene.js";
export const camera = Object.freeze({ position: [0, 18.5, 16], lookAt: [0, .6, 0], fov: 43 });
export const ui = Object.freeze({ id: "rf15", brand: "乡野合作社 · 冷链装运", unit: "RF-15 · HARVEST TO TRUCK", systemLabel: "出库状态", cargoLabel: "携带", gateLabel: "装车", startKicker: "RF-15 / MORNING HARVEST", startTitle: "采摘入筐<br />称重装车", startCopy: "领取番茄与苹果采摘筐，逐筐称重记录，在包装工位封箱，再操作冷藏车尾板完成装车。最后返回出库台确认清单。", completeKicker: "COLD CHAIN READY", completeTitle: "两箱鲜品 · 装车完成", completeCopy: "番茄 8.6 kg 与苹果 9.4 kg 已称重、封箱并装入冷藏货车。出库记录完成。", terminalHeading: "RF-15 / 装运记录" });
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });
export const eventMessages = Object.freeze({ harvest_started: "先到收货台领取采摘筐", basket_picked: "已拿起，请按任务提示送往下一工位", on_scale: "已放上电子秤，再按 F 记录净重", weight_recorded: "净重已记录，再按 F 取回采摘筐", on_pack: "已放到包装台，按 F 装箱封签", box_sealed: "纸箱已封好，重量标签已贴上", on_tail: "货箱已放上尾板，前往右侧控制按钮", lift_started: "尾板升起，货箱进入冷藏车厢", load_finished: "装车完成，尾板已复位", harvest_complete: "两箱农产品已装车，出库记录完成", empty_interaction: "请靠近并面向任务物品 · 余量 -5", wrong_station: "当前工位不接收此物品 · 余量 -5", weigh_first: "请先称重记录，再到空闲包装工位 · 余量 -5", pack_first: "请先装箱，尾板上同时只能放一箱 · 余量 -5", tail_not_ready: "先将封好的纸箱放到空闲尾板 · 余量 -5", dispatch_not_ready: "两箱农产品尚未全部装车 · 余量 -5", drop_blocked: "前方空间不足，无法放置 · 余量 -5", pickup_blocked: "携带空间不足，请调整站位 · 余量 -5", basket_dropped: "已安全放下，可再次拾取", progress_depleted: "余量耗尽，按 R 重置" });
export function isCarrying(state) { return Boolean(state.carriedItem); }
export function getTelemetry(state) { return { system: state.complete ? "已出库" : state.liftActive ? "尾板运行" : "装运中", systemOnline: state.complete, cargo: state.carriedItem ? state.items[state.carriedItem].name + (state.items[state.carriedItem].packed ? "箱" : "筐") : "空载", gate: `${state.loaded.length}/2 箱` }; }
export function getProgressSteps(state) { return [{ label: `称重记录 ${state.records.length}/2`, done: state.records.length === 2, active: true }, { label: `包装封签 ${PRODUCE.filter(item => state.items[item.id].packed).length}/2`, done: PRODUCE.every(item => state.items[item.id].packed), active: !!state.packItem }, { label: `冷藏车装车 ${state.loaded.length}/2`, done: state.loaded.length === 2, active: state.liftActive }, { label: "出库确认", done: state.complete, active: state.loaded.length === 2 }]; }
export function getTerminal(state) { return { title: "农产品出库清单", copy: "两种农产品分别称重封箱后装车。", rows: [["番茄", "8.6 kg"], ["苹果", "9.4 kg"], ["已装车", `${state.loaded.length}/2`]] }; }
export function getSoundPosition(_before, state) { return state.player; }
export function getDebugState(state) { return { revision: LEVEL.revision, items: state.items, records: state.records, loaded: state.loaded, minimumReserve: state.minimumReserve, distanceMoved: state.distanceMoved }; }
'''
for name, content in files.items(): (root / name).write_text(content)
source=(root/'game/app.js').read_text()
if 'rf15:' not in source:
    source=source.replace('"rf14", "test_zpf"','"rf14", "rf15", "test_zpf"')
    source=source.replace('  rf14: () => import("/game/levels/rf14/runtime.js"),','  rf14: () => import("/game/levels/rf14/runtime.js"),\n  rf15: () => import("/game/levels/rf15/runtime.js"),')
    source=source.replace('  rf14: "收集网球并全部归筐",','  rf14: "收集网球并全部归筐",\n  rf15: "称重、装箱与冷藏车装运",')
    (root/'game/app.js').write_text(source)
assert 'rf15: ()' in source
print('RF15 runtime registered with three minimal entry additions')
