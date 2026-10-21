import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { AnimationHand } from '../game/levels/rf15/animation-hand.js';
import { createVariantEngine } from '../game/levels/rf15/variant-engine.js';
import { LEVEL } from '../game/levels/rf15-1/level.js';
import { FIELD } from '../game/levels/rf15/field-layout.js';

test('held visual follows translated and rotated wrist exactly, then stops after release', () => {
  const hand = new AnimationHand(new THREE.Scene(), [{ name: 'palm', geoms: [] }], new Map(), 'left');
  const initialPose = { position: new THREE.Vector3(1, 2, 3), rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), .7) };
  hand.update(0, initialPose);
  const entry = { id: 'lettuce-1', position: new THREE.Vector3(1.15, 2.1, 3), rotation: new THREE.Quaternion() };
  hand.attach(entry);
  const localPosition = hand.attachment.position.clone();
  const localRotation = hand.attachment.rotation.clone();
  for (let frame = 0; frame < 120; frame++) {
    const pose = { position: new THREE.Vector3(frame * .01, .7, 0), rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), frame * .02) };
    hand.update(1 / 60, pose);
    assert.ok(entry.position.distanceTo(localPosition.clone().applyQuaternion(pose.rotation).add(pose.position)) < 1e-9);
    assert.ok(entry.rotation.angleTo(pose.rotation.clone().multiply(localRotation)) < 1e-7);
  }
  hand.detach();
  const released = entry.position.clone();
  hand.update(1, initialPose);
  assert.equal(hand.held, null);
  assert.deepEqual(entry.position.toArray(), released.toArray());
});

test('scripted harvest commits only at animation event, deposits all eight once with existing accounting', () => {
  const runtime = createVariantEngine(LEVEL);
  let state = runtime.createInitialState(); state.heldTool = 'harvest-knife';
  for (const crop of Object.values(state.crops)) {
    state.player = { x: crop.x - .9, z: crop.z, yaw: Math.PI / 2 };
    assert.equal(state.crops[crop.id].location, 'field');
    const before = state.interactions;
    state = runtime.interact(state, { animationComplete: true });
    assert.equal(state.carriedCrop, crop.id);
    assert.equal(state.cuttingCrop, undefined);
    assert.equal(state.interactions, before + 1);
    assert.equal(state.crops[crop.id].location, 'carried');
    state.player = { x: FIELD.basket.x - .9, z: FIELD.basket.z, yaw: Math.PI / 2 };
    state = runtime.interact(state, { animationComplete: true });
    assert.equal(state.carriedCrop, null);
    assert.equal(state.crops[crop.id].location, 'basket');
  }
  assert.equal(state.complete, true);
  assert.equal(new Set(state.harvested).size, 8);
  assert.equal(state.errors, 0);
  assert.equal(runtime.interact(state, { animationComplete: true }), state);
  assert.equal(runtime.createInitialState().harvested.length, 0);
});

test('legacy harvest timing remains available and missing knife is still rejected', () => {
  const runtime = createVariantEngine(LEVEL);
  const state = runtime.createInitialState();
  const crop = Object.values(state.crops)[0];
  state.player = { x: crop.x - .9, z: crop.z, yaw: Math.PI / 2 };
  const rejected = runtime.interact(state, { animationComplete: true });
  assert.equal(rejected.carriedCrop, null);
  assert.equal(rejected.errors, 1);
  state.heldTool = 'harvest-knife';
  const pending = runtime.interact(state);
  assert.equal(pending.cuttingCrop, crop.id);
  assert.equal(pending.carriedCrop, null);
});
