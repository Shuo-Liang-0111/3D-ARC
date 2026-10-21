import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { BrowserArmScript } from './browser-arm-script.js';
import { AnimationHand } from './animation-hand.js';
import { FIELD, FIELD_CROPS } from './field-layout.js';
import { TOOL_ROOM } from './tool-room-layout.js';
import { CartAnimation } from './cart-animation.js';
import { InteractionWalk } from './interaction-walk.js';
import { OrangeAnimation } from './orange-animation.js';

const up = new THREE.Vector3(0, 1, 0);
const smooth = value => THREE.MathUtils.smoothstep(value, 0, 1);
const placing = ['return-tool', 'harvest-drop', 'place-scale', 'place-pack', 'place-tail', 'drop'];

export async function createInteractionAnimation(view, robot, options) {
  const root = '/local-assets/levels/rf15/browser-physics-v1/';
  const response = await fetch(root + 'hands.json');
  if (!response.ok) throw Error('Hand assets failed to load');
  const definitions = (await response.json()).hands;
  const files = [...new Set(Object.values(definitions).flatMap(parts => parts.flatMap(part => part.geoms.filter(geom => geom.visual).map(geom => geom.mesh))))];
  const geometries = new Map(await Promise.all(files.map(async file => [file, await new STLLoader().loadAsync(root + file)])));
  return new InteractionAnimation(view, robot, definitions, geometries, options);
}

export class InteractionAnimation {
  constructor(view, robot, definitions, geometries, options) {
    this.view = view;
    this.robot = robot;
    this.options = options;
    this.arms = {};
    this.hands = {};
    this.objects = new Map();
    this.action = null;
    this.cartAnimation = new CartAnimation(this);
    this.walk = new InteractionWalk(this);
    this.orangeAnimation = new OrangeAnimation(this);
    this.crouch = 0;
    this.requestedCrouch = 0;
    const models = { ...view.field.crops, ...view.field.produce, ...view.toolRoom.tools };
    for (const [id, model] of Object.entries(models)) {
      model.updateWorldMatrix(true, false);
      const position = model.getWorldPosition(new THREE.Vector3());
      const rotation = model.getWorldQuaternion(new THREE.Quaternion());
      if (['harvest-knife', 'hand-trowel'].includes(id)) {
        position.set((id === 'harvest-knife' ? TOOL_ROOM.harvest.x : TOOL_ROOM.trowel.x) - .1, 1.155, -12.45);
        rotation.setFromAxisAngle(up, -Math.PI / 2);
      }
      const grasp = new THREE.Vector3(...(FIELD_CROPS.some(crop => crop.id === id) ? [0, .16, 0] : id === 'sprayer' ? [0, .58, 0] : ['harvest-knife', 'hand-trowel'].includes(id) ? [0, .025, -.045] : [.3, .23, 0]));
      this.objects.set(id, { id, model, position, rotation, grasp, home: position.clone(), homeRotation: rotation.clone(), scale: model.scale.clone() });
    }
    for (const side of ['left', 'right']) {
      this.arms[side] = new BrowserArmScript(robot, side);
      this.hands[side] = new AnimationHand(view.scene, definitions[side], geometries, side);
      const rubber = robot.userData.officialModel.getObjectByName(`${side}_wrist_yaw_link__visual_1`);
      if (rubber) rubber.visible = false;
    }
    for (const horizontal of [TOOL_ROOM.harvest.x, TOOL_ROOM.trowel.x]) {
      for (const [size, position] of [[[.025, .13, .46], [horizontal + .08, 1.085, -12.66]], [[.12, .155, .46], [horizontal - .23, 1.0975, -12.66]]]) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color: 0x594c38, roughness: .85 }));
        mesh.position.fromArray(position); mesh.castShadow = true; view.scene.add(mesh);
      }
    }
    if (new URLSearchParams(location.search).get('qa')) import('./animation-qa.js').then(module => module.installAnimationQA(this));
  }

  get busy() { return Boolean(this.action); }
  graspPoint(id) { const entry = this.objects.get(id); return entry.grasp.clone().applyQuaternion(entry.rotation).add(entry.position); }
  targetOrientation(yaw) {
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const down = new THREE.Vector3(0, -1, 0);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward, down, new THREE.Vector3().crossVectors(forward, down)));
  }

  interact() {
    if (this.action?.kind === 'cart' && this.action.phase === 'push') return this.cartAnimation.release();
    if (this.busy) return true;
    const state = this.options.getState();
    if (state.complete || state.failed) return true;
    const selected = this.options.runtime.getInteraction(state);
    if (!selected || ['knife-required', 'open-tool-room', 'close-tool-room', 'weigh', 'pack', 'spray', 'orange-weighing'].includes(selected.type)) {
      const next = this.options.runtime.interact(state);
      this.options.setState(next);
      if (next.errors > state.errors) this.options.message(selected?.type === 'knife-required' ? '需要携带收割刀' : selected?.type === 'orange-weighing' ? '电子秤读数稳定中，请等待' : '请靠近可操作的位置');
      return true;
    }
    if (['push-cart', 'park-cart'].includes(selected.type)) return this.cartAnimation.start(selected);
    if (selected.type.startsWith('orange-')) return this.orangeAnimation.start(selected);
    const id = selected.tool ?? selected.item ?? 'sprayer';
    const entry = this.objects.get(id);
    if (!entry) return false;
    const kind = selected.type === 'pickup-crop' ? 'harvest' : placing.includes(selected.type) ? 'place' : 'pickup';
    const side = Object.keys(this.hands).find(side => this.hands[side].held === id) ?? (this.hands.right.held ? 'left' : 'right');
    let point = this.graspPoint(id);
    if (kind === 'place') {
      const station = selected.type === 'return-tool' ? entry.home : selected.type === 'harvest-drop' ? FIELD.basket : selected.type === 'place-scale' ? this.options.runtime.LEVEL.scale : selected.type === 'place-pack' ? this.options.runtime.LEVEL.pack : selected.type === 'place-tail' ? this.options.runtime.LEVEL.tail : state.player;
      point = new THREE.Vector3(station.x, (station.y || 0) + (selected.type === 'return-tool' ? .03 : selected.type === 'harvest-drop' ? .48 : .32), station.z);
      if (selected.type === 'return-tool') point.copy(entry.grasp).applyQuaternion(entry.homeRotation).add(entry.home).y += .03;
    }
    const isCrop = Boolean(state.crops[id]);
    const yaw = ['harvest-knife', 'hand-trowel'].includes(id) && point.z < -12 ? Math.PI : isCrop && kind !== 'place' ? (state.player.x < point.x ? Math.PI / 2 : -Math.PI / 2) : Math.atan2(point.x - state.player.x, point.z - state.player.z);
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const lateral = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(side === 'right' ? .18 : -.18);
    if (kind === 'harvest') lateral.set(0, 0, 0);
    const stand = point.clone().addScaledVector(forward, selected.type === 'harvest-drop' ? -.75 : isCrop ? -.57 : ['harvest-knife', 'hand-trowel'].includes(id) ? -.20 : -.42).sub(lateral); stand.y = 0;
    if (selected.type === 'harvest-drop') point.addScaledVector(forward, -.18);
    if (!this.options.runtime.isWalkable(state, stand.x, stand.z)) { this.options.message('请从正面靠近后操作'); return true; }
    if (!this.walk.begin(stand, yaw)) return true;
    this.action = { id, side, kind, selected, point, yaw, stand, originPlayer: { ...state.player }, phase: 'align', elapsed: 0, phaseTime: 0, orientation: isCrop ? null : this.targetOrientation(yaw) };
    this.lastResult = null;
    this.options.stop();
    return true;
  }

  motionInput(state, input = {}) {
    const action = this.action;
    if (action?.kind === 'cart' && action.phase !== 'align') return this.cartAnimation.motionInput(input);
    if (action?.phase === 'align') return this.walk.input(state);
    return { move: 0, strafe: 0, turn: 0, drain: false };
  }

  commitAction() {
    const state = this.options.getState();
    const next = this.options.runtime.interact({ ...state, player: this.action.originPlayer }, { animationComplete: true });
    next.player = state.player;
    if (next.complete) { this.pendingCompletion = true; next.complete = false; }
    this.options.setState(next);
    if (next.failed || next.errors > state.errors) { this.cancel(); return false; }
    return true;
  }

  phase(name) { this.action.phase = name; this.action.phaseTime = 0; }
  animate(dt) {
    const action = this.action;
    if (!action) return;
    if (action.kind === 'cart') return this.cartAnimation.animate(dt);
    if (action.kind === 'orange') return this.orangeAnimation.animate(dt);
    action.elapsed += dt; action.phaseTime += dt;
    const state = this.options.getState();
    const arm = this.arms[action.side], hand = this.hands[action.side];
    if (action.elapsed > 65) { this.options.message('请调整站位后重试'); this.cancel(); return; }
    if (action.phase === 'align') {
      if (!this.walk.ready) return;
      for (const controller of Object.values(this.arms)) if (!controller.active) controller.capture();
      this.requestedCrouch = THREE.MathUtils.clamp((1.05 - action.point.y) / .75, 0, 1);
      this.phase('prepare');
    } else if (action.phase === 'prepare') {
      if (Math.abs(this.crouch - this.requestedCrouch) > .01) return;
      action.reachStart = arm.graspPose().position;
      action.hover = action.point.clone().add(new THREE.Vector3(-Math.sin(action.yaw) * .1, .12, -Math.cos(action.yaw) * .1));
      arm.plan(action.hover, action.orientation);
      this.phase('approach');
    } else if (action.phase === 'approach') {
      arm.solve(action.hover, action.orientation, 10);
      if (arm.error > .025 && action.phaseTime - (action.lastPlan || -2) > 1.5) { arm.plan(action.hover, action.orientation); action.lastPlan = action.phaseTime; }
      if (arm.graspPose().position.distanceTo(action.hover) < .035) { action.reachStart = arm.graspPose().position; this.phase('reach'); }
    } else if (action.phase === 'reach') {
      const target = action.reachStart.clone().lerp(action.point, smooth(action.phaseTime / 1.2));
      arm.solve(target, action.orientation, 12);
      if (action.phaseTime > 1.2 && arm.error > .025 && action.phaseTime - (action.lastReachPlan || -2) > 1.5) { arm.plan(action.point, action.orientation); action.lastReachPlan = action.phaseTime; }
      if (action.phaseTime > 1.2 && arm.graspPose().position.distanceTo(action.point) < (action.kind === 'place' ? .055 : .035)) {
        hand.setGrip(action.kind !== 'place');
        this.phase(action.kind === 'place' ? 'release' : 'close');
      }
    } else if (action.phase === 'close') {
      if (action.phaseTime < .4) return;
      if (action.kind === 'harvest') {
        const knifeArm = this.arms.right;
        const knife = this.objects.get('harvest-knife');
        const wrist = knifeArm.nativePose();
        action.bladeEffector = new THREE.Vector3(0, .025, .19).applyQuaternion(knife.rotation).add(knife.position).sub(wrist.position).applyQuaternion(wrist.rotation.clone().invert());
        action.bladeStart = action.bladeEffector.clone().applyQuaternion(wrist.rotation).add(wrist.position);
        action.cutTarget = action.point.clone().add(new THREE.Vector3(0, -.07, 0));
        knifeArm.plan(action.cutTarget, null, action.bladeEffector);
        this.phase('cut');
      } else this.lift();
    } else if (action.phase === 'cut') {
      const target = action.bladeStart.clone().lerp(action.cutTarget, smooth(action.phaseTime / 1.5));
      this.arms.right.solve(target, null, 16, action.bladeEffector);
      if (this.arms.right.error > .025 && action.phaseTime - (action.lastCutPlan || -2) > 1.5) {
        this.arms.right.plan(action.cutTarget, null, action.bladeEffector);
        action.lastCutPlan = action.phaseTime;
      }
      const wrist = this.arms.right.nativePose();
      const blade = action.bladeEffector.clone().applyQuaternion(wrist.rotation).add(wrist.position);
      if (action.phaseTime > 1.5 && blade.distanceTo(action.cutTarget) < .04) this.lift();
    } else if (action.phase === 'lift') {
      arm.solve(action.liftStart.clone().add(new THREE.Vector3(0, .14 * smooth(action.phaseTime / 1.2), 0)), action.orientation, 12);
      if (action.phaseTime > 1.5) { this.requestedCrouch = 0; this.phase('stand'); }
    } else if (action.phase === 'release') {
      if (action.phaseTime < .35) return;
      hand.detach();
      if (!this.commitAction()) return;
      const entry = this.objects.get(action.id);
      if (action.selected.type === 'harvest-drop') {
        action.placeStart = entry.position.clone();
        action.placeRotation = entry.rotation.clone();
        this.phase('settle');
        return;
      }
      entry.rotation.copy(entry.homeRotation);
      if (action.selected.type === 'return-tool') entry.position.copy(entry.home);
      else if (action.selected.type !== 'harvest-drop') { const item = this.options.getState().items[action.id]; entry.position.set(item.x, item.y, item.z); }
      this.phase('withdraw');
    } else if (action.phase === 'settle') {
      const entry = this.objects.get(action.id);
      const index = state.harvested.indexOf(action.id);
      entry.position.copy(action.placeStart).lerp(this.basketPosition(index), smooth(action.phaseTime / .6));
      entry.rotation.copy(action.placeRotation).slerp(entry.homeRotation, smooth(action.phaseTime / .6));
      if (action.phaseTime >= .6) this.phase('withdraw');
    } else if (action.phase === 'withdraw') {
      const retreat = new THREE.Vector3(-Math.sin(action.yaw) * .16, .15, -Math.cos(action.yaw) * .16).multiplyScalar(smooth(action.phaseTime / .8));
      arm.solve(action.point.clone().add(retreat), action.orientation, 10);
      if (action.phaseTime > 1) { this.requestedCrouch = 0; this.phase('stand'); }
    } else if (action.phase === 'stand') {
      if (this.crouch > .001) return;
      for (const side of ['left', 'right']) {
        const forward = new THREE.Vector3(Math.sin(state.player.yaw), 0, Math.cos(state.player.yaw));
        const lateral = new THREE.Vector3(-Math.cos(state.player.yaw), 0, Math.sin(state.player.yaw)).multiplyScalar(side === 'right' ? .24 : -.24);
        const point = new THREE.Vector3(state.player.x, this.hands[side].held ? .95 : .7, state.player.z).addScaledVector(forward, this.hands[side].held ? .25 : .06).add(lateral);
        this.arms[side].plan(point, null);
      }
      this.phase('carry');
    } else if (action.phase === 'carry' && Object.values(this.arms).every(controller => Math.max(...controller.angles.map((angle, index) => Math.abs(angle - controller.targetAngles[index]))) < .04)) {
      this.lastResult = { id: action.id, result: action.kind === 'place' ? 'placed' : 'held' };
      this.action = null;
      if (this.pendingCompletion) { this.options.setState({ ...this.options.getState(), complete: true }); this.pendingCompletion = false; }
    }
  }

  lift() {
    const action = this.action;
    if (!this.commitAction()) return;
    this.hands[action.side].attach(this.objects.get(action.id));
    action.liftStart = this.arms[action.side].graspPose().position;
    this.phase('lift');
  }

  applyCrouch(dt) {
    this.crouch += THREE.MathUtils.clamp(this.requestedCrouch - this.crouch, -dt * .5, dt * .5);
    if (this.crouch < .0001) return;
    const model = this.robot.userData.officialModel;
    this.robot.updateMatrixWorld(true);
    const feet = ['left', 'right'].map(side => model.getObjectByName(`${side}_ankle_roll_link`));
    const center = () => feet.reduce((sum, foot) => sum.add(foot.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).multiplyScalar(.5);
    const before = center();
    const knee = this.crouch * 2.7, ankle = -this.crouch * .87;
    for (const side of ['left', 'right']) {
      const set = this.robot.userData.robotProfile.setJointAngle;
      set(model, `${side}_hip_pitch_link`, -knee - ankle);
      set(model, `${side}_knee_link`, knee);
      set(model, `${side}_ankle_pitch_link`, ankle);
    }
    this.robot.userData.robotProfile.setJointAngle(model, 'torso_link', this.crouch * .5);
    this.robot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.crouch * .5));
    this.robot.updateMatrixWorld(true);
    this.robot.position.add(before.sub(center()));
    this.robot.updateMatrixWorld(true);
  }

  frame(dt, running) {
    const step = running ? Math.min(dt, .05) : 0;
    this.applyCrouch(step);
    this.cartAnimation.gait(step);
    if (this.action?.phase === 'align') {
      this.walk.update(step);
      if (this.action?.phase === 'align') this.walk.draw(step);
    }
    for (const arm of Object.values(this.arms)) if (arm.active) arm.apply();
    if (this.action?.kind === 'harvest' && ['prepare', 'approach', 'reach', 'close'].includes(this.action.phase)) {
      const action = this.action;
      const forward = new THREE.Vector3(Math.sin(action.yaw), 0, Math.cos(action.yaw));
      const point = action.stand.clone().addScaledVector(forward, .32).add(new THREE.Vector3(-Math.cos(action.yaw) * .18, 0, Math.sin(action.yaw) * .18));
      point.y = 1.22 - .63 * this.crouch;
      this.arms.right.solve(point, this.targetOrientation(action.yaw), 16);
    }
    this.orangeAnimation.pose();
    if (running) this.animate(step);
    for (const [side, arm] of Object.entries(this.arms)) {
      arm.update(step);
      this.hands[side].update(step, arm.nativePose());
    }
    this.draw();
    this.orangeAnimation.draw();
    const shell = document.querySelector('#game-shell');
    if (shell) shell.dataset.rf15Animation = JSON.stringify(this.snapshot());
  }

  draw() {
    const state = this.options.getState();
    for (const [id, entry] of this.objects) {
      const crop = state.crops[id], item = state.items[id];
      const model = item?.packed ? this.view.items[id] : entry.model;
      entry.model.visible = !item?.packed;
      if (item) this.view.items[id].visible = Boolean(item.packed);
      if (crop?.location === 'basket' && !(this.action?.id === id && this.action.phase === 'settle')) entry.position.copy(this.basketPosition(state.harvested.indexOf(id)));
      model.position.copy(model.parent.worldToLocal(entry.position.clone()));
      model.quaternion.copy(model.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(entry.rotation));
    }
    if (this.view.field.cuttingKnife) this.view.field.cuttingKnife.visible = false;
    for (const model of Object.values(this.view.field.deposited)) model.visible = false;
    if (this.robot.userData.rackPayload) this.robot.userData.rackPayload.visible = false;
  }

  basketPosition(index) {
    return new THREE.Vector3(FIELD.basket.x + (index % 2 - .5) * .28, .045 + Math.floor(index / 4) * .18, FIELD.basket.z + (Math.floor(index / 2) % 2 - .5) * .18);
  }

  cancel() {
    this.walk.reset();
    this.orangeAnimation.cancel();
    if (this.action?.kind === 'cart') this.cartAnimation.cancel();
    if (this.action) this.lastResult = { id: this.action.id, result: 'cancelled' };
    this.action = null; this.requestedCrouch = 0;
    for (const arm of Object.values(this.arms)) arm.targetAngles = [...arm.angles];
    for (const hand of Object.values(this.hands)) if (!hand.held) hand.setGrip(false);
    if (this.pendingCompletion) { this.options.setState({ ...this.options.getState(), complete: true }); this.pendingCompletion = false; }
  }

  reset() {
    this.pendingCompletion = false;
    this.cancel(); this.lastResult = null; this.crouch = 0; this.requestedCrouch = 0;
    this.orangeAnimation.reset();
    for (const hand of Object.values(this.hands)) { hand.detach(); hand.amount = 0; }
    for (const arm of Object.values(this.arms)) arm.active = false;
    for (const entry of this.objects.values()) { entry.position.copy(entry.home); entry.rotation.copy(entry.homeRotation); }
  }

  snapshot() {
    const walking = this.walk.snapshot();
    return { revision: 'f-animation-v5-walking-approach', walking, player: { ...this.options.getState().player }, cart: this.cartAnimation.snapshot(), mode: 'scripted-animation', action: this.action ? { id: this.action.id, phase: this.action.phase, elapsed: this.action.elapsed } : null, lastResult: this.lastResult, crouch: this.crouch, hands: Object.fromEntries(Object.entries(this.hands).map(([side, hand]) => [side, { held: hand.held, closed: hand.closed, position: hand.root.position }])), objects: Object.fromEntries([...this.objects].map(([id, entry]) => [id, { position: entry.position, rotation: entry.rotation }])) };
  }
}
