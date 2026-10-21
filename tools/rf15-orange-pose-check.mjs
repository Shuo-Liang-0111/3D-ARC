import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { loadUnitreeG1Dex1Model, setUnitreeG1Dex1JointAngle } from '../game/unitree-g1-dex1-model.js';
import { applyMujocoState } from '../game/mujoco-client.js';
import { BrowserArmScript } from '../game/levels/rf15/browser-arm-script.js';
import { InteractionAnimation } from '../game/levels/rf15/interaction-animation.js';
import { InteractionWalk } from '../game/levels/rf15/interaction-walk.js';
import { OrangeAnimation } from '../game/levels/rf15/orange-animation.js';
import { createVariantEngine } from '../game/levels/rf15/variant-engine.js';
import { ORANGE_ID, ORANGE_TASK } from '../game/levels/rf15/orange-task.js';
import { LEVEL } from '../game/levels/rf15-3/level.js';

globalThis.ProgressEvent = class { constructor(type, values) { this.type = type; Object.assign(this, values); } };
globalThis.document = { querySelector: () => null };
const model = await loadUnitreeG1Dex1Model({ url: process.env.ARC_MODEL_URL || 'http://127.0.0.1:4173/local-assets/unitree/g1/g1_29dof_official.glb', groundY: 0 });
const standing = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const robot = new THREE.Group(); robot.add(model);
robot.userData.officialModel = model; robot.userData.robotProfile = { id: 'g1', setJointAngle: setUnitreeG1Dex1JointAngle };
const runtime = { ...createVariantEngine(LEVEL), LEVEL };
let state = runtime.createInitialState();
const owner = Object.create(InteractionAnimation.prototype);
Object.assign(owner, { robot, action: null, crouch: 0, requestedCrouch: 0, pendingCompletion: false, objects: new Map(), arms: {}, hands: {},
  options: { runtime, getState: () => state, setState: next => { state = next; }, stop() {}, message: text => console.log(text) },
  view: { field: { deposited: {} }, orange: { shipment: new THREE.Group(), moving: new THREE.Group(), sourceFruits: Array.from({ length: 20 }, () => new THREE.Group()) }, tail: new THREE.Group() },
  cartAnimation: { gait() {}, cancel() {} },
});
for (const side of ['left', 'right']) {
  owner.arms[side] = new BrowserArmScript(robot, side);
  owner.hands[side] = { held: null, attachment: null, setGrip(value) { this.closed = value; }, update() {}, detach() { this.held = null; } };
}
owner.walk = new InteractionWalk(owner); owner.orangeAnimation = new OrangeAnimation(owner);
function frame() {
  state = runtime.updateMovement(state, owner.motionInput(state), .025);
  state = runtime.updateEnvironment(state, .025);
  robot.position.set(state.player.x, 0, state.player.z); robot.rotation.set(0, state.player.yaw, 0);
  applyMujocoState(robot, standing, robot.userData.robotProfile, { groundY: 0, projectWorldPose: false });
  owner.frame(.025, true);
}
function action(station, expected) {
  if (station) state.player = { ...ORANGE_TASK.stands[station], x: ORANGE_TASK.stands[station].x - .05 };
  frame();
  assert.equal(runtime.getInteraction(state)?.type, expected);
  owner.interact();
  let frames = 0;
  let previousPhase = '';
  for (; owner.action && frames < 3000; frames++) {
    frame();
    if (owner.action?.phase !== previousPhase) {
      previousPhase = owner.action?.phase;
      console.log(JSON.stringify({ phase: previousPhase, frame: frames, leftError: owner.arms.left.error, rightError: owner.arms.right.error }));
    }
  }
  console.log(JSON.stringify({ expected, result: owner.lastResult, seconds: frames * .025, count: state.items[ORANGE_ID].orangeCount, leftError: owner.arms.left.error, rightError: owner.arms.right.error }));
  assert.equal(owner.lastResult?.result, expected);
  assert.equal(state.failed, false);
}
action('home', 'orange-pickup');
action('scale', 'orange-place-scale');
for (let count = 0; count < 20; count++) action(null, 'orange-add');
action(null, 'orange-take-scale');
action('pack', 'orange-place-pack');
action(null, 'orange-pack');
action(null, 'orange-take-pack');
action('tail', 'orange-load');
assert.equal(state.complete, true);
assert.equal(state.items[ORANGE_ID].orangeCount, 20);
console.log(JSON.stringify({ complete: state.complete, reserve: state.progress, delivered: state.loaded, fixtureNavigation: true }));
