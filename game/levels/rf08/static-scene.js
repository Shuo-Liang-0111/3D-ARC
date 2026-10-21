import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createBinModel, OFFICE_BIN } from "./bin.js";
import { loadOfficePhysics } from "./scan-physics.js";

const ASSET_VERSION = "colors-20260908-v2";

export function createOfficeScan() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbbb9ae);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x777366, 2));
  const root = new THREE.Group();
  root.name = "rf08-baked-office";
  scene.add(root);
  const collisionRoot = new THREE.Group();
  collisionRoot.visible = false;
  scene.add(collisionRoot);
  const binRoot = createBinModel();
  binRoot.position.set(OFFICE_BIN.x, 0, OFFICE_BIN.z);
  scene.add(binRoot);
  const ready = Promise.all([
    new GLTFLoader().loadAsync(`/office-scan/office-static.glb?v=${ASSET_VERSION}`),
    loadOfficePhysics(),
    binRoot.userData.assetReady,
  ]).then(([asset, physics, binAsset]) => {
    if (!binAsset.loaded) throw binAsset.error;
    root.add(asset.scene);
    physics.setBin({ location: "floor", x: OFFICE_BIN.x, z: OFFICE_BIN.z });
    return { loaded: true, physics, format: "textured-glb", asset };
  });
  return { scene, root, binRoot, collisionRoot, ready, assetReady: ready.then((result) => [result]), collisionReady: ready };
}
