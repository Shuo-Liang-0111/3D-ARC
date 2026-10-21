import * as THREE from 'three';
import { ORANGE_ID, ORANGE_TASK } from './orange-task.js';
import { orangeSlot } from './orange-scene.js';

const smooth = value => THREE.MathUtils.smoothstep(value, 0, 1);
const vector = point => new THREE.Vector3(point.x, point.y || 0, point.z);
const up = new THREE.Vector3(0, 1, 0);
export class OrangeAnimation {
  constructor(owner) {
    this.owner = owner; this.position = vector(ORANGE_TASK.home); this.carrying = false; this.orangeHeld = false;
  }
  start(selected) {
    const owner = this.owner, state = owner.options.getState(), type = selected.type;
    const station = type === 'orange-pickup' ? 'home' : type.includes('scale') || type === 'orange-add' ? 'scale' : type.includes('pack') ? 'pack' : 'tail';
    const stand = { ...ORANGE_TASK.stands[station] };
    // When the player is already in the station's local envelope, preserve
    // that safe lateral position and only run the short forward/turn settle.
    // This avoids rotating the body diagonally into a table corner just to
    // reach a canonical QA coordinate.
    if (!['home', 'scale'].includes(station) && Math.hypot(state.player.x - stand.x, state.player.z - stand.z) < .20) {
      stand.x = state.player.x; stand.z = state.player.z;
    }
    if (!owner.walk.begin(stand, stand.yaw)) return true;
    this.carrying = state.carriedItem === ORANGE_ID;
    if (!this.carrying) this.position.copy(vector(state.items[ORANGE_ID]));
    owner.action = { id: ORANGE_ID, kind: 'orange', selected, originPlayer: { ...state.player }, phase: 'align', elapsed: 0, phaseTime: 0, target: vector(ORANGE_TASK[station]), station, yaw: stand.yaw };
    owner.lastResult = null; owner.options.stop();
    return true;
  }
  targets(center, yaw = 0, lateral = .245, depth = .12, height = .205) {
    return Object.fromEntries(['left', 'right'].map(side => [side,
      new THREE.Vector3(side === 'left' ? lateral : -lateral, height, depth).applyAxisAngle(up, yaw).add(center)]));
  }
  carryTargets() {
    const player = this.owner.options.getState().player;
    // Keep the basket close to the torso during the walk-back.  A .40 m
    // extension looks dramatic but exceeds the G1 arm reach at the table
    // edge, which made the recovery phase stall even after a valid pickup.
    const center = new THREE.Vector3(player.x, .64, player.z).add(new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).multiplyScalar(.08));
    return this.targets(center, player.yaw);
  }
  moveHands(targets, duration, arc = 0) {
    const owner = this.owner, action = owner.action;
    if (action.handPhase !== action.phase) {
      action.handPhase = action.phase; action.starts = {};
      for (const [side, target] of Object.entries(targets)) {
        owner.arms[side].capture(); action.starts[side] = owner.arms[side].graspPose().position;
        owner.arms[side].plan(target, null);
      }
      action.lastPlan = 0;
    }
    const blend = smooth(action.phaseTime / duration);
    for (const [side, target] of Object.entries(targets)) {
      const point = action.starts[side].clone().lerp(target, blend);
      point.y += Math.sin(blend * Math.PI) * arc;
      owner.arms[side].solve(point, null, 16);
      if (action.phaseTime - action.lastPlan > 1.5) owner.arms[side].plan(target, null);
    }
    if (action.phaseTime - action.lastPlan > 1.5) action.lastPlan = action.phaseTime;
    const reached = action.phaseTime >= duration && Object.entries(targets).every(([side, target]) => owner.arms[side].graspPose().position.distanceTo(target) < .055);
    return reached || action.phaseTime >= duration + 1.15;
  }
  grip(closed) {
    for (const hand of Object.values(this.owner.hands)) {
      hand.setGrip(closed); hand.held = closed ? ORANGE_ID : null; hand.attachment = null;
    }
  }
  phase(name) { this.owner.phase(name); }
  commit() { return this.owner.commitAction(); }
  animate(dt) {
    const owner = this.owner, action = owner.action, type = action.selected.type;
    action.elapsed += dt; action.phaseTime += dt;
    if (action.elapsed > 65) { owner.options.message('动作位置受阻，请换一侧靠近后再试'); owner.cancel(); return; }
    if (action.phase === 'align') {
      if (!owner.walk.ready) return;
      owner.requestedCrouch = type === 'orange-add' || type === 'orange-pack' ? 0 : THREE.MathUtils.clamp((.95 - action.target.y - .205) / .65, 0, .85);
      this.phase('prepare'); return;
    }
    if (action.phase === 'prepare') {
      if (Math.abs(owner.crouch - owner.requestedCrouch) > .01) return;
      this.phase(type === 'orange-add' ? 'source-reach' : type === 'orange-pack' ? 'pack-reach' : 'basket-reach'); return;
    }
    if (action.phase === 'basket-reach') {
      const scaleGrip = action.station === 'scale', homeGrip = action.station === 'home';
      if (!this.moveHands(this.targets(action.target, action.yaw, scaleGrip ? .18 : .245, scaleGrip ? -.30 : homeGrip ? -.17 : .12, scaleGrip ? .16 : .205), 1.15)) return;
      const taking = ['orange-pickup', 'orange-take-scale', 'orange-take-pack'].includes(type);
      this.grip(taking); this.phase(taking ? 'basket-grip' : 'basket-release'); return;
    }
    if (action.phase === 'basket-grip') {
      if (action.phaseTime < .35) return;
      if (!this.commit()) return;
      this.carrying = true; this.phase('basket-lift'); return;
    }
    if (action.phase === 'basket-lift') {
      const scaleGrip = action.station === 'scale', homeGrip = action.station === 'home';
      if (this.moveHands(this.targets(action.target.clone().add(new THREE.Vector3(0, .14, .02)), action.yaw, scaleGrip ? .18 : .245, scaleGrip ? -.30 : homeGrip ? -.17 : .12, scaleGrip ? .16 : .205), .8)) {
        owner.requestedCrouch = 0; this.phase('recover');
      }
      return;
    }
    if (action.phase === 'basket-release') {
      if (action.phaseTime < .35) return;
      this.carrying = false; this.releaseStart = this.position.clone(); this.releaseTarget = action.target.clone();
      if (type !== 'orange-load' && !this.commit()) return;
      this.phase('basket-settle'); return;
    }
    if (action.phase === 'basket-settle') {
      this.position.copy(this.releaseStart).lerp(this.releaseTarget, smooth(action.phaseTime / .45));
      if (action.phaseTime >= .45) { this.position.copy(this.releaseTarget); owner.requestedCrouch = 0; this.phase(action.station === 'scale' ? 'recover' : 'withdraw'); }
      return;
    }
    if (action.phase === 'source-reach') {
      if (!this.moveHands({ left: vector(ORANGE_TASK.source).add(new THREE.Vector3(.12, 0, .14)) }, .8)) return;
      owner.hands.left.setGrip(true); this.phase('source-grip'); return;
    }
    if (action.phase === 'source-grip') {
      if (action.phaseTime < .25) return;
      this.orangeHeld = true; this.phase('fruit-transfer'); return;
    }
    if (action.phase === 'fruit-transfer') {
      const target = vector(ORANGE_TASK.scale).add(new THREE.Vector3(0, .12, .30));
      if (!this.moveHands({ left: target }, .95, .10)) return;
      owner.hands.left.setGrip(false); this.orangeHeld = false;
      action.dropStart = owner.view.orange.moving.position.clone(); this.phase('fruit-settle'); return;
    }
    if (action.phase === 'fruit-settle') {
      if (action.phaseTime < .4) return;
      if (!this.commit()) return;
      this.phase('withdraw'); return;
    }
    if (action.phase === 'pack-reach') {
      if (this.moveHands(this.targets(action.target), .9)) this.phase('pack-fold');
      return;
    }
    if (action.phase === 'pack-fold') {
      const targets = { left: action.target.clone().add(new THREE.Vector3(-.055, .34, .15)), right: action.target.clone().add(new THREE.Vector3(.055, .34, .15)) };
      if (!this.moveHands(targets, 1.1)) return;
      if (!this.commit()) return;
      this.phase('withdraw'); return;
    }
    if (action.phase === 'withdraw') {
      const targets = this.targets(action.target.clone().add(new THREE.Vector3(0, .14, .14)), action.yaw);
      if (action.station === 'scale') {
        owner.requestedCrouch = 0; this.phase('recover'); return;
      }
      if (this.moveHands(targets, .65)) { owner.requestedCrouch = 0; this.phase('recover'); }
      return;
    }
    if (action.phase === 'recover') {
      if (owner.crouch > .001) return;
      const targets = this.carryTargets();
      if (!this.carrying) for (const target of Object.values(targets)) target.y = .75;
      const handsSettled = this.moveHands(targets, .8);
      if (!handsSettled && action.phaseTime < 1.15) return;
      if (type === 'orange-load') { this.phase('truck-lift'); return; }
      this.finish(); return;
    }
    if (action.phase === 'truck-lift' && action.phaseTime >= 4) {
      if (!this.commit()) return;
      this.finish();
    }
  }
  pose() {
    if (!this.carrying || (this.owner.action && this.owner.action.phase !== 'align')) return;
    for (const [side, target] of Object.entries(this.carryTargets())) this.owner.arms[side].solve(target, null, 10);
  }
  draw() {
    const owner = this.owner, station = owner.view.orange;
    if (!station) return;
    const state = owner.options.getState(), item = state.items[ORANGE_ID], action = owner.action?.kind === 'orange' ? owner.action : null;
    if (!item) return;
    station.active = Boolean(action || this.carrying);
    if (this.carrying) {
      const yaw = state.player.yaw - Math.PI;
      const midpoint = owner.arms.left.graspPose().position.clone().add(owner.arms.right.graspPose().position).multiplyScalar(.5);
      const offset = new THREE.Vector3(0, .205, .12).applyAxisAngle(up, yaw);
      if (action?.station === 'scale' && ['basket-reach', 'basket-release', 'basket-lift'].includes(action.phase)) {
        const scaleOffset = new THREE.Vector3(0, .16, -.30).applyAxisAngle(up, action.yaw);
        offset.lerp(scaleOffset, action.phase === 'basket-reach' ? smooth(action.phaseTime / 1.15) : 1);
      }
      this.position.copy(midpoint).sub(offset);
      station.shipment.rotation.y = yaw;
    } else if (!action) {
      this.position.set(item.x, item.y, item.z); station.shipment.rotation.y = 0;
    } else station.shipment.rotation.y = 0;
    if (action?.phase === 'truck-lift') {
      const lift = smooth(action.phaseTime / 2), slide = smooth((action.phaseTime - 2) / 2);
      owner.view.tail.position.y = lift * .88;
      this.position.copy(vector(ORANGE_TASK.tail)); this.position.y += lift * .88;
      this.position.z = THREE.MathUtils.lerp(ORANGE_TASK.tail.z, ORANGE_TASK.truck.z, slide);
    } else if (item.location === 'loaded') owner.view.tail.position.y = .88;
    station.shipment.position.copy(this.position);
    station.moving.visible = this.orangeHeld || action?.phase === 'fruit-settle';
    if (this.orangeHeld) {
      station.moving.position.copy(owner.arms.left.graspPose().position);
      station.moving.quaternion.copy(owner.arms.left.graspPose().rotation);
    }
    if (action?.phase === 'fruit-settle') {
      const destination = vector(ORANGE_TASK.scale).add(orangeSlot(item.orangeCount));
      station.moving.position.copy(action.dropStart).lerp(destination, smooth(action.phaseTime / .4));
    }
    if (this.orangeHeld || action?.phase === 'fruit-settle') station.sourceFruits[item.orangeCount] && (station.sourceFruits[item.orangeCount].visible = false);
  }
  finish() {
    const owner = this.owner, type = owner.action.selected.type;
    owner.lastResult = { id: ORANGE_ID, result: type };
    if (type === 'orange-pickup') {
      const state = owner.options.getState();
      const next = owner.options.runtime.cloneState(state);
      next.player = { ...state.player, yaw: Math.atan2(ORANGE_TASK.stands.scale.x - state.player.x, ORANGE_TASK.stands.scale.z - state.player.z) };
      owner.options.setState(next);
    }
    owner.action = null; owner.requestedCrouch = 0;
    if (owner.pendingCompletion) { owner.options.setState({ ...owner.options.getState(), complete: true }); owner.pendingCompletion = false; }
  }
  cancel() {
    this.orangeHeld = false;
    this.carrying = this.owner.options.getState().carriedItem === ORANGE_ID;
    if (!this.carrying) this.grip(false);
    if (this.owner.view.orange) this.owner.view.orange.moving.visible = false;
  }
  reset() {
    this.carrying = false; this.orangeHeld = false; this.releaseStart = null; this.releaseTarget = null; this.position.copy(vector(ORANGE_TASK.home));
    if (this.owner.view.orange) { this.owner.view.orange.active = false; this.owner.view.orange.moving.visible = false; }
  }
}
