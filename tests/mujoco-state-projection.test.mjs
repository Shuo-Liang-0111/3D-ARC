import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { applyMujocoState, projectMujocoDeltaToFrontendInput, scaleMujocoVelocityForFrontend } from "../game/mujoco-client.js";

function fixture() {
  const pelvis = new THREE.Group();
  pelvis.name = "pelvis";
  const official = new THREE.Group();
  official.add(pelvis);
  const model = new THREE.Group();
  model.add(official);
  model.userData.restPose = new Map([["pelvis", pelvis.quaternion.clone()]]);
  const robot = new THREE.Group();
  robot.userData.officialModel = model;
  return { robot, pelvis };
}

test("MuJoCo floating base keeps yaw at ground level and applies tilt at the pelvis", () => {
  const { robot, pelvis } = fixture();
  const yaw = 0.6;
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0, -0.04, "YXZ"));
  const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(tilt);
  const profile = { id: "g1", setJointAngle() {} };

  applyMujocoState(robot, {
    sequence: 1,
    base: { position: [2, 0.79, 3], quaternion: quaternion.toArray(), yaw },
    joints: { names: [], positions: [] },
  }, profile, { groundY: 0 });

  assert.ok(robot.position.distanceTo(new THREE.Vector3(2, 0, 3)) < 1e-9);
  assert.ok(robot.quaternion.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)) < 1e-9);
  const mirroredTilt = new THREE.Quaternion(tilt.x, -tilt.y, -tilt.z, tilt.w);
  assert.ok(pelvis.quaternion.angleTo(mirroredTilt) < 1e-9);
});

test("MuJoCo joint projection compensates for the mirrored official GLB root", () => {
  const { robot } = fixture();
  const calls = [];
  const profile = {
    id: "g1",
    setJointAngle(model, linkName, angle, axis) {
      calls.push({ model, linkName, angle, axis: axis.toArray() });
    },
  };

  applyMujocoState(robot, {
    sequence: 1,
    base: { position: [0, 0.79, 0], quaternion: [0, 0, 0, 1], yaw: 0 },
    joints: {
      names: ["left_hip_roll_joint", "left_hip_yaw_joint", "left_hip_pitch_joint"],
      positions: [0.2, -0.3, 0.4],
    },
  }, profile, { groundY: 0 });

  assert.deepEqual(calls.map(({ linkName, angle, axis }) => ({ linkName, angle, axis })), [
    { linkName: "left_hip_roll_link", angle: 0.2, axis: [0, 0, -1] },
    { linkName: "left_hip_yaw_link", angle: -0.3, axis: [0, -1, 0] },
    { linkName: "left_hip_pitch_link", angle: 0.4, axis: [1, 0, 0] },
  ]);
});

test("MuJoCo floating base preserves vertical gait and resets its height baseline", () => {
  const { robot } = fixture();
  const profile = { id: "g1", setJointAngle() {} };
  const base = { quaternion: [0, 0, 0, 1], yaw: 0 };

  applyMujocoState(robot, { sequence: 10, base: { ...base, position: [0, 0.79, 0] }, joints: {} }, profile, { groundY: 0.2 });
  applyMujocoState(robot, { sequence: 11, base: { ...base, position: [0, 0.755, 0] }, joints: {} }, profile, { groundY: 0.2 });
  assert.ok(Math.abs(robot.position.y - 0.165) < 1e-9);

  applyMujocoState(robot, { sequence: 0, base: { ...base, position: [0, 0.81, 0] }, joints: {} }, profile, { groundY: 0.2 });
  assert.ok(Math.abs(robot.position.y - 0.2) < 1e-9);
});

test("MuJoCo can project gait without overriding the front-end collision pose", () => {
  const { robot } = fixture();
  const profile = { id: "g1", setJointAngle() {} };
  const frontEndYaw = 0.35;
  robot.position.set(4, 0.1, -2);
  robot.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), frontEndYaw);

  applyMujocoState(robot, {
    sequence: 1,
    base: { position: [20, 0.79, 30], quaternion: [0, 0, 0, 1], yaw: 1.2 },
    joints: { names: [], positions: [] },
  }, profile, { groundY: 0.1, projectWorldPose: false });

  assert.deepEqual(robot.position.toArray(), [4, 0.1, -2]);
  const expectedYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), frontEndYaw);
  assert.ok(1 - Math.abs(robot.quaternion.dot(expectedYaw)) < 1e-12);
});

test("frontend G1 velocity mapping matches MuJoCo command limits", () => {
  const level = { moveSpeed: 1.4, turnSpeed: 1.8 };
  const forward = scaleMujocoVelocityForFrontend({ move: 1, strafe: 0, turn: 0, drain: true }, level);
  const backward = scaleMujocoVelocityForFrontend({ move: -1, strafe: 0, turn: 0 }, level);
  const lateral = scaleMujocoVelocityForFrontend({ move: 0, strafe: 1, turn: 0 }, level);
  const yaw = scaleMujocoVelocityForFrontend({ move: 0, strafe: 0, turn: 1 }, level);
  assert.equal(forward.move * level.moveSpeed, 1);
  assert.equal(backward.move * level.moveSpeed, -0.5);
  assert.equal(lateral.strafe * level.moveSpeed, 0.3);
  assert.equal(yaw.turn * level.turnSpeed, 0.6);
  assert.equal(forward.drain, true);
});

test("frontend pose follows MuJoCo base deltas in the robot local frame", () => {
  const input = projectMujocoDeltaToFrontendInput(
    { position: [0, 0, 0], yaw: 0 },
    { position: [0, 0, 0.05], yaw: 0.03 },
    { moveSpeed: 1.4, turnSpeed: 1.8 },
    0.05,
    { move: 1, strafe: 0, turn: 1 },
  );
  assert.ok(Math.abs(input.move - (Math.cos(0.03) / 1.4)) < 1e-12);
  assert.ok(Math.abs(input.strafe + (Math.sin(0.03) / 1.4)) < 1e-12);
  assert.ok(Math.abs(input.turn - (0.03 / (1.8 * 0.05))) < 1e-12);
  assert.equal(input.drain, true);
});
