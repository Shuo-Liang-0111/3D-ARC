import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { FIELD, FIELD_CROPS, FIELD_REVISION, SHARED_PRODUCE } from "./field-layout.js";

const decoder = new DRACOLoader();
decoder.setDecoderPath("/vendor/draco/");
decoder.setWorkerLimit(2);
const loader = new GLTFLoader().setDRACOLoader(decoder);
const cache = new Map();
function attach(kind, parent) {
  const url = `/local-assets/levels/rf15/${FIELD_REVISION}/${kind}.glb`;
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  return cache.get(url).then(asset => {
    const model = asset.scene.clone(true);
    model.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
    parent.add(model);
    return { loaded: true, name: `field-${kind}`, url, model };
  }).catch(error => ({ loaded: false, name: `field-${kind}`, url, error: String(error) }));
}
function anchor(parent, point) {
  const group = new THREE.Group();
  group.position.set(point.x || 0, point.y || 0, point.z || 0);
  parent.add(group);
  return group;
}
function produceCrate(parent, kind, jobs) {
  jobs.push(attach("basket", parent));
  for (const [x, z] of [[-.13, -.08], [.13, -.08], [0, .09]]) {
    const plant = anchor(parent, { x, y: .08, z });
    plant.scale.setScalar(.56);
    jobs.push(attach(kind, plant));
  }
}
export function installField(world) {
  if (new URLSearchParams(location.search).get("qa") === "field") import("./field-qa.js").then(module => module.installFieldQA());
  const root = new THREE.Group(); root.name = "CARDINAL-compact-vegetable-field"; world.scene.add(root);
  const crops = {};
  const deposited = {};
  const produce = {};
  const basket = anchor(root, FIELD.basket);
  const jobs = [attach("field", root), attach("basket", basket)];
  for (const crop of FIELD_CROPS) {
    const plant = anchor(root, crop); plant.rotation.y = crop.rotation; crops[crop.id] = plant;
    jobs.push(attach(crop.kind, plant));
    const collected = anchor(root, FIELD.basket); collected.visible = false; collected.scale.setScalar(.5); deposited[crop.id] = collected;
    jobs.push(attach(crop.kind, collected));
  }
  for (const item of SHARED_PRODUCE) {
    // These legacy shared crates remain in the state contract for old routes,
    // but the visible station now uses the dedicated orange basket and field
    // collection basket. Do not render the duplicate floating crate group.
    const container = anchor(world.scene, item); container.visible = false; produce[item.id] = container;
  }
  world.field = { crops, deposited, produce, basket };
  const previous = world.assetReady;
  world.assetReady = Promise.all([previous, Promise.all(jobs)]).then(([base, added]) => {
    const fieldAsset = added.find(asset => asset.name === "field-field");
    fieldAsset?.model.traverse(node => {
      const match = /^soil-bed-(\d+)$/.exec(node.name);
      if (!match || !node.geometry) return;
      const bed = FIELD.beds[Number(match[1])];
      node.geometry = node.geometry.clone();
      node.geometry.computeBoundingBox();
      const center = node.geometry.boundingBox.getCenter(new THREE.Vector3());
      const width = node.geometry.boundingBox.max.x - node.geometry.boundingBox.min.x;
      node.geometry.translate(-center.x, 0, 0).scale(bed.width / width, 1, 1).translate(center.x, 0, 0);
      node.geometry.computeBoundingBox();
    });
    if (added.every(asset => asset.loaded)) world.assetRoots.environment.traverse(node => {
      if (["REFINED_field-earth", "REFINED_cabbage-leaf"].includes(node.name)) node.visible = false;
    });
    if (added.every(asset => asset.loaded)) {
      world.field.cuttingKnife = world.toolRoom.tools["harvest-knife"].children[0].clone(true);
      world.field.cuttingKnife.visible = false;
      world.scene.add(world.field.cuttingKnife);
    }
    const results = [...base, ...added];
    const shell = document.querySelector("#game-shell");
    if (shell) {
      shell.dataset.fieldRevision = FIELD_REVISION;
      shell.dataset.worldAssetErrors = JSON.stringify(results.filter(asset => !asset.loaded));
      shell.dataset.worldAssetsLoaded = String(results.filter(asset => asset.loaded).length);
      shell.dataset.worldAssetsTotal = String(results.length);
    }
    return results;
  });
}
export function syncField(world, state) {
  if (!state.crops) return;
  for (const crop of FIELD_CROPS) {
    world.field.crops[crop.id].visible = state.crops[crop.id].location === "field";
    world.field.crops[crop.id].rotation.z = state.cuttingCrop === crop.id ? Math.sin(state.cutElapsed * 8) * .08 : 0;
    const collected = world.field.deposited[crop.id];
    const index = state.harvested.indexOf(crop.id);
    collected.visible = index >= 0;
    collected.position.set(FIELD.basket.x + (index % 2 - .5) * .2, .07 + Math.floor(index / 4) * .085, FIELD.basket.z + (Math.floor(index / 2) % 2 - .5) * .14);
  }
  if (world.field.cuttingKnife) {
    const crop = state.crops[state.cuttingCrop];
    world.field.cuttingKnife.visible = Boolean(crop);
    if (crop) {
      world.field.cuttingKnife.position.set(crop.x + .12 - state.cutElapsed * .32, crop.y + .08, crop.z);
      world.field.cuttingKnife.rotation.y = -Math.PI / 2 + Math.sin(state.cutElapsed * Math.PI / .7) * .6;
    }
  }
  for (const [id, model] of Object.entries(world.field.produce)) {
    const item = state.items[id];
    model.visible = false;
    model.position.set(item.x, item.y, item.z);
    world.items[id].visible = false;
  }
  const shell = document.querySelector("#game-shell");
  if (shell) shell.dataset.fieldState = JSON.stringify({ crops: Object.values(state.crops).map(crop => ({ id: crop.id, location: crop.location })), harvested: state.harvested, carried: state.carriedCrop, heldTool: state.heldTool, player: state.player, complete: state.complete });
}
export function installFieldCargo(root) {
  const jobs = [];
  const plants = {};
  const crates = {};
  for (const kind of ["lettuce", "bok-choy"]) {
    const plant = anchor(root, { y: -.22 }); plant.visible = false; plants[kind] = plant; jobs.push(attach(kind, plant));
    const crate = anchor(root, { y: -.25 }); crate.visible = false; crates[kind] = crate; produceCrate(crate, kind, jobs);
  }
  root.userData.fieldCargo = { plants, crates };
  const previous = root.userData.assetReady;
  root.userData.assetReady = Promise.all([previous, Promise.all(jobs)]).then(results => results.flat());
  return root;
}
export function syncFieldCargo(root, state) {
  const crop = state.crops?.[state.carriedCrop];
  const item = state.items[state.carriedItem];
  for (const [kind, model] of Object.entries(root.userData.fieldCargo.plants)) model.visible = crop?.kind === kind;
  for (const [kind, model] of Object.entries(root.userData.fieldCargo.crates)) model.visible = !crop && item?.kind === kind && !item.packed;
  if (crop || (item && !item.packed)) for (const variant of Object.values(root.userData.variants)) variant.visible = false;
  root.traverse(node => { if (node.geometry?.type === "PlaneGeometry") node.visible = false; });
}
