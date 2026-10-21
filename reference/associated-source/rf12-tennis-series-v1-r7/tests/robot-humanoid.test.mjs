import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";
import {
  configureUnitreeG1D435DepthCamera,
  getUnitreeG1D435WorldPose,
  setUnitreeG1FirstPersonHeadVisible,
  updateUnitreeG1Dex1Model,
  UNITREE_G1_D435_DEPTH_CAMERA,
  UNITREE_G1_HEAD_PITCH,
} from "../game/unitree-g1-dex1-model.js";
import { createRobot, updateRobotAnimation } from "../game/robot.js";

const robotSource = await readFile(new URL("../game/robot.js", import.meta.url), "utf8");
const modelSource = await readFile(new URL("../game/unitree-g1-dex1-model.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../game/app.js", import.meta.url), "utf8");

test("official MuJoCo G1 EDU2 29DOF GLB is the runtime robot", () => {
  assert.match(modelSource, /g1\/g1_29dof_official\.glb/);
  assert.match(robotSource, /profile\.loadModel\(\{ url: assetUrl, groundY: 0, \.\.\.options \}\)/);
  assert.doesNotMatch(robotSource, /createDexterousHand/);
  const robot = createRobot();
  assert.equal(robot.name, "unitree-g1-edu2-dex1-game-robot");
  assert.equal(robot.userData.modelVariant, "G1 EDU2 · 官方 MuJoCo 29DOF");
});

test("official loader preserves the MuJoCo kinematic hierarchy", () => {
  assert.match(modelSource, /left_hand_base_link: "left_wrist_yaw_link"/);
  assert.match(modelSource, /right_hand_base_link: "right_wrist_yaw_link"/);
  assert.match(modelSource, /d435_link: "torso_link"/);
  assert.match(modelSource, /hand_\$\{finger\}_3/);
  assert.match(modelSource, /setUnitreeG1Dex1Grip/);
  assert.match(modelSource, /officialTemplatePromises/);
  assert.match(modelSource, /getUnitreeG1Dex1AssetUrls/);
  assert.match(modelSource, /addMujocoHeadAndSensorLinks/);
  assert.match(robotSource, /assetUrls\[Math\.min\(attempt - 1, assetUrls\.length - 1\)\]/);
});

test("third-person robot preserves cargo and interaction contracts", () => {
  const robot = createRobot();
  const carryPose = { kind: "pickup", visualCarrying: true, reach: 0.7, carryBlend: 0.8, grip: 0.75 };
  updateRobotAnimation(robot, 0.1, 1, "moving", carryPose);
  assert.equal(robot.userData.rackPayload.visible, true);
  assert.equal(robot.userData.rackBattery, robot.userData.rackPayload);
  assert.equal(robot.userData.cargoGrip.position.y < 0.88, true);
  assert.match(robotSource, /motion === "moving" \? "walking"/);
});

test("robot cargo can preserve authored meter scale", () => {
  const cargo = new THREE.Group();
  cargo.userData.robotScale = 1;
  const robot = createRobot(cargo);

  assert.equal(robot.userData.rackPayload, cargo);
  assert.deepEqual(cargo.scale.toArray(), [1, 1, 1]);
});

test("first-person view renders the actual full robot from the D435 optical pose", () => {
  assert.doesNotMatch(appSource, /createFirstPersonRobot|firstPersonRig/);
  assert.match(appSource, /getUnitreeG1D435WorldPose\(robot, firstPersonCamera\.position, firstPersonForward\)/);
  assert.match(appSource, /robot\.visible = true/);
});

test("first-person head hiding restores collision debug visibility exactly", () => {
  const head = new THREE.Group();
  head.name = "head_link";
  const shell = new THREE.Mesh(new THREE.BoxGeometry());
  const hiddenCollider = new THREE.Mesh(new THREE.BoxGeometry());
  hiddenCollider.visible = false;
  head.add(shell, hiddenCollider);
  const model = new THREE.Group();
  model.add(head);
  const robot = { userData: { officialModel: model } };

  setUnitreeG1FirstPersonHeadVisible(robot, false);
  assert.equal(shell.visible, false);
  assert.equal(hiddenCollider.visible, false);
  setUnitreeG1FirstPersonHeadVisible(robot, true);
  assert.equal(shell.visible, true);
  assert.equal(hiddenCollider.visible, false);
});

test("MuJoCo gait keeps the front-end collision pose authoritative", () => {
  assert.match(appSource, /projectWorldPose: false/);
  assert.match(appSource, /robot\.position\.set\(state\.player\.x, robot\.position\.y, state\.player\.z\)/);
  assert.doesNotMatch(appSource, /x: sampledMujocoState\.base\.position\[0\]/);
  assert.doesNotMatch(appSource, /z: sampledMujocoState\.base\.position\[2\]/);
});

test("first-person camera follows the official head-mounted D435 depth imager", () => {
  assert.equal(UNITREE_G1_HEAD_PITCH.parentLink, "torso_link");
  assert.equal(UNITREE_G1_HEAD_PITCH.visualLink, "head_link");
  assert.equal(UNITREE_G1_HEAD_PITCH.sensorLink, "d435_link");
  assert.equal(UNITREE_G1_D435_DEPTH_CAMERA.parentLink, "torso_link");
  assert.equal(UNITREE_G1_D435_DEPTH_CAMERA.runtimeParentLink, UNITREE_G1_HEAD_PITCH.linkName);
  assert.deepEqual(UNITREE_G1_D435_DEPTH_CAMERA.translationUrdfMeters, [0.0576235, 0.01753, 0.41987]);
  assert.deepEqual(UNITREE_G1_D435_DEPTH_CAMERA.rotationRpyRadians, [0, 0.8307767239493009, 0]);
  assert.deepEqual(UNITREE_G1_D435_DEPTH_CAMERA.opticalAxisUrdf, [1, 0, 0]);
  assert.equal(UNITREE_G1_D435_DEPTH_CAMERA.width, 848);
  assert.equal(UNITREE_G1_D435_DEPTH_CAMERA.height, 480);
  assert.equal(UNITREE_G1_D435_DEPTH_CAMERA.horizontalFov, 87);
  assert.equal(UNITREE_G1_D435_DEPTH_CAMERA.verticalFov, 58);
  assert.equal(UNITREE_G1_D435_DEPTH_CAMERA.minimumDepthMeters, 0.105);
  assert.equal(UNITREE_G1_D435_DEPTH_CAMERA.maximumDepthMeters, 10);
  assert.match(appSource, /fitAspectViewport\(view, UNITREE_G1_D435_DEPTH_CAMERA\.aspect\)/);
  assert.match(appSource, /configureUnitreeG1D435DepthCamera/);
  assert.doesNotMatch(appSource, /firstPersonCamera\.position\.set\(state\.player\.x, 2\.26/);
});

test("D435 world pose applies the official URDF mount and downward optical axis", () => {
  const official = new THREE.Group();
  const torso = new THREE.Group();
  torso.name = "torso_link";
  official.add(torso);
  const headPitch = new THREE.Group();
  headPitch.name = UNITREE_G1_HEAD_PITCH.linkName;
  torso.add(headPitch);
  const sensor = new THREE.Group();
  sensor.name = UNITREE_G1_HEAD_PITCH.sensorLink;
  const [urdfX, urdfY, urdfZ] = UNITREE_G1_D435_DEPTH_CAMERA.translationUrdfMeters;
  sensor.position.set(-urdfY, urdfZ, urdfX);
  sensor.rotation.y = -Math.PI / 2;
  headPitch.add(sensor);
  const model = new THREE.Group();
  model.add(official);
  const robot = { userData: { officialModel: model } };
  const position = new THREE.Vector3();
  const forward = new THREE.Vector3();

  assert.equal(getUnitreeG1D435WorldPose(robot, position, forward), true);
  assert.ok(Math.abs(position.x + 0.01753) < 1e-9);
  assert.ok(Math.abs(position.y - 0.41987) < 1e-9);
  assert.ok(Math.abs(position.z - 0.0576235) < 1e-9);
  assert.ok(Math.abs(forward.y) < 1e-9);
  assert.ok(Math.abs(forward.x) < 1e-9);
  assert.ok(forward.z > 0);

  headPitch.rotation.x = -THREE.MathUtils.degToRad(30);
  assert.equal(getUnitreeG1D435WorldPose(robot, position, forward), true);
  assert.ok(Math.abs(THREE.MathUtils.radToDeg(Math.asin(forward.y)) - 30) < 1e-9);
});

test("D435 projection preserves the independent nominal depth FOVs", () => {
  const camera = configureUnitreeG1D435DepthCamera(new THREE.PerspectiveCamera());
  const horizontalFov = THREE.MathUtils.radToDeg(2 * Math.atan(1 / camera.projectionMatrix.elements[0]));
  const verticalFov = THREE.MathUtils.radToDeg(2 * Math.atan(1 / camera.projectionMatrix.elements[5]));

  assert.ok(Math.abs(horizontalFov - 87) < 1e-9);
  assert.ok(Math.abs(verticalFov - 58) < 1e-9);
  assert.equal(camera.near, 0.105);
  assert.equal(camera.far, 40);
});

test("G1 first-person rendering stays at 40m while D435 measurement stays at 10m", () => {
  const camera = configureUnitreeG1D435DepthCamera(new THREE.PerspectiveCamera());

  assert.equal(camera.near, UNITREE_G1_D435_DEPTH_CAMERA.minimumDepthMeters);
  assert.equal(camera.far, UNITREE_G1_D435_DEPTH_CAMERA.renderFarMeters);
  assert.equal(UNITREE_G1_D435_DEPTH_CAMERA.renderFarMeters, 40);
  assert.equal(UNITREE_G1_D435_DEPTH_CAMERA.maximumDepthMeters, 10);
  assert.doesNotMatch(appSource, /firstPersonRenderFar|levelId === "rf01" \? 40/);
  assert.match(appSource, /configureUnitreeG1D435DepthCamera\(new THREE\.PerspectiveCamera\(\)\)/);
  assert.match(appSource, /configureUnitreeG1D435DepthCamera\(activeCamera\)/);
});

test("gait phase is driven by translated distance instead of free-running time", () => {
  assert.match(appSource, /gaitDistance \+= Math\.hypot/);
  assert.match(robotSource, /travelDistance = null/);
  assert.match(modelSource, /travelDistance \* Math\.PI \/ \(2 \* walkingStride\)/);
  assert.match(modelSource, /const walkingStride = 0\.175/);
});

test("D435 look pitch persists and only rotates the runtime head link", () => {
  assert.match(appSource, /keys\.has\("ArrowUp"\)/);
  assert.match(appSource, /keys\.has\("ArrowDown"\)/);
  assert.match(appSource, /d435LookPitch \+ lookDirection/);
  assert.match(appSource, /UNITREE_G1_HEAD_PITCH\.minimumRadians/);
  assert.match(appSource, /UNITREE_G1_HEAD_PITCH\.maximumRadians/);
  const animateSource = appSource.slice(appSource.indexOf("function animate"), appSource.indexOf("window.addEventListener"));
  assert.doesNotMatch(animateSource, /d435LookPitch \*=|d435LookPitch = 0;/);
  const gazeSource = modelSource.slice(modelSource.indexOf("const gaze ="), modelSource.indexOf("// World-space validation"));
  assert.match(gazeSource, /UNITREE_G1_HEAD_PITCH\.linkName, pitchAxis, -gaze/);
  assert.doesNotMatch(gazeSource, /waist_roll_link|hip_pitch_link|knee_link|ankle_pitch_link/);

  const official = new THREE.Group();
  const jointNames = [
    UNITREE_G1_HEAD_PITCH.linkName,
    "waist_roll_link",
    "left_hip_pitch_link",
    "right_hip_pitch_link",
    "left_knee_link",
    "right_knee_link",
    "left_ankle_pitch_link",
    "right_ankle_pitch_link",
  ];
  jointNames.forEach((name) => {
    const joint = new THREE.Group();
    joint.name = name;
    official.add(joint);
  });
  const model = new THREE.Group();
  model.add(official);
  model.userData.restPose = new Map(jointNames.map((name) => [name, official.getObjectByName(name).quaternion.clone()]));
  model.userData.gaitWeight = 0;
  model.userData.restPosition = model.position.clone();
  model.userData.restQuaternion = model.quaternion.clone();
  updateUnitreeG1Dex1Model(model, 1 / 60, 0, "idle", 0, THREE.MathUtils.degToRad(25));

  assert.ok(official.getObjectByName(UNITREE_G1_HEAD_PITCH.linkName).quaternion.angleTo(new THREE.Quaternion()) > 0);
  jointNames.slice(1).forEach((name) => {
    assert.ok(official.getObjectByName(name).quaternion.angleTo(new THREE.Quaternion()) < 1e-12);
  });
});

test("the HUD documents persistent D435 look controls", async () => {
  const htmlSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(htmlSource, /<kbd>↑<\/kbd><kbd>↓<\/kbd> 调整 D435 视角/);
});

test("cyan light guide is attached in head-link local space", () => {
  assert.match(modelSource, /const head = root\.getObjectByName\("head_link"\)/);
  assert.match(modelSource, /head\.add\(lightGuide\)/);
  assert.doesNotMatch(modelSource, /root\.add\(lightGuide\)/);
  assert.match(modelSource, /\[0\.0744, 0\.488, -0\.052\]/);
});

test("entry remains blocked until the shared official robot loads", () => {
  assert.match(appSource, /startButton\.disabled = true/);
  assert.match(appSource, /robotAssetsLoaded = thirdPersonAsset\.loaded;/);
  assert.doesNotMatch(appSource, /robotAssetsLoaded = thirdPersonAsset\.loaded && cargoAsset\.loaded/);
  assert.match(appSource, /const cargoAssetResults = Array\.isArray\(cargoAsset\)/);
  assert.match(appSource, /const cargoAssetsLoaded = cargoAssetResults\.every/);
  assert.match(appSource, /cargoAssetLoaded = String\(cargoAssetsLoaded\)/);
  assert.match(appSource, /robotAssetState = robotAssetsLoaded \? "ready" : "failed"/);
  assert.match(appSource, /正在重新加载/);
  assert.match(appSource, /G1 EDU2 加载失败 · 点击重试/);
  assert.match(robotSource, /MODEL_LOAD_ATTEMPTS = 3/);
  assert.match(robotSource, /loadOfficialModelWithRetry/);
  assert.match(appSource, /if \(!robotAssetsLoaded\)/);
  assert.match(appSource, /if \(!running\) return;/);
});
