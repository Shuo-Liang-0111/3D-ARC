import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { ORANGE_ID, ORANGE_TASK } from './orange-task.js';

const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/vendor/draco/').setWorkerLimit(2));
export function orangeSlot(index) {
  return new THREE.Vector3((index % 4 - 1.5) * .105, .065 + Math.floor(index / 12) * .085, (Math.floor(index / 4) % 3 - 1) * .10);
}
function fit(model, width, height, depth) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
  const wrapper = new THREE.Group();
  model.position.sub(new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, bounds.min.y, (bounds.min.z + bounds.max.z) / 2));
  wrapper.add(model); wrapper.scale.set(width / size.x, height / size.y, depth / size.z);
  model.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
  return wrapper;
}
function label(text, width, height) {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 256;
  const context = canvas.getContext('2d'); context.fillStyle = '#f1e6c9'; context.fillRect(0, 0, 768, 256);
  context.fillStyle = '#263b26'; context.font = 'bold 76px sans-serif'; context.textAlign = 'center';
  context.fillText(text, 384, 108); context.font = '38px sans-serif'; context.fillText('乡野合作社 · 净重 5 kg', 384, 195);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: .9 }));
}
export function installOrangeStation(world) {
  world.assetRoots.scale.position.z = ORANGE_TASK.scale.z;
  const root = new THREE.Group(); root.name = 'orange-weighing-station'; world.scene.add(root);
  const shipment = new THREE.Group(); shipment.position.set(...Object.values(ORANGE_TASK.home)); root.add(shipment);
  const basket = new THREE.Group(), fruit = new THREE.Group(), carton = new THREE.Group();
  shipment.add(basket, fruit, carton); carton.visible = false;
  const supply = new THREE.Group(); supply.position.set(ORANGE_TASK.source.x, .76, ORANGE_TASK.source.z); root.add(supply);
  const moving = new THREE.Group(); moving.visible = false; root.add(moving);
  const empty = new THREE.Group(); empty.visible = false; empty.position.set(ORANGE_TASK.pack.x, ORANGE_TASK.pack.y, ORANGE_TASK.pack.z); root.add(empty);
  const displayCanvas = document.createElement('canvas'); displayCanvas.width = 1024; displayCanvas.height = 400;
  const displayTexture = new THREE.CanvasTexture(displayCanvas); displayTexture.colorSpace = THREE.SRGBColorSpace;
  const housing = new THREE.Mesh(new THREE.BoxGeometry(.34, .18, .055), new THREE.MeshStandardMaterial({ color: '#243b35', roughness: .5, metalness: .5 }));
  // The generated readout is mounted on the front face of the physical platform scale.
  // Keep it below the work-surface sightline so it cannot float above the station sign.
  housing.position.set(ORANGE_TASK.scale.x, 1.00, ORANGE_TASK.scale.z + .305); root.add(housing);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.30, .13), new THREE.MeshBasicMaterial({ map: displayTexture }));
  screen.position.set(ORANGE_TASK.scale.x, 1.00, ORANGE_TASK.scale.z + .338); root.add(screen);
  world.display.mesh.visible = false;
  const station = { root, shipment, basket, fruit, carton, supply, moving, empty, displayCanvas, displayTexture, value: null, fruits: [], sourceFruits: [], active: false };
  world.orange = station;
  const previous = world.assetReady;
  const assets = [
    ['orange', '/local-assets/levels/rf15/orange-v1/orange.glb'],
    ['basket', '/local-assets/levels/rf15/cardinal-field-v2/basket.glb'],
    ['carton', '/local-assets/levels/rf15/realism-v0.4.3/tomato-box.glb'],
  ];
  world.assetReady = Promise.all([previous, Promise.all(assets.map(async ([name, url]) => {
    try {
      const model = (await loader.loadAsync(url)).scene;
      if (name === 'orange') {
        for (let index = 0; index < ORANGE_TASK.count; index++) {
          const orange = fit(model.clone(true), .089, .087, .087);
          orange.position.copy(orangeSlot(index)); orange.rotation.y = index * 1.91; fruit.add(orange); station.fruits.push(orange);
          const sourceOrange = fit(model.clone(true), .089, .087, .087);
          sourceOrange.position.set((index % 3 - 1) * .094, .05 + Math.floor(index / 6) * .07, (Math.floor(index / 3) % 2 - .5) * .10);
          sourceOrange.rotation.y = index * .93; supply.add(sourceOrange); station.sourceFruits.push(sourceOrange);
        }
        const movingOrange = fit(model.clone(true), .089, .087, .087); movingOrange.position.y = -.0435; moving.add(movingOrange);
      }
      if (name === 'basket') {
        basket.add(fit(model.clone(true), .56, .24, .40));
        empty.add(fit(model.clone(true), .56, .24, .40));
        supply.add(fit(model.clone(true), .32, .12, .27));
      }
      if (name === 'carton') {
        carton.add(fit(model, .55, .34, .40));
        const sticker = label('鲜橙 · 20 枚', .37, .13); sticker.position.set(0, .20, .202); carton.add(sticker);
        const topSticker = label('鲜橙 · 20 枚', .32, .11); topSticker.rotation.x = -Math.PI / 2; topSticker.position.set(0, .342, 0); carton.add(topSticker);
      }
      return { name: 'orange-station-' + name, url, loaded: true };
    } catch (error) { return { name: 'orange-station-' + name, url, loaded: false, error: String(error) }; }
  }))]).then(([base, added]) => {
    const results = [...base, ...added], shell = document.querySelector('#game-shell');
    if (shell) {
      shell.dataset.worldAssetErrors = JSON.stringify(results.filter(result => !result.loaded));
      shell.dataset.worldAssetsLoaded = String(results.filter(result => result.loaded).length);
      shell.dataset.worldAssetsTotal = String(results.length);
    }
    return results;
  });
}
export function syncOrangeStation(world, state) {
  const station = world.orange, item = state.items[ORANGE_ID];
  if (!station || !item) return;
  if (!station.active) {
    station.shipment.position.set(item.x, item.y, item.z); station.shipment.rotation.set(0, 0, 0);
    station.moving.visible = false;
  }
  station.basket.visible = !item.packed; station.fruit.visible = !item.packed; station.carton.visible = item.packed;
  station.empty.visible = item.packed;
  station.fruits.forEach((orange, index) => { orange.visible = index < item.orangeCount; });
  station.sourceFruits.forEach((orange, index) => { orange.visible = index >= item.orangeCount; });
  const reading = state.scaleItem ? state.weight || 0 : 0;
  const value = reading.toFixed(2);
  if (station.value !== value) {
    const context = station.displayCanvas.getContext('2d');
    context.fillStyle = '#0d2019'; context.fillRect(0, 0, 1024, 400);
    context.fillStyle = '#c1f7a6'; context.textAlign = 'right'; context.font = 'bold 228px monospace';
    context.fillText(value, 850, 284);
    context.font = '48px sans-serif'; context.fillText('kg', 986, 283);
    context.textAlign = 'left'; context.font = '40px sans-serif'; context.fillText('NET 净重', 34, 62);
    context.font = '35px sans-serif'; context.fillText('已去皮 · 单果 250 g', 34, 367);
    station.displayTexture.needsUpdate = true; station.value = value;
  }
  const shell = document.querySelector('#game-shell');
  if (shell) shell.dataset.rf15Orange = JSON.stringify({ revision: ORANGE_TASK.revision, count: item.orangeCount, grams: item.orangeCount * ORANGE_TASK.gramsEach, display: value + ' kg', stable: item.stable, weighing: item.weighing, weighElapsed: item.weighElapsed, location: item.location, packed: item.packed, carried: state.carriedItem === ORANGE_ID, loaded: state.loaded.includes(ORANGE_ID), complete: state.complete });
}
