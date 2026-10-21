import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import {
  UNITREE_R1_EDU_GLB_URL,
  UNITREE_R1_EDU_CONTROL_PROFILE,
  UNITREE_R1_EDU_PALETTE,
  UNITREE_R1_EDU_SPEC,
  UNITREE_R1_HEAD_PITCH,
  parseUnitreeR1EduModel,
  setUnitreeR1EduGrip,
  setUnitreeR1EduJointAngle,
  updateUnitreeR1EduModel,
} from "../game/unitree-r1-edu.js";

const assetUrl = new URL("../public/local-assets/unitree/unitree-r1-official-mujoco.glb", import.meta.url);
const assetBytes = await readFile(assetUrl);

function assetArrayBuffer() {
  return assetBytes.buffer.slice(assetBytes.byteOffset, assetBytes.byteOffset + assetBytes.byteLength);
}

async function collectJavaScriptFiles(directory) {
  const directoryPath = directory instanceof URL ? fileURLToPath(directory) : directory;
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) return collectJavaScriptFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith(".js") ? [absolutePath] : [];
  }));
  return nested.flat();
}

test("R1 EDU descriptor identifies the official MuJoCo source", () => {
  assert.equal(UNITREE_R1_EDU_GLB_URL, "/local-assets/unitree/unitree-r1-official-mujoco.glb");
  assert.equal(UNITREE_R1_EDU_SPEC.configuration, "official-unitree_mujoco-R1");
  assert.equal(UNITREE_R1_EDU_SPEC.sourceFormat, "MuJoCo XML + STL");
  assert.equal(UNITREE_R1_EDU_SPEC.sourceRevision, "4134cb5dc7ff1ba7f484deda48b5274b58694519");
  assert.equal(UNITREE_R1_EDU_SPEC.license, "BSD-3-Clause");
  assert.equal(UNITREE_R1_EDU_SPEC.dof, 29);
  assert.equal(UNITREE_R1_EDU_SPEC.integrationStatus, "standalone");
  assert.equal(UNITREE_R1_EDU_SPEC.colorway, "official-website-pearl-white-navy");
  assert.equal(UNITREE_R1_EDU_PALETTE.reference, "https://www.unitree.com/R1/");
});

test("converted asset is a substantial binary glTF", () => {
  assert.equal(assetBytes.subarray(0, 4).toString("ascii"), "glTF");
  assert.ok(assetBytes.byteLength > 20_000_000);
});

test("official GLB preserves the MuJoCo body hierarchy and dimensions", async () => {
  const robot = await parseUnitreeR1EduModel(assetArrayBuffer(), { instanceId: "hierarchy" });
  for (const link of [
    "pelvis",
    "torso_link",
    "head_yaw_link",
    "left_hip_pitch_link",
    "left_knee_link",
    "left_ankle_roll_link",
    "right_hip_pitch_link",
    "right_knee_link",
    "right_ankle_roll_link",
    "left_shoulder_pitch_link",
    "left_wrist_roll_link",
    "right_shoulder_pitch_link",
    "right_wrist_roll_link",
  ]) {
    assert.ok(robot.getObjectByName(link), `missing official MuJoCo link ${link}`);
  }

  robot.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(robot).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.y - 1.2302) < 0.015, `expected official height near 1.2302m, received ${size.y}`);
  assert.equal(robot.userData.officialAsset.sourceFormat, "MuJoCo XML + STL");
  assert.equal(robot.userData.officialAsset.nativeHeightMeters.toFixed(4), "1.2302");
});

test("official public R1 asset exposes fixed hands without articulated finger links", async () => {
  const robot = await parseUnitreeR1EduModel(assetArrayBuffer(), { instanceId: "wrist-only" });
  assert.ok(robot.getObjectByName("left_wrist_roll_link"));
  assert.ok(robot.getObjectByName("right_wrist_roll_link"));
  assert.equal(robot.getObjectByName("left_hand_base_link"), undefined);
  assert.equal(robot.getObjectByName("right_hand_base_link"), undefined);
  assert.equal(robot.userData.configuration.handType, "official-fixed-hand-integrated-wrist-mesh");
});

test("runtime applies the official website colorway without MuJoCo debug colors", async () => {
  const robot = await parseUnitreeR1EduModel(assetArrayBuffer(), { instanceId: "official-colorway" });
  const wrist = robot.getObjectByName("left_wrist_roll_link__visual");
  const foot = robot.getObjectByName("left_ankle_roll_link__visual");
  const shell = robot.getObjectByName("left_knee_link__visual");
  const mechanism = robot.getObjectByName("left_ankle_A_link");

  assert.equal(wrist.material.color.getHexString(), UNITREE_R1_EDU_PALETTE.graphite.slice(1));
  assert.equal(foot.material.color.getHexString(), UNITREE_R1_EDU_PALETTE.navy.slice(1));
  assert.equal(shell.material.color.getHexString(), UNITREE_R1_EDU_PALETTE.shell.slice(1));
  assert.equal(mechanism.material.color.getHexString(), UNITREE_R1_EDU_PALETTE.graphite.slice(1));
  assert.equal(robot.userData.configuration.appearanceReference, "https://www.unitree.com/R1/");

  for (const accentName of [
    "r1-website-vision-visor",
    "r1-website-crown-left",
    "r1-website-left-shoulder-cap",
    "r1-website-right-knee-cap",
    "r1-website-left-leg-stripe-1",
    "r1-website-chest-marker",
  ]) {
    assert.ok(robot.getObjectByName(accentName), `missing website color accent ${accentName}`);
  }
  assert.equal(robot.userData.sculptRuntime.appearanceAccents.length, 14);
});

test("R1 camera socket follows the pitch joint for D435 first-person view", async () => {
  const robot = await parseUnitreeR1EduModel(assetArrayBuffer(), { instanceId: "d435-camera" });
  const socket = robot.userData.sculptRuntime.sockets.camera;
  assert.equal(socket.parent.name, "head_pitch_link");
  assert.deepEqual(socket.position.toArray(), [0.055, 0, 0.015]);
});

test("R1 control profile matches the shared G1 keyboard and reserve contract", () => {
  assert.deepEqual(UNITREE_R1_EDU_CONTROL_PROFILE.input, {
    forward: "KeyW",
    backward: "KeyS",
    strafeLeft: "KeyA",
    strafeRight: "KeyD",
    turnLeft: "KeyQ",
    turnRight: "KeyE",
  });
  assert.equal(UNITREE_R1_EDU_CONTROL_PROFILE.movementDrainsProgress, true);
  assert.equal(UNITREE_R1_EDU_CONTROL_PROFILE.turningDrainsProgress, false);
  assert.equal(UNITREE_R1_EDU_CONTROL_PROFILE.supportsTravelDistanceGait, true);
  assert.equal(UNITREE_R1_EDU_CONTROL_PROFILE.supportsLookPitch, true);
  assert.equal(UNITREE_R1_EDU_CONTROL_PROFILE.supportsGripCommand, false);
});

test("R1 update uses G1-compatible travel distance, look pitch, and joint commands", async () => {
  const robot = await parseUnitreeR1EduModel(assetArrayBuffer(), { instanceId: "control-contract" });
  const head = robot.getObjectByName(UNITREE_R1_HEAD_PITCH.linkName);
  const hip = robot.getObjectByName("left_hip_pitch_link");
  const restHead = robot.userData.restPose.get(UNITREE_R1_HEAD_PITCH.linkName).clone();
  const restHip = robot.userData.restPose.get("left_hip_pitch_link").clone();

  updateUnitreeR1EduModel(robot, 0.25, 99, "walking", 0.175, THREE.MathUtils.degToRad(12));
  assert.ok(Math.abs(robot.userData.gaitPhase - Math.PI / 2) < 1e-9);
  assert.ok(head.quaternion.angleTo(restHead) > 0.1);
  assert.ok(hip.quaternion.angleTo(restHip) > 0.1);

  updateUnitreeR1EduModel(robot, 0.25, 0, "idle", 0.175, THREE.MathUtils.degToRad(90));
  assert.ok(head.quaternion.angleTo(restHead) <= UNITREE_R1_HEAD_PITCH.maximumRadians + 1e-9);

  setUnitreeR1EduJointAngle(robot, "left_elbow_link", 0.42);
  assert.ok(robot.getObjectByName("left_elbow_link").quaternion.angleTo(robot.userData.restPose.get("left_elbow_link")) > 0.4);
  setUnitreeR1EduGrip(robot, 0.74);
  assert.equal(robot.userData.grip, 0.74);
});

test("R1 turning accepts the G1 marching animation state without advancing position gait", async () => {
  const robot = await parseUnitreeR1EduModel(assetArrayBuffer(), { instanceId: "turn-contract" });
  const torso = robot.getObjectByName("torso_link");
  const torsoRest = robot.userData.restPose.get("torso_link").clone();

  updateUnitreeR1EduModel(robot, 0.2, 0.25, "marching", 10, 0);
  assert.ok(torso.quaternion.angleTo(torsoRest) > 0);
  assert.ok(Math.abs(robot.userData.gaitPhase - 0.25 * 5.6) < 1e-9);
});

test("loader exposes independent instances and future collaboration sockets", async () => {
  const [alpha, beta] = await Promise.all([
    parseUnitreeR1EduModel(assetArrayBuffer(), { instanceId: "alpha" }),
    parseUnitreeR1EduModel(assetArrayBuffer(), { instanceId: "beta" }),
  ]);
  assert.notEqual(alpha, beta);
  assert.equal(alpha.userData.instanceId, "alpha");
  assert.equal(beta.userData.instanceId, "beta");
  assert.deepEqual(
    Object.keys(alpha.userData.sculptRuntime.sockets).sort(),
    ["batteryBay", "camera", "chest", "head", "leftHand", "rightHand"],
  );
  const alphaMesh = alpha.getObjectByProperty("isMesh", true);
  const betaMesh = beta.getObjectByProperty("isMesh", true);
  assert.notEqual(alphaMesh.material, betaMesh.material);

  updateUnitreeR1EduModel(alpha, 0.16, 1.2, "moving");
  assert.ok(alpha.userData.gaitPhase > 0);
  assert.equal(beta.userData.gaitPhase, 0);
});

test("exploded view remains reversible on official mesh parts", async () => {
  const robot = await parseUnitreeR1EduModel(assetArrayBuffer(), { instanceId: "explode" });
  const part = robot.userData.sculptRuntime.parts[0];
  const initial = part.position.clone();
  robot.userData.sculptRuntime.setExploded(1);
  assert.notDeepEqual(part.position.toArray(), initial.toArray());
  robot.userData.sculptRuntime.setExploded(0);
  assert.deepEqual(part.position.toArray(), initial.toArray());
});

test("conversion is reproducible and the production build ships the official asset", async () => {
  const converterSource = await readFile(new URL("../tools/convert-unitree-r1-mujoco.mjs", import.meta.url), "utf8");
  const viteConfigSource = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");
  const sourceNotes = await readFile(new URL("../public/local-assets/unitree/UNITREE_R1_SOURCE.md", import.meta.url), "utf8");
  const license = await readFile(new URL("../public/local-assets/unitree/UNITREE_R1_LICENSE.txt", import.meta.url), "utf8");
  const previewHtml = await readFile(new URL("../r1-view.html", import.meta.url), "utf8");
  const previewSource = await readFile(new URL("../game/r1-view.js", import.meta.url), "utf8");

  assert.match(converterSource, /R1_C\+\+\.xml/);
  assert.match(converterSource, /4134cb5dc7ff1ba7f484deda48b5274b58694519/);
  assert.match(converterSource, /STLLoader/);
  assert.match(converterSource, /GLTFExporter/);
  assert.match(viteConfigSource, /unitree\/unitree-r1-official-mujoco\.glb/);
  assert.match(sourceNotes, /unitree_robots\/r1/);
  assert.match(sourceNotes, /https:\/\/www\.unitree\.com\/R1\//);
  assert.match(license, /BSD 3-Clause License/);
  assert.match(license, /HangZhou YuShu TECHNOLOGY CO\.,LTD\./);
  assert.match(viteConfigSource, /r1View/);
  assert.match(previewHtml, /Unitree R1 EDU/);
  assert.match(previewSource, /loadUnitreeR1EduModel/);
});

test("R1 EDU is registered through the shared profile while levels stay robot-agnostic", async () => {
  const runtimeFiles = await collectJavaScriptFiles(new URL("../game/levels/", import.meta.url));
  for (const runtimeFile of runtimeFiles) {
    const source = await readFile(runtimeFile, "utf8");
    assert.doesNotMatch(source, /unitree-r1-edu|loadUnitreeR1EduModel/, String(runtimeFile));
  }
});
