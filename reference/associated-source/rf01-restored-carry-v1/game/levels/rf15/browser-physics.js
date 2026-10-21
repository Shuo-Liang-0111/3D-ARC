import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { RF15PhysicsWorld, PHYSICS_REVISION } from './browser-physics-world.js';
import { BrowserContactHand } from './browser-contact-hand.js';
import { BrowserArmScript } from './browser-arm-script.js';
import { FIELD_CROPS, FIELD } from './field-layout.js';
import { TOOL_ROOM } from './tool-room-layout.js';

const assetRoot = `/local-assets/levels/rf15/${PHYSICS_REVISION}/`;
const up = new THREE.Vector3(0, 1, 0);
const distance = (player, point) => Math.hypot(player.x - point.x, player.z - point.z);

export async function createBrowserPhysics(world, robot, options) {
  const response = await fetch(assetRoot + 'hands.json');
  if (!response.ok) throw new Error('Hand definitions failed to load');
  const definitions = (await response.json()).hands;
  const files = [...new Set(Object.values(definitions).flatMap(parts => parts.flatMap(part => part.geoms.map(geom => geom.mesh).filter(Boolean))))];
  const geometries = new Map(await Promise.all(files.map(async file => [file, await new STLLoader().loadAsync(assetRoot + file)])));
  return new BrowserPhysics(world, robot, definitions, geometries, options);
}

export class BrowserPhysics {
  constructor(view, robot, definitions, geometries, options) {
    this.view = view;
    this.robot = robot;
    this.options = options;
    this.rig = robot.userData.collisionRig;
    this.rig.ownsWorld = false;
    this.physics = new RF15PhysicsWorld(this.rig.world);
    this.definitions = definitions;
    this.geometries = geometries;
    this.hands = {};
    this.arms = {};
    this.action = null;
    this.ready = true;
    this.crouch = 0;
    this.requestedCrouch = 0;
    this.depositTimes = new Map();
    this.attachModels();
    for (const side of ['left', 'right']) {
      const arm = new BrowserArmScript(robot, side);
      const pose = arm.nativePose();
      this.arms[side] = arm;
      this.hands[side] = new BrowserContactHand(this.physics.world, view.scene, definitions[side], geometries, side, { position: pose.position.toArray(), quaternion: pose.rotation.toArray() });
      const rubber = robot.userData.officialModel.getObjectByName(`${side}_wrist_yaw_link__visual_1`);
      if (rubber) rubber.visible = false;
    }
    for (const part of this.rig.parts) {
      part.collider.setCollisionGroups(part.spec.source === 'supplemental-hand' ? 0 : 0x00080013);
    }
    for (const staticPart of this.physics.statics.filter(part => part.id === 'tool-rest')) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...staticPart.size), new THREE.MeshStandardMaterial({ color: 0x594c38, roughness: .85 }));
      mesh.position.fromArray(staticPart.position); mesh.castShadow = true; mesh.receiveShadow = true;
      view.scene.add(mesh);
    }
    robot.userData.browserPhysics = this;
    window.__RF15_PHYSICS__ = {
      getState: () => this.snapshot(),
      grip: (side, closed, strength = .9) => { if (!this.hands[side]) throw new Error('Unknown hand'); this.hands[side].setGrip(closed, strength); },
      interact: () => this.interact(),
    };
    document.querySelector('#game-shell').dataset.physicsRevision = PHYSICS_REVISION;
    if (new URLSearchParams(location.search).get('qa') === 'physics') import('./browser-physics-qa.js').then(module => module.installPhysicsQA(this));
  }

  get busy() { return Boolean(this.action); }

  cancel() {
    if (!this.action) return;
    this.lastResult = { id: this.action.id, result: 'cancelled' };
    this.action = null;
    this.requestedCrouch = this.crouch;
    for (const arm of Object.values(this.arms)) arm.targetAngles = [...arm.angles];
    this.options.stop();
  }

  attachModels() {
    const view = this.view;
    const models = { ...view.field.crops, ...view.field.produce, ...view.toolRoom.tools, 'harvest-basket': view.field.basket, 'platform-scale': view.assetRoots.scale, 'pallet-jack': view.assetRoots.jack };
    for (const [id, entry] of this.physics.objects) {
      entry.model = models[id];
      if (!entry.model) throw new Error('Missing interactive model ' + id);
    }
  }

  reset() {
    this.action = null;
    this.lastResult = null;
    this.crouch = 0; this.requestedCrouch = 0;
    this.depositTimes.clear();
    for (const side of ['left', 'right']) {
      this.hands[side].setGrip(false);
      this.hands[side].restoreReleasedCollisions(true);
    }
    for (const entry of this.physics.objects.values()) {
      entry.rooted = Boolean(entry.definition.rooted);
      entry.body.setBodyType(entry.rooted ? RAPIER.RigidBodyType.Fixed : RAPIER.RigidBodyType.Dynamic, true);
      entry.body.setTranslation(new THREE.Vector3(...entry.definition.position), true);
      const rotation = entry.definition.rotation;
      entry.body.setRotation(Array.isArray(rotation) ? new THREE.Quaternion(...rotation) : new THREE.Quaternion().setFromAxisAngle(up, rotation || 0), true);
      entry.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      entry.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    this.physics.door.setRotation(new THREE.Quaternion(), true);
    this.physics.door.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.resetHandPose = true;
    for (const side of ['left', 'right']) { this.arms[side].active = false; this.hands[side].setGrip(false); }
  }

  targetOrientation(yaw) {
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const down = new THREE.Vector3(0, -1, 0);
    const across = new THREE.Vector3().crossVectors(forward, down);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward, down, across));
  }

  interact() {
    if (this.busy) return true;
    if (this.options.controlMode !== 'velocity') { this.options.message('当前由 29DOF Agent 控制手臂'); return true; }
    const state = this.options.getState();
    if (state.complete || state.failed) return true;
    let selected = this.options.runtime.getInteraction(state);
    if (selected?.type === 'knife-required') {
      const knife = this.physics.objects.get('harvest-knife');
      if (distance(state.player, knife.body.translation()) < 1.25) selected = { type: 'take-tool', tool: 'harvest-knife' };
      else { this.options.message('需要携带收割刀'); return true; }
    }
    if (selected && ['open-tool-room', 'close-tool-room', 'spray', 'weigh', 'pack'].includes(selected.type)) {
      const next = this.options.runtime.interact(state);
      this.options.setState(next);
      return true;
    }
    const heldSide = ['left', 'right'].find(side => this.hands[side].held && [state.carriedCrop, state.carriedItem].includes(this.hands[side].held)) ?? ['right', 'left'].find(side => this.hands[side].held);
    if (heldSide && (!selected || ['drop', 'return-tool', 'harvest-drop', 'place-scale', 'place-pack', 'place-tail'].includes(selected.type))) {
      const id = this.hands[heldSide].held;
      const home = this.physics.objects.get(id).definition;
      const station = selected?.type === 'return-tool' ? new THREE.Vector3(...home.position) : selected?.type === 'harvest-drop' ? this.physics.objects.get('harvest-basket').body.translation() : selected?.type === 'place-scale' ? this.physics.objects.get('platform-scale').body.translation() : selected?.type === 'place-pack' ? this.options.runtime.LEVEL.pack : selected?.type === 'place-tail' ? this.options.runtime.LEVEL.tail : null;
      if (!station) { this.hands[heldSide].setGrip(false); this.options.message('已松手'); return true; }
      const point = new THREE.Vector3(station.x, station.y + (selected.type === 'place-scale' ? .55 : selected.type === 'harvest-drop' ? .48 : .32), station.z);
      if (selected.type === 'return-tool') point.copy(station).add(new THREE.Vector3(...home.grasp).applyQuaternion(new THREE.Quaternion(...home.rotation))).y += .03;
      this.beginMotion(id, heldSide, point, 'place', selected);
      return true;
    }
    let id = selected?.tool ?? selected?.item ?? (selected?.type === 'take-sprayer' ? 'sprayer' : null);
    if (!id) id = [...this.physics.objects].filter(([name, entry]) => !entry.rooted && distance(state.player, entry.body.translation()) < 1.25 && !Object.values(this.hands).some(hand => hand.held === name)).sort((left, right) => distance(state.player, left[1].body.translation()) - distance(state.player, right[1].body.translation()))[0]?.[0];
    const entry = this.physics.objects.get(id);
    if (!entry) { this.options.message('附近没有可操作物体'); return true; }
    const side = this.hands.right.held ? 'left' : 'right';
    if (this.hands[side].held) { this.options.message('请先放下手中物体'); return true; }
    if (entry.rooted && !Object.values(this.hands).some(hand => hand.held === 'harvest-knife')) { this.options.message('需要携带收割刀'); return true; }
    const point = this.physics.graspPoint(id);
    this.beginMotion(id, side, point, entry.rooted ? 'harvest' : 'pickup', selected);
    return true;
  }

  beginMotion(id, side, point, kind, selected) {
    const state = this.options.getState();
    const isCrop = Boolean(state.crops[id]);
    const yaw = ['harvest-knife', 'hand-trowel'].includes(id) && point.z < -12 ? Math.PI : isCrop && kind !== 'place' ? (state.player.x < point.x ? Math.PI / 2 : -Math.PI / 2) : Math.atan2(point.x - state.player.x, point.z - state.player.z);
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const lateral = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(side === 'right' ? .18 : -.18);
    if (kind === 'harvest') lateral.set(0, 0, 0);
    const stand = point.clone().addScaledVector(forward, isCrop ? -.57 : ['harvest-knife', 'hand-trowel'].includes(id) ? -.20 : -.42).sub(lateral);
    stand.y = 0;
    if (!this.options.runtime.isWalkable(state, stand.x, stand.z)) { this.options.message('请从物体正面靠近后重试'); return; }
    this.action = { id, side, kind, selected, point: point.clone(), yaw, stand, phase: 'align', elapsed: 0, phaseTime: 0, orientation: this.targetOrientation(yaw) };
    this.lastResult = null;
    this.hands[side].setGrip(kind === 'place', .9);
    this.options.stop();
  }

  motionInput(state) {
    if (!this.action) return null;
    const action = this.action;
    if (action.phase !== 'align') return { move: 0, strafe: 0, turn: 0, drain: false };
    const yawError = Math.atan2(Math.sin(action.yaw - state.player.yaw), Math.cos(action.yaw - state.player.yaw));
    const dx = action.stand.x - state.player.x, dz = action.stand.z - state.player.z;
    const forward = Math.sin(state.player.yaw) * dx + Math.cos(state.player.yaw) * dz;
    const lateral = Math.cos(state.player.yaw) * dx - Math.sin(state.player.yaw) * dz;
    return { move: THREE.MathUtils.clamp(forward * 4, -.45, .45), strafe: THREE.MathUtils.clamp(lateral * 5, -.5, .5), turn: THREE.MathUtils.clamp(yawError * 4, -.8, .8), drain: true };
  }

  animateAction(dt) {
    const action = this.action;
    if (!action) return;
    action.elapsed += dt; action.phaseTime += dt;
    const state = this.options.getState();
    const arm = this.arms[action.side];
    const hand = this.hands[action.side];
    const orientation = state.crops[action.id] ? null : action.orientation;
    if (action.elapsed > 45) { this.fail('动作未完成，请调整站位后重试'); return; }
    if (action.phase === 'align') {
      if (distance(state.player, action.stand) > .012 || Math.abs(Math.atan2(Math.sin(action.yaw - state.player.yaw), Math.cos(action.yaw - state.player.yaw))) > .015) return;
      this.options.stop();
      const alreadyActive = arm.active;
      if (!alreadyActive) arm.capture();
      this.requestedCrouch = Math.max(0, Math.min(1, (1.05 - action.point.y) / .75));
      if (action.kind === 'place') {
        action.phase = 'reach'; action.phaseTime = 0;
        action.reachStart = arm.graspPose().position;
        return;
      }
      action.phase = 'fold'; action.phaseTime = 0;
      arm.targetAngles = [.5, action.side === 'right' ? -.7 : .7, 0, -1, 0, 0, 0];
      action.hover = action.kind === 'harvest' ? .04 : .13;
      action.waypoint = action.point.clone().add(new THREE.Vector3(-Math.sin(action.yaw) * .17, action.hover, -Math.cos(action.yaw) * .17));
      if (alreadyActive) { arm.plan(action.waypoint, orientation); action.phase = 'raise'; }
      return;
    }
    if (action.phase === 'fold') {
      if (Math.max(...arm.angles.map((angle, index) => Math.abs(angle - arm.targetAngles[index]))) < .07) {
        arm.targetAngles = [-.8, action.side === 'right' ? -.7 : .7, 0, -1, 0, 0, 0];
        action.phase = 'rise'; action.phaseTime = 0;
      }
    } else if (action.phase === 'rise') {
      if (Math.max(...arm.angles.map((angle, index) => Math.abs(angle - arm.targetAngles[index]))) < .07) {
        arm.plan(action.waypoint, orientation);
        action.phase = 'raise'; action.phaseTime = 0;
      }
    } else if (action.phase === 'raise') {
      arm.solve(action.waypoint, orientation, 12);
      if (arm.graspPose().position.distanceTo(action.waypoint) < .035) {
        action.phase = 'approach'; action.phaseTime = 0;
      }
    } else if (action.phase === 'approach') {
      const point = action.point.clone().add(new THREE.Vector3(0, action.hover, 0));
      arm.solve(point, orientation, 12);
      if (arm.error > .025 && action.phaseTime - (action.lastPlan || -2) > 1.5) {
        arm.plan(point, orientation);
        action.lastPlan = action.phaseTime;
      }
      if (arm.graspPose().position.distanceTo(point) < .025) { action.phase = 'reach'; action.phaseTime = 0; action.reachStart = point; }
    } else if (action.phase === 'reach') {
      const target = action.kind === 'place' ? action.point : this.physics.graspPoint(action.id);
      if (target.distanceTo(action.point) > .12) { this.fail('物体已移动，请重新靠近后取物'); return; }
      const point = action.reachStart.clone().lerp(target, Math.min(1, action.phaseTime / 4));
      arm.solve(point, orientation, 12);
      if (action.kind === 'place' && arm.error > .025 && action.phaseTime - (action.lastReachPlan || -2) > 1.5) {
        arm.plan(point, orientation);
        action.lastReachPlan = action.phaseTime;
      }
      if (action.phaseTime >= 4 && arm.graspPose().position.distanceTo(target) < (action.kind === 'place' ? .045 : .015)) {
        if (action.kind === 'place') { hand.setGrip(false); action.phase = 'release'; action.releaseRotation = arm.graspPose().rotation; }
        else { hand.setGrip(true); action.phase = 'close'; }
        action.phaseTime = 0;
      }
    } else if (action.phase === 'close') {
      if (hand.held === action.id && action.phaseTime > .7) {
        if (action.kind === 'harvest' && this.physics.objects.get(action.id).rooted) {
          action.phase = 'cut'; action.phaseTime = 0;
          action.knifeSide = ['left', 'right'].find(side => this.hands[side].held === 'harvest-knife');
          if (!action.knifeSide) { this.fail('收割刀已滑落'); return; }
          const knifeArm = this.arms[action.knifeSide];
          action.knifeStart = knifeArm.graspPose().position;
          const knife = this.physics.objects.get('harvest-knife');
          const relativeRotation = knifeArm.nativePose().rotation.clone().invert().multiply(new THREE.Quaternion().copy(knife.body.rotation()));
          action.knifeOrientation = new THREE.Quaternion().setFromAxisAngle(up, action.yaw).multiply(relativeRotation.invert());
          action.bladeStart = new THREE.Vector3(0, .025, .19).applyQuaternion(new THREE.Quaternion().copy(knife.body.rotation())).add(new THREE.Vector3().copy(knife.body.translation()));
          action.cutTarget = this.physics.graspPoint(action.id).add(new THREE.Vector3(0, -.06, 0));
          return;
        }
        action.origin = arm.graspPose().position;
        action.phase = 'lift'; action.phaseTime = 0;
      } else if (action.phaseTime > 4) this.fail('未夹稳物体，请重新尝试');
    } else if (action.phase === 'cut') {
      if (this.hands[action.knifeSide].held !== 'harvest-knife') { this.fail('收割刀已滑落'); return; }
      const knife = this.physics.objects.get('harvest-knife');
      const knifeArm = this.arms[action.knifeSide];
      const blade = new THREE.Vector3(0, .025, .19).applyQuaternion(new THREE.Quaternion().copy(knife.body.rotation())).add(new THREE.Vector3().copy(knife.body.translation()));
      const wrist = knifeArm.nativePose();
      const effector = blade.sub(wrist.position).applyQuaternion(wrist.rotation.invert());
      const stemTarget = action.cutTarget.clone();
      knifeArm.solve(action.bladeStart.clone().lerp(stemTarget, Math.min(1, action.phaseTime / 6)), action.knifeOrientation, 18, effector);
      if (knifeArm.error > .025 && action.phaseTime - (action.lastCutPlan || -2) > 1.5) {
        knifeArm.plan(stemTarget, action.knifeOrientation, effector);
        action.lastCutPlan = action.phaseTime;
      }
      let bladeContact = false;
      this.physics.world.contactPair(knife.colliders[1], this.physics.objects.get(action.id).colliders[0], manifold => { if (manifold.numContacts() > 0) bladeContact = true; });
      if (bladeContact) {
        this.physics.cut(action.id);
        action.knifeRetreatStart = knifeArm.graspPose().position;
        knifeArm.targetAngles = [...knifeArm.angles];
        action.origin = arm.graspPose().position;
        action.phase = hand.held === action.id ? 'lift' : 'close'; action.phaseTime = 0;
      } else if (action.phaseTime > 12) this.fail('刀刃未接触菜茎，请重新调整位置');
    } else if (action.phase === 'lift') {
      if (action.knifeRetreatStart && this.hands[action.knifeSide].held === 'harvest-knife') {
        const retreat = new THREE.Vector3(-Math.sin(action.yaw) * .08, .06, -Math.cos(action.yaw) * .08).multiplyScalar(Math.min(1, action.phaseTime / 3));
        this.arms[action.knifeSide].solve(action.knifeRetreatStart.clone().add(retreat), null, 12);
      }
      const point = action.origin.clone().add(new THREE.Vector3(0, Math.min(.10, action.phaseTime * .04), 0));
      arm.solve(point, orientation, 10);
      if (action.phaseTime > .5 && hand.held !== action.id) this.fail('物体滑落');
      else if (action.phaseTime > 3) {
        this.requestedCrouch = 0;
        if (this.crouch > .01) {
          action.phase = 'recover'; action.phaseTime = 0;
          action.recoverStart = Object.fromEntries(Object.entries(this.arms).map(([side, controller]) => [side, controller.graspPose().position]));
        }
        else { this.lastResult = { id: action.id, result: 'held', height: this.physics.objects.get(action.id).body.translation().y }; this.action = null; this.options.message('已抓稳物体'); }
      }
    } else if (action.phase === 'recover') {
      if (hand.held !== action.id) { this.fail('起身时物体滑落'); return; }
      if (this.crouch < .001 && action.phaseTime > 4) {
        this.lastResult = { id: action.id, result: 'held', height: this.physics.objects.get(action.id).body.translation().y };
        this.action = null; this.options.message('已抓稳物体');
      }
    } else if (action.phase === 'release') {
      const crop = Boolean(state.crops[action.id]);
      const retreat = new THREE.Vector3(-Math.sin(action.yaw) * (crop ? .3 : 1), crop ? 1 : 0, -Math.cos(action.yaw) * (crop ? .3 : 1)).multiplyScalar(Math.max(0, Math.min(.25, (action.phaseTime - (crop ? 4 : 1)) * .08)));
      const endRotation = this.targetOrientation(action.yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
      const rotation = crop ? action.releaseRotation.clone().slerp(endRotation, Math.min(1, action.phaseTime / 3)) : orientation;
      arm.solve(action.point.clone().add(retreat), rotation, 16);
      if (crop && arm.error > .04 && action.phaseTime - (action.lastReleasePlan || -2) > 2) {
        arm.plan(action.point.clone().add(retreat), rotation);
        action.lastReleasePlan = action.phaseTime;
      }
      const touching = hand.contacts.some(contact => contact.id === action.id);
      if (action.phaseTime > 5 && !touching) { this.lastResult = { id: action.id, result: 'released' }; this.action = null; this.requestedCrouch = 0; }
    }
  }

  fail(message) {
    this.lastResult = { id: this.action?.id, result: 'failed', message };
    if (this.action) this.hands[this.action.side].setGrip(false);
    this.action = null; this.requestedCrouch = 0;
    this.options.stop(); this.options.message(message);
  }

  applyCrouch(dt) {
    this.crouch += THREE.MathUtils.clamp(this.requestedCrouch - this.crouch, -dt * .12, dt * .28);
    if (this.crouch < .0001) return;
    const model = this.robot.userData.officialModel;
    this.robot.updateMatrixWorld(true);
    const feet = ['left', 'right'].map(side => model.getObjectByName(`${side}_ankle_roll_link`));
    const before = feet.reduce((sum, foot) => sum.add(foot.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).multiplyScalar(.5);
    const knee = this.crouch * 2.7;
    const ankle = -this.crouch * .87;
    const profile = this.robot.userData.robotProfile;
    for (const side of ['left', 'right']) {
      profile.setJointAngle(model, `${side}_hip_pitch_link`, -knee - ankle);
      profile.setJointAngle(model, `${side}_knee_link`, knee);
      profile.setJointAngle(model, `${side}_ankle_pitch_link`, ankle);
    }
    profile.setJointAngle(model, 'torso_link', this.crouch * .5);
    this.robot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.crouch * .5));
    this.robot.updateMatrixWorld(true);
    const after = feet.reduce((sum, foot) => sum.add(foot.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).multiplyScalar(.5);
    this.robot.position.add(before.sub(after));
    this.robot.updateMatrixWorld(true);
  }

  frame(dt, running) {
    if (!this.ready) return;
    const state = this.options.getState();
    this.applyCrouch(dt);
    for (const arm of Object.values(this.arms)) if (arm.active) arm.apply();
    if (this.action?.kind === 'harvest' && !['align', 'cut', 'lift', 'recover'].includes(this.action.phase)) {
      for (const [side, hand] of Object.entries(this.hands)) if (hand.held === 'harvest-knife') {
        const forward = new THREE.Vector3(Math.sin(this.action.yaw), 0, Math.cos(this.action.yaw));
        const lateral = new THREE.Vector3(-Math.cos(this.action.yaw), 0, Math.sin(this.action.yaw)).multiplyScalar(side === 'right' ? .18 : -.18);
        const point = this.action.stand.clone().addScaledVector(forward, .32).add(lateral);
        point.y = 1.22 - .63 * this.crouch;
        this.arms[side].solve(point, this.action.orientation, 16);
      }
    }
    this.animateAction(running ? dt : 0);
    if (this.options.controlMode === 'velocity') for (const arm of Object.values(this.arms)) arm.update(running ? dt : 0);
    this.robot.updateMatrixWorld(true);
    this.rig.sync({ step: false });
    const poses = Object.fromEntries(Object.entries(this.arms).map(([side, arm]) => [side, arm.nativePose()]));
    this.physics.doorJoint.configureMotorPosition(state.toolRoomOpen ? -Math.PI / 2 : 0, 90, 18);
    this.physics.tail.setNextKinematicTranslation({ x: 5.3, y: .06 + this.view.tail.position.y, z: 1 });
    this.physics.advance(dt, (step, fraction) => {
      for (const [side, hand] of Object.entries(this.hands)) {
        const position = new THREE.Vector3().copy(hand.palm.translation()).lerp(poses[side].position, fraction);
        const rotation = new THREE.Quaternion().copy(hand.palm.rotation()).slerp(poses[side].rotation, fraction);
        hand.setPose(position, rotation, this.resetHandPose);
        hand.beforeStep(step);
      }
      this.resetHandPose = false;
    }, step => { for (const hand of Object.values(this.hands)) hand.afterStep(step, this.physics.objects); });
    this.draw();
    this.updateState(dt);
    const shell = document.querySelector('#game-shell');
    if (shell && performance.now() - (this.lastTelemetry || 0) > 200) {
      this.lastTelemetry = performance.now();
      shell.dataset.rf15Physics = JSON.stringify(this.snapshot());
    }
  }

  updateState(dt) {
    const state = this.options.getState();
    if (state.complete || state.failed) return;
    const next = this.options.runtime.cloneState(state);
    next.browserPhysics = true;
    const held = Object.values(this.hands).map(hand => hand.held).filter(Boolean);
    next.heldTool = held.find(id => ['harvest-knife', 'hand-trowel'].includes(id)) ?? null;
    next.sprayer = held.includes('sprayer');
    next.carriedCrop = held.find(id => Boolean(next.crops[id])) ?? null;
    next.carriedItem = held.find(id => Boolean(next.items[id])) ?? null;
    next.scaleItem = null; next.packItem = null;
    for (const [id, entry] of this.physics.objects) {
      const item = next.items[id] ?? next.crops[id];
      if (!item) continue;
      Object.assign(item, entry.body.translation());
      if (next.crops[id]) {
        const deposited = !held.includes(id) && !entry.rooted && this.physics.insideBasket(id);
        this.depositTimes.set(id, deposited ? (this.depositTimes.get(id) ?? 0) + dt : 0);
        item.location = held.includes(id) ? 'carried' : entry.rooted ? 'field' : deposited ? 'basket' : 'floor';
        if (this.depositTimes.get(id) > .6 && !next.harvested.includes(id)) next.harvested.push(id);
      } else {
        item.location = held.includes(id) ? 'carried' : 'floor';
        if (held.includes(id)) continue;
        const scale = this.physics.objects.get('platform-scale').body.translation();
        if (distance(item, scale) < .30 && item.y > scale.y + .22 && item.y < scale.y + .38) { next.scaleItem = id; item.location = 'scale'; }
        if (distance(item, this.options.runtime.LEVEL.pack) < .7 && Math.abs(item.y - this.options.runtime.LEVEL.pack.y) < .08) { next.packItem = id; item.location = 'pack'; }
        if (item.packed && distance(item, this.options.runtime.LEVEL.tail) < .8 && item.y < .3 && !next.loaded.includes(id)) { next.loaded.push(id); item.location = 'loaded'; }
      }
    }
    next.toolDoorAngle = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().copy(this.physics.door.rotation()), 'YXZ').y;
    if (!this.action && next.carriedItem !== state.carriedItem) next.lastEvent = next.carriedItem ? 'cargo_picked' : 'cargo_dropped';
    next.complete = this.options.runtime.LEVEL.variant === 'rf15-1' ? next.cart.parked : this.options.runtime.LEVEL.variant === 'rf15-2' ? next.harvested.length === FIELD_CROPS.length : next.loaded.length === 2;
    this.options.setState(next);
  }

  draw() {
    for (const [id, entry] of this.physics.objects) {
      const item = this.options.getState().items[id];
      const model = item?.packed ? this.view.items[id] : entry.model;
      if (item) { this.view.items[id].visible = Boolean(item.packed); entry.model.visible = !item.packed; }
      else model.visible = true;
      const worldPosition = new THREE.Vector3().copy(entry.body.translation());
      model.position.copy(model.parent.worldToLocal(worldPosition));
      model.quaternion.copy(model.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(new THREE.Quaternion().copy(entry.body.rotation())));
    }
    this.view.toolRoom.hinge.quaternion.copy(this.physics.door.rotation());
    for (const model of Object.values(this.view.field.deposited)) model.visible = false;
    if (this.view.field.cuttingKnife) this.view.field.cuttingKnife.visible = false;
    if (this.robot.userData.rackPayload) this.robot.userData.rackPayload.visible = false;
    for (const hand of Object.values(this.hands)) hand.draw();
  }

  snapshot() {
    const feedback = this.options.robotFeedback?.();
    const backend = feedback ? { fallen: feedback.fallen, base: feedback.base, target: this.arms.right.targetAngles, active: this.arms.right.active, error: this.arms.right.error, solvedPosition: this.arms.right.solvedPosition, joints: this.arms.right.joints.map(joint => [joint.name, joint.parent.name, joint.position.toArray()]) } : null;
    return { ...this.physics.snapshot(), backend, lastResult: this.lastResult, robot: this.robot.position, shoulder: this.arms.right.joints[0].getWorldPosition(new THREE.Vector3()), angles: this.arms.right.angles, door: this.physics.door.rotation(), mode: this.options.controlMode, action: this.action ? { id: this.action.id, phase: this.action.phase, side: this.action.side, elapsed: this.action.elapsed, stand: this.action.stand, target: this.action.point, grasp: this.arms[this.action.side].graspPose().position } : null, hands: Object.fromEntries(Object.entries(this.hands).map(([side, hand]) => [side, { held: hand.held, attachment: hand.attachmentState(), closed: hand.closed, strength: hand.strength, contacts: hand.contacts, position: hand.graspPoint() }])) };
  }
}
