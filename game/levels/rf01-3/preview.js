import * as THREE from "three";
import { createScene, syncVisuals } from "../../rf01-shared-scene.js";
import { loadRF01EnvironmentMap } from "../../rf01-production-assets.js";
import { createInitialState, updateEnvironment } from "./engine.js";
import { SORTING } from "../../rf01-sorting-layout.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.append(renderer.domElement);
const world = createScene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .05, 100);
const views = {
  line: { position: [3.65, 2.35, -2.35], target: [-1, 1.2, -5.3] },
  cages: { position: [1.85, 2.15, -4.25], target: [-2.05, .9, -2.4] },
};
function view(name) {
  camera.position.set(...views[name].position);
  camera.lookAt(...views[name].target);
}
view("line");
let state = { ...createInitialState(), powered: true, lightsOn: true, shutterLift: 2.36, shutterPhase: "open", shutterHold: 1e8 };
const ready = await Promise.all([world.assetReady, loadRF01EnvironmentMap(renderer, world.scene)]);
if (ready.flat(Infinity).some(result => result?.loaded === false)) throw new Error("Shared scene asset failed");
document.querySelector("#status").textContent = SORTING.revision + " / 正式场景同源资产与灯光";
for (const name of ["line", "cages"]) document.getElementById(name).onclick = () => view(name);
document.querySelector("#dark").onclick = () => { state.lightsOn = !state.lightsOn; };
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
let previous = performance.now();
function render(now) {
  const delta = Math.min(.05, (now - previous) / 1000);
  previous = now;
  state = updateEnvironment(state, delta);
  syncVisuals(world, state, delta);
  renderer.render(world.scene, camera);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
