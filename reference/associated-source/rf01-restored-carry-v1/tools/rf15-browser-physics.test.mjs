import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { RF15PhysicsWorld } from '../game/levels/rf15/browser-physics-world.js';
import { BrowserContactHand } from '../game/levels/rf15/browser-contact-hand.js';

const assetRoot = 'public/local-assets/levels/rf15/browser-physics-v1/';
const definition = JSON.parse(fs.readFileSync(assetRoot + 'hands.json')).hands.right;
const geometries = new Map();
for (const part of definition) for (const geom of part.geoms) if (geom.mesh && !geometries.has(geom.mesh)) {
  const bytes = fs.readFileSync(assetRoot + geom.mesh);
  geometries.set(geom.mesh, new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
}

test('tool stays supported, pushes and falls under gravity', () => {
  const physics = new RF15PhysicsWorld();
  for (let frame = 0; frame < 120; frame++) physics.advance(1 / 60);
  const tool = physics.objects.get('harvest-knife').body;
  assert.ok(tool.translation().y > 1.12 && tool.translation().y < 1.2);
  tool.applyImpulse({ x: 0, y: 0, z: 1.2 }, true);
  for (let frame = 0; frame < 180; frame++) physics.advance(1 / 60);
  assert.ok(tool.translation().z > -12);
  assert.ok(tool.translation().y < .15);
  assert.ok(tool.translation().y > -.02);
  physics.world.free();
});

test('rooted vegetables release as dynamic bodies', () => {
  const physics = new RF15PhysicsWorld();
  const [id, crop] = [...physics.objects].find(([, entry]) => entry.rooted);
  assert.equal(crop.body.isFixed(), true);
  assert.equal(physics.cut(id), true);
  assert.equal(physics.cut(id), false);
  assert.equal(crop.body.isDynamic(), true);
  assert.ok(Math.abs(crop.body.mass() - .3) < .001);
  physics.world.free();
});

test('door reaches the open angle without catching the jamb', () => {
  const physics = new RF15PhysicsWorld();
  physics.doorJoint.configureMotorPosition(-Math.PI / 2, 90, 18);
  for (let frame = 0; frame < 480; frame++) physics.advance(1 / 60);
  const angle = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().copy(physics.door.rotation()), 'YXZ').y;
  assert.ok(Math.abs(angle + Math.PI / 2) < .02, String(angle));
  physics.world.free();
});

test('contact grasp fixes knife position and rotation until explicit release', () => {
  const physics = new RF15PhysicsWorld();
  const forward = new THREE.Vector3(0, 0, -1);
  const down = new THREE.Vector3(0, -1, 0);
  const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward, down, new THREE.Vector3().crossVectors(forward, down)));
  for (let frame = 0; frame < 60; frame++) physics.advance(1 / 60);
  const point = physics.graspPoint('harvest-knife');
  const palm = point.clone().sub(new THREE.Vector3(.14, .04, 0).applyQuaternion(rotation));
  const hand = new BrowserContactHand(physics.world, null, definition, geometries, 'right', { position: palm.toArray(), quaternion: rotation.toArray() });
  const entry = physics.objects.get('harvest-knife');
  const tool = entry.body;
  const groups = entry.colliders.map(collider => collider.collisionGroups());
  const initialHeight = tool.translation().y;
  const initialJoints = physics.world.impulseJoints.len();
  hand.setGrip(true);
  for (let frame = 0; frame < 1200; frame++) physics.advance(1 / 240, step => {
    hand.setPose(palm.clone().add(new THREE.Vector3(0, Math.max(0, Math.min(.1, (frame - 360) / 240 * .025)), 0)), rotation);
    hand.beforeStep(step);
  }, step => hand.afterStep(step, physics.objects));
  assert.equal(hand.held, 'harvest-knife', JSON.stringify({ contacts: hand.contacts, position: tool.translation() }));
  assert.ok(tool.translation().y > initialHeight + .06);
  assert.equal(physics.world.impulseJoints.len(), initialJoints + 1);
  assert.ok(hand.attachment);
  const relativePose = () => {
    const inverse = new THREE.Quaternion().copy(hand.palm.rotation()).invert();
    return {
      position: new THREE.Vector3().copy(tool.translation()).sub(new THREE.Vector3().copy(hand.palm.translation())).applyQuaternion(inverse),
      rotation: inverse.multiply(new THREE.Quaternion().copy(tool.rotation())),
    };
  };
  const fixed = relativePose();
  hand.setGrip(true, .002);
  for (let frame = 0; frame < 720; frame++) physics.advance(1 / 240, step => {
    const progress = frame / 720;
    hand.setPose(palm.clone().add(new THREE.Vector3(.3 * progress, .1 + .3 * progress, 0)), rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), progress * .8)));
    hand.beforeStep(step);
  }, step => {
    hand.afterStep(step, physics.objects);
    const actual = relativePose();
    assert.ok(actual.position.distanceTo(fixed.position) < .003);
    assert.ok(actual.rotation.angleTo(fixed.rotation) < .015);
  });
  assert.equal(hand.held, 'harvest-knife');
  hand.setGrip(false);
  assert.equal(hand.attachment, null);
  assert.equal(physics.world.impulseJoints.len(), initialJoints);
  for (let frame = 0; frame < 720; frame++) physics.advance(1 / 240, step => {
    hand.setPose(palm.clone().add(new THREE.Vector3(.3, .4, frame / 240 * .3)), rotation);
    hand.beforeStep(step);
  }, step => hand.afterStep(step, physics.objects));
  assert.equal(hand.held, null);
  assert.ok(tool.translation().y < initialHeight + .03);
  assert.deepEqual(entry.colliders.map(collider => collider.collisionGroups()), groups);
  hand.dispose();
  physics.world.free();
});

test('vegetable stays rooted until cut; attachment and disposal preserve collision groups', () => {
  const physics = new RF15PhysicsWorld();
  const crop = physics.objects.get('lettuce-1');
  const groups = crop.colliders.map(collider => collider.collisionGroups());
  const hand = new BrowserContactHand(physics.world, null, definition, geometries, 'right', { position: [10.7, .4, -3.55], quaternion: [0, 0, 0, 1] });
  const initialJoints = physics.world.impulseJoints.len();
  hand.attach(crop);
  assert.equal(hand.attachment, null);
  physics.cut('lettuce-1');
  hand.attach(crop);
  hand.attach(crop);
  assert.equal(physics.world.impulseJoints.len(), initialJoints + 1);
  assert.ok(crop.body.isDynamic());
  assert.deepEqual(crop.colliders.map(collider => collider.collisionGroups()), groups.map(group => group & ~12));
  hand.dispose();
  assert.deepEqual(crop.colliders.map(collider => collider.collisionGroups()), groups);
  assert.equal(physics.world.impulseJoints.len(), initialJoints - 7);
  physics.world.free();
});
