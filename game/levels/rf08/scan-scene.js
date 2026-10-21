import * as THREE from "three";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createBinModel } from './bin.js';
import { loadOfficePhysics } from "./scan-physics.js";

export function createOfficeScan(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbbb9ae);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x777366, 2));
  const spark = new SparkRenderer({ renderer, maxStdDev: 3, minAlpha: 0.015 });
  scene.add(spark);
  const root = new THREE.Group();
  scene.add(root);
  const collisionRoot = new THREE.Group();
  collisionRoot.visible = false;
  scene.add(collisionRoot);
  const binRoot = createBinModel();
  binRoot.position.set(-0.82,0,2.01);
  scene.add(binRoot);
  const ready = (async () => {
    const response = await fetch("/office-scan/manifest.json?v=bin-20260907");
    if (!response.ok) throw new Error("办公室清单加载失败");
    const manifest = await response.json();
    root.quaternion.fromArray(manifest.rotationQuaternion);
    root.position.fromArray(manifest.translation);
    const splats = new SplatMesh({ url: "/office-scan/office.ply?v=bin-20260907" });
    root.add(splats);
    const [, physics, collision] = await Promise.all([
      splats.initialized,
      loadOfficePhysics(),
      new GLTFLoader().loadAsync("/office-scan/office-collision.glb?v=bin-20260907"),
    ]);
    const binAsset = await binRoot.userData.assetReady;
    if (!binAsset.loaded) throw binAsset.error;
    physics.setBin({location: 'floor', x: -0.82, z: 2.01});
    collision.scene.traverse((object) => {
      if (object.isMesh) object.material = new THREE.MeshBasicMaterial({ color: 0x39e6b0, wireframe: true, transparent: true, opacity: 0.4 });
    });
    collisionRoot.add(collision.scene);
    return { loaded: true, physics, manifest, splats };
  })();
  return { scene, root, spark, binRoot, collisionRoot, ready, assetReady: ready.then((value) => [value]), collisionReady: ready };
}
