import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { LEVEL } from "./level.js";
import { createPlayCanvasGaussianLayer } from "./playcanvas-gaussian.js";
import { installRF10ExplorationCollision, installRF10MeshCollision } from "./mesh-collision.js";

export const RF10_ASSETS = Object.freeze({
  visualEnvironment: "/local-assets/gaussian/rf10/rf10-room-full.ply",
  depthProxy: "/local-assets/gaussian/rf10/IMG_7207_collider.glb",
});

function configureDepthProxy(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      colorWrite: false,
      depthTest: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    object.material = material;
    object.renderOrder = -100;
    object.castShadow = false;
    object.receiveShadow = false;
  });
}

function createRF10GaussianDepthLayer(renderer) {
  const root = new THREE.Group();
  root.name = "rf10-gaussian-depth-layer";
  root.rotation.z = Math.PI;
  const spark = new SparkRenderer({
    renderer,
    maxPixelRadius: 64,
    maxStdDev: Math.sqrt(8),
    minPixelRadius: 0,
    minAlpha: 0.03,
    preBlurAmount: 0,
    blurAmount: 0,
    falloff: 1,
    focalAdjustment: 2,
    sortRadial: false,
    transparent: false,
    depthTest: true,
    depthWrite: true,
  });
  spark.material.colorWrite = false;
  spark.renderOrder = -50;
  const splats = new SplatMesh({
    url: RF10_ASSETS.visualEnvironment,
    editable: false,
    raycastable: false,
  });
  root.add(spark);
  root.add(splats);
  const ready = splats.initialized.then(() => ({
    loaded: true,
    url: RF10_ASSETS.visualEnvironment,
    depthOnly: true,
    splatCount: splats.numSplats ?? splats.packedSplats?.numSplats ?? null,
  })).catch((error) => ({
    loaded: false,
    url: RF10_ASSETS.visualEnvironment,
    depthOnly: true,
    error,
  }));
  return { root, spark, splats, ready };
}

function createInteractionAnchor(name, position) {
  const root = new THREE.Group();
  root.name = name;
  root.position.set(position.x, 0, position.z);
  return root;
}

export function createRF10Scene(renderer) {
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = null;
  scene.add(new THREE.HemisphereLight(0xeaf3ef, 0x303837, 1.45));
  const sun = new THREE.DirectionalLight(0xffedd6, 2.4);
  sun.position.set(-5, 8, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  const collisionRoot = new THREE.Group();
  collisionRoot.name = "rf10-gaussian-collision-layer";
  scene.add(collisionRoot);
  const fallbackCollision = installRF10ExplorationCollision({ min: { x: -4.05, z: -2.65 }, max: { x: 9.7, z: 2.45 } });
  const collisionReady = new GLTFLoader().loadAsync(RF10_ASSETS.depthProxy).then(({ scene: depthProxy }) => {
    depthProxy.name = "rf10-depth-and-collision-proxy";
    depthProxy.rotation.z = Math.PI;
    configureDepthProxy(depthProxy);
    depthProxy.visible = false;
    collisionRoot.add(depthProxy);
    const collision = installRF10MeshCollision(depthProxy);
    return { loaded: true, url: RF10_ASSETS.depthProxy, ...collision, depthProxy: true };
  }).catch((error) => ({ loaded: false, url: RF10_ASSETS.depthProxy, error, ...fallbackCollision, temporary: true }));

  const gaussian = createPlayCanvasGaussianLayer(renderer.domElement.parentElement);
  const gaussianDepth = createRF10GaussianDepthLayer(renderer);
  scene.add(gaussianDepth.root);
  const assetReady = Promise.all([gaussian.ready, gaussianDepth.ready, collisionReady]);
  return {
    scene,
    gaussianRoot: null,
    gaussianLayer: gaussian,
    gaussianReady: gaussian.ready,
    gaussianDepthReady: gaussianDepth.ready,
    collisionRoot,
    collisionReady,
    assetReady,
  };
}

export function syncRF10Visuals(world, state, delta) {
  return world;
}
