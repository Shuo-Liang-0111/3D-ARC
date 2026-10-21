import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createClinicScene, createClinicCargoModel, syncClinicVisuals, setClinicCargoModel } from "./scene.js";
import { createInitialState } from "./engine.js";
import { REVISION } from "./level.js";
import { walkRoute } from "./review-route.js";
import { createRobot, updateRobotAnimation } from "../../robot.js";
import { getRobotActionPose, createRobotActionState } from "../../robot-action.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
document.querySelector("#canvas").append(renderer.domElement);
const revision = new URLSearchParams(location.search).get("revision") || REVISION;
const world = createClinicScene(renderer, revision);
const cargo = createClinicCargoModel(revision);
const robot = createRobot(cargo, { robotId: "g1" });
world.scene.add(robot);
const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
camera.position.set(10, 13, 14);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 0.5, -0.3); orbit.update();
let state = createInitialState();
let route = walkRoute();
let playing = false;
let stepNumber = 0;
const status = document.querySelector("#status");
function resize() {
  const bounds = document.querySelector("#canvas").getBoundingClientRect();
  renderer.setSize(bounds.width, bounds.height);
  camera.aspect = bounds.width / bounds.height; camera.updateProjectionMatrix();
}
function render() {
  syncClinicVisuals(world, state); setClinicCargoModel(cargo, state);
  robot.position.set(state.player.x, 0, state.player.z); robot.rotation.y = state.player.yaw;
  updateRobotAnimation(robot, 0.016, state.elapsed, state.motion, getRobotActionPose(createRobotActionState(), Boolean(state.carriedItem)));
  renderer.render(world.scene, camera);
}
await Promise.all([world.assetReady, cargo.userData.assetReady, robot.userData.assetReady]).then(results => {
  if (results.flat().some(result => !result.loaded)) throw new Error("Required clinic asset failed");
  status.textContent = "诊所已加载 · 拖动旋转，滚轮缩放";
  document.querySelector("#next").disabled = false; document.querySelector("#play").disabled = false;
}).catch(error => { status.textContent = String(error); });
function advance(stopAtInteraction = true) {
  try {
    for (let count = 0; count < (stopAtInteraction ? 4000 : 4); count += 1) {
      const entry = route.next();
      if (entry.done) { playing = false; status.textContent = "完整路线检查通过 · 4 站补给 / 4 盒回收 / 2 项归位 / 已开诊"; return; }
      state = entry.value.state;
      if (entry.value.action === "interact") {
        stepNumber += 1;
        status.textContent = `${stepNumber}/20 · ${entry.value.label} · 补给 ${state.delivered.length}/4 · 回收 ${state.returned.length}/4 · 归位 ${state.prepared.length}/2`;
        if (stopAtInteraction) return;
      }
    }
  } catch (error) { playing = false; status.textContent = String(error); }
}
document.querySelector("#next").onclick = () => { playing = false; advance(); render(); };
document.querySelector("#play").onclick = () => { playing = !playing; };
document.querySelector("#reset").onclick = () => { playing = false; state = createInitialState(); route = walkRoute(); stepNumber = 0; status.textContent = "已重置"; render(); };
document.querySelector("#top").onclick = () => { camera.position.set(0, 18, 0.01); orbit.target.set(0, 0, 0); orbit.update(); render(); };
for (const [id, position, target] of [
  ["entry", [0, 1.6, 4.3], [0, 1.45, -2]],
  ["exam", [-2.65, 1.65, -1.55], [-0.6, 1.0, -3.0]],
  ["treatment", [4.6, 1.65, -1.5], [6.25, 1.3, -3.7]],
  ["waiting", [-2.1, 1.65, 2.7], [-6.4, 1.25, 2.6]],
]) {
  document.querySelector(`#${id}`).onclick = () => { camera.position.set(...position); orbit.target.set(...target); orbit.update(); render(); };
}
document.querySelector("#carrier").onclick = () => {
  camera.position.set(state.player.x + 1.6, 1.1, state.player.z + 1.6);
  orbit.target.set(state.player.x, 0.8, state.player.z); orbit.update(); render();
};
document.querySelector("#capture").onclick = () => {
  render();
  const link = document.createElement("a");
  link.download = `rf13-${revision}-${Date.now()}.png`;
  link.href = renderer.domElement.toDataURL("image/png");
  link.click();
};
window.addEventListener("resize", resize);
resize();
let lastStep = 0;
function animate(time) {
  if (playing && time - lastStep > 50) { advance(false); lastStep = time; }
  orbit.update(); render(); requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

