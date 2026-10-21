import * as THREE from "three";
import { createFacilityScene } from "../../scene.js";
import { loadRF01EnvironmentMap } from "../../rf01-production-assets.js";
import { setWorkshopLighting, syncWorkshopShutter } from "../../rf01-workshop.js";
const world = createFacilityScene();
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.append(renderer.domElement);
await Promise.all([world.assetReady, loadRF01EnvironmentMap(renderer, world.scene)]);
const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, .01, 100);
let current = "yard";
const views = {
  yard: [[1,8.2,13],[0,1,-1.5]],
  rack: [[-7.4,3.4,3.8],[-6.8,.55,-1.25]],
  equipment: [[7,3.3,4.5],[6.5,.8,-1.4]],
  inside: [[2,3,-2.6],[-3.4,.4,-4.15]],
  door: [[-.43,1.35,-.24],[-.68,1.2,-1.08]],
  light: [[4.05,1.35,-5.5],[3.8,1.2,-6.34]],
  doorBack: [[-.68,1.3,-1.8],[-.68,1.2,-1.08]],
  lightBack: [[3.8,1.3,-7],[3.8,1.2,-6.34]],
};
function show(name) {
  current = name;
  camera.position.set(...views[name][0]);
  camera.lookAt(...views[name][1]);
  syncWorkshopShutter(world.workshop, name === "inside" ? 2.36 : 0);
  setWorkshopLighting(world.workshop, ["inside","light","lightBack"].includes(name));
  renderer.render(world.scene,camera);
  document.querySelector("#info").textContent = world.visualRevision + " / " + name;
}
document.querySelectorAll("[data-view]").forEach(button => { button.onclick = () => show(button.dataset.view); });
document.querySelector("#save").onclick = () => {
  renderer.render(world.scene,camera);
  const link = document.createElement("a");
  link.href = renderer.domElement.toDataURL("image/jpeg", .95);
  link.download = "rf01-v2-" + current + ".jpg"; link.click();
};
show("yard");
