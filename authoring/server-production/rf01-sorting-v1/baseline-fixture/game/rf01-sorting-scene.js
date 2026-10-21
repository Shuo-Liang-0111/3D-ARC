import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { ASSETS } from "./levels/rf03/scene.js";
import { SORTING, PARCEL_TYPES, PARCEL_META } from "./rf01-sorting-layout.js";

const decoder = new DRACOLoader().setDecoderPath("/vendor/draco/").setWorkerLimit(2);
const loader = new GLTFLoader().setDRACOLoader(decoder);
const sources = new Map();

function loadModel(asset, root) {
  const url = ASSETS[asset];
  if (!sources.has(url)) sources.set(url, loader.loadAsync(url));
  return sources.get(url).then(gltf => {
    const model = gltf.scene.clone(true);
    model.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const copies = materials.map(material => {
        const copy = material.clone();
        if (copy.map) copy.map.colorSpace = THREE.SRGBColorSpace;
        return copy;
      });
      object.material = Array.isArray(object.material) ? copies : copies[0];
    });
    root.add(model);
    return { loaded: true, name: root.name, url, model };
  });
}

function label(type, width, height) {
  const meta = PARCEL_META[type];
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 256;
  const context = canvas.getContext("2d");
  context.fillStyle = "#" + meta.color.toString(16).padStart(6, "0");
  context.fillRect(0, 0, 512, 256);
  context.fillStyle = "#f8f6ec";
  context.fillRect(24, 24, 464, 208);
  context.fillStyle = "#172024";
  context.font = "bold 112px monospace";
  context.textAlign = "center";
  context.fillText(meta.code, 256, 150);
  for (let index = 0; index < 45; index += 1) context.fillRect(76 + index * 8, 175, index % 3 + 2, 35);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: texture, roughness: .88, side: THREE.DoubleSide }));
}

export function createSortingParcel(type) {
  const root = new THREE.Group();
  root.name = "sorting-parcel-" + type;
  const [width, height, depth] = PARCEL_META[type].dimensions;
  const fitted = new THREE.Group();
  fitted.scale.set(width / .52, height / .32, depth / .38);
  root.add(fitted);
  const top = label(type, width * .82, depth * .75);
  top.position.set(0, height + .003, 0);
  top.rotation.x = -Math.PI / 2;
  const front = label(type, width * .82, height * .75);
  front.position.set(0, height / 2, depth / 2 + .003);
  root.add(top, front);
  root.visible = false;
  root.userData.assetReady = loadModel("parcel", fitted).then(result => {
    root.visible = true;
    return { ...result, name: root.name };
  });
  return root;
}

export function installSortingLine(world) {
  const root = new THREE.Group();
  root.name = SORTING.revision;
  world.scene.add(root);
  const pending = [];
  for (const placement of SORTING.placements) {
    const slot = new THREE.Group();
    slot.name = placement.id;
    slot.position.set(...placement.position);
    root.add(slot);
    pending.push(loadModel(placement.asset, slot));
  }
  const parcels = {};
  for (const type of PARCEL_TYPES) {
    const bin = SORTING.bins[type];
    const cage = new THREE.Group();
    cage.name = "sorting-cage-" + type;
    cage.position.set(bin.x, .04, bin.z);
    cage.rotation.y = bin.yaw;
    root.add(cage);
    const sign = label(type, .84, .36);
    sign.position.set(0, 1.35, .421);
    cage.add(sign);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.02, .02, .72),
      new THREE.MeshStandardMaterial({ color: 0x687274, metalness: .65, roughness: .6 }));
    deck.name = "sorting-cage-deck-" + type;
    deck.position.y = bin.floor - .05;
    deck.receiveShadow = true;
    cage.add(deck);
    pending.push(loadModel("routeCage", cage));
    const parcel = createSortingParcel(type);
    parcels[type] = parcel;
    root.add(parcel);
    pending.push(parcel.userData.assetReady);
    const mark = new THREE.Mesh(new THREE.RingGeometry(.28, .33, 4),
      new THREE.MeshStandardMaterial({ color: PARCEL_META[type].color, roughness: .95, side: THREE.DoubleSide }));
    mark.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
    mark.position.set(bin.x, .049, bin.z - .75);
    root.add(mark);
  }
  const indicatorMaterial = new THREE.MeshStandardMaterial({ color: 0x39463b, emissive: 0x38d979, emissiveIntensity: 0 });
  const indicator = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .14, 16), indicatorMaterial);
  indicator.position.set(-1, 2.98, -5.5);
  root.add(indicator);
  const ready = Promise.all(pending);
  return { root, parcels, indicatorMaterial, ready };
}

export function syncSortingLine(world, state) {
  if (!world.sorting) return;
  world.sorting.indicatorMaterial.emissiveIntensity = state.powered && state.lightsOn ? 1.8 : 0;
  for (const type of PARCEL_TYPES) {
    const parcel = state.parcels[type];
    const model = world.sorting.parcels[type];
    model.visible = parcel.location !== "carried";
    const height = parcel.location === "conveyor" ? SORTING.conveyor.beltHeight
      : parcel.location === "sorted" ? SORTING.bins[type].floor : .045;
    model.position.set(parcel.x, height, parcel.z);
  }
}
