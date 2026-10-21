import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const UNITREE_G1_DEX1_GLB_URL = "/local-assets/unitree/g1/g1_29dof_official.glb";

const D435_DEPTH_WIDTH = 848;
const D435_DEPTH_HEIGHT = 480;
const D435_HORIZONTAL_FOV_DEGREES = 87;
const D435_VERTICAL_FOV_DEGREES = 58;
const FIRST_PERSON_VISIBILITY_KEY = "g1FirstPersonVisibility";

function focalLengthFromFov(size, fovDegrees) {
  return size / (2 * Math.tan(THREE.MathUtils.degToRad(fovDegrees) / 2));
}

export const UNITREE_G1_HEAD_PITCH = Object.freeze({
  linkName: "runtime_head_pitch_link",
  parentLink: "torso_link",
  visualLink: "head_link",
  sensorLink: "d435_link",
  pivotConvertedMeters: Object.freeze([0.0039635, 0.3556194305419922, 0]),
  minimumRadians: -THREE.MathUtils.degToRad(20),
  maximumRadians: THREE.MathUtils.degToRad(35),
});

export const UNITREE_G1_D435_DEPTH_CAMERA = Object.freeze({
  // Unitree g1_29dof.urdf: d435_joint is fixed directly to torso_link.
  parentLink: "torso_link",
  runtimeParentLink: UNITREE_G1_HEAD_PITCH.linkName,
  sensorLink: UNITREE_G1_HEAD_PITCH.sensorLink,
  translationUrdfMeters: Object.freeze([0.0576235, 0.01753, 0.41987]),
  rotationRpyRadians: Object.freeze([0, 0.8307767239493009, 0]),
  opticalAxisUrdf: Object.freeze([1, 0, 0]),
  width: D435_DEPTH_WIDTH,
  height: D435_DEPTH_HEIGHT,
  horizontalFov: D435_HORIZONTAL_FOV_DEGREES,
  verticalFov: D435_VERTICAL_FOV_DEGREES,
  aspect: D435_DEPTH_WIDTH / D435_DEPTH_HEIGHT,
  fx: focalLengthFromFov(D435_DEPTH_WIDTH, D435_HORIZONTAL_FOV_DEGREES),
  fy: focalLengthFromFov(D435_DEPTH_HEIGHT, D435_VERTICAL_FOV_DEGREES),
  cx: D435_DEPTH_WIDTH / 2,
  cy: D435_DEPTH_HEIGHT / 2,
  minimumDepthMeters: 0.105,
  maximumDepthMeters: 10,
  renderFarMeters: 40,
});

export function getUnitreeG1Dex1AssetUrls() {
  return [UNITREE_G1_DEX1_GLB_URL];
}

const CHAIN_PARENTS = {
  d435_link: "torso_link",
  logo_link: "torso_link",
  pelvis_contour_link: "pelvis",
  waist_yaw_link: "pelvis", waist_roll_link: "waist_yaw_link", torso_link: "waist_roll_link", head_link: "torso_link",
  left_hip_pitch_link: "pelvis", left_hip_roll_link: "left_hip_pitch_link", left_hip_yaw_link: "left_hip_roll_link", left_knee_link: "left_hip_yaw_link", left_ankle_pitch_link: "left_knee_link", left_ankle_roll_link: "left_ankle_pitch_link",
  right_hip_pitch_link: "pelvis", right_hip_roll_link: "right_hip_pitch_link", right_hip_yaw_link: "right_hip_roll_link", right_knee_link: "right_hip_yaw_link", right_ankle_pitch_link: "right_knee_link", right_ankle_roll_link: "right_ankle_pitch_link",
  left_shoulder_pitch_link: "torso_link", left_shoulder_roll_link: "left_shoulder_pitch_link", left_shoulder_yaw_link: "left_shoulder_roll_link", left_elbow_link: "left_shoulder_yaw_link", left_wrist_roll_link: "left_elbow_link", left_wrist_pitch_link: "left_wrist_roll_link", left_wrist_yaw_link: "left_wrist_pitch_link", left_hand_base_link: "left_wrist_yaw_link",
  right_shoulder_pitch_link: "torso_link", right_shoulder_roll_link: "right_shoulder_pitch_link", right_shoulder_yaw_link: "right_shoulder_roll_link", right_elbow_link: "right_shoulder_yaw_link", right_wrist_roll_link: "right_elbow_link", right_wrist_pitch_link: "right_wrist_roll_link", right_wrist_yaw_link: "right_wrist_pitch_link", right_hand_base_link: "right_wrist_yaw_link",
};

const officialTemplatePromises = new Map();

for (const side of ["left", "right"]) for (const finger of ["Link1", "Link2"]) {
  CHAIN_PARENTS[`${side}_hand_${finger}_1`] = `${side}_hand_base_link`;
  CHAIN_PARENTS[`${side}_hand_${finger}_2`] = `${side}_hand_${finger}_1`;
  CHAIN_PARENTS[`${side}_hand_${finger}_3`] = `${side}_hand_${finger}_2`;
}

function addRuntimeHeadPitchLink(root) {
  const config = UNITREE_G1_HEAD_PITCH;
  const torso = root.getObjectByName(config.parentLink);
  const head = root.getObjectByName(config.visualLink);
  const sensor = root.getObjectByName(config.sensorLink);
  if (!torso || !head || !sensor || root.getObjectByName(config.linkName)) return;

  const pivot = new THREE.Group();
  pivot.name = config.linkName;
  torso.add(pivot);
  pivot.position.set(...config.pivotConvertedMeters);
  torso.updateWorldMatrix(true, true);
  pivot.attach(head);
  pivot.attach(sensor);
  root.updateMatrixWorld(true);
}

function addMujocoHeadAndSensorLinks(root) {
  const torso = root.getObjectByName("torso_link");
  if (!torso) return;
  if (!root.getObjectByName("head_link")) {
    const headVisual = root.getObjectByName("torso_link__visual_2");
    if (headVisual) {
      const head = new THREE.Group();
      head.name = "head_link";
      torso.add(head);
      head.attach(headVisual);
    }
  }
  if (!root.getObjectByName("d435_link")) {
    const sensor = new THREE.Group();
    sensor.name = "d435_link";
    sensor.position.set(-0.01753, 0.41987, 0.0576235);
    sensor.rotation.y = -Math.PI / 2;
    torso.add(sensor);
  }
}

function rebuildKinematicHierarchy(root) {
  root.updateMatrixWorld(true);
  for (const [childName, parentName] of Object.entries(CHAIN_PARENTS)) {
    const child = root.getObjectByName(childName);
    const parent = root.getObjectByName(parentName);
    if (child && parent && child.parent !== parent) parent.attach(child);
  }
  addMujocoHeadAndSensorLinks(root);
  addRuntimeHeadPitchLink(root);
  root.updateMatrixWorld(true);
}

function createExplodedController(root) {
  const parts = [];
  const center = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const direction = object.getWorldPosition(new THREE.Vector3()).sub(center).normalize().multiplyScalar(0.055);
    direction.transformDirection(object.parent.matrixWorld.clone().invert());
    parts.push({ object, rest: object.position.clone(), direction });
  });
  return {
    parts: parts.map(({ object }) => object),
    setExploded(amount) {
      const clamped = THREE.MathUtils.clamp(amount, 0, 1);
      for (const part of parts) part.object.position.copy(part.rest).addScaledVector(part.direction, clamped);
    },
  };
}

export function rememberUnitreeG1Dex1RestPose(root) {
  const pose = new Map();
  root.traverse((object) => pose.set(object.name, object.quaternion.clone()));
  return pose;
}

function damp(current, target, smoothing, delta) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-smoothing * delta));
}

function applyJointDelta(root, restPose, name, axis, angle) {
  const joint = root.getObjectByName(name);
  const rest = restPose.get(name);
  if (joint && rest) joint.quaternion.copy(rest).multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
}

function solveSagittalLeg(footForward, footDown) {
  // Distances measured from the converted official GLB joint origins.
  const thigh = 0.3409234414;
  const shin = 0.3000100106;
  const distanceSquared = footForward * footForward + footDown * footDown;
  const kneeCosine = THREE.MathUtils.clamp(
    (distanceSquared - thigh * thigh - shin * shin) / (2 * thigh * shin),
    -1,
    1,
  );
  const knee = Math.acos(kneeCosine);
  const hip = Math.atan2(footForward, footDown)
    - Math.atan2(shin * Math.sin(knee), thigh + shin * Math.cos(knee));
  return { hip, knee, ankle: -(hip + knee) };
}

async function loadOfficialTemplate(url) {
  if (!officialTemplatePromises.has(url)) {
    const templatePromise = new GLTFLoader().loadAsync(url).then((gltf) => {
      rebuildKinematicHierarchy(gltf.scene);
      return gltf.scene;
    }).catch((error) => {
      officialTemplatePromises.delete(url);
      throw error;
    });
    officialTemplatePromises.set(url, templatePromise);
  }
  return officialTemplatePromises.get(url);
}

export async function loadUnitreeG1Dex1Model({ url = UNITREE_G1_DEX1_GLB_URL, groundY = -0.15 } = {}) {
  const template = await loadOfficialTemplate(url);
  const official = template.clone(true);
  official.name = "unitree-g1-29dof-dex1-official";
  // Trimesh exports MuJoCo +Y (robot left) as Three.js -X. Mirror X once so
  // the browser model matches the game's +X-left coordinate convention.
  official.rotation.y = 0;
  official.scale.x = -1;
  const bounds = new THREE.Box3().setFromObject(official);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const robot = new THREE.Group();
  robot.name = "unitree-g1-edu2-dex1-web";
  robot.add(official);
  official.position.set(-center.x, -bounds.min.y + groundY, -center.z);
  robot.userData.officialAsset = { url, configuration: "G1-29dof", sourceFormat: "MuJoCo MJCF/STL", webFormat: "GLB", nativeHeightMeters: size.y };
  robot.userData.restPose = rememberUnitreeG1Dex1RestPose(official);
  robot.userData.restPosition = robot.position.clone();
  robot.userData.restQuaternion = robot.quaternion.clone();
  robot.userData.gaitWeight = 0;
  robot.userData.sculptRuntime = createExplodedController(official);
  return robot;
}

const convertedPitchAxis = new THREE.Vector3(1, 0, 0);

export function setUnitreeG1Dex1JointAngle(robot, name, angle, axis = convertedPitchAxis) {
  const official = robot.children[0];
  const rest = robot.userData.restPose;
  if (official && rest) applyJointDelta(official, rest, name, axis, angle);
}

export function setUnitreeG1Dex1Grip(robot, amount) {
  const official = robot.children[0];
  const rest = robot.userData.restPose;
  if (!official || !rest) return;
  const grip = THREE.MathUtils.clamp(amount, 0, 1);
  for (const side of ["left", "right"]) {
    for (const finger of ["Link1", "Link2"]) {
      for (let joint = 1; joint <= 3; joint += 1) {
        applyJointDelta(
          official,
          rest,
          `${side}_hand_${finger}_${joint}`,
          convertedPitchAxis,
          grip * (joint === 1 ? 0.48 : 0.72),
        );
      }
    }
  }
}

export function updateUnitreeG1Dex1Model(robot, delta, elapsed, motion = "idle", travelDistance = null, lookPitch = 0) {
  const official = robot.children[0];
  const rest = robot.userData.restPose;
  if (!official || !rest) return;
  const active = motion === "marching" || motion === "walking";
  robot.userData.gaitWeight = damp(robot.userData.gaitWeight, active ? 1 : 0, 5.5, delta);
  const weight = robot.userData.gaitWeight;
  const walkingStride = 0.175;
  const cycle = motion === "walking" && Number.isFinite(travelDistance)
    ? travelDistance * Math.PI / (2 * walkingStride)
    : elapsed * 5.6;
  const swing = Math.sin(cycle);
  const leftLift = Math.max(0, swing);
  const rightLift = Math.max(0, -swing);
  const stride = motion === "walking" ? walkingStride : 0;
  const liftHeight = motion === "walking" ? 0.06 : 0.052;
  const leftFootForward = swing * stride;
  const rightFootForward = -swing * stride;
  // MuJoCo (X forward, Y left, Z up) is exported as Three.js
  // (+Z forward, -X left, +Y up).
  const pitchAxis = new THREE.Vector3(1, 0, 0);
  const yawAxis = new THREE.Vector3(0, -1, 0);

  // Official USD axes: pitch joints use USD local Y and yaw uses USD local Z.
  // Use their converted GLB axes here; copying the USD letters directly would
  // rotate the legs sideways in Three.js.
  // Unitree's official G1 RL home pose (hip=-0.1, knee=0.3,
  // ankle=-0.2) defines the nominal foot distance. For an in-place step the
  // support foot stays at that target while the other foot rises 45 mm.
  // Two-link IK produces the coupled hip/knee angles; the ankle cancels their
  // sum to keep the sole approximately level.
  const nominalForward = 0.3409234414 * Math.sin(-0.1) + 0.3000100106 * Math.sin(0.2);
  const nominalDown = 0.3409234414 * Math.cos(-0.1) + 0.3000100106 * Math.cos(0.2);
  const leftLeg = solveSagittalLeg(nominalForward + leftFootForward, nominalDown - leftLift * liftHeight);
  const rightLeg = solveSagittalLeg(nominalForward + rightFootForward, nominalDown - rightLift * liftHeight);
  applyJointDelta(official, rest, "left_hip_pitch_link", pitchAxis, leftLeg.hip * weight);
  applyJointDelta(official, rest, "right_hip_pitch_link", pitchAxis, rightLeg.hip * weight);
  applyJointDelta(official, rest, "left_knee_link", pitchAxis, leftLeg.knee * weight);
  applyJointDelta(official, rest, "right_knee_link", pitchAxis, rightLeg.knee * weight);
  applyJointDelta(official, rest, "left_ankle_pitch_link", pitchAxis, leftLeg.ankle * weight);
  applyJointDelta(official, rest, "right_ankle_pitch_link", pitchAxis, rightLeg.ankle * weight);
  applyJointDelta(official, rest, "waist_yaw_link", yawAxis, -swing * 0.035 * weight);
  const gaze = THREE.MathUtils.clamp(
    lookPitch,
    UNITREE_G1_HEAD_PITCH.minimumRadians,
    UNITREE_G1_HEAD_PITCH.maximumRadians,
  );
  applyJointDelta(official, rest, UNITREE_G1_HEAD_PITCH.linkName, pitchAxis, -gaze);

  // World-space validation on the rebuilt official hierarchy shows that the
  // IK forward sign is inverted after USD -> glTF conversion: swing > 0 puts
  // the RIGHT ankle ahead. Negative shoulder pitch moves a wrist forward, so
  // the LEFT shoulder must be negative at that phase (contralateral gait).
  const armSwing = motion === "walking" ? 0.3 : 0.16;
  const leftArmForward = swing > 0;
  const rightArmForward = swing < 0;
  const leftShoulder = -swing * armSwing;
  const rightShoulder = swing * armSwing;
  applyJointDelta(official, rest, "left_shoulder_pitch_link", pitchAxis, leftShoulder * weight);
  applyJointDelta(official, rest, "right_shoulder_pitch_link", pitchAxis, rightShoulder * weight);
  applyJointDelta(official, rest, "left_elbow_link", pitchAxis, (0.08 + (leftArmForward ? 0.06 : 0)) * weight);
  applyJointDelta(official, rest, "right_elbow_link", pitchAxis, (0.08 + (rightArmForward ? 0.06 : 0)) * weight);

  const restPosition = robot.userData.restPosition;
  robot.position.copy(restPosition);
  robot.position.y -= (0.012 + Math.abs(swing) * 0.008) * weight;
  robot.quaternion.copy(robot.userData.restQuaternion);
  robot.rotateZ(swing * 0.018 * weight);
}

export function configureUnitreeG1D435DepthCamera(camera) {
  const calibration = UNITREE_G1_D435_DEPTH_CAMERA;
  const near = calibration.minimumDepthMeters;
  const far = Math.max(near + Number.EPSILON, calibration.renderFarMeters);
  const left = -calibration.cx * near / calibration.fx;
  const right = (calibration.width - calibration.cx) * near / calibration.fx;
  const top = calibration.cy * near / calibration.fy;
  const bottom = -(calibration.height - calibration.cy) * near / calibration.fy;

  camera.near = near;
  camera.far = far;
  camera.aspect = calibration.aspect;
  camera.fov = calibration.verticalFov;
  camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  return camera;
}

export function getUnitreeG1D435WorldPose(gameRobot, position, forward) {
  const model = gameRobot?.userData?.officialModel;
  if (!model) return false;
  const sensor = model.getObjectByName(UNITREE_G1_D435_DEPTH_CAMERA.sensorLink);
  if (!sensor) return false;
  sensor.updateWorldMatrix(true, false);

  const [urdfX, urdfY, urdfZ] = UNITREE_G1_D435_DEPTH_CAMERA.opticalAxisUrdf;
  position.setFromMatrixPosition(sensor.matrixWorld);
  forward.set(urdfX, urdfZ, -urdfY).transformDirection(sensor.matrixWorld);
  return true;
}

export function setUnitreeG1FirstPersonHeadVisible(gameRobot, visible) {
  const model = gameRobot?.userData?.officialModel;
  const head = model?.getObjectByName("head_link");
  if (!head) return;
  head.traverse((object) => {
    if (!object.isMesh) return;
    if (!visible) {
      if (!(FIRST_PERSON_VISIBILITY_KEY in object.userData)) {
        object.userData[FIRST_PERSON_VISIBILITY_KEY] = object.visible;
      }
      object.visible = false;
      return;
    }
    if (FIRST_PERSON_VISIBILITY_KEY in object.userData) {
      object.visible = object.userData[FIRST_PERSON_VISIBILITY_KEY];
      delete object.userData[FIRST_PERSON_VISIBILITY_KEY];
    }
  });
}
