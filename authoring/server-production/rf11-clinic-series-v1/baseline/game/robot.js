import * as THREE from "three";
import {
  getUnitreeG1Dex1AssetUrls,
  loadUnitreeG1Dex1Model,
  rememberUnitreeG1Dex1RestPose,
  setUnitreeG1Dex1Grip,
  setUnitreeG1Dex1JointAngle,
  UNITREE_G1_DEX1_GLB_URL,
  updateUnitreeG1Dex1Model,
} from "./unitree-g1-dex1-model.js";
import { getUnitreeR1EduAssetUrls, loadUnitreeR1EduModel, setUnitreeR1EduGrip, setUnitreeR1EduJointAngle, UNITREE_R1_EDU_GLB_URL, updateUnitreeR1EduModel } from "./unitree-r1-edu.js";

export const ROBOT_PROFILES = Object.freeze({
  g1: Object.freeze({ id: "g1", label: "G1 EDU2 · MuJoCo 29DOF", modelVariant: "G1 EDU2 · 官方 MuJoCo 29DOF", assetUrl: UNITREE_G1_DEX1_GLB_URL, supportsD435: true, getAssetUrls: getUnitreeG1Dex1AssetUrls, loadModel: loadUnitreeG1Dex1Model, updateModel: updateUnitreeG1Dex1Model, setJointAngle: setUnitreeG1Dex1JointAngle, setGrip: setUnitreeG1Dex1Grip }),
  r1: Object.freeze({ id: "r1", label: "R1 EDU", modelVariant: "R1 EDU · 官方 MuJoCo", assetUrl: UNITREE_R1_EDU_GLB_URL, supportsD435: true, getAssetUrls: getUnitreeR1EduAssetUrls, loadModel: loadUnitreeR1EduModel, updateModel: updateUnitreeR1EduModel, setJointAngle: setUnitreeR1EduJointAngle, setGrip: setUnitreeR1EduGrip }),
});
export function getRobotProfile(robotId = "g1") { return ROBOT_PROFILES[String(robotId).toLowerCase()] ?? ROBOT_PROFILES.g1; }

const MODEL_LOAD_ATTEMPTS = 3;
const MODEL_RETRY_DELAY_MS = 1200;

async function loadOfficialModelWithRetry(data, profile = ROBOT_PROFILES.g1, options = {}) {
  let lastError = null;
  const assetUrls = profile.getAssetUrls();
  const totalAttempts = Math.max(MODEL_LOAD_ATTEMPTS, assetUrls.length);
  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    data.loadAttempt = attempt;
    data.loadState = attempt === 1 ? "loading" : "retrying";
    try {
      const assetUrl = assetUrls[Math.min(attempt - 1, assetUrls.length - 1)];
      data.assetUrl = assetUrl;
      const model = await profile.loadModel({ url: assetUrl, groundY: 0, ...options });
      data.loadState = "ready";
      return model;
    } catch (error) {
      lastError = error;
      data.loadError = error instanceof Error ? error.message : String(error);
      if (attempt < totalAttempts) {
        await new Promise((resolve) => window.setTimeout(resolve, MODEL_RETRY_DELAY_MS));
      }
    }
  }
  data.loadState = "failed";
  throw lastError;
}

function recordModelLoadFailure(data, error) {
  data.loadState = "failed";
  data.loadError = error instanceof Error ? error.message : String(error);
  return { loaded: false, asset: data.assetUrl ?? UNITREE_G1_DEX1_GLB_URL, error };
}

function material(color, metalness = 0.65, roughness = 0.34) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function box(width, height, depth, meshMaterial) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), meshMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function capsule(radius, length, meshMaterial) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 8, 16), meshMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(radiusTop, radiusBottom, height, meshMaterial, segments = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), meshMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function sphere(scale, meshMaterial, segments = 20) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.max(12, Math.round(segments * 0.7))), meshMaterial);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addMicArray(parent, materialRef) {
  const array = new THREE.Group();
  array.name = "g1edu-chest-microphone-array";
  [-0.16, -0.053, 0.053, 0.16].forEach((x) => {
    const mic = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), materialRef);
    mic.position.x = x;
    mic.castShadow = true;
    array.add(mic);
  });
  parent.add(array);
  return array;
}

function addHeadSensors(parent, shellMaterial, darkMaterial, accentMaterial) {
  const sensorAssembly = new THREE.Group();
  sensorAssembly.name = "g1edu-head-sensor-suite";
  sensorAssembly.position.set(0, 0.18, 0.015);
  const shroud = sphere([0.14, 0.065, 0.1], shellMaterial, 16);
  sensorAssembly.add(shroud);
  const lidar = cylinder(0.075, 0.09, 0.055, darkMaterial, 24);
  lidar.rotation.x = Math.PI / 2;
  lidar.position.set(0, 0.035, 0.025);
  sensorAssembly.add(lidar);
  const lidarLens = cylinder(0.042, 0.042, 0.012, accentMaterial, 20);
  lidarLens.rotation.x = Math.PI / 2;
  lidarLens.position.set(0, 0.035, 0.058);
  sensorAssembly.add(lidarLens);
  const depthBar = box(0.18, 0.045, 0.045, darkMaterial);
  depthBar.position.set(0, -0.012, 0.055);
  sensorAssembly.add(depthBar);
  [-0.052, 0.052].forEach((x) => {
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), accentMaterial);
    lens.position.set(x, -0.012, 0.079);
    sensorAssembly.add(lens);
  });
  parent.add(sensorAssembly);
  return sensorAssembly;
}

function addBatteryDock(parent, side, shellMaterial, darkMaterial, accentMaterial) {
  const dock = new THREE.Group();
  dock.name = side < 0 ? "g1edu-left-quick-release-battery" : "g1edu-right-quick-release-battery";
  dock.position.set(side * 0.32, 1.76, 0.02);
  dock.rotation.z = side * 0.05;
  const housing = box(0.14, 0.3, 0.24, darkMaterial);
  housing.position.x = side * 0.035;
  dock.add(housing);
  const batteryFace = box(0.035, 0.22, 0.17, shellMaterial);
  batteryFace.position.set(side * 0.11, 0, 0);
  dock.add(batteryFace);
  const status = box(0.012, 0.028, 0.08, accentMaterial);
  status.position.set(side * 0.132, 0.075, 0);
  dock.add(status);
  parent.add(dock);
  return dock;
}

function addOfficialEduDetails(officialVisual) {
  const torsoNode = officialVisual.getObjectByName("torso_link");
  if (!torsoNode) return null;
  const detail = new THREE.Group();
  detail.name = "unitree-g1-edu-detail-kit";
  const shell = material(0xcbd1cf, 0.58, 0.34);
  const dark = material(0x151a1b, 0.82, 0.22);
  const sensor = new THREE.MeshStandardMaterial({ color: 0x8bcbbb, emissive: 0x24594d, emissiveIntensity: 0.8, metalness: 0.32, roughness: 0.3 });
  const sensorSuite = addHeadSensors(detail, shell, dark, sensor);
  sensorSuite.position.set(0, 0.52, 0.015);
  sensorSuite.scale.setScalar(0.58);
  const microphoneArray = addMicArray(detail, dark);
  microphoneArray.position.set(0, 0.23, 0.185);
  microphoneArray.scale.setScalar(0.55);
  const speaker = box(0.1, 0.04, 0.012, dark);
  speaker.position.set(0, 0.15, 0.19);
  detail.add(speaker);
  [-1, 1].forEach((side) => {
    const dock = new THREE.Group();
    dock.name = side < 0 ? "unitree-g1-edu-left-battery" : "unitree-g1-edu-right-battery";
    dock.position.set(side * 0.245, 0.02, -0.015);
    const housing = box(0.06, 0.22, 0.15, dark);
    dock.add(housing);
    const latch = box(0.02, 0.12, 0.1, shell);
    latch.position.x = side * 0.04;
    dock.add(latch);
    const status = box(0.012, 0.026, 0.05, sensor);
    status.position.set(side * 0.052, 0.06, 0);
    dock.add(status);
    detail.add(dock);
  });
  torsoNode.add(detail);
  return detail;
}

export function createBatteryModel() {
  const group = new THREE.Group();
  const shell = material(0xc5cbbe, 0.75, 0.29);
  const dark = material(0x202727, 0.7, 0.3);
  const energy = new THREE.MeshStandardMaterial({ color: 0xb8d739, emissive: 0x718414, emissiveIntensity: 1.25, metalness: 0.3, roughness: 0.25 });
  const core = box(0.82, 0.34, 0.58, shell);
  core.position.y = 0.22;
  group.add(core);
  const band = box(0.18, 0.38, 0.62, dark);
  band.position.y = 0.23;
  group.add(band);
  [-0.3, 0.3].forEach((x) => {
    const cell = box(0.1, 0.22, 0.63, energy);
    cell.position.set(x, 0.24, 0);
    group.add(cell);
  });
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 18, Math.PI), dark);
  handle.rotation.z = Math.PI;
  handle.position.set(0, 0.48, 0);
  handle.castShadow = true;
  group.add(handle);
  return group;
}

export function createBookModel(color = "red") {
  const palette = { red: 0x8f2822, black: 0x171918, white: 0xe5e1d6 };
  const group = new THREE.Group();
  const cover = material(palette[color] ?? palette.red, 0.08, 0.68);
  const pages = material(0xd9d2c2, 0.02, 0.88);
  const pageBlock = box(0.5, 0.12, 0.72, pages);
  pageBlock.position.y = 0.09;
  group.add(pageBlock);
  const topCover = box(0.54, 0.045, 0.76, cover);
  topCover.position.y = 0.17;
  group.add(topCover);
  const bottomCover = box(0.54, 0.045, 0.76, cover);
  bottomCover.position.y = 0.015;
  group.add(bottomCover);
  const spine = box(0.055, 0.18, 0.76, cover);
  spine.position.set(-0.27, 0.09, 0);
  group.add(spine);
  group.userData.coverMaterial = cover;
  return group;
}

export function setBookModelColor(book, color) {
  const palette = { red: 0x8f2822, black: 0x171918, white: 0xe5e1d6 };
  if (book?.userData?.coverMaterial) book.userData.coverMaterial.color.setHex(palette[color] ?? palette.red);
}

export function createRobot(cargoModel = null, options = {}) {
  const profile = getRobotProfile(options.robotId);
  const root = new THREE.Group();
  root.name = profile.id === "g1" ? "unitree-g1-edu2-dex1-game-robot" : `unitree-${profile.id}-game-robot`;

  const cargoGrip = new THREE.Group();
  cargoGrip.position.set(0, 0.88, 0.38);
  const rackPayload = cargoModel ?? createBatteryModel();
  rackPayload.rotation.x = -0.12;
  rackPayload.scale.setScalar(cargoModel?.userData?.robotScale ?? (cargoModel ? 0.5 : 0.52));
  rackPayload.visible = false;
  cargoGrip.add(rackPayload);
  root.add(cargoGrip);

  const data = {
    officialModel: null,
    model: null,
    cargoGrip,
    rackPayload,
    rackBattery: rackPayload,
    robotId: profile.id,
    robotProfile: profile,
    modelVariant: profile.modelVariant,
    loadAttempt: 0,
    loadState: "pending",
    loadError: "",
    assetReady: null,
    collisionRig: null,
    instanceId: options.instanceId ?? `${profile.id}-edu`,
  };
  root.userData = data;
  data.assetReady = typeof window === "undefined"
    ? Promise.resolve({ loaded: false, asset: profile.assetUrl, reason: "browser-only asset" })
    : loadOfficialModelWithRetry(data, profile, { instanceId: data.instanceId }).then(async (officialModel) => {
      root.add(officialModel);
      data.officialModel = officialModel;
      data.model = officialModel;
      if (profile.id === "g1") {
        const { createG1ArticulatedCollisionRig } = await import("./g1-articulated-collision.js");
        data.collisionRig = createG1ArticulatedCollisionRig(officialModel, {
          debugVisible: Boolean(options.showCollision),
          world: options.collisionWorld ?? null,
        });
      }
      return { loaded: true, asset: data.assetUrl, configuration: data.modelVariant };
    }).catch((error) => recordModelLoadFailure(data, error));
  return root;
}

export function applyRobotActionPose(robot, presentation) {
  const data = robot.userData;
  const model = data.officialModel;
  const pose = typeof presentation === "object" ? presentation : {
    kind: "idle", visualCarrying: Boolean(presentation), reach: 0,
    operationBlend: 0, crouch: 0, carryBlend: presentation ? 1 : 0,
    grip: presentation ? 0.82 : 0.16,
  };
  const carrying = pose.visualCarrying;
  const carryAction = pose.kind === "pickup" || pose.kind === "place";
  const operating = pose.kind === "operate";
  if (model) {
    if (data.robotId === "g1" && (carryAction || operating || carrying)) {
      if (operating) {
        const press = pose.operationBlend;
        data.robotProfile.setJointAngle(model, "right_shoulder_pitch_link", press * 1.02);
        data.robotProfile.setJointAngle(model, "right_elbow_link", 0.12 + press * 0.42);
        data.robotProfile.setJointAngle(model, "right_wrist_pitch_link", -press * 0.28);
      } else {
        const shoulder = carryAction ? pose.carryBlend * 0.55 + pose.reach * 0.72 : 0.55;
        const elbow = carryAction ? 0.18 + pose.carryBlend * 0.32 + pose.reach * 0.12 : 0.5;
        data.robotProfile.setJointAngle(model, "left_shoulder_pitch_link", shoulder);
        data.robotProfile.setJointAngle(model, "right_shoulder_pitch_link", shoulder);
        data.robotProfile.setJointAngle(model, "left_elbow_link", elbow);
        data.robotProfile.setJointAngle(model, "right_elbow_link", elbow);
      }
      if (pose.crouch > 0) {
        for (const side of ["left", "right"]) {
          data.robotProfile.setJointAngle(model, `${side}_hip_pitch_link`, -pose.crouch * 0.45);
          data.robotProfile.setJointAngle(model, `${side}_knee_link`, pose.crouch * 0.9);
          data.robotProfile.setJointAngle(model, `${side}_ankle_pitch_link`, -pose.crouch * 0.45);
        }
        data.robotProfile.setJointAngle(model, "torso_link", pose.crouch * 0.2);
      }
    }
    data.robotProfile.setGrip(model, pose.grip);
    data.collisionRig?.sync({ step: data.collisionRig.ownsWorld });
  }
  const payloadReach = operating ? 0 : pose.reach;
  data.cargoGrip.position.set(0, 0.88 - payloadReach * 0.34, 0.38 + payloadReach * 0.12);
  data.rackPayload.visible = carrying;
}

export function updateRobotAnimation(robot, delta, elapsed, motion, presentation, travelDistance = null, lookPitch = 0) {
  const data = robot.userData;
  const model = data.officialModel;
  const pose = typeof presentation === "object" ? presentation : {
    kind: "idle", visualCarrying: Boolean(presentation), reach: 0,
    operationBlend: 0, crouch: 0, carryBlend: presentation ? 1 : 0,
    grip: presentation ? 0.82 : 0.16,
  };
  if (model) {
    data.robotProfile.updateModel(model, delta, elapsed, motion === "moving" ? "walking" : motion === "turning" ? "marching" : "idle", travelDistance, lookPitch);
  }
  applyRobotActionPose(robot, pose);
}

function createOfficialForearm(model, side) {
  const official = model.children[0];
  const source = official?.getObjectByName(`${side}_elbow_link`);
  if (!source) throw new Error(`Missing official ${side} Dex1 forearm chain`);
  const forearm = source.clone(true);
  forearm.name = `first-person-${side}-official-dex1-forearm`;
  forearm.position.set(0, 0, 0);
  forearm.quaternion.identity();
  forearm.scale.setScalar(1.28);
  forearm.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  const forearmModel = new THREE.Group();
  forearmModel.add(forearm);
  forearmModel.userData.restPose = rememberUnitreeG1Dex1RestPose(forearm);
  return { forearm, forearmModel };
}

export function createFirstPersonRobot(cargoModel = null) {
  const rig = new THREE.Group();
  rig.name = "first-person-unitree-g1-edu2-dex1-viewmodel";
  const arms = [-1, 1].map((side, index) => {
    const arm = new THREE.Group();
    arm.name = side < 0 ? "first-person-left-official-arm" : "first-person-right-official-arm";
    rig.add(arm);
    return { arm, side, phase: index * Math.PI, forearm: null };
  });
  const cargoHolder = new THREE.Group();
  const rackPayload = cargoModel ?? createBatteryModel();
  rackPayload.rotation.x = -0.16;
  rackPayload.scale.setScalar(cargoModel?.userData?.robotScale ?? (cargoModel ? 0.5 : 0.52));
  rackPayload.visible = false;
  cargoHolder.add(rackPayload);
  rig.add(cargoHolder);
  rig.userData = {
    arms, cargoHolder, rackPayload, rackBattery: rackPayload,
    officialModel: null, modelVariant: "G1 EDU2 29DOF Dex1 first-person forearms",
    loadAttempt: 0, loadState: "pending", loadError: "", assetReady: null,
  };
  rig.userData.assetReady = typeof window === "undefined"
    ? Promise.resolve({ loaded: false, asset: UNITREE_G1_DEX1_GLB_URL, reason: "browser-only asset" })
    : loadOfficialModelWithRetry(rig.userData).then((model) => {
      rig.userData.officialModel = model;
      arms.forEach((entry) => {
        const officialForearm = createOfficialForearm(model, entry.side < 0 ? "left" : "right");
        entry.forearm = officialForearm.forearm;
        entry.forearmModel = officialForearm.forearmModel;
        entry.arm.add(entry.forearmModel);
      });
      rig.userData.officialModel = null;
      return { loaded: true, asset: UNITREE_G1_DEX1_GLB_URL, configuration: rig.userData.modelVariant };
    }).catch((error) => recordModelLoadFailure(rig.userData, error));
  return rig;
}

export function updateFirstPersonRobot(rig, elapsed, motion, pose, travelDistance = null) {
  const data = rig.userData;
  const presentation = pose ?? { kind: "idle", visualCarrying: false, reach: 0, carryBlend: 0, grip: 0.16 };
  const active = motion === "moving" || motion === "turning";
  const gaitPhase = motion === "moving" && Number.isFinite(travelDistance) ? travelDistance * Math.PI / 0.35 : elapsed * (motion === "turning" ? 4.6 : 7);
  const gait = active ? Math.sin(gaitPhase) : 0;
  const carrying = presentation.visualCarrying;
  data.arms.forEach(({ arm, side, phase }) => {
    const operatingArm = presentation.kind !== "operate" || side > 0;
    const armReach = operatingArm ? presentation.reach : 0;
    const armCarry = presentation.kind === "operate" ? 0 : presentation.carryBlend;
    const swing = active && !carrying && presentation.kind === "idle" ? Math.sin(elapsed * 7 + phase) * 0.08 : 0;
    arm.position.set(side * (0.42 - armCarry * 0.06), 0.15 - armReach * 0.07 + Math.abs(gait) * 0.008, -0.78 - armReach * 0.1);
    arm.rotation.set(0.08 + armCarry * 0.12 + armReach * 0.18 + swing, side * 0.08, -side * (0.48 - armCarry * 0.14));
  });
  data.arms.forEach(({ forearmModel }) => {
    if (forearmModel) setUnitreeG1Dex1Grip(forearmModel, presentation.grip);
  });
  data.cargoHolder.position.set(0, -0.12 - presentation.reach * 0.14, -1.02 - presentation.reach * 0.12);
  data.rackPayload.visible = carrying;
}
