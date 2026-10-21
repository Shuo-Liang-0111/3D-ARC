import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const SHADOW_HAND_ASSET_ROOT = "/local-assets/shadow-hand/components";

const COMPONENT_URLS = Object.freeze({
  palm: `${SHADOW_HAND_ASSET_ROOT}/palm.glb`,
  knuckle: `${SHADOW_HAND_ASSET_ROOT}/knuckle.glb`,
  proximal: `${SHADOW_HAND_ASSET_ROOT}/proximal.glb`,
  middle: `${SHADOW_HAND_ASSET_ROOT}/middle.glb`,
  distal: `${SHADOW_HAND_ASSET_ROOT}/distal.glb`,
  thumbProximal: `${SHADOW_HAND_ASSET_ROOT}/thumb_proximal.glb`,
  thumbMiddle: `${SHADOW_HAND_ASSET_ROOT}/thumb_middle.glb`,
  thumbDistal: `${SHADOW_HAND_ASSET_ROOT}/thumb_distal.glb`,
  wrist: `${SHADOW_HAND_ASSET_ROOT}/wrist.glb`,
});

let componentLibraryPromise = null;

function fallbackMaterial(color, metalness = 0.72, roughness = 0.3) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function prepareComponent(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    object.material = materials.map((source) => {
      const material = source?.clone?.() ?? fallbackMaterial(0x22292b);
      material.name = "debranded-dexterous-hand";
      material.color?.setHex(0x596361);
      material.metalness = 0.68;
      material.roughness = 0.3;
      return material;
    });
    if (object.material.length === 1) [object.material] = object.material;
  });
  return root;
}

function loadComponent(name, url) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(url, (gltf) => resolve([name, prepareComponent(gltf.scene)]), undefined, reject);
  });
}

export function loadDexterousHandComponents() {
  if (typeof window === "undefined") {
    return Promise.resolve({ loaded: false, components: {}, reason: "browser-only assets" });
  }
  if (!componentLibraryPromise) {
    componentLibraryPromise = Promise.allSettled(
      Object.entries(COMPONENT_URLS).map(([name, url]) => loadComponent(name, url)),
    ).then((results) => {
      const components = Object.fromEntries(
        results.filter((result) => result.status === "fulfilled").map((result) => result.value),
      );
      return {
        loaded: Boolean(components.palm && components.proximal && components.distal),
        loadedCount: Object.keys(components).length,
        totalCount: Object.keys(COMPONENT_URLS).length,
        components,
      };
    });
  }
  return componentLibraryPromise;
}

function createSegment(length, radius, material) {
  const segment = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, Math.max(0.002, length - radius * 2), 5, 10),
    material,
  );
  segment.position.y = length / 2;
  segment.castShadow = true;
  segment.receiveShadow = true;
  return segment;
}

function fitComponent(prototype, targetLength) {
  const visual = new THREE.Group();
  const model = prototype.clone(true);
  visual.add(model);
  visual.updateMatrixWorld(true);
  const initial = new THREE.Box3().setFromObject(visual);
  const size = initial.getSize(new THREE.Vector3());
  if (size.x > size.y && size.x >= size.z) model.rotation.z = Math.PI / 2;
  else if (size.z > size.y && size.z >= size.x) model.rotation.x = -Math.PI / 2;
  visual.updateMatrixWorld(true);
  const oriented = new THREE.Box3().setFromObject(visual);
  const orientedSize = oriented.getSize(new THREE.Vector3());
  const scale = targetLength / Math.max(orientedSize.y, 1e-6);
  model.scale.multiplyScalar(scale);
  visual.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(visual);
  const center = fitted.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= fitted.min.y;
  model.position.z -= center.z;
  return visual;
}

function addAssetSlot(slots, holder, fallback, name, targetLength) {
  slots.push({ holder, fallback, name, targetLength });
}

function createFinger(slots, material, x, y, lengths, spread, name) {
  const finger = new THREE.Group();
  finger.name = name;
  finger.position.set(x, y, 0);
  finger.rotation.z = spread;
  const joints = [];
  let parent = finger;
  lengths.forEach((length, index) => {
    const joint = new THREE.Group();
    joint.name = `${name}-joint-${index + 1}`;
    if (index > 0) joint.position.y = lengths[index - 1];
    parent.add(joint);
    const fallback = createSegment(length, index === 0 ? 0.0105 : 0.009, material);
    joint.add(fallback);
    addAssetSlot(slots, joint, fallback, index === 0 ? "proximal" : index === 1 ? "middle" : "distal", length);
    joints.push(joint);
    parent = joint;
  });
  return { finger, joints };
}

function createThumb(slots, material, side) {
  const thumb = new THREE.Group();
  thumb.name = side < 0 ? "left-thumb" : "right-thumb";
  thumb.position.set(side * 0.052, 0.032, 0.003);
  thumb.rotation.z = side * -0.88;
  thumb.rotation.y = side * 0.18;
  const lengths = [0.047, 0.036, 0.028];
  const componentNames = ["thumbProximal", "thumbMiddle", "thumbDistal"];
  const joints = [];
  let parent = thumb;
  lengths.forEach((length, index) => {
    const joint = new THREE.Group();
    if (index > 0) joint.position.y = lengths[index - 1];
    parent.add(joint);
    const fallback = createSegment(length, index === 0 ? 0.012 : 0.0105, material);
    joint.add(fallback);
    addAssetSlot(slots, joint, fallback, componentNames[index], length);
    joints.push(joint);
    parent = joint;
  });
  return { thumb, joints };
}

export function createDexterousHand(options = {}) {
  const side = options.side === -1 ? -1 : 1;
  const root = new THREE.Group();
  root.name = side < 0 ? "left-five-finger-dexterous-hand" : "right-five-finger-dexterous-hand";
  const shell = fallbackMaterial(options.color ?? 0x242b2d);
  const jointMaterial = fallbackMaterial(0x0f1416, 0.82, 0.22);
  const slots = [];

  const wristHolder = new THREE.Group();
  root.add(wristHolder);
  const wristFallback = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, 0.045, 16), jointMaterial);
  wristFallback.position.y = 0.015;
  wristFallback.castShadow = true;
  wristHolder.add(wristFallback);
  addAssetSlot(slots, wristHolder, wristFallback, "wrist", 0.045);

  const palmHolder = new THREE.Group();
  palmHolder.position.y = 0.03;
  root.add(palmHolder);
  const palmFallback = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.108, 0.034), shell);
  palmFallback.position.y = 0.054;
  palmFallback.castShadow = true;
  palmFallback.receiveShadow = true;
  palmHolder.add(palmFallback);
  addAssetSlot(slots, palmHolder, palmFallback, "palm", 0.108);

  const digitSpecs = [
    [-0.035, [0.052, 0.034, 0.025], -0.08, "index"],
    [-0.012, [0.058, 0.039, 0.028], -0.025, "middle"],
    [0.012, [0.055, 0.037, 0.027], 0.025, "ring"],
    [0.035, [0.046, 0.031, 0.023], 0.09, "little"],
  ];
  const fingers = digitSpecs.map(([x, lengths, spread, name]) => {
    const digit = createFinger(slots, shell, x, 0.138, lengths, spread, name);
    root.add(digit.finger);
    return digit;
  });
  const thumb = createThumb(slots, shell, side);
  root.add(thumb.thumb);

  root.userData.side = side;
  root.userData.fingers = fingers;
  root.userData.thumb = thumb;
  root.userData.assetSlots = slots;
  root.userData.grip = 0;
  root.userData.assetReady = loadDexterousHandComponents().then((library) => {
    slots.forEach((slot) => {
      const prototype = library.components[slot.name];
      if (!prototype) return;
      const visual = fitComponent(prototype, slot.targetLength);
      slot.holder.add(visual);
    });
    return {
      loaded: library.loaded,
      loadedCount: library.loadedCount ?? 0,
      totalCount: library.totalCount ?? Object.keys(COMPONENT_URLS).length,
      assetRoot: SHADOW_HAND_ASSET_ROOT,
    };
  });

  setDexterousHandGrip(root, options.grip ?? 0.16);
  return root;
}

export function setDexterousHandGrip(hand, amount) {
  const grip = Math.max(0, Math.min(1, amount));
  hand.userData.grip = grip;
  hand.userData.fingers.forEach(({ joints }, fingerIndex) => {
    const lengthBias = 1 - fingerIndex * 0.035;
    joints[0].rotation.x = -grip * 0.78 * lengthBias;
    joints[1].rotation.x = -grip * 0.92;
    joints[2].rotation.x = -grip * 0.68;
  });
  const thumb = hand.userData.thumb;
  thumb.thumb.rotation.y = hand.userData.side * (0.18 + grip * 0.42);
  thumb.joints[0].rotation.x = -grip * 0.55;
  thumb.joints[1].rotation.x = -grip * 0.72;
  thumb.joints[2].rotation.x = -grip * 0.5;
}
