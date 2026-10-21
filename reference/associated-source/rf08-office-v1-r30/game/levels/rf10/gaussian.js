import * as THREE from "three";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

export const RF10_GAUSSIAN_ASSET = "/local-assets/gaussian/rf10/rf10-room-full.ply";
export const RF10_GAUSSIAN_TRANSFORM = Object.freeze({
  position: Object.freeze([0, 0, 0]),
  rotationX: 0,
  rotationY: 0,
  rotationZ: Math.PI,
  scale: 1,
});

export function applyRF10GaussianTransform(root) {
  root.position.set(...RF10_GAUSSIAN_TRANSFORM.position);
  root.quaternion.setFromEuler(new THREE.Euler(
    RF10_GAUSSIAN_TRANSFORM.rotationX,
    RF10_GAUSSIAN_TRANSFORM.rotationY,
    RF10_GAUSSIAN_TRANSFORM.rotationZ,
    "XYZ",
  ));
  root.scale.setScalar(RF10_GAUSSIAN_TRANSFORM.scale);
}

export function createGaussianLayer(renderer) {
  const root = new THREE.Group();
  root.name = "rf10-gaussian-visual-layer";
  applyRF10GaussianTransform(root);
  root.visible = true;
  const startedAt = performance.now();
  const spark = new SparkRenderer({
    renderer,
    maxPixelRadius: 32,
    maxStdDev: Math.sqrt(8),
    minPixelRadius: 0,
    minAlpha: 0.25,
    preBlurAmount: 0,
    blurAmount: 0.3,
    falloff: 1,
    focalAdjustment: 2,
    sortRadial: false,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const splats = new SplatMesh({
    url: RF10_GAUSSIAN_ASSET,
    editable: false,
    raycastable: false,
  });
  root.add(splats);
  const ready = splats.initialized.then(() => ({
    loaded: true,
    url: RF10_GAUSSIAN_ASSET,
    loadMs: performance.now() - startedAt,
    splatCount: splats.numSplats ?? splats.packedSplats?.numSplats ?? null,
  })).catch((error) => {
    console.warn("[RF-10] Room SOG unavailable", error);
    return { loaded: false, url: RF10_GAUSSIAN_ASSET, loadMs: performance.now() - startedAt, error };
  });
  return { root, spark, splats, ready };
}
