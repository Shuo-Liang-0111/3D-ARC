import * as THREE from "three";
import { createKitchenScene, syncKitchenVisuals } from "/game/levels/rf12/scene.js";
import { createInitialState } from "/game/levels/rf12/engine.js";

const mount = document.body;
const status = document.getElementById("preview-status");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
mount.appendChild(renderer.domElement);
window.__RF12_CAPTURE__ = () => renderer.domElement.toDataURL("image/png");
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.05, 50);
const view = new URLSearchParams(window.location.search).get("view") || "wide";
const views = {
  wide: { position: [0, 2.10, 2.65], lookAt: [0, 1.05, -1.45] },
  entry: { position: [-1.65, 1.6, -0.3], lookAt: [0.75, 1.15, 3.15] },
  stove: { position: [3.65, 1.75, 1.05], lookAt: [2.25, 1.35, -2.65] },
  window: { position: [-1.45, 1.65, -0.75], lookAt: [-0.75, 1.55, -3.15] },
};
const selectedView = views[view] || views.wide;
camera.position.set(...selectedView.position);
camera.lookAt(...selectedView.lookAt);
const world = createKitchenScene();
const state = createInitialState();
world.assetReady.then((results) => {
  const loaded = results.filter((result) => result.loaded).length;
  const complete = loaded === results.length;
  syncKitchenVisuals(world, state);
  window.__ARC_PREVIEW__ = { level: "rf12", requiredAssetsReady: complete, results };
  status.dataset.ready = complete ? "true" : "false";
  status.textContent = complete ? "RF-12 final assets loaded" : `RF-12 asset gate blocked (${loaded}/${results.length})`;
  world.scene.updateMatrixWorld(true);
  renderer.render(world.scene, camera);
  status.dataset.capture = renderer.domElement.toDataURL("image/png");
  const redraw = () => { world.scene.updateMatrixWorld(true); renderer.render(world.scene, camera); status.dataset.capture = renderer.domElement.toDataURL("image/png"); };
  window.setTimeout(redraw, 1200);
  window.setTimeout(redraw, 3000);
}).catch((error) => { window.__ARC_PREVIEW__ = { level: "rf12", requiredAssetsReady: false, error: String(error) }; status.textContent = "RF-12 asset load failed"; renderer.render(world.scene, camera); });
