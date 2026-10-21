import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loaderSource = await readFile(new URL("../game/unitree-g1-dex1-model.js", import.meta.url), "utf8");
const previewSource = await readFile(new URL("../game/g1-edu2-preview.js", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../g1-edu2.html", import.meta.url), "utf8");
const viteConfigSource = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");

test("G1 EDU2 preview loads the MuJoCo GLB instead of the procedural blockout", () => {
  assert.match(previewSource, /loadUnitreeG1Dex1Model/);
  assert.doesNotMatch(previewSource, /createUnitreeG1Edu2Model/);
  assert.match(loaderSource, /g1\/g1_29dof_official\.glb/);
  assert.match(loaderSource, /GLTFLoader/);
});

test("production build ships the exact MuJoCo G1 runtime asset", () => {
  assert.match(loaderSource, /\/local-assets\/unitree\/g1\/g1_29dof_official\.glb/);
  assert.match(viteConfigSource, /"unitree\/g1"/);
});

test("official G1 hierarchy covers the MuJoCo 29-DOF body chains", () => {
  for (const link of ["pelvis", "torso_link", "head_link", "left_ankle_roll_link", "right_ankle_roll_link", "left_wrist_yaw_link", "right_wrist_yaw_link"]) assert.match(loaderSource, new RegExp(link));
  assert.match(loaderSource, /sourceFormat: "MuJoCo MJCF\/STL"/);
  assert.match(loaderSource, /addMujocoHeadAndSensorLinks/);
});

test("official model retains animation and exploded-view runtime contracts", () => {
  assert.match(loaderSource, /rebuildKinematicHierarchy/);
  assert.match(loaderSource, /updateUnitreeG1Dex1Model/);
  assert.match(loaderSource, /setExploded\(amount\)/);
  assert.match(previewSource, /__IMG2THREEJS_CAPTURE__/);
});

test("MuJoCo export is corrected to the game's right-handed coordinate frame", () => {
  assert.match(loaderSource, /official\.rotation\.y = 0/);
  assert.match(loaderSource, /official\.scale\.x = -1/);
  assert.match(loaderSource, /browser model matches the game's \+X-left coordinate convention/);
});

test("MuJoCo materials remain unmodified and the preview has no decorative halo", () => {
  assert.doesNotMatch(loaderSource, /restoreOfficialMaterials/);
  assert.doesNotMatch(loaderSource, /unitree-g1-head-cyan-light-guide/);
  assert.doesNotMatch(previewSource, /TorusGeometry/);
});

test("gait converts MuJoCo axes into GLB coordinates and articulates the full leg chain", () => {
  assert.match(loaderSource, /const pitchAxis = new THREE\.Vector3\(1, 0, 0\)/);
  assert.match(loaderSource, /const yawAxis = new THREE\.Vector3\(0, -1, 0\)/);
  assert.match(loaderSource, /left_hip_pitch_link[^\n]*pitchAxis/);
  assert.match(loaderSource, /left_knee_link[^\n]*pitchAxis/);
  assert.match(loaderSource, /left_ankle_pitch_link[^\n]*pitchAxis/);
  assert.match(loaderSource, /right_ankle_pitch_link[^\n]*pitchAxis/);
  assert.match(loaderSource, /function solveSagittalLeg/);
  assert.match(loaderSource, /const thigh = 0\.3409234414/);
  assert.match(loaderSource, /const shin = 0\.3000100106/);
  assert.match(loaderSource, /const liftHeight = motion === "walking" \? 0\.06 : 0\.052/);
  assert.match(loaderSource, /leftLift \* liftHeight/);
  assert.match(loaderSource, /ankle: -\(hip \+ knee\)/);
  assert.match(loaderSource, /gaitWeight = damp/);
  assert.doesNotMatch(loaderSource, /const yAxis = new THREE\.Vector3\(0, 1, 0\)/);
});

test("arm swing is contralateral and walking has an independent foot trajectory", () => {
  assert.match(loaderSource, /const leftFootForward = swing \* stride/);
  assert.match(loaderSource, /const rightFootForward = -swing \* stride/);
  assert.match(loaderSource, /const leftShoulder = -swing \* armSwing/);
  assert.match(loaderSource, /const rightShoulder = swing \* armSwing/);
  assert.match(loaderSource, /motion === "walking" \? walkingStride : 0/);
  assert.match(loaderSource, /leftArmForward = swing > 0/);
  assert.match(loaderSource, /rightArmForward = swing < 0/);
});

test("preview drives movement from an isolated MuJoCo session", () => {
  assert.match(previewSource, /MujocoClient/);
  assert.match(previewSource, /applyMujocoState\(actor/);
  assert.match(previewSource, /motion === "turning" \? 1 : 0/);
  assert.match(previewSource, /motion === "walking" \? 0\.5 : 0/);
  assert.match(previewSource, /camera\.position\.add\(horizontalDelta\)/);
  assert.match(previewSource, /#walk-toggle/);
  assert.match(pageSource, /启动真实转向/);
  assert.match(pageSource, /启动真实行走/);
});

test("review harness can freeze gait phases for visual inspection", () => {
  assert.match(previewSource, /query\.has\("gaitPhase"\)/);
  assert.match(previewSource, /reviewGaitPhase \/ 5\.6/);
});

test("page identifies the official simulation source", () => {
  assert.match(pageSource, /Official Simulation Asset/);
  assert.match(pageSource, /Unitree MuJoCo/);
  assert.doesNotMatch(pageSource, /Dex3|程序化形象/);
});
