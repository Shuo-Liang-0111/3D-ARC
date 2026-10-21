import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { applyMujocoState, MujocoClient } from "./mujoco-client.js";
import { createG1ArticulatedCollisionRig } from "./g1-articulated-collision.js";
import { loadUnitreeG1Dex1Model, setUnitreeG1Dex1JointAngle, updateUnitreeG1Dex1Model } from "./unitree-g1-dex1-model.js";

const query = new URLSearchParams(window.location.search);
const reviewGaitPhase = query.has("gaitPhase") ? Number(query.get("gaitPhase")) : null;
document.body.classList.toggle("review-mode", query.has("review"));

const canvas = document.querySelector("#g1-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.76;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9ecf2);

const camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.05, 50);
camera.position.set(1.95, 1.02, 3.45);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.66, 0);
controls.enableDamping = true;
controls.minDistance = 1.4;
controls.maxDistance = 5;
controls.maxPolarAngle = Math.PI * 0.52;

scene.add(new THREE.HemisphereLight(0xf6f8ff, 0x4b535e, 0.82));
const key = new THREE.DirectionalLight(0xffffff, 2.5);
key.position.set(2.4, 3.2, 3.8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -3;
key.shadow.camera.right = 3;
key.shadow.camera.top = 4;
key.shadow.camera.bottom = -1;
scene.add(key);
const fill = new THREE.DirectionalLight(0xdde6ff, 0.72);
fill.position.set(-2.8, 2.2, 2.2);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xb9d8ff, 0.64);
rim.position.set(0, 2.8, -3);
scene.add(rim);

const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xd5d9df, metalness: 0.08, roughness: 0.7 });
const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 96), floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.15;
floor.receiveShadow = true;
scene.add(floor);
const loadStatus = document.querySelector("#load-status");
let robot;
try {
  robot = await loadUnitreeG1Dex1Model();
  loadStatus?.remove();
} catch (error) {
  if (loadStatus) loadStatus.textContent = "官方 G1 Dex1 模型加载失败";
  console.error("Unable to load the official Unitree G1 Dex1 GLB", error);
  throw error;
}
robot.rotation.y = 0;
const actor = new THREE.Group();
actor.userData.officialModel = robot;
actor.userData.robotProfile = { id: "g1", setJointAngle: setUnitreeG1Dex1JointAngle };
actor.add(robot);
scene.add(actor);
const collisionDebugEnabled = query.get("colliders") === "1";
const collisionRig = createG1ArticulatedCollisionRig(robot, { debugVisible: collisionDebugEnabled });
window.__G1_COLLISION_RIG__ = collisionRig;
const collisionSummary = collisionRig.getCollisionSummary();
const collisionSummaryElement = document.querySelector("#collision-summary");
if (collisionSummaryElement) {
  collisionSummaryElement.textContent = `${collisionSummary.officialGeomCount} 官方 geom · ${Math.round(collisionSummary.triangleCount / 1000)}K 面`;
  collisionSummaryElement.title = `Rapier 构建耗时 ${collisionSummary.buildDurationMs.toFixed(1)} ms；另含 ${collisionSummary.supplementalHandCount} 个手部网格`;
}
const previousActorPosition = actor.position.clone();

let mujocoOnline = false;
const mujocoClient = Number.isFinite(reviewGaitPhase) ? null : new MujocoClient({
  onStatus(status) { mujocoOnline = status === "online"; },
});
mujocoClient?.connect();
window.addEventListener("beforeunload", () => mujocoClient?.close());

const timer = new THREE.Timer();
timer.connect(document);
let elapsed = 0;
let motion = "idle";
let explode = 0;

const marchButton = document.querySelector("#motion-toggle");
const walkButton = document.querySelector("#walk-toggle");
const collisionButton = document.querySelector("#collision-toggle");

function updateMotionButtons() {
  marchButton.textContent = motion === "turning" ? "停止真实转向" : "启动真实转向";
  walkButton.textContent = motion === "walking" ? "停止真实行走" : "启动真实行走";
}

marchButton.addEventListener("click", () => {
  motion = motion === "turning" ? "idle" : "turning";
  mujocoClient?.reset({ x: 0, z: 0, yaw: 0 });
  updateMotionButtons();
});

walkButton.addEventListener("click", () => {
  motion = motion === "walking" ? "idle" : "walking";
  mujocoClient?.reset({ x: 0, z: 0, yaw: 0 });
  updateMotionButtons();
});

document.querySelector("#explode-toggle").addEventListener("click", (event) => {
  explode = explode === 0 ? 1 : 0;
  robot.userData.sculptRuntime.setExploded(explode);
  event.currentTarget.textContent = explode === 0 ? "展开部件" : "合拢部件";
});

function updateCollisionButton() {
  collisionButton.textContent = collisionRig.debugVisible ? "隐藏官方碰撞体" : "显示官方碰撞体";
}

collisionButton.addEventListener("click", () => {
  collisionRig.setDebugVisible(!collisionRig.debugVisible);
  updateCollisionButton();
});
updateCollisionButton();

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
window.__IMG2THREEJS_READY__ = false;
window.__IMG2THREEJS_CAPTURE__ = {
  setCamera(cameraSpec) {
    const reviewTarget = cameraSpec.target?.some((value) => value !== 0)
      ? cameraSpec.target
      : [0, 0.66, 0];
    if (Array.isArray(cameraSpec.position)) {
      camera.position.fromArray(cameraSpec.position);
    } else {
      const azimuth = THREE.MathUtils.degToRad(cameraSpec.azimuthDegrees ?? 0);
      const elevation = THREE.MathUtils.degToRad(cameraSpec.elevationDegrees ?? 0);
      const radius = cameraSpec.radius ?? 3.75;
      const horizontalRadius = Math.cos(elevation) * radius;
      camera.position.set(
        reviewTarget[0] + Math.sin(azimuth) * horizontalRadius,
        reviewTarget[1] + 0.34 + Math.sin(elevation) * radius,
        reviewTarget[2] + Math.cos(azimuth) * horizontalRadius,
      );
    }
    controls.target.fromArray(reviewTarget);
    camera.fov = cameraSpec.fovDegrees ?? camera.fov;
    camera.updateProjectionMatrix();
    controls.update();
  },
  capturePass() {
    renderer.render(scene, camera);
    return { ok: true, selector: "#g1-canvas" };
  },
  setExploded(amount) {
    robot.userData.sculptRuntime.setExploded(amount);
  },
  setCollisionDebug(visible) {
    collisionRig.setDebugVisible(visible);
    updateCollisionButton();
  },
};

if (Number.isFinite(reviewGaitPhase)) {
  motion = query.get("motion") === "walking" ? "walking" : "marching";
  robot.userData.gaitWeight = 1;
  updateMotionButtons();
}
if (query.has("azimuth")) {
  window.__IMG2THREEJS_CAPTURE__.setCamera({ azimuthDegrees: Number(query.get("azimuth")), elevationDegrees: Number(query.get("elevation") ?? 2), radius: Number(query.get("radius") ?? 3.75), target: [0, 0.66, 0], fovDegrees: 25 });
}

function frame() {
  timer.update();
  const delta = Math.min(timer.getDelta(), 0.05);
  elapsed += delta;
  const motionElapsed = Number.isFinite(reviewGaitPhase) ? reviewGaitPhase / 5.6 : elapsed;
  if (explode === 0 && Number.isFinite(reviewGaitPhase)) {
    updateUnitreeG1Dex1Model(robot, delta, motionElapsed, motion);
  } else if (explode === 0 && mujocoOnline) {
    const velocity = {
      forward: motion === "walking" ? 0.5 : 0,
      lateral: 0,
      yaw: motion === "turning" ? 1 : 0,
    };
    mujocoClient.setCommand(velocity, "g1-preview", { x: 0, z: 0, yaw: 0 });
    const state = mujocoClient.sample(performance.now());
    if (state) {
      applyMujocoState(actor, state, actor.userData.robotProfile, { groundY: 0 });
      const horizontalDelta = actor.position.clone().sub(previousActorPosition);
      horizontalDelta.y = 0;
      camera.position.add(horizontalDelta);
      controls.target.add(horizontalDelta);
      previousActorPosition.copy(actor.position);
    }
  }
  collisionRig.sync();
  controls.update();
  renderer.render(scene, camera);
  window.__IMG2THREEJS_READY__ = true;
  requestAnimationFrame(frame);
}

frame();
