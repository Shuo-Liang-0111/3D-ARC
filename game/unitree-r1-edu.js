import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const UNITREE_R1_EDU_GLB_URL = "/local-assets/unitree/unitree-r1-official-mujoco.glb";
export const UNITREE_R1_EDU_REMOTE_GLB_URL = "http://49.233.44.228:4175/local-assets/unitree/unitree-r1-official-mujoco.glb";

export const UNITREE_R1_EDU_PALETTE = Object.freeze({
  reference: "https://www.unitree.com/R1/",
  colorway: "official-website-pearl-white-navy",
  shell: "#e2e5e9",
  secondaryShell: "#aeb5bf",
  navy: "#17264b",
  graphite: "#171b23",
  vision: "#070a10",
  blue: "#315fc7",
  red: "#b92f3b",
});

export const UNITREE_R1_EDU_SPEC = Object.freeze({
  manufacturer: "Unitree",
  model: "R1 EDU",
  configuration: "official-unitree_mujoco-R1",
  dimensionsMeters: Object.freeze({ height: 1.23, width: 0.357, depth: 0.19 }),
  massKg: 29,
  dof: 29,
  handType: "official-fixed-hand-integrated-wrist-mesh",
  colorway: UNITREE_R1_EDU_PALETTE.colorway,
  appearanceReference: UNITREE_R1_EDU_PALETTE.reference,
  forwardAxis: "+Z",
  sourceFormat: "MuJoCo XML + STL",
  webFormat: "GLB",
  sourceRepository: "https://github.com/unitreerobotics/unitree_mujoco",
  sourceRevision: "4134cb5dc7ff1ba7f484deda48b5274b58694519",
  license: "BSD-3-Clause",
  integrationStatus: "standalone",
});

export const UNITREE_R1_EDU_CONTROL_PROFILE = Object.freeze({
  input: Object.freeze({ forward: "KeyW", backward: "KeyS", strafeLeft: "KeyA", strafeRight: "KeyD", turnLeft: "KeyQ", turnRight: "KeyE" }),
  movementDrainsProgress: true,
  turningDrainsProgress: false,
  supportsTravelDistanceGait: true,
  supportsLookPitch: true,
  supportsGripCommand: false,
});

export const UNITREE_R1_HEAD_PITCH = Object.freeze({
  linkName: "head_yaw_link",
  neckLinkName: "head_pitch_link",
  minimumRadians: -THREE.MathUtils.degToRad(20),
  maximumRadians: THREE.MathUtils.degToRad(35),
});

const officialTemplatePromises = new Map();
const pitchAxis = new THREE.Vector3(0, 1, 0);
const rollAxis = new THREE.Vector3(1, 0, 0);
const yawAxis = new THREE.Vector3(0, 0, 1);

export function getUnitreeR1EduAssetUrls() {
  if (typeof window === "undefined") return [UNITREE_R1_EDU_GLB_URL];
  const urls = [UNITREE_R1_EDU_GLB_URL];
  if (window.location.hostname !== "49.233.44.228") urls.push(UNITREE_R1_EDU_REMOTE_GLB_URL);
  return urls;
}

function finishForMesh(name) {
  if (/ankle_(?:A|B|constraint)|ankle_[AB]_rod/.test(name)) return "graphite";
  if (/wrist_roll_link__visual$/.test(name)) return "graphite";
  if (/ankle_roll_link__(?:visual|primitive)$/.test(name)) return "navy";
  if (/waist_roll_link__visual$|head_pitch_link$|hip_roll_link__visual$/.test(name)) return "navy";
  if (/elbow_link__visual$|ankle_pitch_link__visual$/.test(name)) return "secondaryShell";
  return "shell";
}

function createWebsiteMaterial(finish) {
  const color = UNITREE_R1_EDU_PALETTE[finish];
  const isShell = finish === "shell" || finish === "secondaryShell";
  const material = new THREE.MeshStandardMaterial({
    name: `unitree-r1-website-${finish}`,
    color,
    metalness: isShell ? 0.18 : 0.34,
    roughness: isShell ? 0.34 : 0.42,
  });
  material.envMapIntensity = isShell ? 0.9 : 0.68;
  return material;
}

function cloneMaterials(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const finish = finishForMesh(object.name);
    object.material = createWebsiteMaterial(finish);
    object.userData.appearanceFinish = finish;
  });
}

function addAccent(parent, name, geometry, finish, position, rotation = [0, 0, 0]) {
  if (!parent) return null;
  const accent = new THREE.Mesh(geometry, createWebsiteMaterial(finish));
  accent.name = name;
  accent.position.set(...position);
  accent.rotation.set(...rotation);
  accent.castShadow = true;
  accent.receiveShadow = true;
  accent.userData.appearanceFinish = finish;
  accent.userData.appearanceReference = UNITREE_R1_EDU_PALETTE.reference;
  parent.add(accent);
  return accent;
}

function createWebsiteAccents(root) {
  const accents = [];
  const head = root.getObjectByName("head_yaw_link");
  accents.push(addAccent(
    head,
    "r1-website-vision-visor",
    new THREE.BoxGeometry(0.004, 0.1, 0.028),
    "vision",
    [0.092, 0, -0.008],
  ));
  accents.push(addAccent(
    head,
    "r1-website-crown-left",
    new THREE.BoxGeometry(0.005, 0.012, 0.026),
    "blue",
    [0.091, -0.011, 0.012],
    [0.48, 0, 0],
  ));
  accents.push(addAccent(
    head,
    "r1-website-crown-right",
    new THREE.BoxGeometry(0.005, 0.012, 0.026),
    "blue",
    [0.091, 0.011, 0.012],
    [-0.48, 0, 0],
  ));

  for (const side of ["left", "right"]) {
    const direction = side === "left" ? 1 : -1;
    const shoulder = root.getObjectByName(`${side}_shoulder_pitch_link__visual`);
    accents.push(addAccent(
      shoulder,
      `r1-website-${side}-shoulder-cap`,
      new THREE.CylinderGeometry(0.029, 0.029, 0.006, 32),
      "navy",
      [0, direction * 0.09, -0.014],
    ));

    const knee = root.getObjectByName(`${side}_knee_link__visual`);
    const kneeY = side === "left" ? -0.038 : 0.038;
    accents.push(addAccent(
      knee,
      `r1-website-${side}-knee-cap`,
      new THREE.CylinderGeometry(0.027, 0.027, 0.006, 32),
      "navy",
      [0.055, kneeY, 0.008],
      [0, 0, Math.PI / 2],
    ));
    for (let stripeIndex = 0; stripeIndex < 3; stripeIndex += 1) {
      accents.push(addAccent(
        knee,
        `r1-website-${side}-leg-stripe-${stripeIndex + 1}`,
        new THREE.BoxGeometry(0.006, 0.013, 0.034),
        "red",
        [0.056, kneeY, -0.145 - stripeIndex * 0.043],
      ));
    }
  }

  const chest = root.getObjectByName("waist_yaw_link");
  accents.push(addAccent(
    chest,
    "r1-website-chest-marker",
    new THREE.CircleGeometry(0.016, 3),
    "blue",
    [0.073, 0, 0.205],
    [0, Math.PI / 2, Math.PI / 2],
  ));
  return accents.filter(Boolean);
}

function createSocket(parent, name, position = [0, 0, 0]) {
  const socket = new THREE.Group();
  socket.name = `${name}-socket`;
  socket.userData.socketId = name;
  socket.position.set(...position);
  parent?.add(socket);
  return socket;
}

function createSockets(official) {
  const leftWrist = official.getObjectByName("left_wrist_roll_link");
  const rightWrist = official.getObjectByName("right_wrist_roll_link");
  const torso = official.getObjectByName("torso_link");
  const head = official.getObjectByName("head_yaw_link");
  const headPitch = official.getObjectByName("head_pitch_link") ?? head;
  return {
    leftHand: createSocket(leftWrist, "leftHand", [0.14, 0, 0]),
    rightHand: createSocket(rightWrist, "rightHand", [0.14, 0, 0]),
    chest: createSocket(torso, "chest", [0.11, 0, 0.17]),
    head: createSocket(headPitch, "head", [0, 0, 0.08]),
    camera: createSocket(headPitch, "camera", [0.055, 0, 0.015]),
    batteryBay: createSocket(torso, "batteryBay", [-0.085, 0, 0.17]),
  };
}

function createExplodedController(root) {
  root.updateMatrixWorld(true);
  const center = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
  const records = [];
  root.traverse((object) => {
    if (!object.isMesh) return;
    const direction = object.getWorldPosition(new THREE.Vector3()).sub(center);
    if (direction.lengthSq() < 0.0001) direction.set(0, 1, 0);
    direction.normalize().multiplyScalar(0.055);
    direction.transformDirection(object.parent.matrixWorld.clone().invert());
    records.push({ object, rest: object.position.clone(), direction });
  });
  return {
    parts: records.map(({ object }) => object),
    setExploded(amount = 0) {
      const clamped = THREE.MathUtils.clamp(amount, 0, 1);
      for (const record of records) {
        record.object.position.copy(record.rest).addScaledVector(record.direction, clamped);
      }
    },
  };
}

function rememberRestPose(root) {
  const pose = new Map();
  root.traverse((object) => {
    if (object.name) pose.set(object.name, object.quaternion.clone());
  });
  return pose;
}

export function rememberUnitreeR1EduRestPose(root) {
  return rememberRestPose(root);
}

function applyJointDelta(root, restPose, name, axis, angle) {
  const joint = root.getObjectByName(name);
  const rest = restPose.get(name);
  if (!joint || !rest) return;
  joint.quaternion.copy(rest).multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
}

export function setUnitreeR1EduJointAngle(robot, name, angle, axis = pitchAxis) {
  const official = robot?.userData?.official;
  const restPose = robot?.userData?.restPose;
  if (official && restPose) applyJointDelta(official, restPose, name, axis, angle);
}

export function setUnitreeR1EduGrip(robot, amount) {
  if (!robot?.userData) return;
  robot.userData.grip = THREE.MathUtils.clamp(amount, 0, 1);
}

function damp(current, target, smoothing, delta) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-smoothing * delta));
}

async function loadOfficialTemplate(url) {
  if (!officialTemplatePromises.has(url)) {
    const promise = new GLTFLoader().loadAsync(url).then((gltf) => gltf.scene).catch((error) => {
      officialTemplatePromises.delete(url);
      throw error;
    });
    officialTemplatePromises.set(url, promise);
  }
  return officialTemplatePromises.get(url);
}

function createRobotFromTemplate(template, options = {}) {
  const official = template.clone(true);
  official.name = "unitree-r1-official-mujoco";
  official.rotation.y = -Math.PI / 2;
  cloneMaterials(official);
  const appearanceAccents = createWebsiteAccents(official);
  official.updateMatrixWorld(true);

  const nativeBounds = new THREE.Box3().setFromObject(official);
  const nativeSize = nativeBounds.getSize(new THREE.Vector3());
  const nativeCenter = nativeBounds.getCenter(new THREE.Vector3());
  const robot = new THREE.Group();
  const instanceId = options.instanceId ?? "r1-edu";
  robot.name = `unitree-r1-edu-${instanceId}`;
  robot.scale.setScalar(options.scale ?? 1);
  robot.add(official);
  official.position.set(
    official.position.x - nativeCenter.x,
    official.position.y - nativeBounds.min.y + (options.groundY ?? 0),
    official.position.z - nativeCenter.z,
  );
  official.updateMatrixWorld(true);

  const sockets = createSockets(official);
  const exploded = createExplodedController(official);
  robot.userData = {
    instanceId,
    model: "Unitree R1 EDU",
    configuration: {
      handType: UNITREE_R1_EDU_SPEC.handType,
      forwardAxis: UNITREE_R1_EDU_SPEC.forwardAxis,
      integrationStatus: UNITREE_R1_EDU_SPEC.integrationStatus,
      colorway: UNITREE_R1_EDU_SPEC.colorway,
      appearanceReference: UNITREE_R1_EDU_SPEC.appearanceReference,
    },
    officialAsset: {
      url: options.url ?? UNITREE_R1_EDU_GLB_URL,
      configuration: UNITREE_R1_EDU_SPEC.configuration,
      sourceFormat: UNITREE_R1_EDU_SPEC.sourceFormat,
      webFormat: UNITREE_R1_EDU_SPEC.webFormat,
      sourceRepository: UNITREE_R1_EDU_SPEC.sourceRepository,
      sourceRevision: UNITREE_R1_EDU_SPEC.sourceRevision,
      license: UNITREE_R1_EDU_SPEC.license,
      nativeHeightMeters: nativeSize.y,
    },
    official,
    officialBaseY: official.position.y,
    restPose: rememberRestPose(official),
    restPosition: robot.position.clone(),
    restQuaternion: robot.quaternion.clone(),
    gaitPhase: 0,
    gaitWeight: 0,
    grip: 0.16,
    sculptRuntime: {
      model: "Unitree R1 EDU",
      basis: "official Unitree MuJoCo R1 XML and STL conversion",
      parts: exploded.parts,
      sockets,
      appearanceAccents,
      setExploded: exploded.setExploded,
    },
  };
  return robot;
}

export async function parseUnitreeR1EduModel(arrayBuffer, options = {}) {
  const gltf = await new GLTFLoader().parseAsync(arrayBuffer, "");
  return createRobotFromTemplate(gltf.scene, options);
}

export async function loadUnitreeR1EduModel(options = {}) {
  const url = options.url ?? UNITREE_R1_EDU_GLB_URL;
  const template = await loadOfficialTemplate(url);
  return createRobotFromTemplate(template, { ...options, url });
}

export function updateUnitreeR1EduModel(robot, delta, elapsed, motion = "idle", travelDistance = null, lookPitch = 0) {
  const state = robot.userData;
  const official = state.official;
  if (!official || !state.restPose) return;
  const moving = motion === "moving" || motion === "walking";
  const turning = motion === "turning" || motion === "marching";
  const active = moving || turning;
  state.gaitWeight = damp(state.gaitWeight, active ? 1 : 0, 5.5, delta);
  const walkingStride = 0.175;
  const cycle = moving && Number.isFinite(travelDistance)
    ? travelDistance * Math.PI / (2 * walkingStride)
    : elapsed * 5.6;
  state.gaitPhase = cycle;

  const swing = Math.sin(cycle);
  const leftLift = Math.max(0, -swing);
  const rightLift = Math.max(0, swing);
  const stride = moving ? 0.3 : 0.08;
  const weight = state.gaitWeight;

  applyJointDelta(official, state.restPose, "left_hip_pitch_link", pitchAxis, swing * stride * weight);
  applyJointDelta(official, state.restPose, "right_hip_pitch_link", pitchAxis, -swing * stride * weight);
  applyJointDelta(official, state.restPose, "left_knee_link", pitchAxis, (0.04 + leftLift * 0.42) * weight);
  applyJointDelta(official, state.restPose, "right_knee_link", pitchAxis, (0.04 + rightLift * 0.42) * weight);
  applyJointDelta(official, state.restPose, "left_ankle_pitch_link", pitchAxis, -swing * 0.07 * weight);
  applyJointDelta(official, state.restPose, "right_ankle_pitch_link", pitchAxis, swing * 0.07 * weight);

  applyJointDelta(official, state.restPose, "left_shoulder_pitch_link", pitchAxis, -swing * stride * 0.55 * weight);
  applyJointDelta(official, state.restPose, "right_shoulder_pitch_link", pitchAxis, swing * stride * 0.55 * weight);
  applyJointDelta(official, state.restPose, "left_elbow_link", pitchAxis, (0.05 + rightLift * 0.12) * weight);
  applyJointDelta(official, state.restPose, "right_elbow_link", pitchAxis, (0.05 + leftLift * 0.12) * weight);

  const turnAngle = turning ? swing * 0.09 * weight : 0;
  applyJointDelta(official, state.restPose, "torso_link", yawAxis, turnAngle);
  applyJointDelta(official, state.restPose, "waist_roll_link", rollAxis, turning ? Math.cos(cycle) * 0.02 * weight : 0);

  const gaze = THREE.MathUtils.clamp(
    lookPitch,
    UNITREE_R1_HEAD_PITCH.minimumRadians,
    UNITREE_R1_HEAD_PITCH.maximumRadians,
  );
  applyJointDelta(official, state.restPose, UNITREE_R1_HEAD_PITCH.linkName, pitchAxis, gaze);
  applyJointDelta(official, state.restPose, UNITREE_R1_HEAD_PITCH.neckLinkName, pitchAxis, gaze);

  official.position.y = state.officialBaseY - (0.004 + Math.abs(swing) * 0.008) * weight;
  robot.position.copy(state.restPosition);
  robot.quaternion.copy(state.restQuaternion);
  robot.rotateZ(swing * 0.018 * weight);
}
