import * as THREE from "three";
import { createAudioSystem } from "/game/audio.js";
import { loadRF01EnvironmentMap } from "/game/rf01-production-assets.js";
import { createRF01PostProcessing } from "/game/rf01-postprocessing.js";
import { applyRobotActionPose, createRobot, getRobotProfile, updateRobotAnimation } from "/game/robot.js";
import {
  configureUnitreeG1D435DepthCamera,
  getUnitreeG1D435WorldPose,
  setUnitreeG1FirstPersonHeadVisible,
  UNITREE_G1_D435_DEPTH_CAMERA,
  UNITREE_G1_HEAD_PITCH,
} from "/game/unitree-g1-dex1-model.js";
import {
  updateUnitreeR1EduModel,
} from "/game/unitree-r1-edu.js";
import {
  advanceRobotAction,
  beginRobotAction,
  createRobotActionState,
  finishRobotAction,
  getRobotActionPose,
  getRobotPresentationState,
  isRobotActionActive,
} from "/game/robot-action.js";
import { mountOperatorConsole } from "/game/operator-controls.js";
import { syncRF01BatteryPose } from "/game/rf01-battery.js";
import { mountThirdPersonViewControls, nextThirdPersonZoom } from "/game/third-person-view-controls.js";
import { fitAspectViewport, getViewports, resolveViewMode } from "/game/view-mode.js";
import {
  G1_29DOF_JOINT_ORDER,
  projectMujocoDeltaToFrontendInput,
  scaleMujocoVelocityForFrontend,
  MUJOCO_CONTROL_MODES,
  MujocoClient,
  applyMujocoState,
} from "/game/mujoco-client.js";

const searchParams = new URLSearchParams(window.location.search);
const requestedLevel = searchParams.get("level");
const levelId = ["rf01", "rf01-2", "rf01-3", "rf02", "rf02-2", "rf02-3", "rf03", "rf04", "rf04-2", "rf04-3", "rf05", "rf05-2", "rf05-3", "rf06", "rf06-2", "rf06-3", "rf07", "rf07-2", "rf07-3", "rf08", "rf09", "rf09-2", "rf09-3", "rf10", "rf11", "rf12", "rf13", "rf14", "rf15", "rf15-1", "rf15-2", "rf15-3", "test_zpf", "test_zpf2"].includes(requestedLevel) ? requestedLevel : "rf01";
const isOfficeSeries = ["rf09", "rf09-2", "rf09-3"].includes(levelId);
const isCooperativeLevel = levelId === "rf11";
const robotProfile = getRobotProfile(isCooperativeLevel || isOfficeSeries ? "g1" : searchParams.get("robot"));
const robotId = robotProfile.id;
const requestedControlMode = searchParams.get("control");
const controlModeId = robotId === "g1" && !isCooperativeLevel && !isOfficeSeries && requestedControlMode === "joint"
  ? "joint"
  : "velocity";
const mujocoControlMode = MUJOCO_CONTROL_MODES[controlModeId];
const episodeMode = Boolean(searchParams.get("episode") && searchParams.get("browser_token"));
const pageMode = searchParams.get("mode") || (episodeMode ? "agent" : requestedLevel ? "play" : "home");
const isHomePage = pageMode === "home" && !episodeMode;
const isAgentPage = pageMode === "agent" || episodeMode;
const VIEW_STORAGE_KEY = "arc-view-mode";
let storedViewMode = null;
try {
  storedViewMode = window.localStorage.getItem(VIEW_STORAGE_KEY);
} catch {
  // Storage can be unavailable in privacy-restricted browser contexts.
}
let viewMode = resolveViewMode(searchParams.get("view"), storedViewMode);
const runtimeLoaders = {
  rf01: () => import("/game/levels/rf01/runtime.js"),
  "rf01-2": () => import("/game/levels/rf01-2/runtime.js"),
  "rf01-3": () => import("/game/levels/rf01-3/runtime.js"),
  rf02: () => import("/game/levels/rf02/runtime.js"),
  "rf02-2": () => import("/game/levels/rf02-2/runtime.js"),
  "rf02-3": () => import("/game/levels/rf02-3/runtime.js"),
  rf03: () => import("/game/levels/rf03/runtime.js"),
  rf04: () => import("/game/levels/rf04/runtime.js"),
  "rf04-2": () => import("/game/levels/rf04-2/runtime.js"),
  "rf04-3": () => import("/game/levels/rf04-3/runtime.js"),
  rf05: () => import("/game/levels/rf05/series-entry.js"),
  "rf05-2": () => import("/game/levels/rf05-2/runtime.js"),
  "rf05-3": () => import("/game/levels/rf05-3/runtime.js"),
  rf06: () => import("/game/levels/rf06/runtime.js"),
  "rf06-2": () => import("/game/levels/rf06-2/runtime.js"),
  "rf06-3": () => import("/game/levels/rf06-3/runtime.js"),
  rf07: () => import("/game/levels/rf07/runtime.js"),
  "rf07-2": () => import("/game/levels/rf07-2/runtime.js"),
  "rf07-3": () => import("/game/levels/rf07-3/runtime.js"),
  rf08: () => import("/game/levels/rf08/runtime.js"),
  rf09: () => import("/game/levels/rf09/office-entry.js"),
  "rf09-2": () => import("/game/levels/rf09-2/office-entry.js"),
  "rf09-3": () => import("/game/levels/rf09-3/office-entry.js"),
  rf10: () => import("/game/levels/rf10/runtime.js"),
  rf11: () => import("/game/levels/rf11/runtime.js"),
  rf12: () => import("/game/levels/rf12/runtime.js"),
  rf13: () => import("/game/levels/rf13/runtime.js"),
  rf14: () => import("/game/levels/rf14/runtime.js"),
  rf15: () => import("/game/levels/rf15/runtime.js"),
  "rf15-1": () => import("/game/levels/rf15-1/runtime.js"),
  "rf15-2": () => import("/game/levels/rf15-2/runtime.js"),
  "rf15-3": () => import("/game/levels/rf15-3/runtime.js"),
  test_zpf: () => import("/game/levels/test_zpf/runtime.js"),
  test_zpf2: () => import("/game/levels/test_zpf2/runtime.js"),
};
const runtime = await runtimeLoaders[levelId]();
const { LEVEL } = runtime;
const FINAL_OBJECTIVES = Object.freeze({
  rf01: "恢复园区供电，打开园区大门并抵达出口",
  "rf01-2": "进入厂房并开启照明",
  "rf01-3": "完成三件快递的正确分拣",
  rf02: "完成馆藏归位",
  "rf02-2": "将两把椅子推到桌边，还书车停入右侧墙边的黄色停车区",
  "rf02-3": "椅子推到桌边，还书车停入右侧黄色停车区，并归还三本随机落书",
  rf03: "完成快递分拣",
  rf04: "完成衣物洗涤与晾晒",
  "rf04-2": "洗净、晾干并分类收好三件衣物",
  "rf04-3": "收好三件衣物，并将扫地机器人放回充电区",
  rf05: "将旧毛巾、水杯和垃圾分别回收，完成客房整理",
  "rf05-2": "回收旧物，并为双床客房补齐两套干净毛巾和水杯",
  "rf05-3": "完成客房回收补给、关窗整理床铺及家具归位，确认客房可交付",
  rf06: "关闭漏水阀门，接住残水、清理积水并归还工具。",
  "rf06-2": "止住漏水，清除扩散的积水并归还工具。",
  "rf06-3": "拿起杀虫剂，消灭住宅内的两只蟑螂。",
  rf07: "完成冷链转运",
  "rf07-2": "启动全部三台冷藏柜",
  "rf07-3": "完成冷链转运并处置泄漏报警",
  rf08: "自由探索实景办公室",
  rf09: "将三件办公物品归还正确位置",
  "rf09-2": "布置四个会议席位并完成就绪检查",
  "rf09-3": "完成打印配送、饮水补给与资料回收",
  rf10: "自由探索会议室重建场景",
  rf11: "完成双机器人协作搬运",
  rf12: "完成家庭厨房安全任务",
  rf13: "完成社区诊所开诊任务",
  rf14: "收集网球并全部归筐",
  rf15: "将两箱农产品装入冷藏车，并完成出库确认",
  "rf15-1": "手推车归位",
  "rf15-2": "田间收割入筐",
  "rf15-3": "动态称重装车",
  test_zpf: "完成小办公室三点巡检",
  test_zpf2: "完成小办公室巡检",
});
const finalObjective = FINAL_OBJECTIVES[levelId];

const $ = (selector) => document.querySelector(selector);
const viewport = $("#viewport");
const gameShell = $("#game-shell");
const homeOverlay = $("#home-overlay");
const startOverlay = $("#start-overlay");
const terminalOverlay = $("#terminal-overlay");
const completeOverlay = $("#complete-overlay");
const failureOverlay = $("#failure-overlay");
const startButton = $("#start-button");
const returnToLevels = $("#return-to-levels");
const startButtonLabel = startButton.innerHTML;
const restartButton = $("#restart-button");
const failureRestartButton = $("#failure-restart-button");
const terminalClose = $("#terminal-close");
const objectiveTitle = $("#objective-title");
const powerLabel = $("#power-label");
const systemLight = $("#system-light");
const robotState = $("#robot-state");
const cargoState = $("#cargo-state");
const gateState = $("#gate-state");
const toast = $("#toast");
const progressMeter = $("#progress-meter");
const progressFill = $("#progress-fill");
const progressValue = $("#progress-value");
const terminalTitle = $("#terminal-title");
const terminalCopy = $("#terminal-copy");
const terminalLabels = [$("#terminal-label-1"), $("#terminal-label-2"), $("#terminal-label-3")];
const terminalValues = [$("#terminal-battery"), $("#terminal-power"), $("#terminal-door")];
const viewModeOptions = [...document.querySelectorAll("[data-view-option]")];
const levelOptions = [...document.querySelectorAll("[data-level-option]")];
const robotOptions = [...document.querySelectorAll("[data-robot-option]")];
const controlModeOptions = [...document.querySelectorAll("[data-control-option]")];
const operatorConsoleRoot = $("#operator-console");
const EXTERNAL_AGENT_ACTIONS = Object.freeze(["W", "A", "S", "D", "E", "WAIT"]);
const EXTERNAL_AGENT_HARNESSES = Object.freeze(["visual", "hybrid", "state"]);
const LOCAL_CONTROL_CODES = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "ArrowUp", "ArrowDown", "KeyI", "KeyJ", "KeyK", "KeyL", "KeyU", "KeyO", "Minus", "Equal"]);

function applyLevelCopy() {
  document.title = `${runtime.ui.brand} — 3D Robot Demo`;
  gameShell.dataset.level = levelId;
  $("#brand-name").textContent = runtime.ui.brand;
  $("#unit-label").textContent = runtime.ui.unit;
  $("#system-label").textContent = runtime.ui.systemLabel;
  $("#cargo-label").textContent = runtime.ui.cargoLabel;
  $("#gate-label").textContent = runtime.ui.gateLabel;
  $("#start-kicker").textContent = runtime.ui.startKicker;
  $("#start-title").innerHTML = levelId === "rf15" ? finalObjective : runtime.ui.startTitle;
  $("#start-copy").textContent = finalObjective;
  objectiveTitle.textContent = finalObjective;
  $("#terminal-heading-text").textContent = runtime.ui.terminalHeading;
  $("#complete-kicker").textContent = runtime.ui.completeKicker;
  $("#complete-title").textContent = runtime.ui.completeTitle;
  $("#complete-copy").textContent = runtime.ui.completeCopy;
  levelOptions.forEach((link) => {
    const selected = link.dataset.levelOption === levelId;
    link.classList.toggle("selected", selected);
    if (selected) link.setAttribute("aria-current", "page");
    const nextUrl = new URL(window.location.href);
    if (isOfficeSeries) nextUrl.pathname = "/";
    nextUrl.search = "";
    nextUrl.searchParams.set("mode", pageMode === "agent" ? "agent" : "play");
    nextUrl.searchParams.set("level", link.dataset.levelOption);
    nextUrl.searchParams.set("view", viewMode);
    nextUrl.searchParams.set("robot", robotId);
    nextUrl.searchParams.set("control", controlModeId);
    link.href = nextUrl.toString();
  });
  gameShell.dataset.viewMode = viewMode;
  gameShell.dataset.controlMode = controlModeId;
  robotOptions.forEach((button) => {
    const selected = button.dataset.robotOption === robotId;
    button.disabled = isOfficeSeries && button.dataset.robotOption !== "g1";
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  controlModeOptions.forEach((button) => {
    const available = button.dataset.controlOption !== "joint" || (robotId === "g1" && !isCooperativeLevel && !isOfficeSeries);
    const selected = button.dataset.controlOption === controlModeId;
    button.disabled = !available;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  viewModeOptions.forEach((button) => {
    const selected = button.dataset.viewOption === viewMode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

applyLevelCopy();

homeOverlay.hidden = !isHomePage;
startOverlay.hidden = !["play", "agent"].includes(pageMode) || episodeMode;
returnToLevels.hidden = true;
gameShell.dataset.pageMode = pageMode;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: levelId === "rf10", powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, runtime.rendering?.pixelRatioCap ?? 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = ["rf02", "rf02-2", "rf02-3"].includes(levelId) ? 1.15 : levelId === "rf03" ? 1.22 : ["rf04", "rf04-2", "rf04-3"].includes(levelId) ? 1.12 : 1.3;
if (levelId === "rf10") {
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.zIndex = "1";
}
viewport.append(renderer.domElement);

const world = runtime.createScene(renderer);
const environmentReady = ["rf01", "rf01-2", "rf01-3"].includes(levelId)
  ? loadRF01EnvironmentMap(renderer, world.scene)
  : Promise.resolve({ loaded: false });
const baseFogNear = world.scene.fog?.near;
const baseFogFar = world.scene.fog?.far;
const baseFogDensity = world.scene.fog?.density;
const camera = new THREE.PerspectiveCamera(runtime.camera.fov, window.innerWidth / window.innerHeight, 0.1, 100);
// This camera uses the official G1 mount transform and the D435 848x480
// nominal depth intrinsics. The fitted viewport keeps that sensor frame intact.
const firstPersonCamera = robotProfile.supportsD435
  ? configureUnitreeG1D435DepthCamera(new THREE.PerspectiveCamera())
  : new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 40);
const secondFirstPersonCamera = isCooperativeLevel ? configureUnitreeG1D435DepthCamera(new THREE.PerspectiveCamera()) : null;
const cameraPosition = new THREE.Vector3(...runtime.camera.position);
const cameraLookAt = new THREE.Vector3(...runtime.camera.lookAt);
const thirdPersonBaseOffset = cameraPosition.clone().sub(cameraLookAt);
const thirdPersonBaseDistance = Math.max(0.1, thirdPersonBaseOffset.length());
let thirdPersonOrbitYaw = Math.atan2(thirdPersonBaseOffset.x, thirdPersonBaseOffset.z);
let thirdPersonOrbitPitch = Math.asin(THREE.MathUtils.clamp(thirdPersonBaseOffset.y / thirdPersonBaseDistance, -1, 1));
let thirdPersonZoom = 1;
let thirdPersonFramingScale = 1;
const up = new THREE.Vector3(0, 1, 0);
const cameraForward = new THREE.Vector3(-cameraPosition.x, 0, -cameraPosition.z).normalize();
const cameraRight = new THREE.Vector3().crossVectors(cameraForward, up).normalize();
const firstPersonForward = new THREE.Vector3();
const firstPersonLookAt = new THREE.Vector3();
const r1CameraForward = new THREE.Vector3();
const r1CameraRight = new THREE.Vector3();
const postProcessing = ["rf01", "rf01-2", "rf01-3"].includes(levelId)
  ? createRF01PostProcessing(renderer, world.scene, camera)
  : null;
let robotAction = createRobotActionState();
let state = runtime.createInitialState();
let gaitDistance = 0;
let d435LookPitch = 0;
let d435LookPitchBeta = 0;
const cargoModel = runtime.createCargoModel?.();
const collisionDebugEnabled = searchParams.get("colliders") === "1";
const robot = createRobot(cargoModel, { robotId, showCollision: collisionDebugEnabled });
function createR1PartnerRobot() {
  const root = createRobot(null, { robotId: "r1", instanceId: "beta" });
  root.name = "unitree-r1-edu-beta-container";
  return root;
}
const secondRobot = isCooperativeLevel ? createR1PartnerRobot() : null;
const robotGroundY = runtime.getRobotGroundY?.() ?? 0;
const mujocoEnabled = robotId === "g1" && !isCooperativeLevel && !isOfficeSeries;
let mujocoOnline = false;
let latestMujocoState = null;
let lastMujocoMotionAnchor = null;
const mujocoClient = mujocoEnabled
  ? new MujocoClient({
    onState: (nextState) => { latestMujocoState = nextState; },
    onStatus: (status) => {
      mujocoOnline = status === "online";
      if (!mujocoOnline) lastMujocoMotionAnchor = null;
      gameShell.dataset.mujocoStatus = status;
      updateInterface();
    },
  })
  : null;
robot.position.set(state.player.x, robotGroundY, state.player.z);
robot.rotation.y = state.player.yaw;
world.scene.add(robot);
if (secondRobot) world.scene.add(secondRobot);
Promise.allSettled([robot.userData.assetReady, world.collisionReady]).then(([robotResult, collisionResult]) => {
  if (!["rf01", "rf01-2", "rf01-3"].includes(levelId) || robotId !== "g1" || robotResult.status !== "fulfilled" || collisionResult.status !== "fulfilled") return;
  const rig = robot.userData.collisionRig;
  if (!rig || !collisionResult.value?.loaded || rig.staticParts.length) return;
  LEVEL.staticColliders.forEach(rect => rig.addStaticBox(
    [(rect.minX + rect.maxX) / 2, 1.2, (rect.minZ + rect.maxZ) / 2],
    [rect.maxX - rect.minX, 2.4, rect.maxZ - rect.minZ], rect.id));
  gameShell.dataset.g1CollisionReady = "true";
  gameShell.dataset.g1CollisionGeomCount = String(rig.getCollisionSummary().total);
});
world.scene.add(firstPersonCamera);
camera.position.copy(cameraPosition);
camera.lookAt(cameraLookAt);
function updateThirdPersonCameraPose() {
  const distance = thirdPersonBaseDistance * thirdPersonFramingScale * thirdPersonZoom;
  const horizontalDistance = Math.cos(thirdPersonOrbitPitch) * distance;
  camera.position.set(
    cameraLookAt.x + Math.sin(thirdPersonOrbitYaw) * horizontalDistance,
    cameraLookAt.y + Math.sin(thirdPersonOrbitPitch) * distance,
    cameraLookAt.z + Math.cos(thirdPersonOrbitYaw) * horizontalDistance,
  );
  camera.far = Math.max(100, distance + 80);
  const fogScale = thirdPersonFramingScale * thirdPersonZoom;
  if (world.scene.fog?.isFog) {
    world.scene.fog.near = baseFogNear * fogScale;
    world.scene.fog.far = baseFogFar * fogScale;
  } else if (world.scene.fog?.isFogExp2) {
    world.scene.fog.density = baseFogDensity / fogScale;
  }
  camera.lookAt(cameraLookAt);
}

function updateCameraFraming() {
  const views = getViewports(viewMode, window.innerWidth, window.innerHeight);
  const thirdView = views.find((view) => view.view === "third") ?? views[0];
  const firstView = views.find((view) => view.view === "first") ?? views[0];
  const thirdAspect = thirdView.width / thirdView.height;
  const narrowScale = isCooperativeLevel && viewMode === "dual"
    ? 0.95
    : thirdAspect < 1 ? Math.min(3.35, 1.5 / thirdAspect) : 1;
  thirdPersonFramingScale = narrowScale;
  camera.aspect = thirdAspect;
  camera.updateProjectionMatrix();
  updateThirdPersonCameraPose();
  if (robotProfile.supportsD435) configureUnitreeG1D435DepthCamera(firstPersonCamera);
}
updateCameraFraming();

function selectViewMode(nextMode) {
  viewMode = resolveViewMode(nextMode, null);
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  } catch {
    // The selected mode still applies for this session when storage is blocked.
  }
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("view", viewMode);
  nextUrl.searchParams.set("robot", robotId);
  nextUrl.searchParams.set("control", controlModeId);
  window.history.replaceState(null, "", nextUrl);
  applyLevelCopy();
  updateCameraFraming();
  thirdPersonViewControls?.refresh();
  renderViews();
}
const audioSystem = createAudioSystem(camera, world.scene, runtime.audio);
world.assetReady.then((results) => {
  gameShell.dataset.cardinalAssetsLoaded = String(results.filter((result) => result.loaded).length);
  gameShell.dataset.cardinalAssetsTotal = String(results.length);
});
world.gaussianReady?.then((result) => {
  gameShell.dataset.gaussianLoaded = String(result.loaded);
  gameShell.dataset.gaussianLoadMs = result.loadMs.toFixed(1);
});
environmentReady.then((result) => {
  gameShell.dataset.environmentMapLoaded = String(result.loaded);
});
let robotAssetsLoaded = false;
let robotAssetsFailed = false;
startButton.disabled = true;
startButton.textContent = `正在加载 ${robotProfile.label}…`;
gameShell.dataset.robotAssetState = "loading";
const robotLoadStatusTimer = window.setInterval(() => {
  const attempts = Math.max(robot.userData.loadAttempt, 1);
  const retrying = robot.userData.loadState === "retrying";
  startButton.textContent = retrying
    ? `正在重新加载 ${robotProfile.label}（${attempts}/3）…`
    : `正在加载 ${robotProfile.label}…`;
}, 200);
const collisionReady = world.collisionReady ?? Promise.resolve({ loaded: true });
const cargoAssetReady = cargoModel?.userData?.assetReady ?? Promise.resolve({ loaded: true });
let browserPhysics = null;
const browserPhysicsReady = runtime.createInteractionAnimation && controlModeId === "velocity"
  ? Promise.all([robot.userData.assetReady, world.assetReady]).then(async () => {
    browserPhysics = await runtime.createInteractionAnimation(world, robot, {
      runtime, getState: () => state, setState: (next) => { state = next; },
      stop: releaseAllControls, message: showToast,
    });
    return { loaded: true };
  })
  : robotId === "g1" && controlModeId === "velocity" && ["rf15-1", "rf15-2", "rf15-3"].includes(levelId)
  ? Promise.all([robot.userData.assetReady, world.assetReady]).then(async () => {
    const { createInteractionAnimation } = await import("./levels/rf15/interaction-animation.js");
    browserPhysics = await createInteractionAnimation(world, robot, {
      runtime, controlMode: controlModeId,
      getState: () => state,
      setState: next => { state = next; },
      stop: releaseAllControls,
      message: showToast,
      robotFeedback: () => latestMujocoState,
    });
    return { loaded: true };
  })
  : Promise.resolve({ loaded: true });
browserPhysicsReady.catch(error => { gameShell.dataset.physicsError = String(error); console.error(error); });
const environmentAssetReady = world.assetReady ?? Promise.resolve([{ loaded: true }]);
const secondRobotAssetReady = secondRobot?.userData?.assetReady ?? Promise.resolve({ loaded: true });
Promise.allSettled([robot.userData.assetReady, secondRobotAssetReady, collisionReady, cargoAssetReady, environmentAssetReady, browserPhysicsReady]).then(([robotResult, secondRobotResult, collisionResult, cargoResult, environmentResult, physicsResult]) => {
  const thirdPersonAsset = robotResult.status === "fulfilled"
    ? robotResult.value
    : { loaded: false, asset: UNITREE_G1_DEX1_GLB_URL, error: robotResult.reason };
  const collisionAsset = collisionResult.status === "fulfilled"
    ? collisionResult.value
    : { loaded: false, error: collisionResult.reason };
  const cargoAsset = cargoResult.status === "fulfilled"
    ? cargoResult.value
    : { loaded: false, error: cargoResult.reason };
  window.clearInterval(robotLoadStatusTimer);
  const cargoAssetResults = Array.isArray(cargoAsset) ? cargoAsset.flat(Infinity) : [cargoAsset];
  const cargoAssetsLoaded = cargoAssetResults.every((asset) => asset?.loaded);
  const environmentAssets = environmentResult.status === "fulfilled" && Array.isArray(environmentResult.value) ? environmentResult.value : [];
  const environmentAssetsLoaded = environmentAssets.every((asset) => asset?.loaded) && physicsResult.status === "fulfilled";
  robotAssetsLoaded = thirdPersonAsset.loaded && (secondRobotResult.status !== "fulfilled" || secondRobotResult.value?.loaded !== false) && environmentAssetsLoaded;
  robotAssetsFailed = !robotAssetsLoaded;
  gameShell.dataset.robotModelLoaded = String(thirdPersonAsset.loaded);
  gameShell.dataset.firstPersonRobotLoaded = String(thirdPersonAsset.loaded);
  gameShell.dataset.robotAssetState = robotAssetsLoaded ? "ready" : "failed";
  gameShell.dataset.robotAssetError = robot.userData.loadError;
  gameShell.dataset.collisionProxyLoaded = String(collisionAsset.loaded);
  gameShell.dataset.cargoAssetLoaded = String(cargoAssetsLoaded);
  gameShell.dataset.requiredAssetsReady = String(robotAssetsLoaded && collisionAsset.loaded && cargoAssetsLoaded);
  startButton.disabled = false;
  startButton.innerHTML = robotAssetsLoaded ? startButtonLabel : `${robotProfile.label} 加载失败 · 点击重试`;
  if (robotAssetsLoaded && episodeMode) startGame();
});

const keys = new Set();
let operatorConsole = null;
let thirdPersonViewControls = null;
let running = false;
let externalSimulation = false;
let lastTime = performance.now();
let toastTimer = 0;
let completeShown = false;
let failureShown = false;

const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function showToast(message) {
  if (!message) return;
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2200);
}

function localControlEnabled() {
  return running && !externalSimulation && !state.complete && !state.failed && !state.terminalOpen;
}

function setControlPressed(code, pressed) {
  if (!LOCAL_CONTROL_CODES.has(code)) return false;
  if (pressed && localControlEnabled()) keys.add(code);
  else keys.delete(code);
  operatorConsole?.setPressed(code, pressed && keys.has(code));
  return keys.has(code);
}

function releaseAllControls() {
  keys.clear();
  operatorConsole?.clearPressed();
}

function stopControlInput() {
  releaseAllControls();
  browserPhysics?.cancel();
  robotAction = finishRobotAction();
  showToast("移动输入已停止");
  updateInterface();
}

function resetSimulation({ force = false } = {}) {
  audioSystem.stopAll();
  robotAction = finishRobotAction();
  state = runtime.createInitialState();
  gaitDistance = 0;
  completeShown = false;
  failureShown = false;
  completeOverlay.hidden = true;
  failureOverlay.hidden = true;
  terminalOverlay.hidden = true;
  robot.position.set(state.player.x, robotGroundY, state.player.z);
  robot.rotation.y = state.player.yaw;
  latestMujocoState = null;
  lastMujocoMotionAnchor = null;
  mujocoClient?.reset({ x: state.player.x, z: state.player.z, yaw: state.player.yaw });
  releaseAllControls();
  browserPhysics?.reset();
  updateInterface();
  if (!force) showToast("模拟环境已重置");
  return true;
}

function resetGame() {
  return resetSimulation();
}

function hudObservation() {
  const telemetry = runtime.getTelemetry(state);
  return {
    objective: finalObjective,
    reserve: Math.max(0, Math.round(state.progress)),
    cargo: telemetry.cargo,
    system: telemetry.system,
    gate: telemetry.gate,
    result: state.complete ? "success" : state.failed ? "failure" : "running",
  };
}

function drawPanel(context, element, painter) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || element.hidden) return;
  context.save();
  context.translate(rect.left, rect.top);
  context.beginPath();
  context.rect(0, 0, rect.width, rect.height);
  context.clip();
  context.fillStyle = "rgba(12, 18, 18, 0.88)";
  context.fillRect(0, 0, rect.width, rect.height);
  context.strokeStyle = "rgba(167, 188, 180, 0.42)";
  context.lineWidth = 1;
  context.strokeRect(0.5, 0.5, rect.width - 1, rect.height - 1);
  painter(context, rect.width, rect.height);
  context.restore();
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = String(text || "").split(/\s+/);
  let line = "";
  let lineIndex = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth) {
      context.fillText(line, x, y + lineIndex * lineHeight, maxWidth);
      line = word;
      lineIndex += 1;
      if (lineIndex >= maxLines) return;
    } else {
      line = next;
    }
  }
  if (lineIndex < maxLines && line) context.fillText(line, x, y + lineIndex * lineHeight, maxWidth);
}

function drawVisibleHud(context) {
  const muted = "#a9b8b1";
  const bright = "#f3f7f4";
  const accent = "#78d8a3";
  context.textBaseline = "alphabetic";
  context.letterSpacing = "0px";

  [document.querySelector(".controls-hint"), document.querySelector(".legacy-link")]
    .forEach((element) => {
      const rect = element?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      context.fillStyle = "rgba(8, 12, 12, 0.96)";
      context.fillRect(rect.left, rect.top, rect.width, rect.height);
    });

  drawPanel(context, document.querySelector(".top-hud"), (panel, width, height) => {
    panel.fillStyle = muted;
    panel.font = "600 11px system-ui, sans-serif";
    panel.fillText($("#unit-label").textContent, 18, 22, width * 0.3);
    panel.fillStyle = bright;
    panel.font = "700 17px system-ui, sans-serif";
    panel.fillText($("#brand-name").textContent, 18, 47, width * 0.3);

    const reserveX = width * 0.39;
    const reserveWidth = Math.max(120, width * 0.24);
    panel.fillStyle = muted;
    panel.font = "600 11px system-ui, sans-serif";
    panel.fillText("MISSION RESERVE", reserveX, 21);
    panel.fillStyle = bright;
    panel.font = "700 17px system-ui, sans-serif";
    panel.textAlign = "right";
    panel.fillText(progressValue.textContent, reserveX + reserveWidth, 22);
    panel.textAlign = "left";
    panel.fillStyle = "rgba(255,255,255,0.14)";
    panel.fillRect(reserveX, 34, reserveWidth, 9);
    panel.fillStyle = state.progress <= 15 ? "#ef6b62" : state.progress <= 35 ? "#e6c45c" : accent;
    panel.fillRect(reserveX, 34, reserveWidth * Math.max(0, state.progress) / 100, 9);

    panel.fillStyle = muted;
    panel.font = "600 11px system-ui, sans-serif";
    panel.fillText($("#system-label").textContent, width * 0.75, 22, width * 0.22);
    panel.fillStyle = bright;
    panel.font = "700 17px system-ui, sans-serif";
    panel.fillText(powerLabel.textContent, width * 0.75, 47, width * 0.22);
  });

  drawPanel(context, document.querySelector(".mission-panel"), (panel, width) => {
    panel.fillStyle = muted;
    panel.font = "600 10px system-ui, sans-serif";
    panel.fillText("CURRENT DIRECTIVE", 18, 24);
    panel.fillStyle = bright;
    panel.font = "700 20px system-ui, sans-serif";
    panel.fillText(objectiveTitle.textContent, 18, 54, width - 36);
  });

  drawPanel(context, document.querySelector(".telemetry-panel"), (panel, width) => {
    const rows = [
      ["ROBOT STATE", robotState.textContent],
      [$("#cargo-label").textContent, cargoState.textContent],
      [$("#gate-label").textContent, gateState.textContent],
    ];
    rows.forEach(([label, value], index) => {
      const y = 24 + index * 38;
      panel.fillStyle = muted;
      panel.font = "600 10px system-ui, sans-serif";
      panel.fillText(label, 16, y, width * 0.48);
      panel.fillStyle = bright;
      panel.font = "700 12px system-ui, sans-serif";
      panel.textAlign = "right";
      panel.fillText(value, width - 16, y, width * 0.48);
      panel.textAlign = "left";
    });
  });

  if (!terminalOverlay.hidden) {
    drawPanel(context, document.querySelector(".terminal-card"), (panel, width) => {
      panel.fillStyle = muted;
      panel.font = "600 10px system-ui, sans-serif";
      panel.fillText($("#terminal-heading-text").textContent, 20, 27, width - 40);
      panel.fillStyle = bright;
      panel.font = "700 22px system-ui, sans-serif";
      panel.fillText(terminalTitle.textContent, 20, 62, width - 40);
      panel.fillStyle = muted;
      panel.font = "400 12px system-ui, sans-serif";
      drawWrappedText(panel, terminalCopy.textContent, 20, 88, width - 40, 17, 3);
      terminalValues.forEach((value, index) => {
        panel.fillStyle = bright;
        panel.font = "600 11px system-ui, sans-serif";
        panel.fillText(`${terminalLabels[index].textContent}: ${value.textContent}`, 20, 150 + index * 24, width - 40);
      });
    });
  }
}

function updateFirstPersonView() {
  if (isCooperativeLevel) {
    if (!getUnitreeG1D435WorldPose(robot, firstPersonCamera.position, firstPersonForward)) return;
    firstPersonForward.set(Math.sin(state.player.yaw), 0, Math.cos(state.player.yaw));
    const firstPersonRight = new THREE.Vector3(Math.cos(state.player.yaw), 0, -Math.sin(state.player.yaw));
    firstPersonForward.applyAxisAngle(firstPersonRight, d435LookPitch);
    firstPersonCamera.lookAt(firstPersonCamera.position.clone().add(firstPersonForward));
    return;
  }
  if (!getUnitreeG1D435WorldPose(robot, firstPersonCamera.position, firstPersonForward)) {
    const socket = robot.userData?.officialModel?.userData?.sculptRuntime?.sockets?.camera;
    if (!socket) return;
    socket.updateWorldMatrix(true, false);
    firstPersonCamera.position.setFromMatrixPosition(socket.matrixWorld);
    firstPersonForward.set(1, 0, 0).transformDirection(socket.matrixWorld);
  }
  firstPersonLookAt.copy(firstPersonCamera.position).add(firstPersonForward);
  firstPersonCamera.lookAt(firstPersonLookAt);
}

function updateSecondFirstPersonView() {
  if (!secondRobot || !secondFirstPersonCamera) return;
  const r1Model = secondRobot.userData?.model;
  const cameraSocket = r1Model?.userData?.sculptRuntime?.sockets?.camera;
  if (cameraSocket) {
    const cameraQuaternion = new THREE.Quaternion();
    cameraSocket.getWorldPosition(secondFirstPersonCamera.position);
    cameraSocket.getWorldQuaternion(cameraQuaternion);
    r1CameraForward.set(Math.sin(state.partner.yaw), 0, Math.cos(state.partner.yaw)).normalize();
    r1CameraRight.set(Math.cos(state.partner.yaw), 0, -Math.sin(state.partner.yaw)).normalize();
    r1CameraForward.applyAxisAngle(r1CameraRight, d435LookPitchBeta);
    secondFirstPersonCamera.lookAt(secondFirstPersonCamera.position.clone().add(r1CameraForward));
    return;
  }
  const forward = new THREE.Vector3();
  if (!getUnitreeG1D435WorldPose(secondRobot, secondFirstPersonCamera.position, forward)) return;
  secondFirstPersonCamera.lookAt(secondFirstPersonCamera.position.clone().add(forward));
}

function renderViews() {
  updateFirstPersonView();
  updateSecondFirstPersonView();
  const width = window.innerWidth;
  const height = window.innerHeight;
  const views = isCooperativeLevel && viewMode === "dual"
    ? (() => {
      const leftWidth = Math.floor(width * 0.5);
      const rightWidth = width - leftWidth;
      const halfHeight = Math.floor(height * 0.5);
      return [
        { view: "first-alpha", x: 0, y: halfHeight, width: leftWidth, height: height - halfHeight },
        { view: "first-beta", x: 0, y: 0, width: leftWidth, height: halfHeight },
        { view: "third", x: leftWidth, y: 0, width: rightWidth, height },
      ];
    })()
    : getViewports(viewMode, width, height);
  const split = views.length > 1;
  const gaussianViews = views.map((view) => view.view.startsWith("first")
    ? (robotProfile.supportsD435 ? { ...fitAspectViewport(view, UNITREE_G1_D435_DEPTH_CAMERA.aspect), view: view.view } : view)
    : view);
  world.gaussianLayer?.syncViews(gaussianViews, { first: firstPersonCamera, third: camera });
  views.forEach((view) => {
    const firstPerson = view.view.startsWith("first");
    const betaView = view.view === "first-beta";
    const renderView = firstPerson && robotProfile.supportsD435 ? fitAspectViewport(view, UNITREE_G1_D435_DEPTH_CAMERA.aspect) : view;
    robot.visible = true;
    const activeCamera = firstPerson ? (betaView ? secondFirstPersonCamera : firstPersonCamera) : camera;
    if (isCooperativeLevel) { robot.visible = true; if (secondRobot) secondRobot.visible = true; }
    renderer.setScissorTest(split || firstPerson);
    if (firstPerson) {
      renderer.setViewport(view.x, view.y, view.width, view.height);
      renderer.setScissor(view.x, view.y, view.width, view.height);
      renderer.setClearColor(levelId === "rf10" ? 0x000000 : 0x050708, levelId === "rf10" ? 0 : 1);
      renderer.clear(true, true, true);
    }
    renderer.setViewport(renderView.x, renderView.y, renderView.width, renderView.height);
    if (split || firstPerson) renderer.setScissor(renderView.x, renderView.y, renderView.width, renderView.height);
    if (firstPerson && robotProfile.supportsD435) {
      configureUnitreeG1D435DepthCamera(activeCamera);
    } else {
      activeCamera.aspect = renderView.width / Math.max(1, renderView.height);
      activeCamera.updateProjectionMatrix();
    }
      const r1Head = betaView ? secondRobot?.userData?.model?.userData?.sculptRuntime?.sockets?.head : null;
      if (r1Head) r1Head.visible = false;
      if (firstPerson && robotProfile.supportsD435 && (!betaView || !secondRobot?.userData?.model)) setUnitreeG1FirstPersonHeadVisible(robot, false);
    try {
      runtime.prepareView?.(world, { firstPerson });
      if (postProcessing && !split && !firstPerson) postProcessing.render(activeCamera);
      else renderer.render(world.scene, activeCamera);
    } finally {
      if (firstPerson && robotProfile.supportsD435 && (!betaView || !secondRobot?.userData?.model)) setUnitreeG1FirstPersonHeadVisible(robot, true);
      if (r1Head) r1Head.visible = true;
    }
  });
  robot.visible = true;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, width, height);
}

function captureFrame() {
  renderViews();
  const width = Math.min(1600, window.innerWidth);
  const height = Math.max(1, Math.round(width * window.innerHeight / window.innerWidth));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.drawImage(renderer.domElement, 0, 0, width, height);
  context.save();
  context.scale(width / window.innerWidth, height / window.innerHeight);
  drawVisibleHud(context);
  context.restore();
  return canvas.toDataURL("image/jpeg", 0.84);
}

function captureRenderFrame() {
  renderViews();
  const canvas = document.createElement("canvas");
  canvas.width = renderer.domElement.width;
  canvas.height = renderer.domElement.height;
  canvas.getContext("2d", { alpha: false }).drawImage(renderer.domElement, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function waitForRobotAction() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timeout = window.setTimeout(finish, 1800);
    function check() {
      if (!isRobotActionActive(robotAction)) {
        window.clearTimeout(timeout);
        finish();
      }
      else requestAnimationFrame(check);
    }
    check();
  });
}

function waitForFrameSync(timeoutMs = 120) {
  return Promise.race([
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    delay(timeoutMs),
  ]);
}

async function executeAgentAction(action, durationMs = 300) {
  if (["W", "A", "S", "D"].includes(action)) {
    const input = {
      W: { move: 1, strafe: 0, turn: 0 },
      A: { move: 0, strafe: 1, turn: 0 },
      S: { move: -1, strafe: 0, turn: 0 },
      D: { move: 0, strafe: -1, turn: 0 },
    }[action];
    externalSimulation = true;
    try {
      let remainingMs = durationMs;
      while (remainingMs > 0) {
        const deltaSeconds = Math.min(0.05, remainingMs / 1000);
        if (running && !state.complete && !state.failed) {
          const previousX = state.player.x;
          const previousZ = state.player.z;
          const movementInput = mujocoEnabled && controlModeId === "velocity"
            ? scaleMujocoVelocityForFrontend(input, runtime.LEVEL)
            : input;
          state = runtime.updateMovement(state, movementInput, deltaSeconds);
          gaitDistance += Math.hypot(state.player.x - previousX, state.player.z - previousZ);
          robot.position.set(state.player.x, robotGroundY, state.player.z);
          robot.rotation.y = state.player.yaw;
          runtime.syncRobotCargo?.(robot, state);
          updateInterface();
        }
        remainingMs -= deltaSeconds * 1000;
        await delay(deltaSeconds * 1000);
      }
    } finally {
      externalSimulation = false;
    }
  } else if (action === "E") {
    performInteraction();
    if (isRobotActionActive(robotAction)) await waitForRobotAction();
    else await delay(durationMs);
  } else if (action === "WAIT") {
    await delay(durationMs);
  }
  await waitForFrameSync();
}
let externalAgentAction = Promise.resolve();

function startGame(event) {
  event?.preventDefault();
  event?.stopPropagation();
  if (robotAssetsFailed) {
    const retryUrl = new URL(window.location.href);
    if (!episodeMode) {
      retryUrl.search = "";
      retryUrl.searchParams.set("mode", pageMode === "agent" ? "agent" : "play");
      retryUrl.searchParams.set("level", levelId);
      retryUrl.searchParams.set("view", viewMode);
      retryUrl.searchParams.set("robot", robotId);
      retryUrl.searchParams.set("control", controlModeId);
    }
    window.location.assign(retryUrl);
    return;
  }
  if (!robotAssetsLoaded) {
    showToast("G1 EDU2 · MuJoCo 29DOF 模型尚未加载完成，当前禁止进入任务");
    return;
  }
  void audioSystem.unlock();
  if (!episodeMode) {
    const gameplayUrl = new URL(window.location.href);
    gameplayUrl.search = "";
    gameplayUrl.searchParams.set("mode", pageMode === "agent" ? "agent" : "play");
    gameplayUrl.searchParams.set("level", levelId);
    gameplayUrl.searchParams.set("view", viewMode);
    gameplayUrl.searchParams.set("robot", robotId);
    gameplayUrl.searchParams.set("control", controlModeId);
    for (const name of ["physics", "qa"]) {
      if (searchParams.has(name)) gameplayUrl.searchParams.set(name, searchParams.get(name));
    }
    window.history.replaceState(null, "", gameplayUrl);
  }
  running = true;
  if (mujocoEnabled) {
    mujocoClient.connect();
    mujocoClient.setControlMode(mujocoControlMode);
    mujocoClient.reset({ x: state.player.x, z: state.player.z, yaw: state.player.yaw });
  }
  homeOverlay.hidden = true;
  startOverlay.hidden = true;
  returnToLevels.hidden = !["play", "agent"].includes(pageMode) || episodeMode;
  lastTime = performance.now();
  updateInterface();
}

function showLevelSelector() {
  if (episodeMode) return;
  running = false;
  externalSimulation = false;
  resetSimulation({ force: true });
  homeOverlay.hidden = true;
  startOverlay.hidden = false;
  returnToLevels.hidden = true;
  const nextUrl = new URL(window.location.href);
  nextUrl.search = "";
  nextUrl.searchParams.set("mode", pageMode === "agent" ? "agent" : "play");
  nextUrl.searchParams.set("level", levelId);
  nextUrl.searchParams.set("view", viewMode);
  nextUrl.searchParams.set("robot", robotId);
  nextUrl.searchParams.set("control", controlModeId);
  window.history.replaceState(null, "", nextUrl);
}

function updateTerminal() {
  const terminal = runtime.getTerminal(state);
  terminalTitle.textContent = terminal.title;
  terminalCopy.textContent = terminal.copy;
  terminal.rows.forEach(([label, value], index) => {
    terminalLabels[index].textContent = label;
    terminalValues[index].textContent = value;
  });
}

function updateInterface() {
  const telemetry = runtime.getTelemetry(state);
  powerLabel.textContent = telemetry.system;
  powerLabel.classList.toggle("online", telemetry.systemOnline);
  systemLight.classList.toggle("online", telemetry.systemOnline);
  robotState.textContent = (isCooperativeLevel ? `${state.motion.alpha}/${state.motion.beta}` : state.motion).toUpperCase();
  cargoState.textContent = telemetry.cargo;
  gateState.textContent = telemetry.gate;
  const roundedProgress = Math.max(0, Math.round(state.progress));
  progressFill.style.width = `${state.progress}%`;
  progressValue.textContent = `${roundedProgress}%`;
  progressMeter.setAttribute("aria-valuenow", String(roundedProgress));
  progressMeter.classList.toggle("warning", state.progress <= 35 && state.progress > 15);
  progressMeter.classList.toggle("critical", state.progress <= 15);
  gameShell.classList.toggle("failed", state.failed);
  terminalOverlay.hidden = !state.terminalOpen;
  if (state.terminalOpen) updateTerminal();

  gameShell.dataset.playerX = state.player.x.toFixed(2);
  gameShell.dataset.playerZ = state.player.z.toFixed(2);
  gameShell.dataset.complete = String(state.complete);
  gameShell.dataset.failed = String(state.failed);
  gameShell.dataset.progress = state.progress.toFixed(2);
  const actionPose = getRobotActionPose(robotAction, runtime.isCarrying(state));
  gameShell.dataset.robotAction = robotAction.kind;
  gameShell.dataset.robotActionEvent = robotAction.event ?? "";
  gameShell.dataset.robotActionGesture = robotAction.gesture ?? "idle";
  gameShell.dataset.robotActionActive = String(robotAction.active);
  gameShell.dataset.robotActionProgress = actionPose.progress.toFixed(3);
  gameShell.dataset.robotActionContact = String(actionPose.contactReached);
  Object.entries(runtime.getDebugState(state)).forEach(([key, value]) => {
    gameShell.dataset[key] = typeof value === "object" ? JSON.stringify(value) : String(value);
  });
  const controlsReady = localControlEnabled();
  operatorConsole?.update({
    controlEnabled: controlsReady,
    controlMode: controlModeId === "joint" ? "29DOF AGENT" : externalSimulation ? "AGENT" : controlsReady ? "LOCAL" : "STANDBY",
    motion: (isCooperativeLevel ? `${state.motion.alpha}/${state.motion.beta}` : state.motion).toUpperCase(),
    input: controlModeId === "joint" ? "JOINT API" : externalSimulation ? "AGENT" : controlsReady ? "READY" : "LOCKED",
    feed: externalSimulation ? "AGENT" : running ? "RUNNING" : "STANDBY",
    level: runtime.ui.levelLabel ?? levelId.toUpperCase(),
  });
}

function performInteraction() {
  if (!running || state.complete || state.failed || isRobotActionActive(robotAction)) return false;
  void audioSystem.unlock();
  const beforeState = state;
  if (browserPhysics) {
    const handled = browserPhysics.interact();
    if (handled !== false) {
      updateInterface();
      return handled;
    }
  }
  const beforeInteractions = state.interactions;
  state = runtime.interact(state, isCooperativeLevel ? (window.__RF11_INTERACTION_AGENT__ || "alpha") : "alpha");
  if (state.interactions !== beforeInteractions) {
    robotAction = beginRobotAction(robotAction, state.lastEvent, beforeState, state);
    audioSystem.playEvent(state.lastEvent, runtime.getSoundPosition(beforeState, state));

  }
  updateInterface();
  return state.interactions !== beforeInteractions;
}

function readInput() {
  let move = 0;
  let strafe = 0;
  let turn = 0;
  if (keys.has("KeyW")) move += 1;
  if (keys.has("KeyS")) move -= 1;
  if (keys.has("KeyA")) strafe += 1;
  if (keys.has("KeyD")) strafe -= 1;
  if (keys.has("KeyQ")) turn += 1;
  if (keys.has("KeyE")) turn -= 1;
  if (!isCooperativeLevel) return { move, strafe, turn, drain: move !== 0 || strafe !== 0 };
  return {
    alpha: { move, strafe, turn, drain: move !== 0 || strafe !== 0 },
    beta: {
      move: (keys.has("KeyI") ? 1 : 0) + (keys.has("KeyK") ? -1 : 0),
      strafe: (keys.has("KeyJ") ? 1 : 0) + (keys.has("KeyL") ? -1 : 0),
      turn: (keys.has("KeyU") ? 1 : 0) + (keys.has("KeyO") ? -1 : 0),
      drain: keys.has("KeyI") || keys.has("KeyK") || keys.has("KeyJ") || keys.has("KeyL"),
    },
  };
}

function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  robotAction = advanceRobotAction(robotAction, delta);
  const input = isRobotActionActive(robotAction)
    ? (isCooperativeLevel ? { alpha: {}, beta: {} } : { move: 0, strafe: 0, turn: 0, drain: false })
    : browserPhysics?.busy ? browserPhysics.motionInput(state, readInput()) ?? { move: 0, strafe: 0, turn: 0, drain: false } : readInput();
  if (running && !externalSimulation && !state.complete && !state.failed) {
    if (browserPhysics?.busy) {
      mujocoClient?.setCommand({ forward: 0, lateral: 0, yaw: 0 }, levelId, { x: state.player.x, z: state.player.z, yaw: state.player.yaw });
      state = runtime.updateMovement(state, input, delta);
    } else if (mujocoEnabled && mujocoOnline && controlModeId === "velocity") {
      const velocity = { forward: input.move || 0, lateral: input.strafe || 0, yaw: input.turn || 0 };
      mujocoClient.setCommand(velocity, levelId, { x: state.player.x, z: state.player.z, yaw: state.player.yaw });
    } else if (!mujocoEnabled) {
      const previousX = state.player.x;
      const previousZ = state.player.z;
      state = runtime.updateMovement(state, input, delta);
      gaitDistance += Math.hypot(state.player.x - previousX, state.player.z - previousZ);
    }
  }
  const environmentActionPose = getRobotActionPose(robotAction, runtime.isCarrying(state));
  const environmentActionBlocked = robotAction.kind === "operate" && !environmentActionPose.contactReached;
  if (running && !state.complete && !state.failed && runtime.updateEnvironment && !environmentActionBlocked) {
    state = runtime.updateEnvironment(state, delta);
  }
  const pose = getRobotActionPose(robotAction, runtime.isCarrying(state));
  const presentationState = getRobotPresentationState(robotAction, state);
  const sampledMujocoState = mujocoEnabled && mujocoOnline ? mujocoClient.sample(now) : null;
  if (sampledMujocoState) {
    const currentMujocoMotionAnchor = {
      position: sampledMujocoState.base.position,
      yaw: sampledMujocoState.base.yaw,
    };
    if (!lastMujocoMotionAnchor) {
      lastMujocoMotionAnchor = currentMujocoMotionAnchor;
    } else if (running && !externalSimulation && !state.complete && !state.failed) {
      const movementInput = projectMujocoDeltaToFrontendInput(
        lastMujocoMotionAnchor,
        currentMujocoMotionAnchor,
        runtime.LEVEL,
        delta,
        input,
      );
      if (movementInput && !browserPhysics?.busy && (!browserPhysics || input.move || input.strafe || input.turn)) {
        const previousX = state.player.x;
        const previousZ = state.player.z;
        state = runtime.updateMovement(state, { ...movementInput, passiveMotion: !input.move && !input.strafe }, delta);
        gaitDistance += Math.hypot(state.player.x - previousX, state.player.z - previousZ);
      }
      lastMujocoMotionAnchor = currentMujocoMotionAnchor;
    } else {
      lastMujocoMotionAnchor = currentMujocoMotionAnchor;
    }
    applyMujocoState(robot, sampledMujocoState, robotProfile, {
      groundY: robotGroundY,
      lookPitch: d435LookPitch,
      projectWorldPose: false,
    });
    if (isRobotActionActive(robotAction) || pose.visualCarrying) applyRobotActionPose(robot, pose);
    robot.position.set(state.player.x, robot.position.y, state.player.z);
    robot.quaternion.setFromAxisAngle(up, state.player.yaw);
    robot.userData.collisionRig?.sync({ step: robot.userData.collisionRig.ownsWorld });
  } else {
    robot.position.set(state.player.x, robotGroundY, state.player.z);
    robot.rotation.y = state.player.yaw;
  }
  if (secondRobot) { secondRobot.position.set(state.partner.x, robotGroundY, state.partner.z); secondRobot.rotation.y = state.partner.yaw; }
  if (levelId === "rf01" || levelId === "rf01-2") syncRF01BatteryPose(robot, pose, state, robotAction);
  runtime.syncRobotCargo?.(robot, presentationState);
  const lookDirection = (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);
  d435LookPitch = THREE.MathUtils.clamp(
    d435LookPitch + lookDirection * THREE.MathUtils.degToRad(28) * delta,
    UNITREE_G1_HEAD_PITCH.minimumRadians,
    UNITREE_G1_HEAD_PITCH.maximumRadians,
  );
  if (isCooperativeLevel) {
    const betaLookDirection = (keys.has("Equal") ? 1 : 0) - (keys.has("Minus") ? 1 : 0);
    d435LookPitchBeta = THREE.MathUtils.clamp(
      d435LookPitchBeta + betaLookDirection * THREE.MathUtils.degToRad(28) * delta,
      UNITREE_G1_HEAD_PITCH.minimumRadians,
      UNITREE_G1_HEAD_PITCH.maximumRadians,
    );
  }
  if (!sampledMujocoState) updateRobotAnimation(robot, delta, state.elapsed, isCooperativeLevel ? state.motion.alpha : state.motion, pose, gaitDistance, d435LookPitch);
  if (secondRobot?.userData?.model) updateUnitreeR1EduModel(secondRobot.userData.model, delta, state.elapsed, state.motion.beta, null, d435LookPitchBeta);
  runtime.syncVisuals(world, presentationState, delta);
  browserPhysics?.frame(delta, running && !state.complete && !state.failed);
  if (state.complete && !completeShown && !isRobotActionActive(robotAction)) {
    completeShown = true;
    window.setTimeout(() => { completeOverlay.hidden = false; }, 550);
  }
  if (state.failed && !failureShown) {
    failureShown = true;
    releaseAllControls();
    robotAction = finishRobotAction();
    const failureCopy = runtime.getFailureMessage?.(state);
    if (failureCopy) failureOverlay.querySelector("p").textContent = failureCopy;
    failureOverlay.hidden = false;
  }
  updateInterface();
  renderViews();
}

window.addEventListener("keydown", (event) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "KeyF", "KeyR", "ArrowUp", "ArrowDown", "Escape", "KeyI", "KeyJ", "KeyK", "KeyL", "KeyU", "KeyO", "KeyH", "Minus", "Equal"].includes(event.code)) event.preventDefault();
  if ((event.code === "KeyF" || (isCooperativeLevel && event.code === "KeyH")) && !event.repeat) { window.__RF11_INTERACTION_AGENT__ = event.code === "KeyH" ? "beta" : "alpha"; performInteraction(); }
  else if (event.code === "KeyR" && !event.repeat) resetGame();
  else if (event.code === "Escape" && state.terminalOpen) {
    state = runtime.closeTerminal(state);
    updateInterface();
  } else setControlPressed(event.code, true);
});
window.addEventListener("keyup", (event) => setControlPressed(event.code, false));
window.addEventListener("blur", () => {
  releaseAllControls();
  robotAction = finishRobotAction();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  releaseAllControls();
  robotAction = finishRobotAction();
});
window.addEventListener("resize", () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, runtime.rendering?.pixelRatioCap ?? 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  postProcessing?.setSize(window.innerWidth, window.innerHeight);
  updateCameraFraming();
});

startButton.addEventListener("click", startGame);
returnToLevels.addEventListener("click", showLevelSelector);
levelOptions.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const nextUrl = new URL(window.location.href);
    if (isOfficeSeries) nextUrl.pathname = "/";
    nextUrl.search = "";
    nextUrl.searchParams.set("mode", pageMode === "agent" ? "agent" : "play");
    nextUrl.searchParams.set("level", link.dataset.levelOption);
    nextUrl.searchParams.set("view", viewMode);
    nextUrl.searchParams.set("robot", robotId);
    nextUrl.searchParams.set("control", controlModeId);
    window.location.assign(nextUrl.toString());
  });
});
restartButton.addEventListener("click", resetGame);
failureRestartButton.addEventListener("click", resetGame);
terminalClose.addEventListener("click", performInteraction);
viewModeOptions.forEach((button) => {
  button.addEventListener("click", () => selectViewMode(button.dataset.viewOption));
});
robotOptions.forEach((button) => {
  button.addEventListener("click", () => {
    const nextUrl = new URL(window.location.href);
    const nextRobotId = getRobotProfile(button.dataset.robotOption).id;
    nextUrl.searchParams.set("robot", nextRobotId);
    if (nextRobotId !== "g1") nextUrl.searchParams.set("control", "velocity");
    window.location.assign(nextUrl.toString());
  });
});
controlModeOptions.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled) return;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("control", button.dataset.controlOption);
    window.location.assign(nextUrl.toString());
  });
});
operatorConsole = mountOperatorConsole({
  root: operatorConsoleRoot,
  pressControl: (code) => setControlPressed(code, true),
  releaseControl: (code) => setControlPressed(code, false),
  interact: performInteraction,
  reset: resetGame,
  stop: stopControlInput,
});
thirdPersonViewControls = mountThirdPersonViewControls({
  element: renderer.domElement,
  shell: gameShell,
  getViewMode: () => viewMode,
  onOrbit: ({ yaw, pitch }) => {
    thirdPersonOrbitYaw += yaw;
    thirdPersonOrbitPitch = THREE.MathUtils.clamp(
      thirdPersonOrbitPitch + pitch,
      THREE.MathUtils.degToRad(12),
      THREE.MathUtils.degToRad(86),
    );
    updateThirdPersonCameraPose();
  },
  onZoom: (deltaY) => {
    thirdPersonZoom = nextThirdPersonZoom(thirdPersonZoom, deltaY);
    updateThirdPersonCameraPose();
  },
});

updateInterface();
requestAnimationFrame(animate);

window.__RELAY_DEMO__ = {
  getState: () => structuredClone(state),
  getRobotAction: () => structuredClone(robotAction),
  getInteraction: () => runtime.getInteraction?.(state) ?? null,
  captureFrame,
  level: LEVEL,
  levelId,
  getViewMode: () => viewMode,
  getThirdPersonView: () => ({
    yaw: thirdPersonOrbitYaw,
    pitch: thirdPersonOrbitPitch,
    zoom: thirdPersonZoom,
    interaction: thirdPersonViewControls?.getState() ?? null,
  }),
  getD435LookPitch: () => d435LookPitch,
  getMujocoState: () => latestMujocoState ? structuredClone(latestMujocoState) : null,
  getControlMode: () => controlModeId,
  getJointOrder: () => G1_29DOF_JOINT_ORDER,
  setJointTargets: (targets, durationMs = 100) => {
    if (controlModeId !== "joint" || !mujocoClient) {
      throw new Error("当前关卡没有启用 G1 29DOF Agent 控制");
    }
    mujocoClient.setJointTargets(targets, durationMs);
    return true;
  },
};

function externalAgentStatus() {
  return state.complete ? "WIN" : state.failed ? "GAME_OVER" : "NOT_FINISHED";
}

function createExternalAgentObservation(harness = "hybrid", actionResult = null) {
  if (!EXTERNAL_AGENT_HARNESSES.includes(harness)) throw new Error(`不支持的 Harness：${harness}`);
  const debug = runtime.getDebugState(state);
  const observation = {
    protocolVersion: "arc-env-v1",
    observedAt: new Date().toISOString(),
    gameId: `${levelId}-v1`,
    level: levelId,
    view: viewMode,
    harness,
    ready: robotAssetsLoaded && !robotAssetsFailed,
    status: externalAgentStatus(),
    availableActions: EXTERNAL_AGENT_ACTIONS,
    hud: hudObservation(),
    actionResult,
  };
  if (harness !== "state") observation.screenshot = captureFrame();
  if (harness === "hybrid") {
    observation.player = structuredClone(state.player);
    observation.motion = state.motion;
    observation.lastEvent = state.lastEvent;
    observation.interaction = runtime.getInteraction?.(state) ?? null;
    observation.debug = structuredClone(debug);
  }
  if (harness === "state") {
    observation.state = structuredClone(state);
    observation.interaction = runtime.getInteraction?.(state) ?? null;
    observation.debug = structuredClone(debug);
  }
  return observation;
}

async function executeExternalAgentAction(action, durationMs = 300, harness = "hybrid") {
  const normalizedAction = String(action || "").toUpperCase();
  if (!EXTERNAL_AGENT_ACTIONS.includes(normalizedAction)) throw new Error(`非法动作：${normalizedAction}`);
  if (!robotAssetsLoaded || robotAssetsFailed) throw new Error("G1 EDU2 · MuJoCo 29DOF 模型尚未加载完成");
      const normalizedDuration = Math.min(1000, Math.max(50, Number(durationMs) || 300));
      const run = async () => {
        if (!running) startGame();
        if (!running) return;
        const before = { x: state.player.x, z: state.player.z, yaw: state.player.yaw, interactions: state.interactions };
    await executeAgentAction(normalizedAction, normalizedDuration);
    const interacted = state.interactions !== before.interactions;
    const actionResult = {
      action: normalizedAction,
      durationMs: normalizedDuration,
      event: interacted ? state.lastEvent : normalizedAction === "E" ? "no_interaction" : "executed",
      moved: Math.hypot(state.player.x - before.x, state.player.z - before.z),
      turned: Math.abs(state.player.yaw - before.yaw),
      status: externalAgentStatus(),
    };
    return createExternalAgentObservation(harness, actionResult);
  };
  externalAgentAction = externalAgentAction.then(run, run);
  return externalAgentAction;
}

window.__ARC_AGENT__ = Object.freeze({
  protocolVersion: "arc-env-v1",
  ready: () => ({
    ready: robotAssetsLoaded && !robotAssetsFailed,
    assetState: gameShell.dataset.robotAssetState || "loading",
    level: levelId,
    view: viewMode,
  }),
  observe: (harness = "hybrid") => createExternalAgentObservation(harness),
  act: ({ action, durationMs = 300, harness = "hybrid" }) => executeExternalAgentAction(action, durationMs, harness),
  reset: ({ harness = "hybrid" } = {}) => {
    resetSimulation({ force: true });
    if (!running) startGame();
    return createExternalAgentObservation(harness, { action: "RESET", event: "environment_reset", status: externalAgentStatus() });
  },
  getState: () => structuredClone(state),
});

async function startEpisodeBridge() {
  const episodeId = searchParams.get("episode");
  const browserToken = searchParams.get("browser_token");
  if (!episodeId || !browserToken) return;
  gameShell.dataset.agentEpisode = episodeId;
  const basePath = `/api/v1/episodes/${encodeURIComponent(episodeId)}`;
  const request = async (path, options = {}) => {
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetch(`${basePath}/${path}${separator}browser_token=${encodeURIComponent(browserToken)}`, {
      cache: "no-store",
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) },
    });
    if (!response.ok && response.status !== 204) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || `Episode API 返回 ${response.status}`);
    }
    return response;
  };
  const submitObservation = async (payload) => {
    let retryDelay = 500;
    while (true) {
      try {
        const response = await request("observations", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        delete gameShell.dataset.agentBridgeError;
        return response;
      } catch (error) {
        gameShell.dataset.agentBridgeError = `观察回传失败，正在重试：${error.message}`;
        await delay(retryDelay);
        retryDelay = Math.min(5000, retryDelay * 2);
      }
    }
  };
  while (!robotAssetsLoaded && !robotAssetsFailed) await delay(250);
  if (!running && robotAssetsLoaded && !robotAssetsFailed) startGame();
  if (!running) {
    gameShell.dataset.agentBridgeError = "游戏尚未进入运行状态";
    return;
  }
  const harness = searchParams.get("harness") || "hybrid";
  await submitObservation({ observation: createExternalAgentObservation(harness) });
  while (true) {
    try {
      const response = await request("commands/next");
      if (response.status === 204) {
        await delay(300);
        continue;
      }
      const command = await response.json();
      let observation;
      if (command.kind === "act") {
        observation = await executeExternalAgentAction(command.payload.action, command.payload.durationMs, harness);
      } else if (command.kind === "reset") {
        observation = window.__ARC_AGENT__.reset({ harness });
      } else {
        observation = createExternalAgentObservation(harness, { action: "OBSERVE", event: "observed", status: externalAgentStatus() });
      }
      await submitObservation({ commandId: command.id, observation });
    } catch (error) {
      gameShell.dataset.agentBridgeError = error.message;
      await delay(1000);
    }
  }
}

void startEpisodeBridge();

if (searchParams.get("qaCapture") === "1") {
  window.setTimeout(() => {
    const frame = new Image();
    frame.id = "qa-captured-frame";
    frame.alt = "RF-01 QA captured frame";
    frame.src = captureRenderFrame();
    frame.hidden = true;
    document.body.append(frame);
  }, 6000);
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tIFwiL25vZGVfbW9kdWxlcy8udml0ZS9kZXBzL3RocmVlLmpzP3Y9OGIxMDYwZGJcIjtcbmltcG9ydCB7IGNyZWF0ZUF1ZGlvU3lzdGVtIH0gZnJvbSBcIi9nYW1lL2F1ZGlvLmpzXCI7XG5pbXBvcnQgeyBsb2FkUkYwMUVudmlyb25tZW50TWFwIH0gZnJvbSBcIi9nYW1lL3JmMDEtcHJvZHVjdGlvbi1hc3NldHMuanNcIjtcbmltcG9ydCB7IGNyZWF0ZVJGMDFQb3N0UHJvY2Vzc2luZyB9IGZyb20gXCIvZ2FtZS9yZjAxLXBvc3Rwcm9jZXNzaW5nLmpzXCI7XG5pbXBvcnQgeyBjcmVhdGVSb2JvdCwgdXBkYXRlUm9ib3RBbmltYXRpb24gfSBmcm9tIFwiL2dhbWUvcm9ib3QuanNcIjtcbmltcG9ydCB7XG4gIGNvbmZpZ3VyZVVuaXRyZWVHMUQ0MzVEZXB0aENhbWVyYSxcbiAgZ2V0VW5pdHJlZUcxRDQzNVdvcmxkUG9zZSxcbiAgc2V0VW5pdHJlZUcxRmlyc3RQZXJzb25IZWFkVmlzaWJsZSxcbiAgVU5JVFJFRV9HMV9ENDM1X0RFUFRIX0NBTUVSQSxcbiAgVU5JVFJFRV9HMV9IRUFEX1BJVENILFxufSBmcm9tIFwiL2dhbWUvdW5pdHJlZS1nMS1kZXgxLW1vZGVsLmpzXCI7XG5pbXBvcnQge1xuICBhZHZhbmNlUm9ib3RBY3Rpb24sXG4gIGJlZ2luUm9ib3RBY3Rpb24sXG4gIGNyZWF0ZVJvYm90QWN0aW9uU3RhdGUsXG4gIGZpbmlzaFJvYm90QWN0aW9uLFxuICBnZXRSb2JvdEFjdGlvblBvc2UsXG4gIGdldFJvYm90UHJlc2VudGF0aW9uU3RhdGUsXG4gIGlzUm9ib3RBY3Rpb25BY3RpdmUsXG59IGZyb20gXCIvZ2FtZS9yb2JvdC1hY3Rpb24uanNcIjtcbmltcG9ydCB7IGZpdEFzcGVjdFZpZXdwb3J0LCBnZXRWaWV3cG9ydHMsIHJlc29sdmVWaWV3TW9kZSB9IGZyb20gXCIvZ2FtZS92aWV3LW1vZGUuanNcIjtcblxuY29uc3Qgc2VhcmNoUGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh3aW5kb3cubG9jYXRpb24uc2VhcmNoKTtcbmNvbnN0IHJlcXVlc3RlZExldmVsID0gc2VhcmNoUGFyYW1zLmdldChcImxldmVsXCIpO1xuY29uc3QgbGV2ZWxJZCA9IFtcInJmMDFcIiwgXCJyZjAyXCIsIFwicmYwM1wiLCBcInJmMDRcIiwgXCJyZjA1XCIsIFwicmYwNlwiLCBcInJmMDdcIiwgXCJyZjA4XCIsIFwicmYwOVwiXS5pbmNsdWRlcyhyZXF1ZXN0ZWRMZXZlbCkgPyByZXF1ZXN0ZWRMZXZlbCA6IFwicmYwMVwiO1xuY29uc3QgVklFV19TVE9SQUdFX0tFWSA9IFwiYXJjLXZpZXctbW9kZVwiO1xubGV0IHN0b3JlZFZpZXdNb2RlID0gbnVsbDtcbnRyeSB7XG4gIHN0b3JlZFZpZXdNb2RlID0gd2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKFZJRVdfU1RPUkFHRV9LRVkpO1xufSBjYXRjaCB7XG4gIC8vIFN0b3JhZ2UgY2FuIGJlIHVuYXZhaWxhYmxlIGluIHByaXZhY3ktcmVzdHJpY3RlZCBicm93c2VyIGNvbnRleHRzLlxufVxubGV0IHZpZXdNb2RlID0gcmVzb2x2ZVZpZXdNb2RlKHNlYXJjaFBhcmFtcy5nZXQoXCJ2aWV3XCIpLCBzdG9yZWRWaWV3TW9kZSk7XG5jb25zdCBydW50aW1lTG9hZGVycyA9IHtcbiAgcmYwMTogKCkgPT4gaW1wb3J0KFwiL2dhbWUvbGV2ZWxzL3JmMDEvcnVudGltZS5qc1wiKSxcbiAgcmYwMjogKCkgPT4gaW1wb3J0KFwiL2dhbWUvbGV2ZWxzL3JmMDIvcnVudGltZS5qc1wiKSxcbiAgcmYwMzogKCkgPT4gaW1wb3J0KFwiL2dhbWUvbGV2ZWxzL3JmMDMvcnVudGltZS5qc1wiKSxcbiAgcmYwNDogKCkgPT4gaW1wb3J0KFwiL2dhbWUvbGV2ZWxzL3JmMDQvcnVudGltZS5qc1wiKSxcbiAgcmYwNTogKCkgPT4gaW1wb3J0KFwiL2dhbWUvbGV2ZWxzL3JmMDUvcnVudGltZS5qc1wiKSxcbiAgcmYwNjogKCkgPT4gaW1wb3J0KFwiL2dhbWUvbGV2ZWxzL3JmMDYvcnVudGltZS5qc1wiKSxcbiAgcmYwNzogKCkgPT4gaW1wb3J0KFwiL2dhbWUvbGV2ZWxzL3JmMDcvcnVudGltZS5qc1wiKSxcbiAgcmYwODogKCkgPT4gaW1wb3J0KFwiL2dhbWUvbGV2ZWxzL3JmMDgvcnVudGltZS5qc1wiKSxcbiAgcmYwOTogKCkgPT4gaW1wb3J0KFwiL2dhbWUvbGV2ZWxzL3JmMDkvcnVudGltZS5qcz90PTE3ODcxOTgzODM3NzRcIiksXG59O1xuY29uc3QgcnVudGltZSA9IGF3YWl0IHJ1bnRpbWVMb2FkZXJzW2xldmVsSWRdKCk7XG5jb25zdCB7IExFVkVMIH0gPSBydW50aW1lO1xuY29uc3QgRklOQUxfT0JKRUNUSVZFUyA9IE9iamVjdC5mcmVlemUoe1xuICByZjAxOiBcIuaBouWkjeWbreWMuuS+m+eUtVwiLFxuICByZjAyOiBcIuWujOaIkOmmhuiXj+W9kuS9jVwiLFxuICByZjAzOiBcIuWujOaIkOW/q+mAkuWIhuaLo1wiLFxuICByZjA0OiBcIuWujOaIkOiho+eJqea0l+a2pOS4juaZvuaZklwiLFxuICByZjA1OiBcIuWujOaIkOWuouaIv+aVtOeQhlwiLFxuICByZjA2OiBcIuWujOaIkOa8j+awtOWkhOeQhlwiLFxuICByZjA3OiBcIuWujOaIkOWGt+mTvui9rOi/kFwiLFxuICByZjA4OiBcIuWujOaIkOinhuiniea1i+ivlVwiLFxuICByZjA5OiBcIuWQr+WKqOS8muiurua8lOekulwiLFxufSk7XG5jb25zdCBmaW5hbE9iamVjdGl2ZSA9IEZJTkFMX09CSkVDVElWRVNbbGV2ZWxJZF07XG5cbmNvbnN0ICQgPSAoc2VsZWN0b3IpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuY29uc3Qgdmlld3BvcnQgPSAkKFwiI3ZpZXdwb3J0XCIpO1xuY29uc3QgZ2FtZVNoZWxsID0gJChcIiNnYW1lLXNoZWxsXCIpO1xuY29uc3Qgc3RhcnRPdmVybGF5ID0gJChcIiNzdGFydC1vdmVybGF5XCIpO1xuY29uc3QgdGVybWluYWxPdmVybGF5ID0gJChcIiN0ZXJtaW5hbC1vdmVybGF5XCIpO1xuY29uc3QgY29tcGxldGVPdmVybGF5ID0gJChcIiNjb21wbGV0ZS1vdmVybGF5XCIpO1xuY29uc3QgZmFpbHVyZU92ZXJsYXkgPSAkKFwiI2ZhaWx1cmUtb3ZlcmxheVwiKTtcbmNvbnN0IHN0YXJ0QnV0dG9uID0gJChcIiNzdGFydC1idXR0b25cIik7XG5jb25zdCBzdGFydEJ1dHRvbkxhYmVsID0gc3RhcnRCdXR0b24uaW5uZXJIVE1MO1xuY29uc3QgcmVzdGFydEJ1dHRvbiA9ICQoXCIjcmVzdGFydC1idXR0b25cIik7XG5jb25zdCBmYWlsdXJlUmVzdGFydEJ1dHRvbiA9ICQoXCIjZmFpbHVyZS1yZXN0YXJ0LWJ1dHRvblwiKTtcbmNvbnN0IHRlcm1pbmFsQ2xvc2UgPSAkKFwiI3Rlcm1pbmFsLWNsb3NlXCIpO1xuY29uc3Qgb2JqZWN0aXZlVGl0bGUgPSAkKFwiI29iamVjdGl2ZS10aXRsZVwiKTtcbmNvbnN0IHBvd2VyTGFiZWwgPSAkKFwiI3Bvd2VyLWxhYmVsXCIpO1xuY29uc3Qgc3lzdGVtTGlnaHQgPSAkKFwiI3N5c3RlbS1saWdodFwiKTtcbmNvbnN0IHJvYm90U3RhdGUgPSAkKFwiI3JvYm90LXN0YXRlXCIpO1xuY29uc3QgY2FyZ29TdGF0ZSA9ICQoXCIjY2FyZ28tc3RhdGVcIik7XG5jb25zdCBnYXRlU3RhdGUgPSAkKFwiI2dhdGUtc3RhdGVcIik7XG5jb25zdCB0b2FzdCA9ICQoXCIjdG9hc3RcIik7XG5jb25zdCBwcm9ncmVzc01ldGVyID0gJChcIiNwcm9ncmVzcy1tZXRlclwiKTtcbmNvbnN0IHByb2dyZXNzRmlsbCA9ICQoXCIjcHJvZ3Jlc3MtZmlsbFwiKTtcbmNvbnN0IHByb2dyZXNzVmFsdWUgPSAkKFwiI3Byb2dyZXNzLXZhbHVlXCIpO1xuY29uc3QgdGVybWluYWxUaXRsZSA9ICQoXCIjdGVybWluYWwtdGl0bGVcIik7XG5jb25zdCB0ZXJtaW5hbENvcHkgPSAkKFwiI3Rlcm1pbmFsLWNvcHlcIik7XG5jb25zdCB0ZXJtaW5hbExhYmVscyA9IFskKFwiI3Rlcm1pbmFsLWxhYmVsLTFcIiksICQoXCIjdGVybWluYWwtbGFiZWwtMlwiKSwgJChcIiN0ZXJtaW5hbC1sYWJlbC0zXCIpXTtcbmNvbnN0IHRlcm1pbmFsVmFsdWVzID0gWyQoXCIjdGVybWluYWwtYmF0dGVyeVwiKSwgJChcIiN0ZXJtaW5hbC1wb3dlclwiKSwgJChcIiN0ZXJtaW5hbC1kb29yXCIpXTtcbmNvbnN0IHZpZXdNb2RlT3B0aW9ucyA9IFsuLi5kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiW2RhdGEtdmlldy1vcHRpb25dXCIpXTtcbmNvbnN0IHZpc3VhbE1vZGVQYW5lbCA9ICQoXCIjcmYwOC12aXN1YWwtcGFuZWxcIik7XG5jb25zdCB2aXN1YWxNb2RlT3B0aW9ucyA9IFsuLi5kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiW2RhdGEtcmYwOC12aXN1YWxdXCIpXTtcbmNvbnN0IHZpc3VhbEZwcyA9ICQoXCIjcmYwOC1mcHNcIik7XG5jb25zdCB2aXN1YWxMb2FkID0gJChcIiNyZjA4LWxvYWRcIik7XG5jb25zdCB2aXN1YWxTcGxhdHMgPSAkKFwiI3JmMDgtc3BsYXRzXCIpO1xuY29uc3QgRVhURVJOQUxfQUdFTlRfQUNUSU9OUyA9IE9iamVjdC5mcmVlemUoW1wiV1wiLCBcIkFcIiwgXCJTXCIsIFwiRFwiLCBcIkVcIiwgXCJXQUlUXCJdKTtcbmNvbnN0IEVYVEVSTkFMX0FHRU5UX0hBUk5FU1NFUyA9IE9iamVjdC5mcmVlemUoW1widmlzdWFsXCIsIFwiaHlicmlkXCIsIFwic3RhdGVcIl0pO1xuXG5mdW5jdGlvbiBhcHBseUxldmVsQ29weSgpIHtcbiAgZG9jdW1lbnQudGl0bGUgPSBgJHtydW50aW1lLnVpLmJyYW5kfSDigJQgM0QgUm9ib3QgRGVtb2A7XG4gIGdhbWVTaGVsbC5kYXRhc2V0LmxldmVsID0gbGV2ZWxJZDtcbiAgJChcIiNicmFuZC1uYW1lXCIpLnRleHRDb250ZW50ID0gcnVudGltZS51aS5icmFuZDtcbiAgJChcIiN1bml0LWxhYmVsXCIpLnRleHRDb250ZW50ID0gcnVudGltZS51aS51bml0O1xuICAkKFwiI3N5c3RlbS1sYWJlbFwiKS50ZXh0Q29udGVudCA9IHJ1bnRpbWUudWkuc3lzdGVtTGFiZWw7XG4gICQoXCIjY2FyZ28tbGFiZWxcIikudGV4dENvbnRlbnQgPSBydW50aW1lLnVpLmNhcmdvTGFiZWw7XG4gICQoXCIjZ2F0ZS1sYWJlbFwiKS50ZXh0Q29udGVudCA9IHJ1bnRpbWUudWkuZ2F0ZUxhYmVsO1xuICAkKFwiI3N0YXJ0LWtpY2tlclwiKS50ZXh0Q29udGVudCA9IHJ1bnRpbWUudWkuc3RhcnRLaWNrZXI7XG4gICQoXCIjc3RhcnQtdGl0bGVcIikuaW5uZXJIVE1MID0gcnVudGltZS51aS5zdGFydFRpdGxlO1xuICAkKFwiI3N0YXJ0LWNvcHlcIikudGV4dENvbnRlbnQgPSBmaW5hbE9iamVjdGl2ZTtcbiAgb2JqZWN0aXZlVGl0bGUudGV4dENvbnRlbnQgPSBmaW5hbE9iamVjdGl2ZTtcbiAgJChcIiN0ZXJtaW5hbC1oZWFkaW5nLXRleHRcIikudGV4dENvbnRlbnQgPSBydW50aW1lLnVpLnRlcm1pbmFsSGVhZGluZztcbiAgJChcIiNjb21wbGV0ZS1raWNrZXJcIikudGV4dENvbnRlbnQgPSBydW50aW1lLnVpLmNvbXBsZXRlS2lja2VyO1xuICAkKFwiI2NvbXBsZXRlLXRpdGxlXCIpLnRleHRDb250ZW50ID0gcnVudGltZS51aS5jb21wbGV0ZVRpdGxlO1xuICAkKFwiI2NvbXBsZXRlLWNvcHlcIikudGV4dENvbnRlbnQgPSBydW50aW1lLnVpLmNvbXBsZXRlQ29weTtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIltkYXRhLWxldmVsLW9wdGlvbl1cIikuZm9yRWFjaCgobGluaykgPT4ge1xuICAgIGNvbnN0IHNlbGVjdGVkID0gbGluay5kYXRhc2V0LmxldmVsT3B0aW9uID09PSBsZXZlbElkO1xuICAgIGxpbmsuY2xhc3NMaXN0LnRvZ2dsZShcInNlbGVjdGVkXCIsIHNlbGVjdGVkKTtcbiAgICBpZiAoc2VsZWN0ZWQpIGxpbmsuc2V0QXR0cmlidXRlKFwiYXJpYS1jdXJyZW50XCIsIFwicGFnZVwiKTtcbiAgICBsaW5rLmhyZWYgPSBgLz9sZXZlbD0ke2xpbmsuZGF0YXNldC5sZXZlbE9wdGlvbn0mdmlldz0ke3ZpZXdNb2RlfWA7XG4gIH0pO1xuICBnYW1lU2hlbGwuZGF0YXNldC52aWV3TW9kZSA9IHZpZXdNb2RlO1xuICB2aWV3TW9kZU9wdGlvbnMuZm9yRWFjaCgoYnV0dG9uKSA9PiB7XG4gICAgY29uc3Qgc2VsZWN0ZWQgPSBidXR0b24uZGF0YXNldC52aWV3T3B0aW9uID09PSB2aWV3TW9kZTtcbiAgICBidXR0b24uY2xhc3NMaXN0LnRvZ2dsZShcInNlbGVjdGVkXCIsIHNlbGVjdGVkKTtcbiAgICBidXR0b24uc2V0QXR0cmlidXRlKFwiYXJpYS1wcmVzc2VkXCIsIFN0cmluZyhzZWxlY3RlZCkpO1xuICB9KTtcbn1cblxuYXBwbHlMZXZlbENvcHkoKTtcblxuY29uc3QgcmVuZGVyZXIgPSBuZXcgVEhSRUUuV2ViR0xSZW5kZXJlcih7IGFudGlhbGlhczogdHJ1ZSwgcG93ZXJQcmVmZXJlbmNlOiBcImhpZ2gtcGVyZm9ybWFuY2VcIiB9KTtcbnJlbmRlcmVyLnNldFBpeGVsUmF0aW8oTWF0aC5taW4od2luZG93LmRldmljZVBpeGVsUmF0aW8sIDIpKTtcbnJlbmRlcmVyLnNldFNpemUod2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCk7XG5yZW5kZXJlci5zaGFkb3dNYXAuZW5hYmxlZCA9IHRydWU7XG5yZW5kZXJlci5zaGFkb3dNYXAudHlwZSA9IFRIUkVFLlBDRlNoYWRvd01hcDtcbnJlbmRlcmVyLm91dHB1dENvbG9yU3BhY2UgPSBUSFJFRS5TUkdCQ29sb3JTcGFjZTtcbnJlbmRlcmVyLnRvbmVNYXBwaW5nID0gVEhSRUUuQUNFU0ZpbG1pY1RvbmVNYXBwaW5nO1xucmVuZGVyZXIudG9uZU1hcHBpbmdFeHBvc3VyZSA9IGxldmVsSWQgPT09IFwicmYwMlwiID8gMS4xNSA6IGxldmVsSWQgPT09IFwicmYwM1wiID8gMS4yMiA6IGxldmVsSWQgPT09IFwicmYwNFwiID8gMS4xMiA6IDEuMztcbnZpZXdwb3J0LmFwcGVuZChyZW5kZXJlci5kb21FbGVtZW50KTtcblxuY29uc3Qgd29ybGQgPSBydW50aW1lLmNyZWF0ZVNjZW5lKHJlbmRlcmVyKTtcbmNvbnN0IGVudmlyb25tZW50UmVhZHkgPSBsZXZlbElkID09PSBcInJmMDFcIlxuICA/IGxvYWRSRjAxRW52aXJvbm1lbnRNYXAocmVuZGVyZXIsIHdvcmxkLnNjZW5lKVxuICA6IFByb21pc2UucmVzb2x2ZSh7IGxvYWRlZDogZmFsc2UgfSk7XG5jb25zdCBiYXNlRm9nTmVhciA9IHdvcmxkLnNjZW5lLmZvZz8ubmVhcjtcbmNvbnN0IGJhc2VGb2dGYXIgPSB3b3JsZC5zY2VuZS5mb2c/LmZhcjtcbmNvbnN0IGJhc2VGb2dEZW5zaXR5ID0gd29ybGQuc2NlbmUuZm9nPy5kZW5zaXR5O1xuY29uc3QgY2FtZXJhID0gbmV3IFRIUkVFLlBlcnNwZWN0aXZlQ2FtZXJhKHJ1bnRpbWUuY2FtZXJhLmZvdiwgd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQsIDAuMSwgMTAwKTtcbi8vIFRoaXMgY2FtZXJhIHVzZXMgdGhlIG9mZmljaWFsIEcxIG1vdW50IHRyYW5zZm9ybSBhbmQgdGhlIEQ0MzUgODQ4eDQ4MFxuLy8gbm9taW5hbCBkZXB0aCBpbnRyaW5zaWNzLiBUaGUgZml0dGVkIHZpZXdwb3J0IGtlZXBzIHRoYXQgc2Vuc29yIGZyYW1lIGludGFjdC5cbmNvbnN0IGZpcnN0UGVyc29uQ2FtZXJhID0gY29uZmlndXJlVW5pdHJlZUcxRDQzNURlcHRoQ2FtZXJhKG5ldyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYSgpKTtcbmNvbnN0IGNhbWVyYVBvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjMoLi4ucnVudGltZS5jYW1lcmEucG9zaXRpb24pO1xuY29uc3QgY2FtZXJhTG9va0F0ID0gbmV3IFRIUkVFLlZlY3RvcjMoLi4ucnVudGltZS5jYW1lcmEubG9va0F0KTtcbmNvbnN0IHVwID0gbmV3IFRIUkVFLlZlY3RvcjMoMCwgMSwgMCk7XG5jb25zdCBjYW1lcmFGb3J3YXJkID0gbmV3IFRIUkVFLlZlY3RvcjMoLWNhbWVyYVBvc2l0aW9uLngsIDAsIC1jYW1lcmFQb3NpdGlvbi56KS5ub3JtYWxpemUoKTtcbmNvbnN0IGNhbWVyYVJpZ2h0ID0gbmV3IFRIUkVFLlZlY3RvcjMoKS5jcm9zc1ZlY3RvcnMoY2FtZXJhRm9yd2FyZCwgdXApLm5vcm1hbGl6ZSgpO1xuY29uc3QgZmlyc3RQZXJzb25Gb3J3YXJkID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IGZpcnN0UGVyc29uTG9va0F0ID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IHBvc3RQcm9jZXNzaW5nID0gbGV2ZWxJZCA9PT0gXCJyZjAxXCJcbiAgPyBjcmVhdGVSRjAxUG9zdFByb2Nlc3NpbmcocmVuZGVyZXIsIHdvcmxkLnNjZW5lLCBjYW1lcmEpXG4gIDogbnVsbDtcbmxldCByZjA4VmlzdWFsTW9kZSA9IGxldmVsSWQgPT09IFwicmYwOFwiICYmIFtcImdsYlwiLCBcImdhdXNzaWFuXCIsIFwic3BsaXRcIl0uaW5jbHVkZXMoc2VhcmNoUGFyYW1zLmdldChcInZpc3VhbFwiKSkgPyBzZWFyY2hQYXJhbXMuZ2V0KFwidmlzdWFsXCIpIDogXCJnbGJcIjtcbmxldCBmcHNGcmFtZXMgPSAwO1xubGV0IGZwc1dpbmRvd1N0YXJ0ZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbmlmICh2aXN1YWxNb2RlUGFuZWwpIHZpc3VhbE1vZGVQYW5lbC5oaWRkZW4gPSBsZXZlbElkICE9PSBcInJmMDhcIjtcbmZ1bmN0aW9uIHNldFJGMDhWaXN1YWxNb2RlKG1vZGUpIHtcbiAgaWYgKGxldmVsSWQgIT09IFwicmYwOFwiIHx8ICFbXCJnbGJcIiwgXCJnYXVzc2lhblwiLCBcInNwbGl0XCJdLmluY2x1ZGVzKG1vZGUpKSByZXR1cm47XG4gIHJmMDhWaXN1YWxNb2RlID0gbW9kZTtcbiAgcnVudGltZS5zZXRWaXN1YWxNb2RlPy4od29ybGQsIG1vZGUgPT09IFwic3BsaXRcIiA/IFwiZ2xiXCIgOiBtb2RlKTtcbiAgdmlzdWFsTW9kZU9wdGlvbnMuZm9yRWFjaCgoYnV0dG9uKSA9PiB7XG4gICAgY29uc3Qgc2VsZWN0ZWQgPSBidXR0b24uZGF0YXNldC5yZjA4VmlzdWFsID09PSBtb2RlO1xuICAgIGJ1dHRvbi5jbGFzc0xpc3QudG9nZ2xlKFwic2VsZWN0ZWRcIiwgc2VsZWN0ZWQpO1xuICAgIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoXCJhcmlhLXByZXNzZWRcIiwgU3RyaW5nKHNlbGVjdGVkKSk7XG4gIH0pO1xuICBjb25zdCBuZXh0VXJsID0gbmV3IFVSTCh3aW5kb3cubG9jYXRpb24uaHJlZik7XG4gIG5leHRVcmwuc2VhcmNoUGFyYW1zLnNldChcInZpc3VhbFwiLCBtb2RlKTtcbiAgd2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKG51bGwsIFwiXCIsIG5leHRVcmwpO1xufVxuc2V0UkYwOFZpc3VhbE1vZGUocmYwOFZpc3VhbE1vZGUpO1xuXG5sZXQgcm9ib3RBY3Rpb24gPSBjcmVhdGVSb2JvdEFjdGlvblN0YXRlKCk7XG5sZXQgc3RhdGUgPSBydW50aW1lLmNyZWF0ZUluaXRpYWxTdGF0ZSgpO1xubGV0IGdhaXREaXN0YW5jZSA9IDA7XG5sZXQgZDQzNUxvb2tQaXRjaCA9IDA7XG5jb25zdCBjYXJnb01vZGVsID0gcnVudGltZS5jcmVhdGVDYXJnb01vZGVsPy4oKTtcbmNvbnN0IHJvYm90ID0gY3JlYXRlUm9ib3QoY2FyZ29Nb2RlbCk7XG5yb2JvdC5wb3NpdGlvbi5zZXQoc3RhdGUucGxheWVyLngsIDAsIHN0YXRlLnBsYXllci56KTtcbnJvYm90LnJvdGF0aW9uLnkgPSBzdGF0ZS5wbGF5ZXIueWF3O1xud29ybGQuc2NlbmUuYWRkKHJvYm90KTtcbndvcmxkLnNjZW5lLmFkZChmaXJzdFBlcnNvbkNhbWVyYSk7XG5jYW1lcmEucG9zaXRpb24uY29weShjYW1lcmFQb3NpdGlvbik7XG5jYW1lcmEubG9va0F0KGNhbWVyYUxvb2tBdCk7XG5mdW5jdGlvbiB1cGRhdGVDYW1lcmFGcmFtaW5nKCkge1xuICBjb25zdCB2aWV3cyA9IGdldFZpZXdwb3J0cyh2aWV3TW9kZSwgd2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCk7XG4gIGNvbnN0IHRoaXJkVmlldyA9IHZpZXdzLmZpbmQoKHZpZXcpID0+IHZpZXcudmlldyA9PT0gXCJ0aGlyZFwiKSA/PyB2aWV3c1swXTtcbiAgY29uc3QgZmlyc3RWaWV3ID0gdmlld3MuZmluZCgodmlldykgPT4gdmlldy52aWV3ID09PSBcImZpcnN0XCIpID8/IHZpZXdzWzBdO1xuICBjb25zdCB0aGlyZEFzcGVjdCA9IHRoaXJkVmlldy53aWR0aCAvIHRoaXJkVmlldy5oZWlnaHQ7XG4gIGNvbnN0IG5hcnJvd1NjYWxlID0gdGhpcmRBc3BlY3QgPCAxID8gTWF0aC5taW4oMy4zNSwgMS41IC8gdGhpcmRBc3BlY3QpIDogMTtcbiAgY2FtZXJhLnBvc2l0aW9uLmNvcHkoY2FtZXJhTG9va0F0KS5hZGQoY2FtZXJhUG9zaXRpb24uY2xvbmUoKS5zdWIoY2FtZXJhTG9va0F0KS5tdWx0aXBseVNjYWxhcihuYXJyb3dTY2FsZSkpO1xuICBjYW1lcmEuZmFyID0gTWF0aC5tYXgoMTAwLCBjYW1lcmEucG9zaXRpb24uZGlzdGFuY2VUbyhjYW1lcmFMb29rQXQpICsgODApO1xuICBpZiAod29ybGQuc2NlbmUuZm9nPy5pc0ZvZykge1xuICAgIHdvcmxkLnNjZW5lLmZvZy5uZWFyID0gYmFzZUZvZ05lYXIgKiBuYXJyb3dTY2FsZTtcbiAgICB3b3JsZC5zY2VuZS5mb2cuZmFyID0gYmFzZUZvZ0ZhciAqIG5hcnJvd1NjYWxlO1xuICB9IGVsc2UgaWYgKHdvcmxkLnNjZW5lLmZvZz8uaXNGb2dFeHAyKSB7XG4gICAgd29ybGQuc2NlbmUuZm9nLmRlbnNpdHkgPSBiYXNlRm9nRGVuc2l0eSAvIG5hcnJvd1NjYWxlO1xuICB9XG4gIGNhbWVyYS5hc3BlY3QgPSB0aGlyZEFzcGVjdDtcbiAgY2FtZXJhLnVwZGF0ZVByb2plY3Rpb25NYXRyaXgoKTtcbiAgY2FtZXJhLmxvb2tBdChjYW1lcmFMb29rQXQpO1xuICBjb25maWd1cmVVbml0cmVlRzFENDM1RGVwdGhDYW1lcmEoZmlyc3RQZXJzb25DYW1lcmEpO1xufVxudXBkYXRlQ2FtZXJhRnJhbWluZygpO1xuXG5mdW5jdGlvbiBzZWxlY3RWaWV3TW9kZShuZXh0TW9kZSkge1xuICB2aWV3TW9kZSA9IHJlc29sdmVWaWV3TW9kZShuZXh0TW9kZSwgbnVsbCk7XG4gIHRyeSB7XG4gICAgd2luZG93LmxvY2FsU3RvcmFnZS5zZXRJdGVtKFZJRVdfU1RPUkFHRV9LRVksIHZpZXdNb2RlKTtcbiAgfSBjYXRjaCB7XG4gICAgLy8gVGhlIHNlbGVjdGVkIG1vZGUgc3RpbGwgYXBwbGllcyBmb3IgdGhpcyBzZXNzaW9uIHdoZW4gc3RvcmFnZSBpcyBibG9ja2VkLlxuICB9XG4gIGNvbnN0IG5leHRVcmwgPSBuZXcgVVJMKHdpbmRvdy5sb2NhdGlvbi5ocmVmKTtcbiAgbmV4dFVybC5zZWFyY2hQYXJhbXMuc2V0KFwidmlld1wiLCB2aWV3TW9kZSk7XG4gIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZShudWxsLCBcIlwiLCBuZXh0VXJsKTtcbiAgYXBwbHlMZXZlbENvcHkoKTtcbiAgdXBkYXRlQ2FtZXJhRnJhbWluZygpO1xuICByZW5kZXJWaWV3cygpO1xufVxuY29uc3QgYXVkaW9TeXN0ZW0gPSBjcmVhdGVBdWRpb1N5c3RlbShjYW1lcmEsIHdvcmxkLnNjZW5lLCBydW50aW1lLmF1ZGlvKTtcbndvcmxkLmFzc2V0UmVhZHkudGhlbigocmVzdWx0cykgPT4ge1xuICBnYW1lU2hlbGwuZGF0YXNldC5jYXJkaW5hbEFzc2V0c0xvYWRlZCA9IFN0cmluZyhyZXN1bHRzLmZpbHRlcigocmVzdWx0KSA9PiByZXN1bHQubG9hZGVkKS5sZW5ndGgpO1xuICBnYW1lU2hlbGwuZGF0YXNldC5jYXJkaW5hbEFzc2V0c1RvdGFsID0gU3RyaW5nKHJlc3VsdHMubGVuZ3RoKTtcbn0pO1xud29ybGQuZ2F1c3NpYW5SZWFkeT8udGhlbigocmVzdWx0KSA9PiB7XG4gIGdhbWVTaGVsbC5kYXRhc2V0LmdhdXNzaWFuTG9hZGVkID0gU3RyaW5nKHJlc3VsdC5sb2FkZWQpO1xuICBnYW1lU2hlbGwuZGF0YXNldC5nYXVzc2lhbkxvYWRNcyA9IHJlc3VsdC5sb2FkTXMudG9GaXhlZCgxKTtcbiAgaWYgKHZpc3VhbExvYWQpIHZpc3VhbExvYWQudGV4dENvbnRlbnQgPSByZXN1bHQubG9hZGVkID8gYCR7TWF0aC5yb3VuZChyZXN1bHQubG9hZE1zKX0gbXNgIDogXCJOT1QgQlVJTFRcIjtcbiAgaWYgKHZpc3VhbFNwbGF0cykgdmlzdWFsU3BsYXRzLnRleHRDb250ZW50ID0gcmVzdWx0LnNwbGF0Q291bnQgPT0gbnVsbCA/IFwi4oCUXCIgOiByZXN1bHQuc3BsYXRDb3VudC50b0xvY2FsZVN0cmluZygpO1xuICBpZiAoIXJlc3VsdC5sb2FkZWQgJiYgcmYwOFZpc3VhbE1vZGUgIT09IFwiZ2xiXCIpIHNldFJGMDhWaXN1YWxNb2RlKFwiZ2xiXCIpO1xufSk7XG5lbnZpcm9ubWVudFJlYWR5LnRoZW4oKHJlc3VsdCkgPT4ge1xuICBnYW1lU2hlbGwuZGF0YXNldC5lbnZpcm9ubWVudE1hcExvYWRlZCA9IFN0cmluZyhyZXN1bHQubG9hZGVkKTtcbn0pO1xubGV0IHJvYm90QXNzZXRzTG9hZGVkID0gZmFsc2U7XG5sZXQgcm9ib3RBc3NldHNGYWlsZWQgPSBmYWxzZTtcbnN0YXJ0QnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcbnN0YXJ0QnV0dG9uLnRleHRDb250ZW50ID0gXCLmraPlnKjliqDovb0gRzEgRURVMiDCtyBEZXgx4oCmXCI7XG5nYW1lU2hlbGwuZGF0YXNldC5yb2JvdEFzc2V0U3RhdGUgPSBcImxvYWRpbmdcIjtcbmNvbnN0IHJvYm90TG9hZFN0YXR1c1RpbWVyID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcbiAgY29uc3QgYXR0ZW1wdHMgPSBNYXRoLm1heChyb2JvdC51c2VyRGF0YS5sb2FkQXR0ZW1wdCwgMSk7XG4gIGNvbnN0IHJldHJ5aW5nID0gcm9ib3QudXNlckRhdGEubG9hZFN0YXRlID09PSBcInJldHJ5aW5nXCI7XG4gIHN0YXJ0QnV0dG9uLnRleHRDb250ZW50ID0gcmV0cnlpbmdcbiAgICA/IGDmraPlnKjph43mlrDliqDovb0gRzEgRURVMiDCtyBEZXgx77yIJHthdHRlbXB0c30vM++8ieKApmBcbiAgICA6IFwi5q2j5Zyo5Yqg6L29IEcxIEVEVTIgwrcgRGV4MeKAplwiO1xufSwgMjAwKTtcbmNvbnN0IGNvbGxpc2lvblJlYWR5ID0gd29ybGQuY29sbGlzaW9uUmVhZHkgPz8gUHJvbWlzZS5yZXNvbHZlKHsgbG9hZGVkOiB0cnVlIH0pO1xuY29uc3QgY2FyZ29Bc3NldFJlYWR5ID0gY2FyZ29Nb2RlbD8udXNlckRhdGE/LmFzc2V0UmVhZHkgPz8gUHJvbWlzZS5yZXNvbHZlKHsgbG9hZGVkOiB0cnVlIH0pO1xuUHJvbWlzZS5hbGwoW3JvYm90LnVzZXJEYXRhLmFzc2V0UmVhZHksIGNvbGxpc2lvblJlYWR5LCBjYXJnb0Fzc2V0UmVhZHldKS50aGVuKChbdGhpcmRQZXJzb25Bc3NldCwgY29sbGlzaW9uQXNzZXQsIGNhcmdvQXNzZXRdKSA9PiB7XG4gIHdpbmRvdy5jbGVhckludGVydmFsKHJvYm90TG9hZFN0YXR1c1RpbWVyKTtcbiAgY29uc3QgY2FyZ29Bc3NldFJlc3VsdHMgPSBBcnJheS5pc0FycmF5KGNhcmdvQXNzZXQpID8gY2FyZ29Bc3NldC5mbGF0KEluZmluaXR5KSA6IFtjYXJnb0Fzc2V0XTtcbiAgY29uc3QgY2FyZ29Bc3NldHNMb2FkZWQgPSBjYXJnb0Fzc2V0UmVzdWx0cy5ldmVyeSgoYXNzZXQpID0+IGFzc2V0Py5sb2FkZWQpO1xuICByb2JvdEFzc2V0c0xvYWRlZCA9IHRoaXJkUGVyc29uQXNzZXQubG9hZGVkO1xuICByb2JvdEFzc2V0c0ZhaWxlZCA9ICFyb2JvdEFzc2V0c0xvYWRlZDtcbiAgZ2FtZVNoZWxsLmRhdGFzZXQucm9ib3RNb2RlbExvYWRlZCA9IFN0cmluZyh0aGlyZFBlcnNvbkFzc2V0LmxvYWRlZCk7XG4gIGdhbWVTaGVsbC5kYXRhc2V0LmZpcnN0UGVyc29uUm9ib3RMb2FkZWQgPSBTdHJpbmcodGhpcmRQZXJzb25Bc3NldC5sb2FkZWQpO1xuICBnYW1lU2hlbGwuZGF0YXNldC5yb2JvdEFzc2V0U3RhdGUgPSByb2JvdEFzc2V0c0xvYWRlZCA/IFwicmVhZHlcIiA6IFwiZmFpbGVkXCI7XG4gIGdhbWVTaGVsbC5kYXRhc2V0LnJvYm90QXNzZXRFcnJvciA9IHJvYm90LnVzZXJEYXRhLmxvYWRFcnJvcjtcbiAgZ2FtZVNoZWxsLmRhdGFzZXQuY29sbGlzaW9uUHJveHlMb2FkZWQgPSBTdHJpbmcoY29sbGlzaW9uQXNzZXQubG9hZGVkKTtcbiAgZ2FtZVNoZWxsLmRhdGFzZXQuY2FyZ29Bc3NldExvYWRlZCA9IFN0cmluZyhjYXJnb0Fzc2V0c0xvYWRlZCk7XG4gIHN0YXJ0QnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gIHN0YXJ0QnV0dG9uLmlubmVySFRNTCA9IHJvYm90QXNzZXRzTG9hZGVkID8gc3RhcnRCdXR0b25MYWJlbCA6IFwiRzEgRURVMiDliqDovb3lpLHotKUgwrcg54K55Ye76YeN6K+VXCI7XG59KTtcblxuY29uc3Qga2V5cyA9IG5ldyBTZXQoKTtcbmxldCBydW5uaW5nID0gZmFsc2U7XG5sZXQgbGFzdFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbmxldCB0b2FzdFRpbWVyID0gMDtcbmxldCBjb21wbGV0ZVNob3duID0gZmFsc2U7XG5sZXQgZmFpbHVyZVNob3duID0gZmFsc2U7XG5cbmNvbnN0IGRlbGF5ID0gKG1zKSA9PiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gd2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcblxuZnVuY3Rpb24gc2hvd1RvYXN0KG1lc3NhZ2UpIHtcbiAgaWYgKCFtZXNzYWdlKSByZXR1cm47XG4gIHdpbmRvdy5jbGVhclRpbWVvdXQodG9hc3RUaW1lcik7XG4gIHRvYXN0LnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgdG9hc3QuY2xhc3NMaXN0LmFkZChcInZpc2libGVcIik7XG4gIHRvYXN0VGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB0b2FzdC5jbGFzc0xpc3QucmVtb3ZlKFwidmlzaWJsZVwiKSwgMjIwMCk7XG59XG5cbmZ1bmN0aW9uIHJlc2V0U2ltdWxhdGlvbih7IGZvcmNlID0gZmFsc2UgfSA9IHt9KSB7XG4gIGF1ZGlvU3lzdGVtLnN0b3BBbGwoKTtcbiAgcm9ib3RBY3Rpb24gPSBmaW5pc2hSb2JvdEFjdGlvbigpO1xuICBzdGF0ZSA9IHJ1bnRpbWUuY3JlYXRlSW5pdGlhbFN0YXRlKCk7XG4gIGdhaXREaXN0YW5jZSA9IDA7XG4gIGNvbXBsZXRlU2hvd24gPSBmYWxzZTtcbiAgZmFpbHVyZVNob3duID0gZmFsc2U7XG4gIGNvbXBsZXRlT3ZlcmxheS5oaWRkZW4gPSB0cnVlO1xuICBmYWlsdXJlT3ZlcmxheS5oaWRkZW4gPSB0cnVlO1xuICB0ZXJtaW5hbE92ZXJsYXkuaGlkZGVuID0gdHJ1ZTtcbiAgcm9ib3QucG9zaXRpb24uc2V0KHN0YXRlLnBsYXllci54LCAwLCBzdGF0ZS5wbGF5ZXIueik7XG4gIHJvYm90LnJvdGF0aW9uLnkgPSBzdGF0ZS5wbGF5ZXIueWF3O1xuICBrZXlzLmNsZWFyKCk7XG4gIHVwZGF0ZUludGVyZmFjZSgpO1xuICBpZiAoIWZvcmNlKSBzaG93VG9hc3QoXCLmqKHmi5/njq/looPlt7Lph43nva5cIik7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiByZXNldEdhbWUoKSB7XG4gIHJldHVybiByZXNldFNpbXVsYXRpb24oKTtcbn1cblxuZnVuY3Rpb24gaHVkT2JzZXJ2YXRpb24oKSB7XG4gIGNvbnN0IHRlbGVtZXRyeSA9IHJ1bnRpbWUuZ2V0VGVsZW1ldHJ5KHN0YXRlKTtcbiAgcmV0dXJuIHtcbiAgICBvYmplY3RpdmU6IGZpbmFsT2JqZWN0aXZlLFxuICAgIHJlc2VydmU6IE1hdGgubWF4KDAsIE1hdGgucm91bmQoc3RhdGUucHJvZ3Jlc3MpKSxcbiAgICBjYXJnbzogdGVsZW1ldHJ5LmNhcmdvLFxuICAgIHN5c3RlbTogdGVsZW1ldHJ5LnN5c3RlbSxcbiAgICBnYXRlOiB0ZWxlbWV0cnkuZ2F0ZSxcbiAgICByZXN1bHQ6IHN0YXRlLmNvbXBsZXRlID8gXCJzdWNjZXNzXCIgOiBzdGF0ZS5mYWlsZWQgPyBcImZhaWx1cmVcIiA6IFwicnVubmluZ1wiLFxuICB9O1xufVxuXG5mdW5jdGlvbiBkcmF3UGFuZWwoY29udGV4dCwgZWxlbWVudCwgcGFpbnRlcikge1xuICBjb25zdCByZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgaWYgKHJlY3Qud2lkdGggPD0gMCB8fCByZWN0LmhlaWdodCA8PSAwIHx8IGVsZW1lbnQuaGlkZGVuKSByZXR1cm47XG4gIGNvbnRleHQuc2F2ZSgpO1xuICBjb250ZXh0LnRyYW5zbGF0ZShyZWN0LmxlZnQsIHJlY3QudG9wKTtcbiAgY29udGV4dC5iZWdpblBhdGgoKTtcbiAgY29udGV4dC5yZWN0KDAsIDAsIHJlY3Qud2lkdGgsIHJlY3QuaGVpZ2h0KTtcbiAgY29udGV4dC5jbGlwKCk7XG4gIGNvbnRleHQuZmlsbFN0eWxlID0gXCJyZ2JhKDEyLCAxOCwgMTgsIDAuODgpXCI7XG4gIGNvbnRleHQuZmlsbFJlY3QoMCwgMCwgcmVjdC53aWR0aCwgcmVjdC5oZWlnaHQpO1xuICBjb250ZXh0LnN0cm9rZVN0eWxlID0gXCJyZ2JhKDE2NywgMTg4LCAxODAsIDAuNDIpXCI7XG4gIGNvbnRleHQubGluZVdpZHRoID0gMTtcbiAgY29udGV4dC5zdHJva2VSZWN0KDAuNSwgMC41LCByZWN0LndpZHRoIC0gMSwgcmVjdC5oZWlnaHQgLSAxKTtcbiAgcGFpbnRlcihjb250ZXh0LCByZWN0LndpZHRoLCByZWN0LmhlaWdodCk7XG4gIGNvbnRleHQucmVzdG9yZSgpO1xufVxuXG5mdW5jdGlvbiBkcmF3V3JhcHBlZFRleHQoY29udGV4dCwgdGV4dCwgeCwgeSwgbWF4V2lkdGgsIGxpbmVIZWlnaHQsIG1heExpbmVzID0gMikge1xuICBjb25zdCB3b3JkcyA9IFN0cmluZyh0ZXh0IHx8IFwiXCIpLnNwbGl0KC9cXHMrLyk7XG4gIGxldCBsaW5lID0gXCJcIjtcbiAgbGV0IGxpbmVJbmRleCA9IDA7XG4gIGZvciAoY29uc3Qgd29yZCBvZiB3b3Jkcykge1xuICAgIGNvbnN0IG5leHQgPSBsaW5lID8gYCR7bGluZX0gJHt3b3JkfWAgOiB3b3JkO1xuICAgIGlmIChsaW5lICYmIGNvbnRleHQubWVhc3VyZVRleHQobmV4dCkud2lkdGggPiBtYXhXaWR0aCkge1xuICAgICAgY29udGV4dC5maWxsVGV4dChsaW5lLCB4LCB5ICsgbGluZUluZGV4ICogbGluZUhlaWdodCwgbWF4V2lkdGgpO1xuICAgICAgbGluZSA9IHdvcmQ7XG4gICAgICBsaW5lSW5kZXggKz0gMTtcbiAgICAgIGlmIChsaW5lSW5kZXggPj0gbWF4TGluZXMpIHJldHVybjtcbiAgICB9IGVsc2Uge1xuICAgICAgbGluZSA9IG5leHQ7XG4gICAgfVxuICB9XG4gIGlmIChsaW5lSW5kZXggPCBtYXhMaW5lcyAmJiBsaW5lKSBjb250ZXh0LmZpbGxUZXh0KGxpbmUsIHgsIHkgKyBsaW5lSW5kZXggKiBsaW5lSGVpZ2h0LCBtYXhXaWR0aCk7XG59XG5cbmZ1bmN0aW9uIGRyYXdWaXNpYmxlSHVkKGNvbnRleHQpIHtcbiAgY29uc3QgbXV0ZWQgPSBcIiNhOWI4YjFcIjtcbiAgY29uc3QgYnJpZ2h0ID0gXCIjZjNmN2Y0XCI7XG4gIGNvbnN0IGFjY2VudCA9IFwiIzc4ZDhhM1wiO1xuICBjb250ZXh0LnRleHRCYXNlbGluZSA9IFwiYWxwaGFiZXRpY1wiO1xuICBjb250ZXh0LmxldHRlclNwYWNpbmcgPSBcIjBweFwiO1xuXG4gIFtkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLmNvbnRyb2xzLWhpbnRcIiksIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIubGVnYWN5LWxpbmtcIildXG4gICAgLmZvckVhY2goKGVsZW1lbnQpID0+IHtcbiAgICAgIGNvbnN0IHJlY3QgPSBlbGVtZW50Py5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIGlmICghcmVjdCB8fCByZWN0LndpZHRoIDw9IDAgfHwgcmVjdC5oZWlnaHQgPD0gMCkgcmV0dXJuO1xuICAgICAgY29udGV4dC5maWxsU3R5bGUgPSBcInJnYmEoOCwgMTIsIDEyLCAwLjk2KVwiO1xuICAgICAgY29udGV4dC5maWxsUmVjdChyZWN0LmxlZnQsIHJlY3QudG9wLCByZWN0LndpZHRoLCByZWN0LmhlaWdodCk7XG4gICAgfSk7XG5cbiAgZHJhd1BhbmVsKGNvbnRleHQsIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIudG9wLWh1ZFwiKSwgKHBhbmVsLCB3aWR0aCwgaGVpZ2h0KSA9PiB7XG4gICAgcGFuZWwuZmlsbFN0eWxlID0gbXV0ZWQ7XG4gICAgcGFuZWwuZm9udCA9IFwiNjAwIDExcHggc3lzdGVtLXVpLCBzYW5zLXNlcmlmXCI7XG4gICAgcGFuZWwuZmlsbFRleHQoJChcIiN1bml0LWxhYmVsXCIpLnRleHRDb250ZW50LCAxOCwgMjIsIHdpZHRoICogMC4zKTtcbiAgICBwYW5lbC5maWxsU3R5bGUgPSBicmlnaHQ7XG4gICAgcGFuZWwuZm9udCA9IFwiNzAwIDE3cHggc3lzdGVtLXVpLCBzYW5zLXNlcmlmXCI7XG4gICAgcGFuZWwuZmlsbFRleHQoJChcIiNicmFuZC1uYW1lXCIpLnRleHRDb250ZW50LCAxOCwgNDcsIHdpZHRoICogMC4zKTtcblxuICAgIGNvbnN0IHJlc2VydmVYID0gd2lkdGggKiAwLjM5O1xuICAgIGNvbnN0IHJlc2VydmVXaWR0aCA9IE1hdGgubWF4KDEyMCwgd2lkdGggKiAwLjI0KTtcbiAgICBwYW5lbC5maWxsU3R5bGUgPSBtdXRlZDtcbiAgICBwYW5lbC5mb250ID0gXCI2MDAgMTFweCBzeXN0ZW0tdWksIHNhbnMtc2VyaWZcIjtcbiAgICBwYW5lbC5maWxsVGV4dChcIk1JU1NJT04gUkVTRVJWRVwiLCByZXNlcnZlWCwgMjEpO1xuICAgIHBhbmVsLmZpbGxTdHlsZSA9IGJyaWdodDtcbiAgICBwYW5lbC5mb250ID0gXCI3MDAgMTdweCBzeXN0ZW0tdWksIHNhbnMtc2VyaWZcIjtcbiAgICBwYW5lbC50ZXh0QWxpZ24gPSBcInJpZ2h0XCI7XG4gICAgcGFuZWwuZmlsbFRleHQocHJvZ3Jlc3NWYWx1ZS50ZXh0Q29udGVudCwgcmVzZXJ2ZVggKyByZXNlcnZlV2lkdGgsIDIyKTtcbiAgICBwYW5lbC50ZXh0QWxpZ24gPSBcImxlZnRcIjtcbiAgICBwYW5lbC5maWxsU3R5bGUgPSBcInJnYmEoMjU1LDI1NSwyNTUsMC4xNClcIjtcbiAgICBwYW5lbC5maWxsUmVjdChyZXNlcnZlWCwgMzQsIHJlc2VydmVXaWR0aCwgOSk7XG4gICAgcGFuZWwuZmlsbFN0eWxlID0gc3RhdGUucHJvZ3Jlc3MgPD0gMTUgPyBcIiNlZjZiNjJcIiA6IHN0YXRlLnByb2dyZXNzIDw9IDM1ID8gXCIjZTZjNDVjXCIgOiBhY2NlbnQ7XG4gICAgcGFuZWwuZmlsbFJlY3QocmVzZXJ2ZVgsIDM0LCByZXNlcnZlV2lkdGggKiBNYXRoLm1heCgwLCBzdGF0ZS5wcm9ncmVzcykgLyAxMDAsIDkpO1xuXG4gICAgcGFuZWwuZmlsbFN0eWxlID0gbXV0ZWQ7XG4gICAgcGFuZWwuZm9udCA9IFwiNjAwIDExcHggc3lzdGVtLXVpLCBzYW5zLXNlcmlmXCI7XG4gICAgcGFuZWwuZmlsbFRleHQoJChcIiNzeXN0ZW0tbGFiZWxcIikudGV4dENvbnRlbnQsIHdpZHRoICogMC43NSwgMjIsIHdpZHRoICogMC4yMik7XG4gICAgcGFuZWwuZmlsbFN0eWxlID0gYnJpZ2h0O1xuICAgIHBhbmVsLmZvbnQgPSBcIjcwMCAxN3B4IHN5c3RlbS11aSwgc2Fucy1zZXJpZlwiO1xuICAgIHBhbmVsLmZpbGxUZXh0KHBvd2VyTGFiZWwudGV4dENvbnRlbnQsIHdpZHRoICogMC43NSwgNDcsIHdpZHRoICogMC4yMik7XG4gIH0pO1xuXG4gIGRyYXdQYW5lbChjb250ZXh0LCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLm1pc3Npb24tcGFuZWxcIiksIChwYW5lbCwgd2lkdGgpID0+IHtcbiAgICBwYW5lbC5maWxsU3R5bGUgPSBtdXRlZDtcbiAgICBwYW5lbC5mb250ID0gXCI2MDAgMTBweCBzeXN0ZW0tdWksIHNhbnMtc2VyaWZcIjtcbiAgICBwYW5lbC5maWxsVGV4dChcIkNVUlJFTlQgRElSRUNUSVZFXCIsIDE4LCAyNCk7XG4gICAgcGFuZWwuZmlsbFN0eWxlID0gYnJpZ2h0O1xuICAgIHBhbmVsLmZvbnQgPSBcIjcwMCAyMHB4IHN5c3RlbS11aSwgc2Fucy1zZXJpZlwiO1xuICAgIHBhbmVsLmZpbGxUZXh0KG9iamVjdGl2ZVRpdGxlLnRleHRDb250ZW50LCAxOCwgNTQsIHdpZHRoIC0gMzYpO1xuICB9KTtcblxuICBkcmF3UGFuZWwoY29udGV4dCwgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi50ZWxlbWV0cnktcGFuZWxcIiksIChwYW5lbCwgd2lkdGgpID0+IHtcbiAgICBjb25zdCByb3dzID0gW1xuICAgICAgW1wiUk9CT1QgU1RBVEVcIiwgcm9ib3RTdGF0ZS50ZXh0Q29udGVudF0sXG4gICAgICBbJChcIiNjYXJnby1sYWJlbFwiKS50ZXh0Q29udGVudCwgY2FyZ29TdGF0ZS50ZXh0Q29udGVudF0sXG4gICAgICBbJChcIiNnYXRlLWxhYmVsXCIpLnRleHRDb250ZW50LCBnYXRlU3RhdGUudGV4dENvbnRlbnRdLFxuICAgIF07XG4gICAgcm93cy5mb3JFYWNoKChbbGFiZWwsIHZhbHVlXSwgaW5kZXgpID0+IHtcbiAgICAgIGNvbnN0IHkgPSAyNCArIGluZGV4ICogMzg7XG4gICAgICBwYW5lbC5maWxsU3R5bGUgPSBtdXRlZDtcbiAgICAgIHBhbmVsLmZvbnQgPSBcIjYwMCAxMHB4IHN5c3RlbS11aSwgc2Fucy1zZXJpZlwiO1xuICAgICAgcGFuZWwuZmlsbFRleHQobGFiZWwsIDE2LCB5LCB3aWR0aCAqIDAuNDgpO1xuICAgICAgcGFuZWwuZmlsbFN0eWxlID0gYnJpZ2h0O1xuICAgICAgcGFuZWwuZm9udCA9IFwiNzAwIDEycHggc3lzdGVtLXVpLCBzYW5zLXNlcmlmXCI7XG4gICAgICBwYW5lbC50ZXh0QWxpZ24gPSBcInJpZ2h0XCI7XG4gICAgICBwYW5lbC5maWxsVGV4dCh2YWx1ZSwgd2lkdGggLSAxNiwgeSwgd2lkdGggKiAwLjQ4KTtcbiAgICAgIHBhbmVsLnRleHRBbGlnbiA9IFwibGVmdFwiO1xuICAgIH0pO1xuICB9KTtcblxuICBpZiAoIXRlcm1pbmFsT3ZlcmxheS5oaWRkZW4pIHtcbiAgICBkcmF3UGFuZWwoY29udGV4dCwgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi50ZXJtaW5hbC1jYXJkXCIpLCAocGFuZWwsIHdpZHRoKSA9PiB7XG4gICAgICBwYW5lbC5maWxsU3R5bGUgPSBtdXRlZDtcbiAgICAgIHBhbmVsLmZvbnQgPSBcIjYwMCAxMHB4IHN5c3RlbS11aSwgc2Fucy1zZXJpZlwiO1xuICAgICAgcGFuZWwuZmlsbFRleHQoJChcIiN0ZXJtaW5hbC1oZWFkaW5nLXRleHRcIikudGV4dENvbnRlbnQsIDIwLCAyNywgd2lkdGggLSA0MCk7XG4gICAgICBwYW5lbC5maWxsU3R5bGUgPSBicmlnaHQ7XG4gICAgICBwYW5lbC5mb250ID0gXCI3MDAgMjJweCBzeXN0ZW0tdWksIHNhbnMtc2VyaWZcIjtcbiAgICAgIHBhbmVsLmZpbGxUZXh0KHRlcm1pbmFsVGl0bGUudGV4dENvbnRlbnQsIDIwLCA2Miwgd2lkdGggLSA0MCk7XG4gICAgICBwYW5lbC5maWxsU3R5bGUgPSBtdXRlZDtcbiAgICAgIHBhbmVsLmZvbnQgPSBcIjQwMCAxMnB4IHN5c3RlbS11aSwgc2Fucy1zZXJpZlwiO1xuICAgICAgZHJhd1dyYXBwZWRUZXh0KHBhbmVsLCB0ZXJtaW5hbENvcHkudGV4dENvbnRlbnQsIDIwLCA4OCwgd2lkdGggLSA0MCwgMTcsIDMpO1xuICAgICAgdGVybWluYWxWYWx1ZXMuZm9yRWFjaCgodmFsdWUsIGluZGV4KSA9PiB7XG4gICAgICAgIHBhbmVsLmZpbGxTdHlsZSA9IGJyaWdodDtcbiAgICAgICAgcGFuZWwuZm9udCA9IFwiNjAwIDExcHggc3lzdGVtLXVpLCBzYW5zLXNlcmlmXCI7XG4gICAgICAgIHBhbmVsLmZpbGxUZXh0KGAke3Rlcm1pbmFsTGFiZWxzW2luZGV4XS50ZXh0Q29udGVudH06ICR7dmFsdWUudGV4dENvbnRlbnR9YCwgMjAsIDE1MCArIGluZGV4ICogMjQsIHdpZHRoIC0gNDApO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gdXBkYXRlRmlyc3RQZXJzb25WaWV3KCkge1xuICBpZiAoIWdldFVuaXRyZWVHMUQ0MzVXb3JsZFBvc2Uocm9ib3QsIGZpcnN0UGVyc29uQ2FtZXJhLnBvc2l0aW9uLCBmaXJzdFBlcnNvbkZvcndhcmQpKSByZXR1cm47XG4gIGZpcnN0UGVyc29uTG9va0F0LmNvcHkoZmlyc3RQZXJzb25DYW1lcmEucG9zaXRpb24pLmFkZChmaXJzdFBlcnNvbkZvcndhcmQpO1xuICBmaXJzdFBlcnNvbkNhbWVyYS5sb29rQXQoZmlyc3RQZXJzb25Mb29rQXQpO1xufVxuXG5mdW5jdGlvbiByZW5kZXJWaWV3cygpIHtcbiAgdXBkYXRlRmlyc3RQZXJzb25WaWV3KCk7XG4gIGNvbnN0IHdpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XG4gIGNvbnN0IGhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcbiAgY29uc3Qgdmlld3MgPSBsZXZlbElkID09PSBcInJmMDhcIiAmJiByZjA4VmlzdWFsTW9kZSA9PT0gXCJzcGxpdFwiXG4gICAgPyBbeyB2aWV3OiBcInRoaXJkXCIsIHg6IDAsIHk6IDAsIHdpZHRoOiBNYXRoLmZsb29yKHdpZHRoIC8gMiksIGhlaWdodCB9LCB7IHZpZXc6IFwidGhpcmRcIiwgeDogTWF0aC5mbG9vcih3aWR0aCAvIDIpLCB5OiAwLCB3aWR0aDogTWF0aC5jZWlsKHdpZHRoIC8gMiksIGhlaWdodCB9XVxuICAgIDogZ2V0Vmlld3BvcnRzKHZpZXdNb2RlLCB3aWR0aCwgaGVpZ2h0KTtcbiAgY29uc3Qgc3BsaXQgPSB2aWV3cy5sZW5ndGggPiAxO1xuICB2aWV3cy5mb3JFYWNoKCh2aWV3LCBpbmRleCkgPT4ge1xuICAgIGlmIChsZXZlbElkID09PSBcInJmMDhcIiAmJiByZjA4VmlzdWFsTW9kZSA9PT0gXCJzcGxpdFwiKSBydW50aW1lLnNldFZpc3VhbE1vZGU/Lih3b3JsZCwgaW5kZXggPT09IDAgPyBcImdsYlwiIDogXCJnYXVzc2lhblwiKTtcbiAgICBjb25zdCBmaXJzdFBlcnNvbiA9IHZpZXcudmlldyA9PT0gXCJmaXJzdFwiO1xuICAgIGNvbnN0IHJlbmRlclZpZXcgPSBmaXJzdFBlcnNvbiA/IGZpdEFzcGVjdFZpZXdwb3J0KHZpZXcsIFVOSVRSRUVfRzFfRDQzNV9ERVBUSF9DQU1FUkEuYXNwZWN0KSA6IHZpZXc7XG4gICAgcm9ib3QudmlzaWJsZSA9IHRydWU7XG4gICAgY29uc3QgYWN0aXZlQ2FtZXJhID0gZmlyc3RQZXJzb24gPyBmaXJzdFBlcnNvbkNhbWVyYSA6IGNhbWVyYTtcbiAgICByZW5kZXJlci5zZXRTY2lzc29yVGVzdChzcGxpdCB8fCBmaXJzdFBlcnNvbik7XG4gICAgaWYgKGZpcnN0UGVyc29uKSB7XG4gICAgICByZW5kZXJlci5zZXRWaWV3cG9ydCh2aWV3LngsIHZpZXcueSwgdmlldy53aWR0aCwgdmlldy5oZWlnaHQpO1xuICAgICAgcmVuZGVyZXIuc2V0U2Npc3Nvcih2aWV3LngsIHZpZXcueSwgdmlldy53aWR0aCwgdmlldy5oZWlnaHQpO1xuICAgICAgcmVuZGVyZXIuc2V0Q2xlYXJDb2xvcigweDA1MDcwOCwgMSk7XG4gICAgICByZW5kZXJlci5jbGVhcih0cnVlLCB0cnVlLCB0cnVlKTtcbiAgICB9XG4gICAgcmVuZGVyZXIuc2V0Vmlld3BvcnQocmVuZGVyVmlldy54LCByZW5kZXJWaWV3LnksIHJlbmRlclZpZXcud2lkdGgsIHJlbmRlclZpZXcuaGVpZ2h0KTtcbiAgICBpZiAoc3BsaXQgfHwgZmlyc3RQZXJzb24pIHJlbmRlcmVyLnNldFNjaXNzb3IocmVuZGVyVmlldy54LCByZW5kZXJWaWV3LnksIHJlbmRlclZpZXcud2lkdGgsIHJlbmRlclZpZXcuaGVpZ2h0KTtcbiAgICBpZiAoZmlyc3RQZXJzb24pIHtcbiAgICAgIGNvbmZpZ3VyZVVuaXRyZWVHMUQ0MzVEZXB0aENhbWVyYShhY3RpdmVDYW1lcmEpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhY3RpdmVDYW1lcmEuYXNwZWN0ID0gcmVuZGVyVmlldy53aWR0aCAvIE1hdGgubWF4KDEsIHJlbmRlclZpZXcuaGVpZ2h0KTtcbiAgICAgIGFjdGl2ZUNhbWVyYS51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG4gICAgfVxuICAgIGlmIChmaXJzdFBlcnNvbikgc2V0VW5pdHJlZUcxRmlyc3RQZXJzb25IZWFkVmlzaWJsZShyb2JvdCwgZmFsc2UpO1xuICAgIHRyeSB7XG4gICAgICBpZiAocG9zdFByb2Nlc3NpbmcgJiYgIXNwbGl0ICYmICFmaXJzdFBlcnNvbikgcG9zdFByb2Nlc3NpbmcucmVuZGVyKGFjdGl2ZUNhbWVyYSk7XG4gICAgICBlbHNlIHJlbmRlcmVyLnJlbmRlcih3b3JsZC5zY2VuZSwgYWN0aXZlQ2FtZXJhKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgaWYgKGZpcnN0UGVyc29uKSBzZXRVbml0cmVlRzFGaXJzdFBlcnNvbkhlYWRWaXNpYmxlKHJvYm90LCB0cnVlKTtcbiAgICB9XG4gIH0pO1xuICBpZiAobGV2ZWxJZCA9PT0gXCJyZjA4XCIpIHJ1bnRpbWUuc2V0VmlzdWFsTW9kZT8uKHdvcmxkLCByZjA4VmlzdWFsTW9kZSA9PT0gXCJzcGxpdFwiID8gXCJnbGJcIiA6IHJmMDhWaXN1YWxNb2RlKTtcblxuICByb2JvdC52aXNpYmxlID0gdHJ1ZTtcbiAgcmVuZGVyZXIuc2V0U2Npc3NvclRlc3QoZmFsc2UpO1xuICByZW5kZXJlci5zZXRWaWV3cG9ydCgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcbn1cblxuZnVuY3Rpb24gY2FwdHVyZUZyYW1lKCkge1xuICByZW5kZXJWaWV3cygpO1xuICBpZiAobGV2ZWxJZCA9PT0gXCJyZjA4XCIpIHtcbiAgICBmcHNGcmFtZXMgKz0gMTtcbiAgICBjb25zdCBmcHNOb3cgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICBjb25zdCBmcHNFbGFwc2VkID0gZnBzTm93IC0gZnBzV2luZG93U3RhcnRlZDtcbiAgICBpZiAoZnBzRWxhcHNlZCA+PSAxMDAwKSB7XG4gICAgICBjb25zdCBmcHMgPSBmcHNGcmFtZXMgKiAxMDAwIC8gZnBzRWxhcHNlZDtcbiAgICAgIGlmICh2aXN1YWxGcHMpIHZpc3VhbEZwcy50ZXh0Q29udGVudCA9IGZwcy50b0ZpeGVkKDEpO1xuICAgICAgZ2FtZVNoZWxsLmRhdGFzZXQucmYwOEZwcyA9IGZwcy50b0ZpeGVkKDEpO1xuICAgICAgZnBzRnJhbWVzID0gMDtcbiAgICAgIGZwc1dpbmRvd1N0YXJ0ZWQgPSBmcHNOb3c7XG4gICAgfVxuICB9XG4gIGNvbnN0IHdpZHRoID0gTWF0aC5taW4oMTYwMCwgd2luZG93LmlubmVyV2lkdGgpO1xuICBjb25zdCBoZWlnaHQgPSBNYXRoLm1heCgxLCBNYXRoLnJvdW5kKHdpZHRoICogd2luZG93LmlubmVySGVpZ2h0IC8gd2luZG93LmlubmVyV2lkdGgpKTtcbiAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcbiAgY2FudmFzLndpZHRoID0gd2lkdGg7XG4gIGNhbnZhcy5oZWlnaHQgPSBoZWlnaHQ7XG4gIGNvbnN0IGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIsIHsgYWxwaGE6IGZhbHNlIH0pO1xuICBjb250ZXh0LmRyYXdJbWFnZShyZW5kZXJlci5kb21FbGVtZW50LCAwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcbiAgY29udGV4dC5zYXZlKCk7XG4gIGNvbnRleHQuc2NhbGUod2lkdGggLyB3aW5kb3cuaW5uZXJXaWR0aCwgaGVpZ2h0IC8gd2luZG93LmlubmVySGVpZ2h0KTtcbiAgZHJhd1Zpc2libGVIdWQoY29udGV4dCk7XG4gIGNvbnRleHQucmVzdG9yZSgpO1xuICByZXR1cm4gY2FudmFzLnRvRGF0YVVSTChcImltYWdlL2pwZWdcIiwgMC44NCk7XG59XG5cbmZ1bmN0aW9uIGNhcHR1cmVSZW5kZXJGcmFtZSgpIHtcbiAgcmVuZGVyVmlld3MoKTtcbiAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcbiAgY2FudmFzLndpZHRoID0gcmVuZGVyZXIuZG9tRWxlbWVudC53aWR0aDtcbiAgY2FudmFzLmhlaWdodCA9IHJlbmRlcmVyLmRvbUVsZW1lbnQuaGVpZ2h0O1xuICBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIsIHsgYWxwaGE6IGZhbHNlIH0pLmRyYXdJbWFnZShyZW5kZXJlci5kb21FbGVtZW50LCAwLCAwKTtcbiAgcmV0dXJuIGNhbnZhcy50b0RhdGFVUkwoXCJpbWFnZS9qcGVnXCIsIDAuOSk7XG59XG5cbmZ1bmN0aW9uIHdhaXRGb3JSb2JvdEFjdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgZnVuY3Rpb24gY2hlY2soKSB7XG4gICAgICBpZiAoIWlzUm9ib3RBY3Rpb25BY3RpdmUocm9ib3RBY3Rpb24pKSByZXNvbHZlKCk7XG4gICAgICBlbHNlIHJlcXVlc3RBbmltYXRpb25GcmFtZShjaGVjayk7XG4gICAgfVxuICAgIGNoZWNrKCk7XG4gIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBleGVjdXRlQWdlbnRBY3Rpb24oYWN0aW9uLCBkdXJhdGlvbk1zID0gMzAwKSB7XG4gIGlmIChbXCJXXCIsIFwiQVwiLCBcIlNcIiwgXCJEXCJdLmluY2x1ZGVzKGFjdGlvbikpIHtcbiAgICBrZXlzLmFkZChgS2V5JHthY3Rpb259YCk7XG4gICAgYXdhaXQgZGVsYXkoZHVyYXRpb25Ncyk7XG4gICAga2V5cy5kZWxldGUoYEtleSR7YWN0aW9ufWApO1xuICB9IGVsc2UgaWYgKGFjdGlvbiA9PT0gXCJFXCIpIHtcbiAgICBwZXJmb3JtSW50ZXJhY3Rpb24oKTtcbiAgICBpZiAoaXNSb2JvdEFjdGlvbkFjdGl2ZShyb2JvdEFjdGlvbikpIGF3YWl0IHdhaXRGb3JSb2JvdEFjdGlvbigpO1xuICAgIGVsc2UgYXdhaXQgZGVsYXkoZHVyYXRpb25Ncyk7XG4gIH0gZWxzZSBpZiAoYWN0aW9uID09PSBcIldBSVRcIikge1xuICAgIGF3YWl0IGRlbGF5KGR1cmF0aW9uTXMpO1xuICB9XG4gIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHJlc29sdmUpKSk7XG59XG5sZXQgZXh0ZXJuYWxBZ2VudEFjdGlvbiA9IFByb21pc2UucmVzb2x2ZSgpO1xuXG5mdW5jdGlvbiBzdGFydEdhbWUoKSB7XG4gIGlmIChyb2JvdEFzc2V0c0ZhaWxlZCkge1xuICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCFyb2JvdEFzc2V0c0xvYWRlZCkge1xuICAgIHNob3dUb2FzdChcIkcxIEVEVTIgwrcgRGV4MSDmqKHlnovlsJrmnKrliqDovb3lrozmiJDvvIzlvZPliY3npoHmraLov5vlhaXku7vliqFcIik7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZvaWQgYXVkaW9TeXN0ZW0udW5sb2NrKCk7XG4gIHJ1bm5pbmcgPSB0cnVlO1xuICBzdGFydE92ZXJsYXkuaGlkZGVuID0gdHJ1ZTtcbiAgbGFzdFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgdXBkYXRlSW50ZXJmYWNlKCk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVRlcm1pbmFsKCkge1xuICBjb25zdCB0ZXJtaW5hbCA9IHJ1bnRpbWUuZ2V0VGVybWluYWwoc3RhdGUpO1xuICB0ZXJtaW5hbFRpdGxlLnRleHRDb250ZW50ID0gdGVybWluYWwudGl0bGU7XG4gIHRlcm1pbmFsQ29weS50ZXh0Q29udGVudCA9IHRlcm1pbmFsLmNvcHk7XG4gIHRlcm1pbmFsLnJvd3MuZm9yRWFjaCgoW2xhYmVsLCB2YWx1ZV0sIGluZGV4KSA9PiB7XG4gICAgdGVybWluYWxMYWJlbHNbaW5kZXhdLnRleHRDb250ZW50ID0gbGFiZWw7XG4gICAgdGVybWluYWxWYWx1ZXNbaW5kZXhdLnRleHRDb250ZW50ID0gdmFsdWU7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVJbnRlcmZhY2UoKSB7XG4gIGNvbnN0IHRlbGVtZXRyeSA9IHJ1bnRpbWUuZ2V0VGVsZW1ldHJ5KHN0YXRlKTtcbiAgcG93ZXJMYWJlbC50ZXh0Q29udGVudCA9IHRlbGVtZXRyeS5zeXN0ZW07XG4gIHBvd2VyTGFiZWwuY2xhc3NMaXN0LnRvZ2dsZShcIm9ubGluZVwiLCB0ZWxlbWV0cnkuc3lzdGVtT25saW5lKTtcbiAgc3lzdGVtTGlnaHQuY2xhc3NMaXN0LnRvZ2dsZShcIm9ubGluZVwiLCB0ZWxlbWV0cnkuc3lzdGVtT25saW5lKTtcbiAgcm9ib3RTdGF0ZS50ZXh0Q29udGVudCA9IHN0YXRlLm1vdGlvbi50b1VwcGVyQ2FzZSgpO1xuICBjYXJnb1N0YXRlLnRleHRDb250ZW50ID0gdGVsZW1ldHJ5LmNhcmdvO1xuICBnYXRlU3RhdGUudGV4dENvbnRlbnQgPSB0ZWxlbWV0cnkuZ2F0ZTtcbiAgY29uc3Qgcm91bmRlZFByb2dyZXNzID0gTWF0aC5tYXgoMCwgTWF0aC5yb3VuZChzdGF0ZS5wcm9ncmVzcykpO1xuICBwcm9ncmVzc0ZpbGwuc3R5bGUud2lkdGggPSBgJHtzdGF0ZS5wcm9ncmVzc30lYDtcbiAgcHJvZ3Jlc3NWYWx1ZS50ZXh0Q29udGVudCA9IGAke3JvdW5kZWRQcm9ncmVzc30lYDtcbiAgcHJvZ3Jlc3NNZXRlci5zZXRBdHRyaWJ1dGUoXCJhcmlhLXZhbHVlbm93XCIsIFN0cmluZyhyb3VuZGVkUHJvZ3Jlc3MpKTtcbiAgcHJvZ3Jlc3NNZXRlci5jbGFzc0xpc3QudG9nZ2xlKFwid2FybmluZ1wiLCBzdGF0ZS5wcm9ncmVzcyA8PSAzNSAmJiBzdGF0ZS5wcm9ncmVzcyA+IDE1KTtcbiAgcHJvZ3Jlc3NNZXRlci5jbGFzc0xpc3QudG9nZ2xlKFwiY3JpdGljYWxcIiwgc3RhdGUucHJvZ3Jlc3MgPD0gMTUpO1xuICBnYW1lU2hlbGwuY2xhc3NMaXN0LnRvZ2dsZShcImZhaWxlZFwiLCBzdGF0ZS5mYWlsZWQpO1xuICB0ZXJtaW5hbE92ZXJsYXkuaGlkZGVuID0gIXN0YXRlLnRlcm1pbmFsT3BlbjtcbiAgaWYgKHN0YXRlLnRlcm1pbmFsT3BlbikgdXBkYXRlVGVybWluYWwoKTtcblxuICBnYW1lU2hlbGwuZGF0YXNldC5wbGF5ZXJYID0gc3RhdGUucGxheWVyLngudG9GaXhlZCgyKTtcbiAgZ2FtZVNoZWxsLmRhdGFzZXQucGxheWVyWiA9IHN0YXRlLnBsYXllci56LnRvRml4ZWQoMik7XG4gIGdhbWVTaGVsbC5kYXRhc2V0LmNvbXBsZXRlID0gU3RyaW5nKHN0YXRlLmNvbXBsZXRlKTtcbiAgZ2FtZVNoZWxsLmRhdGFzZXQuZmFpbGVkID0gU3RyaW5nKHN0YXRlLmZhaWxlZCk7XG4gIGdhbWVTaGVsbC5kYXRhc2V0LnByb2dyZXNzID0gc3RhdGUucHJvZ3Jlc3MudG9GaXhlZCgyKTtcbiAgY29uc3QgYWN0aW9uUG9zZSA9IGdldFJvYm90QWN0aW9uUG9zZShyb2JvdEFjdGlvbiwgcnVudGltZS5pc0NhcnJ5aW5nKHN0YXRlKSk7XG4gIGdhbWVTaGVsbC5kYXRhc2V0LnJvYm90QWN0aW9uID0gcm9ib3RBY3Rpb24ua2luZDtcbiAgZ2FtZVNoZWxsLmRhdGFzZXQucm9ib3RBY3Rpb25BY3RpdmUgPSBTdHJpbmcocm9ib3RBY3Rpb24uYWN0aXZlKTtcbiAgZ2FtZVNoZWxsLmRhdGFzZXQucm9ib3RBY3Rpb25Qcm9ncmVzcyA9IGFjdGlvblBvc2UucHJvZ3Jlc3MudG9GaXhlZCgzKTtcbiAgZ2FtZVNoZWxsLmRhdGFzZXQucm9ib3RBY3Rpb25Db250YWN0ID0gU3RyaW5nKGFjdGlvblBvc2UuY29udGFjdFJlYWNoZWQpO1xuICBPYmplY3QuZW50cmllcyhydW50aW1lLmdldERlYnVnU3RhdGUoc3RhdGUpKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICBnYW1lU2hlbGwuZGF0YXNldFtrZXldID0gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiID8gSlNPTi5zdHJpbmdpZnkodmFsdWUpIDogU3RyaW5nKHZhbHVlKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHBlcmZvcm1JbnRlcmFjdGlvbigpIHtcbiAgaWYgKCFydW5uaW5nIHx8IHN0YXRlLmNvbXBsZXRlIHx8IHN0YXRlLmZhaWxlZCB8fCBpc1JvYm90QWN0aW9uQWN0aXZlKHJvYm90QWN0aW9uKSkgcmV0dXJuIGZhbHNlO1xuICB2b2lkIGF1ZGlvU3lzdGVtLnVubG9jaygpO1xuICBjb25zdCBiZWZvcmVTdGF0ZSA9IHN0YXRlO1xuICBjb25zdCBiZWZvcmVJbnRlcmFjdGlvbnMgPSBzdGF0ZS5pbnRlcmFjdGlvbnM7XG4gIHN0YXRlID0gcnVudGltZS5pbnRlcmFjdChzdGF0ZSk7XG4gIGlmIChzdGF0ZS5pbnRlcmFjdGlvbnMgIT09IGJlZm9yZUludGVyYWN0aW9ucykge1xuICAgIHJvYm90QWN0aW9uID0gYmVnaW5Sb2JvdEFjdGlvbihyb2JvdEFjdGlvbiwgc3RhdGUubGFzdEV2ZW50LCBiZWZvcmVTdGF0ZSwgc3RhdGUpO1xuICAgIGF1ZGlvU3lzdGVtLnBsYXlFdmVudChzdGF0ZS5sYXN0RXZlbnQsIHJ1bnRpbWUuZ2V0U291bmRQb3NpdGlvbihiZWZvcmVTdGF0ZSwgc3RhdGUpKTtcbiAgICBpZiAoc3RhdGUubGFzdEV2ZW50ICE9PSBcInRlcm1pbmFsX29wZW5lZFwiKSBzaG93VG9hc3QocnVudGltZS5ldmVudE1lc3NhZ2VzW3N0YXRlLmxhc3RFdmVudF0pO1xuICB9XG4gIHVwZGF0ZUludGVyZmFjZSgpO1xuICByZXR1cm4gc3RhdGUuaW50ZXJhY3Rpb25zICE9PSBiZWZvcmVJbnRlcmFjdGlvbnM7XG59XG5cbmZ1bmN0aW9uIHJlYWRJbnB1dCgpIHtcbiAgbGV0IG1vdmUgPSAwO1xuICBsZXQgdHVybiA9IDA7XG4gIGlmIChrZXlzLmhhcyhcIktleVdcIikpIG1vdmUgKz0gMTtcbiAgaWYgKGtleXMuaGFzKFwiS2V5U1wiKSkgbW92ZSAtPSAxO1xuICBpZiAoa2V5cy5oYXMoXCJLZXlBXCIpKSB0dXJuICs9IDE7XG4gIGlmIChrZXlzLmhhcyhcIktleURcIikpIHR1cm4gLT0gMTtcbiAgcmV0dXJuIHsgbW92ZSwgdHVybiB9O1xufVxuXG5mdW5jdGlvbiBhbmltYXRlKG5vdykge1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYW5pbWF0ZSk7XG4gIGNvbnN0IGRlbHRhID0gTWF0aC5taW4oKG5vdyAtIGxhc3RUaW1lKSAvIDEwMDAsIDAuMDUpO1xuICBsYXN0VGltZSA9IG5vdztcbiAgcm9ib3RBY3Rpb24gPSBhZHZhbmNlUm9ib3RBY3Rpb24ocm9ib3RBY3Rpb24sIGRlbHRhKTtcbiAgaWYgKHJ1bm5pbmcgJiYgIXN0YXRlLmNvbXBsZXRlICYmICFzdGF0ZS5mYWlsZWQpIHtcbiAgICBjb25zdCBpbnB1dCA9IGlzUm9ib3RBY3Rpb25BY3RpdmUocm9ib3RBY3Rpb24pID8geyBtb3ZlOiAwLCB0dXJuOiAwIH0gOiByZWFkSW5wdXQoKTtcbiAgICBjb25zdCBwcmV2aW91c1ggPSBzdGF0ZS5wbGF5ZXIueDtcbiAgICBjb25zdCBwcmV2aW91c1ogPSBzdGF0ZS5wbGF5ZXIuejtcbiAgICBzdGF0ZSA9IHJ1bnRpbWUudXBkYXRlTW92ZW1lbnQoc3RhdGUsIGlucHV0LCBkZWx0YSk7XG4gICAgZ2FpdERpc3RhbmNlICs9IE1hdGguaHlwb3Qoc3RhdGUucGxheWVyLnggLSBwcmV2aW91c1gsIHN0YXRlLnBsYXllci56IC0gcHJldmlvdXNaKTtcbiAgfVxuICBjb25zdCBwb3NlID0gZ2V0Um9ib3RBY3Rpb25Qb3NlKHJvYm90QWN0aW9uLCBydW50aW1lLmlzQ2Fycnlpbmcoc3RhdGUpKTtcbiAgY29uc3QgcHJlc2VudGF0aW9uU3RhdGUgPSBnZXRSb2JvdFByZXNlbnRhdGlvblN0YXRlKHJvYm90QWN0aW9uLCBzdGF0ZSk7XG4gIHJvYm90LnBvc2l0aW9uLnNldChzdGF0ZS5wbGF5ZXIueCwgMCwgc3RhdGUucGxheWVyLnopO1xuICByb2JvdC5yb3RhdGlvbi55ID0gc3RhdGUucGxheWVyLnlhdztcbiAgcnVudGltZS5zeW5jUm9ib3RDYXJnbz8uKHJvYm90LCBwcmVzZW50YXRpb25TdGF0ZSk7XG4gIGNvbnN0IGxvb2tEaXJlY3Rpb24gPSAoa2V5cy5oYXMoXCJBcnJvd1VwXCIpID8gMSA6IDApIC0gKGtleXMuaGFzKFwiQXJyb3dEb3duXCIpID8gMSA6IDApO1xuICBkNDM1TG9va1BpdGNoID0gVEhSRUUuTWF0aFV0aWxzLmNsYW1wKFxuICAgIGQ0MzVMb29rUGl0Y2ggKyBsb29rRGlyZWN0aW9uICogVEhSRUUuTWF0aFV0aWxzLmRlZ1RvUmFkKDI4KSAqIGRlbHRhLFxuICAgIFVOSVRSRUVfRzFfSEVBRF9QSVRDSC5taW5pbXVtUmFkaWFucyxcbiAgICBVTklUUkVFX0cxX0hFQURfUElUQ0gubWF4aW11bVJhZGlhbnMsXG4gICk7XG4gIHVwZGF0ZVJvYm90QW5pbWF0aW9uKHJvYm90LCBkZWx0YSwgc3RhdGUuZWxhcHNlZCwgc3RhdGUubW90aW9uLCBwb3NlLCBnYWl0RGlzdGFuY2UsIGQ0MzVMb29rUGl0Y2gpO1xuICBydW50aW1lLnN5bmNWaXN1YWxzKHdvcmxkLCBwcmVzZW50YXRpb25TdGF0ZSwgZGVsdGEpO1xuICBpZiAoc3RhdGUuY29tcGxldGUgJiYgIWNvbXBsZXRlU2hvd24pIHtcbiAgICBjb21wbGV0ZVNob3duID0gdHJ1ZTtcbiAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7IGNvbXBsZXRlT3ZlcmxheS5oaWRkZW4gPSBmYWxzZTsgfSwgNTUwKTtcbiAgfVxuICBpZiAoc3RhdGUuZmFpbGVkICYmICFmYWlsdXJlU2hvd24pIHtcbiAgICBmYWlsdXJlU2hvd24gPSB0cnVlO1xuICAgIGtleXMuY2xlYXIoKTtcbiAgICByb2JvdEFjdGlvbiA9IGZpbmlzaFJvYm90QWN0aW9uKCk7XG4gICAgZmFpbHVyZU92ZXJsYXkuaGlkZGVuID0gZmFsc2U7XG4gICAgc2hvd1RvYXN0KHJ1bnRpbWUuZXZlbnRNZXNzYWdlcy5wcm9ncmVzc19kZXBsZXRlZCk7XG4gIH1cbiAgdXBkYXRlSW50ZXJmYWNlKCk7XG4gIHJlbmRlclZpZXdzKCk7XG59XG5cbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZlbnQpID0+IHtcbiAgaWYgKFtcIktleVdcIiwgXCJLZXlBXCIsIFwiS2V5U1wiLCBcIktleURcIiwgXCJLZXlFXCIsIFwiS2V5UlwiLCBcIkFycm93VXBcIiwgXCJBcnJvd0Rvd25cIiwgXCJFc2NhcGVcIl0uaW5jbHVkZXMoZXZlbnQuY29kZSkpIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gIGlmIChldmVudC5jb2RlID09PSBcIktleUVcIiAmJiAhZXZlbnQucmVwZWF0KSBwZXJmb3JtSW50ZXJhY3Rpb24oKTtcbiAgZWxzZSBpZiAoZXZlbnQuY29kZSA9PT0gXCJLZXlSXCIgJiYgIWV2ZW50LnJlcGVhdCkgcmVzZXRHYW1lKCk7XG4gIGVsc2UgaWYgKGV2ZW50LmNvZGUgPT09IFwiRXNjYXBlXCIgJiYgc3RhdGUudGVybWluYWxPcGVuKSB7XG4gICAgc3RhdGUgPSBydW50aW1lLmNsb3NlVGVybWluYWwoc3RhdGUpO1xuICAgIHVwZGF0ZUludGVyZmFjZSgpO1xuICB9IGVsc2Uga2V5cy5hZGQoZXZlbnQuY29kZSk7XG59KTtcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIiwgKGV2ZW50KSA9PiBrZXlzLmRlbGV0ZShldmVudC5jb2RlKSk7XG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgKCkgPT4ge1xuICBrZXlzLmNsZWFyKCk7XG4gIHJvYm90QWN0aW9uID0gZmluaXNoUm9ib3RBY3Rpb24oKTtcbn0pO1xud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgKCkgPT4ge1xuICByZW5kZXJlci5zZXRQaXhlbFJhdGlvKE1hdGgubWluKHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvLCAyKSk7XG4gIHJlbmRlcmVyLnNldFNpemUod2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCk7XG4gIHBvc3RQcm9jZXNzaW5nPy5zZXRTaXplKHdpbmRvdy5pbm5lcldpZHRoLCB3aW5kb3cuaW5uZXJIZWlnaHQpO1xuICB1cGRhdGVDYW1lcmFGcmFtaW5nKCk7XG59KTtcblxuc3RhcnRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIHN0YXJ0R2FtZSk7XG5yZXN0YXJ0QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCByZXNldEdhbWUpO1xuZmFpbHVyZVJlc3RhcnRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIHJlc2V0R2FtZSk7XG50ZXJtaW5hbENsb3NlLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBwZXJmb3JtSW50ZXJhY3Rpb24pO1xudmlld01vZGVPcHRpb25zLmZvckVhY2goKGJ1dHRvbikgPT4ge1xuICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHNlbGVjdFZpZXdNb2RlKGJ1dHRvbi5kYXRhc2V0LnZpZXdPcHRpb24pKTtcbn0pO1xudmlzdWFsTW9kZU9wdGlvbnMuZm9yRWFjaCgoYnV0dG9uKSA9PiBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHNldFJGMDhWaXN1YWxNb2RlKGJ1dHRvbi5kYXRhc2V0LnJmMDhWaXN1YWwpKSk7XG5cbnVwZGF0ZUludGVyZmFjZSgpO1xucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFuaW1hdGUpO1xuXG53aW5kb3cuX19SRUxBWV9ERU1PX18gPSB7XG4gIGdldFN0YXRlOiAoKSA9PiBzdHJ1Y3R1cmVkQ2xvbmUoc3RhdGUpLFxuICBnZXRSb2JvdEFjdGlvbjogKCkgPT4gc3RydWN0dXJlZENsb25lKHJvYm90QWN0aW9uKSxcbiAgZ2V0SW50ZXJhY3Rpb246ICgpID0+IHJ1bnRpbWUuZ2V0SW50ZXJhY3Rpb24/LihzdGF0ZSkgPz8gbnVsbCxcbiAgY2FwdHVyZUZyYW1lLFxuICBsZXZlbDogTEVWRUwsXG4gIGxldmVsSWQsXG4gIGdldFZpZXdNb2RlOiAoKSA9PiB2aWV3TW9kZSxcbiAgZ2V0VmlzdWFsTW9kZTogKCkgPT4gcmYwOFZpc3VhbE1vZGUsXG4gIGdldEQ0MzVMb29rUGl0Y2g6ICgpID0+IGQ0MzVMb29rUGl0Y2gsXG59O1xuXG5mdW5jdGlvbiBleHRlcm5hbEFnZW50U3RhdHVzKCkge1xuICByZXR1cm4gc3RhdGUuY29tcGxldGUgPyBcIldJTlwiIDogc3RhdGUuZmFpbGVkID8gXCJHQU1FX09WRVJcIiA6IFwiTk9UX0ZJTklTSEVEXCI7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUV4dGVybmFsQWdlbnRPYnNlcnZhdGlvbihoYXJuZXNzID0gXCJoeWJyaWRcIiwgYWN0aW9uUmVzdWx0ID0gbnVsbCkge1xuICBpZiAoIUVYVEVSTkFMX0FHRU5UX0hBUk5FU1NFUy5pbmNsdWRlcyhoYXJuZXNzKSkgdGhyb3cgbmV3IEVycm9yKGDkuI3mlK/mjIHnmoQgSGFybmVzc++8miR7aGFybmVzc31gKTtcbiAgY29uc3QgZGVidWcgPSBydW50aW1lLmdldERlYnVnU3RhdGUoc3RhdGUpO1xuICBjb25zdCBvYnNlcnZhdGlvbiA9IHtcbiAgICBwcm90b2NvbFZlcnNpb246IFwiYXJjLWVudi12MVwiLFxuICAgIG9ic2VydmVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICBnYW1lSWQ6IGAke2xldmVsSWR9LXYxYCxcbiAgICBsZXZlbDogbGV2ZWxJZCxcbiAgICB2aWV3OiB2aWV3TW9kZSxcbiAgICBoYXJuZXNzLFxuICAgIHJlYWR5OiByb2JvdEFzc2V0c0xvYWRlZCAmJiAhcm9ib3RBc3NldHNGYWlsZWQsXG4gICAgc3RhdHVzOiBleHRlcm5hbEFnZW50U3RhdHVzKCksXG4gICAgYXZhaWxhYmxlQWN0aW9uczogRVhURVJOQUxfQUdFTlRfQUNUSU9OUyxcbiAgICBodWQ6IGh1ZE9ic2VydmF0aW9uKCksXG4gICAgYWN0aW9uUmVzdWx0LFxuICB9O1xuICBpZiAoaGFybmVzcyAhPT0gXCJzdGF0ZVwiKSBvYnNlcnZhdGlvbi5zY3JlZW5zaG90ID0gY2FwdHVyZUZyYW1lKCk7XG4gIGlmIChoYXJuZXNzID09PSBcImh5YnJpZFwiKSB7XG4gICAgb2JzZXJ2YXRpb24ucGxheWVyID0gc3RydWN0dXJlZENsb25lKHN0YXRlLnBsYXllcik7XG4gICAgb2JzZXJ2YXRpb24ubW90aW9uID0gc3RhdGUubW90aW9uO1xuICAgIG9ic2VydmF0aW9uLmxhc3RFdmVudCA9IHN0YXRlLmxhc3RFdmVudDtcbiAgICBvYnNlcnZhdGlvbi5pbnRlcmFjdGlvbiA9IHJ1bnRpbWUuZ2V0SW50ZXJhY3Rpb24/LihzdGF0ZSkgPz8gbnVsbDtcbiAgICBvYnNlcnZhdGlvbi5kZWJ1ZyA9IHN0cnVjdHVyZWRDbG9uZShkZWJ1Zyk7XG4gIH1cbiAgaWYgKGhhcm5lc3MgPT09IFwic3RhdGVcIikge1xuICAgIG9ic2VydmF0aW9uLnN0YXRlID0gc3RydWN0dXJlZENsb25lKHN0YXRlKTtcbiAgICBvYnNlcnZhdGlvbi5pbnRlcmFjdGlvbiA9IHJ1bnRpbWUuZ2V0SW50ZXJhY3Rpb24/LihzdGF0ZSkgPz8gbnVsbDtcbiAgICBvYnNlcnZhdGlvbi5kZWJ1ZyA9IHN0cnVjdHVyZWRDbG9uZShkZWJ1Zyk7XG4gIH1cbiAgcmV0dXJuIG9ic2VydmF0aW9uO1xufVxuXG5hc3luYyBmdW5jdGlvbiBleGVjdXRlRXh0ZXJuYWxBZ2VudEFjdGlvbihhY3Rpb24sIGR1cmF0aW9uTXMgPSAzMDAsIGhhcm5lc3MgPSBcImh5YnJpZFwiKSB7XG4gIGNvbnN0IG5vcm1hbGl6ZWRBY3Rpb24gPSBTdHJpbmcoYWN0aW9uIHx8IFwiXCIpLnRvVXBwZXJDYXNlKCk7XG4gIGlmICghRVhURVJOQUxfQUdFTlRfQUNUSU9OUy5pbmNsdWRlcyhub3JtYWxpemVkQWN0aW9uKSkgdGhyb3cgbmV3IEVycm9yKGDpnZ7ms5XliqjkvZzvvJoke25vcm1hbGl6ZWRBY3Rpb259YCk7XG4gIGlmICghcm9ib3RBc3NldHNMb2FkZWQgfHwgcm9ib3RBc3NldHNGYWlsZWQpIHRocm93IG5ldyBFcnJvcihcIkcxIEVEVTIgwrcgRGV4MSDmqKHlnovlsJrmnKrliqDovb3lrozmiJBcIik7XG4gICAgICBjb25zdCBub3JtYWxpemVkRHVyYXRpb24gPSBNYXRoLm1pbigxMDAwLCBNYXRoLm1heCg1MCwgTnVtYmVyKGR1cmF0aW9uTXMpIHx8IDMwMCkpO1xuICAgICAgY29uc3QgcnVuID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBpZiAoIXJ1bm5pbmcpIHN0YXJ0R2FtZSgpO1xuICAgICAgICBpZiAoIXJ1bm5pbmcpIHJldHVybjtcbiAgICAgICAgY29uc3QgYmVmb3JlID0geyB4OiBzdGF0ZS5wbGF5ZXIueCwgejogc3RhdGUucGxheWVyLnosIHlhdzogc3RhdGUucGxheWVyLnlhdywgaW50ZXJhY3Rpb25zOiBzdGF0ZS5pbnRlcmFjdGlvbnMgfTtcbiAgICBhd2FpdCBleGVjdXRlQWdlbnRBY3Rpb24obm9ybWFsaXplZEFjdGlvbiwgbm9ybWFsaXplZER1cmF0aW9uKTtcbiAgICBjb25zdCBpbnRlcmFjdGVkID0gc3RhdGUuaW50ZXJhY3Rpb25zICE9PSBiZWZvcmUuaW50ZXJhY3Rpb25zO1xuICAgIGNvbnN0IGFjdGlvblJlc3VsdCA9IHtcbiAgICAgIGFjdGlvbjogbm9ybWFsaXplZEFjdGlvbixcbiAgICAgIGR1cmF0aW9uTXM6IG5vcm1hbGl6ZWREdXJhdGlvbixcbiAgICAgIGV2ZW50OiBpbnRlcmFjdGVkID8gc3RhdGUubGFzdEV2ZW50IDogbm9ybWFsaXplZEFjdGlvbiA9PT0gXCJFXCIgPyBcIm5vX2ludGVyYWN0aW9uXCIgOiBcImV4ZWN1dGVkXCIsXG4gICAgICBtb3ZlZDogTWF0aC5oeXBvdChzdGF0ZS5wbGF5ZXIueCAtIGJlZm9yZS54LCBzdGF0ZS5wbGF5ZXIueiAtIGJlZm9yZS56KSxcbiAgICAgIHR1cm5lZDogTWF0aC5hYnMoc3RhdGUucGxheWVyLnlhdyAtIGJlZm9yZS55YXcpLFxuICAgICAgc3RhdHVzOiBleHRlcm5hbEFnZW50U3RhdHVzKCksXG4gICAgfTtcbiAgICByZXR1cm4gY3JlYXRlRXh0ZXJuYWxBZ2VudE9ic2VydmF0aW9uKGhhcm5lc3MsIGFjdGlvblJlc3VsdCk7XG4gIH07XG4gIGV4dGVybmFsQWdlbnRBY3Rpb24gPSBleHRlcm5hbEFnZW50QWN0aW9uLnRoZW4ocnVuLCBydW4pO1xuICByZXR1cm4gZXh0ZXJuYWxBZ2VudEFjdGlvbjtcbn1cblxud2luZG93Ll9fQVJDX0FHRU5UX18gPSBPYmplY3QuZnJlZXplKHtcbiAgcHJvdG9jb2xWZXJzaW9uOiBcImFyYy1lbnYtdjFcIixcbiAgcmVhZHk6ICgpID0+ICh7XG4gICAgcmVhZHk6IHJvYm90QXNzZXRzTG9hZGVkICYmICFyb2JvdEFzc2V0c0ZhaWxlZCxcbiAgICBhc3NldFN0YXRlOiBnYW1lU2hlbGwuZGF0YXNldC5yb2JvdEFzc2V0U3RhdGUgfHwgXCJsb2FkaW5nXCIsXG4gICAgbGV2ZWw6IGxldmVsSWQsXG4gICAgdmlldzogdmlld01vZGUsXG4gIH0pLFxuICBvYnNlcnZlOiAoaGFybmVzcyA9IFwiaHlicmlkXCIpID0+IGNyZWF0ZUV4dGVybmFsQWdlbnRPYnNlcnZhdGlvbihoYXJuZXNzKSxcbiAgYWN0OiAoeyBhY3Rpb24sIGR1cmF0aW9uTXMgPSAzMDAsIGhhcm5lc3MgPSBcImh5YnJpZFwiIH0pID0+IGV4ZWN1dGVFeHRlcm5hbEFnZW50QWN0aW9uKGFjdGlvbiwgZHVyYXRpb25NcywgaGFybmVzcyksXG4gIHJlc2V0OiAoeyBoYXJuZXNzID0gXCJoeWJyaWRcIiB9ID0ge30pID0+IHtcbiAgICByZXNldFNpbXVsYXRpb24oeyBmb3JjZTogdHJ1ZSB9KTtcbiAgICBpZiAoIXJ1bm5pbmcpIHN0YXJ0R2FtZSgpO1xuICAgIHJldHVybiBjcmVhdGVFeHRlcm5hbEFnZW50T2JzZXJ2YXRpb24oaGFybmVzcywgeyBhY3Rpb246IFwiUkVTRVRcIiwgZXZlbnQ6IFwiZW52aXJvbm1lbnRfcmVzZXRcIiwgc3RhdHVzOiBleHRlcm5hbEFnZW50U3RhdHVzKCkgfSk7XG4gIH0sXG4gIGdldFN0YXRlOiAoKSA9PiBzdHJ1Y3R1cmVkQ2xvbmUoc3RhdGUpLFxufSk7XG5cbmFzeW5jIGZ1bmN0aW9uIHN0YXJ0RXBpc29kZUJyaWRnZSgpIHtcbiAgY29uc3QgZXBpc29kZUlkID0gc2VhcmNoUGFyYW1zLmdldChcImVwaXNvZGVcIik7XG4gIGNvbnN0IGJyb3dzZXJUb2tlbiA9IHNlYXJjaFBhcmFtcy5nZXQoXCJicm93c2VyX3Rva2VuXCIpO1xuICBpZiAoIWVwaXNvZGVJZCB8fCAhYnJvd3NlclRva2VuKSByZXR1cm47XG4gIGdhbWVTaGVsbC5kYXRhc2V0LmFnZW50RXBpc29kZSA9IGVwaXNvZGVJZDtcbiAgY29uc3QgYmFzZVBhdGggPSBgL2FwaS92MS9lcGlzb2Rlcy8ke2VuY29kZVVSSUNvbXBvbmVudChlcGlzb2RlSWQpfWA7XG4gIGNvbnN0IHJlcXVlc3QgPSBhc3luYyAocGF0aCwgb3B0aW9ucyA9IHt9KSA9PiB7XG4gICAgY29uc3Qgc2VwYXJhdG9yID0gcGF0aC5pbmNsdWRlcyhcIj9cIikgPyBcIiZcIiA6IFwiP1wiO1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7YmFzZVBhdGh9LyR7cGF0aH0ke3NlcGFyYXRvcn1icm93c2VyX3Rva2VuPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGJyb3dzZXJUb2tlbil9YCwge1xuICAgICAgY2FjaGU6IFwibm8tc3RvcmVcIixcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgICBoZWFkZXJzOiB7IFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLCAuLi4ob3B0aW9ucy5oZWFkZXJzIHx8IHt9KSB9LFxuICAgIH0pO1xuICAgIGlmICghcmVzcG9uc2Uub2sgJiYgcmVzcG9uc2Uuc3RhdHVzICE9PSAyMDQpIHtcbiAgICAgIGNvbnN0IGRldGFpbCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihkZXRhaWwuZXJyb3IgfHwgYEVwaXNvZGUgQVBJIOi/lOWbniAke3Jlc3BvbnNlLnN0YXR1c31gKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3BvbnNlO1xuICB9O1xuICB3aGlsZSAoIXJvYm90QXNzZXRzTG9hZGVkICYmICFyb2JvdEFzc2V0c0ZhaWxlZCkgYXdhaXQgZGVsYXkoMjUwKTtcbiAgY29uc3QgaGFybmVzcyA9IHNlYXJjaFBhcmFtcy5nZXQoXCJoYXJuZXNzXCIpIHx8IFwiaHlicmlkXCI7XG4gIGF3YWl0IHJlcXVlc3QoXCJvYnNlcnZhdGlvbnNcIiwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBvYnNlcnZhdGlvbjogY3JlYXRlRXh0ZXJuYWxBZ2VudE9ic2VydmF0aW9uKGhhcm5lc3MpIH0pLFxuICB9KTtcbiAgd2hpbGUgKHRydWUpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0KFwiY29tbWFuZHMvbmV4dFwiKTtcbiAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDIwNCkge1xuICAgICAgICBhd2FpdCBkZWxheSgzMDApO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNvbW1hbmQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICBsZXQgb2JzZXJ2YXRpb247XG4gICAgICBpZiAoY29tbWFuZC5raW5kID09PSBcImFjdFwiKSB7XG4gICAgICAgIG9ic2VydmF0aW9uID0gYXdhaXQgZXhlY3V0ZUV4dGVybmFsQWdlbnRBY3Rpb24oY29tbWFuZC5wYXlsb2FkLmFjdGlvbiwgY29tbWFuZC5wYXlsb2FkLmR1cmF0aW9uTXMsIGhhcm5lc3MpO1xuICAgICAgfSBlbHNlIGlmIChjb21tYW5kLmtpbmQgPT09IFwicmVzZXRcIikge1xuICAgICAgICBvYnNlcnZhdGlvbiA9IHdpbmRvdy5fX0FSQ19BR0VOVF9fLnJlc2V0KHsgaGFybmVzcyB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9ic2VydmF0aW9uID0gY3JlYXRlRXh0ZXJuYWxBZ2VudE9ic2VydmF0aW9uKGhhcm5lc3MsIHsgYWN0aW9uOiBcIk9CU0VSVkVcIiwgZXZlbnQ6IFwib2JzZXJ2ZWRcIiwgc3RhdHVzOiBleHRlcm5hbEFnZW50U3RhdHVzKCkgfSk7XG4gICAgICB9XG4gICAgICBhd2FpdCByZXF1ZXN0KFwib2JzZXJ2YXRpb25zXCIsIHtcbiAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBjb21tYW5kSWQ6IGNvbW1hbmQuaWQsIG9ic2VydmF0aW9uIH0pLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGdhbWVTaGVsbC5kYXRhc2V0LmFnZW50QnJpZGdlRXJyb3IgPSBlcnJvci5tZXNzYWdlO1xuICAgICAgYXdhaXQgZGVsYXkoMTAwMCk7XG4gICAgfVxuICB9XG59XG5cbnZvaWQgc3RhcnRFcGlzb2RlQnJpZGdlKCk7XG5cbmlmIChzZWFyY2hQYXJhbXMuZ2V0KFwicWFDYXB0dXJlXCIpID09PSBcIjFcIikge1xuICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgY29uc3QgZnJhbWUgPSBuZXcgSW1hZ2UoKTtcbiAgICBmcmFtZS5pZCA9IFwicWEtY2FwdHVyZWQtZnJhbWVcIjtcbiAgICBmcmFtZS5hbHQgPSBcIlJGLTAxIFFBIGNhcHR1cmVkIGZyYW1lXCI7XG4gICAgZnJhbWUuc3JjID0gY2FwdHVyZVJlbmRlckZyYW1lKCk7XG4gICAgZnJhbWUuaGlkZGVuID0gdHJ1ZTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZChmcmFtZSk7XG4gIH0sIDYwMDApO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ3JFLE1BQU0sQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7QUFDbEQsTUFBTSxDQUFDLENBQUMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO0FBQ3hFLE1BQU0sQ0FBQyxDQUFDLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO0FBQ3ZFLE1BQU0sQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7QUFDbEUsTUFBTSxDQUFDO0FBQ1AsQ0FBQyxDQUFDLGlDQUFpQztBQUNuQyxDQUFDLENBQUMseUJBQXlCO0FBQzNCLENBQUMsQ0FBQyxrQ0FBa0M7QUFDcEMsQ0FBQyxDQUFDLDRCQUE0QjtBQUM5QixDQUFDLENBQUMscUJBQXFCO0FBQ3ZCLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxD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LE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNwRCxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDcEQsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3BELENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNwRCxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDcEQsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3BELENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ3BFLENBQUM7QUFDRCxLQUFLLENBQUMsT0FBTyxDQUFDLENB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LENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzVDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3BDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3RDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3BDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3BDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2xDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDekIsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDMUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDeEMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDMUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDMUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDeEMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL0YsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDMUYsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVFLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUMvQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5RSxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNoQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN0QyxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUMvRSxLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQzs7QUFFN0UsUUFBUSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7QUFDMUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO0FBQ3hELENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTztBQUNuQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsS0FBSztBQUNqRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSTtBQUNoRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsV0FBVztBQUN6RCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsVUFBVTtBQUN2RCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsU0FBUztBQUNyRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsV0FBVztBQUN6RCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsVUFBVTtBQUNyRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLGNBQWM7QUFDL0MsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLGNBQWM7QUFDN0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxlQUFlO0FBQ3RFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxjQUFjO0FBQy9ELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxhQUFhO0FBQzdELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxZQUFZO0FBQzNELENBQUMsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JFLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPO0FBQ3pELENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUMvQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzNELENBQUMsQ0FB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LENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDM0UsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDM0UsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNO0FBQ3hELENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDN0UsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQzlHLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDM0UsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsS0FB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SSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2QsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ25CLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2xDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSTtBQUNiOztBQUVBLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBQ3JCLENBQUMsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDMUI7O0FBRUEsUUFBUSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7QUFDMUIsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDO0FBQy9DLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDVCxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLGNBQWM7QUFDN0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ3BELENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsU0FBUyxDQUFDLEtBQUs7QUFDMUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTTtBQUM1QixDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJO0FBQ3hCLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDN0UsQ0FBQyxDQUFDLENBQUM7QUFDSDs7QUFFQSxRQUFRLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzlDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsQ0FBQztBQUM5QyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU07QUFDbkUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoQixDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztBQUN4QyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3JCLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO0FBQzdDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDaEIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUM5QyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztBQUNqRCxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ25ELENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZCLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQy9ELENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7QUFDM0MsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUNuQjs7QUFFQSxRQUFRLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEYsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL0MsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNmLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ25CLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUM1QixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUk7QUFDaEQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzVELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUNyRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUk7QUFDakIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU07QUFDdkMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQ1gsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJO0FBQ2pCLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUM7QUFDRixDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ25HOztBQUVBLFFBQVEsQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDakMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDekIsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDMUIsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDMUIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDO0FBQ3JDLENBQUMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQzs7QUFFL0IsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbkYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzFCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUM7QUFDbkQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNO0FBQzlELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNqRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7QUFDcEUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRU4sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbkYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLO0FBQzNCLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO0FBQ2pELENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNyRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE1BQU07QUFDNUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDakQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDOztBQUVyRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDakMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUNwRCxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUs7QUFDM0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDakQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQ25ELENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTTtBQUM1QixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUNqRCxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQzdCLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDMUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUM1QixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUM5QyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pELENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTTtBQUNsRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDOztBQUVyRixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUs7QUFDM0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDakQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQ2xGLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTTtBQUM1QixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUNqRCxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUMxRSxDQUFDLENBQUMsQ0FBQyxDQUFDOztBQUVKLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pGLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSztBQUMzQixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUNqRCxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDL0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUFNO0FBQzVCLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO0FBQ2pELENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDbEUsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFFSixDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuRixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ2pCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDO0FBQzdDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDO0FBQzdELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDO0FBQzNELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM1QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUMvQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLO0FBQzdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUNuRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUNoRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUFNO0FBQzlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUNuRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUMvQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQ3hELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQzlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ04sQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFFSixDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDL0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ25GLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUs7QUFDN0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO0FBQ25ELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDakYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTTtBQUM5QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDbkQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDbkUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSztBQUM3QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDbkQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE1BQU07QUFDaEMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUNyRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDdEgsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDTixDQUFDLENBQUM7QUFDRjs7QUFFQSxRQUFRLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDO0FBQ2pDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLHlCQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxNQUFNO0FBQy9GLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDO0FBQzVFLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUM7QUFDN0M7O0FBRUEsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7QUFDdkIsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUM7QUFDekIsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxVQUFVO0FBQ2pDLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsV0FBVztBQUNuQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUs7QUFDL0QsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2xLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDM0MsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMxSCxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUM3QyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsNEJBQTRCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUk7QUFDeEcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJO0FBQ3hCLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsTUFBTTtBQUNqRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUNqRCxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3JCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztBQUNuRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7QUFDbEUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDekMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDdEMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDO0FBQ3pGLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQztBQUNsSCxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3JCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGlDQUFpQyxDQUFDLFlBQVksQ0FBQztBQUNyRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDWCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUM7QUFDN0UsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLHNCQUFzQixDQUFDLENBQUM7QUFDM0MsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsa0NBQWtDLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3JFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQ1IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUM7QUFDdkYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLFlBQVksQ0FBQztBQUNyRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDZCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxrQ0FBa0MsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDdEUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENB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QVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoRixDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVDOztBQUVBLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7QUFDOUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUNyQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDdEQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQztBQUN2QyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNYLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDSjs7QUFFQSxLQUFLLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDNUQsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFD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Q0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLEtBQUs7QUFDMUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJO0FBQ3hDLENBQUMsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ2pFLENBQUMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFDakQsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7QUFDbkQsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDdEUsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDeEYsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUNsRSxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDcEQsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxN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LENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN2Qjs7QUFFQSxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3RCLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLENBQUM7QUFDaEMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQ3ZELENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUc7QUFDaEIsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3RELENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFD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QUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQ3JJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQ2xFLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDOUQsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDMUQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxhQUFh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RSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQzVCLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDdEQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTTtBQUNyQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTO0FBQzNDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSTtBQUNyRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUM7QUFDOUMsQ0FBQyxDQUFDO0FBQ0YsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUMzQixDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUM7QUFDOUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJO0FBQ3JFLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQztBQUM5QyxDQUFDLENBQUM7QUFD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
