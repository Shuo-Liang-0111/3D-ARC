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
const levelId = ["rf01", "rf01-2", "rf01-3", "rf02", "rf02-2", "rf02-3", "rf03", "rf04", "rf04-2", "rf04-3", "rf05", "rf05-2", "rf05-3", "rf06", "rf06-2", "rf06-3", "rf07", "rf07-2", "rf07-3", "rf08", "rf09", "rf09-2", "rf09-3", "rf10", "rf11", "rf12", "rf12-2", "rf12-3", "rf13", "rf13-02", "rf13-03", "rf14", "rf14-2", "rf14-3", "rf15", "rf15-1", "rf15-2", "rf15-3", "test_zpf", "test_zpf2"].includes(requestedLevel) ? requestedLevel : "rf01";
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
  "rf12-2": () => import("/game/levels/rf12-2/runtime.js"),
  "rf12-3": () => import("/game/levels/rf12-3/runtime.js"),
  rf13: () => import("/game/levels/rf13/series-entry.js"),
  "rf13-02": () => import("/game/levels/rf13-02/runtime.js"),
  "rf13-03": () => import("/game/levels/rf13-03/runtime.js"),
  rf14: () => import("/game/levels/rf14/series-base-runtime.js"),
  "rf14-2": () => import("/game/levels/rf14-2/runtime.js"),
  "rf14-3": () => import("/game/levels/rf14-3/runtime.js"),
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
  "rf05-3": "完成客房回收补给、关窗回收三张纸巾及家具归位，确认客房可交付",
  rf06: "关闭漏水阀门，接住残水、清理积水并归还工具。",
  "rf06-2": "止住漏水，清除扩散的积水并归还工具。",
  "rf06-3": "拿起杀虫剂，消灭住宅内的两只蟑螂。",
  rf07: "完成冷链转运",
  "rf07-2": "启动全部三台冷藏柜",
  "rf07-3": "完成冷链转运并处置泄漏报警",
  rf08: "自由探索实景办公室",
  rf09: "在会议桌摆好一份文件和一瓶水",
  "rf09-2": "摆好一份文件和一瓶水，将挡路椅子推回黄框（顺序不限）",
  "rf09-3": "摆好文件和水、椅子归位（顺序不限）；来电后 30 秒内接听",
  rf10: "自由探索会议室重建场景",
  rf11: "完成双机器人协作搬运",
  rf12: "完成家庭厨房安全任务",
  "rf12-2": "完成简易备餐归位",
  "rf12-3": "烧开水，并在 55–65 秒内关火",
  rf13: "完成社区诊所开诊任务",
  "rf13-02": "补给两间诊室，并在前台确认",
  "rf13-03": "处理六个动态请求，并在前台交班",
  rf14: "收集网球并全部归筐",
  "rf14-2": "将黄色标准球与橙色训练球分别归筐",
  "rf14-3": "分类收齐网球，并在下雨时进棚避雨",
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
  $("#start-copy").textContent = levelId === "rf12-3" ? runtime.ui.startCopy : finalObjective;
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
    if (!["rf14","rf14-2","rf14-3"].includes(link.dataset.levelOption)) nextUrl.pathname="/";
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
const mujocoEnabled = robotId === "g1" && !isCooperativeLevel;
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
    for (const name of ["physics", "qa", "tennisqa", "review"]) {
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
    if (!["rf14","rf14-2","rf14-3"].includes(link.dataset.levelOption)) nextUrl.pathname="/";
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

