import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadUnitreeR1EduModel, updateUnitreeR1EduModel } from "./unitree-r1-edu.js";

const query = new URLSearchParams(location.search);
const stillMode = query.has("still");
document.body.classList.toggle("capture", query.has("capture"));

const canvas = document.querySelector("#r1-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(stillMode ? 1 : Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.shadowMap.enabled = !stillMode;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9edf2);
scene.fog = new THREE.Fog(0xe9edf2, 5, 11);

const camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.03, 30);
camera.position.set(1.72, 0.94, 2.65);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.63, 0);
controls.enableDamping = true;
controls.minDistance = 1.15;
controls.maxDistance = 4;
controls.maxPolarAngle = Math.PI * 0.53;

scene.add(new THREE.HemisphereLight(0xf9fbff, 0x53606a, 1.2));
const key = new THREE.DirectionalLight(0xffffff, 3.4);
key.position.set(2.6, 3.7, 3.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -2;
key.shadow.camera.right = 2;
key.shadow.camera.top = 3;
key.shadow.camera.bottom = -1;
scene.add(key);
const fill = new THREE.DirectionalLight(0xdde9ff, 1.25);
fill.position.set(-2.5, 2.0, 2.1);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xb6e9f1, 1.05);
rim.position.set(-0.5, 2.7, -3.2);
scene.add(rim);

const platform = new THREE.Mesh(
  new THREE.CylinderGeometry(0.76, 0.81, 0.085, 72),
  new THREE.MeshStandardMaterial({ color: 0xd5dbe1, metalness: 0.12, roughness: 0.67 }),
);
platform.position.y = -0.063;
platform.receiveShadow = true;
scene.add(platform);
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(0.58, 0.007, 10, 100),
  new THREE.MeshBasicMaterial({ color: 0x1ab5bf }),
);
ring.rotation.x = Math.PI / 2;
ring.position.y = -0.017;
scene.add(ring);

const status = document.querySelector("#status");
let robot;
try {
  robot = await loadUnitreeR1EduModel({ instanceId: "appearance-preview" });
  scene.add(robot);
  status.remove();
} catch (error) {
  status.textContent = "R1 官方模型加载失败";
  console.error(error);
  throw error;
}

let motion = "idle";
let exploded = false;
document.querySelector("#motion").addEventListener("click", (event) => {
  motion = motion === "walking" ? "idle" : "walking";
  event.currentTarget.textContent = motion === "walking" ? "停止行走姿态" : "启动行走姿态";
});
document.querySelector("#explode").addEventListener("click", (event) => {
  exploded = !exploded;
  robot.userData.sculptRuntime.setExploded(exploded ? 1 : 0);
  event.currentTarget.textContent = exploded ? "合拢部件" : "展开部件";
});

window.__R1_PREVIEW__ = {
  setView(azimuthDegrees, elevationDegrees = 7, radius = 2.75) {
    const azimuth = THREE.MathUtils.degToRad(azimuthDegrees);
    const elevation = THREE.MathUtils.degToRad(elevationDegrees);
    const target = controls.target;
    const horizontal = Math.cos(elevation) * radius;
    camera.position.set(
      target.x + Math.sin(azimuth) * horizontal,
      target.y + Math.sin(elevation) * radius,
      target.z + Math.cos(azimuth) * horizontal,
    );
    controls.update();
  },
};

const clock = new THREE.Clock();
let elapsed = 0;
function frame() {
  const delta = Math.min(clock.getDelta(), 0.05);
  elapsed += delta;
  if (!exploded) updateUnitreeR1EduModel(robot, delta, elapsed, motion);
  controls.update();
  renderer.render(scene, camera);
  window.__R1_READY__ = true;
  if (!stillMode) requestAnimationFrame(frame);
}
frame();

addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
