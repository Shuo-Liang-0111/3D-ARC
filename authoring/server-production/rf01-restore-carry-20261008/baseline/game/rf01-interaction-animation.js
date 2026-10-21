import * as THREE from "three";
import { BrowserArmScript } from "./levels/rf15/browser-arm-script.js";
import { InteractionWalk, approachPath } from "./levels/rf15/interaction-walk.js";
import { SORTING } from "./rf01-sorting-layout.js";

const up = new THREE.Vector3(0, 1, 0);
const idle = () => ({ move: 0, strafe: 0, turn: 0, drain: false });
const smooth = t => THREE.MathUtils.smoothstep(t, 0, 1);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const supported = new Set(["battery", "slot", "drop", "parcel", "sort-parcel", "drop-parcel"]);

export function createInteractionAnimation(world, robot, options) {
  // The existing G1 skeleton and the shared movement/collision contract are retained.
  if (robot.userData.robotId !== "g1") return null;
  return new RF01InteractionAnimation(world, robot, options);
}

export class RF01InteractionAnimation {
  constructor(world, robot, options) {
    this.world = world; this.robot = robot; this.options = options;
    this.arms = ["left", "right"].map(side => new BrowserArmScript(robot, side));
    this.walk = new InteractionWalk(this);
    this.entries = new Map();
    for (const [id, model] of [["battery", world.battery], ...Object.entries(world.sorting.parcels).map(([type, model]) => ["parcel-" + type, model])]) {
      const copy = model.clone(true); copy.position.set(0, 0, 0); copy.rotation.set(0, 0, 0);
      copy.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(copy);
      this.entries.set(id, { id, model, center: bounds.getCenter(new THREE.Vector3()), size: bounds.getSize(new THREE.Vector3()) });
    }
    robot.userData.rf01InteractionAnimation = this;
    world.rf01InteractionAnimation = this;
    this.reset();
  }
  get busy() { return Boolean(this.action); }
  reset() {
    this.action = null; this.held = null; this.crouch = 0; this.bend = 0;
    this.walk.reset(); this.contacts = []; this.lastResult = null;
    for (const arm of this.arms) arm.active = false;
  }
  cancel() {
    if (!this.action) return;
    this.action.cancelled = true; this.phase("recover");
  }
  phase(name) { this.action.phase = name; this.action.time = 0; }
  pose(entry) {
    entry.model.updateWorldMatrix(true, false);
    return { center: entry.model.localToWorld(entry.center.clone()), rotation: entry.model.getWorldQuaternion(new THREE.Quaternion()) };
  }
  carryCenter() { return this.robot.localToWorld(new THREE.Vector3(0, 1.00, .28)); }
  grips(entry, center, rotation, yaw) {
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const inverse = rotation.clone().invert();
    const localRight = right.clone().applyQuaternion(inverse);
    const localForward = forward.clone().applyQuaternion(inverse);
    const half = entry.size.clone().multiplyScalar(.5);
    const width = Math.abs(localRight.x) * half.x + Math.abs(localRight.z) * half.z;
    const depth = Math.abs(localForward.x) * half.x + Math.abs(localForward.z) * half.z;
    // Palms touch the two side faces near the front edge, not an invisible rack.
    const middle = center.clone().addScaledVector(forward, -depth * .6);
    return [1, -1].map(side => middle.clone().addScaledVector(right, side * (width + .008)));
  }
  placePose(entry, selected, state, next) {
    const item = entry.id === "battery" ? next.battery : next.parcels[entry.id.slice(7)];
    const y = entry.id === "battery" ? (item.location === "slotted" ? .38 : 0)
      : item.location === "sorted" ? SORTING.bins[item.type].floor : .045;
    const rotation = new THREE.Quaternion().setFromAxisAngle(up, entry.id === "battery" && item.location === "slotted" ? Math.PI : 0);
    return { center: entry.center.clone().applyQuaternion(rotation).add(new THREE.Vector3(item.x, y, item.z)), rotation };
  }
  standFor(state, center, belt, fixedYaw = null) {
    const runtime = this.options.runtime, choices = [];
    const radii = belt ? [.85, .90, .96] : [.5, .6, .7, .82, .94, .98, 1.05, 1.1, 1.15, 1.45, 1.5];
    for (const radius of radii) for (let i = 0; i < (belt || fixedYaw !== null ? 1 : 24); i++) {
      const yaw = belt ? Math.PI : fixedYaw ?? i * Math.PI / 12;
      const stand = { x: center.x - Math.sin(yaw) * radius, z: center.z - Math.cos(yaw) * radius, yaw };
      if (distance(state.player, stand) > 1.8) continue;
      if (runtime.isWalkable({ ...state, player: { ...state.player, yaw } }, stand.x, stand.z) && approachPath(state, stand, runtime)) {
        choices.push({ stand, score: distance(state.player, stand) * .35 + radius * 3 });
      }
    }
    return choices.sort((a, b) => a.score - b.score)[0]?.stand;
  }
  interact() {
    if (this.busy) return true;
    const state = this.options.getState(), runtime = this.options.runtime;
    const selected = runtime.getInteraction(state);
    if (!selected || !supported.has(selected.type)) return false;
    const pickup = selected.type === "battery" || selected.type === "parcel";
    const id = selected.type === "battery" ? "battery" : selected.type === "parcel" ? "parcel-" + selected.parcelType
      : state.battery.location === "carried" ? "battery" : state.carriedItem;
    const entry = this.entries.get(id);
    if (!entry) return false;
    // Check the authoritative action before starting; errors retain existing behavior.
    const proposed = runtime.interact(state);
    const success = pickup ? (id === "battery" ? proposed.battery.location === "carried" : proposed.carriedItem === id)
      : id === "battery" ? proposed.battery.location !== "carried" : proposed.carriedItem !== id;
    if (!success) return false;
    const belt = pickup && selected.target?.location === "conveyor";
    const destination = pickup ? this.pose(entry) : this.placePose(entry, selected, state, proposed);
    if (belt) destination.center.x = THREE.MathUtils.clamp(state.player.x, .05, 1.5);
    const stand = ["drop", "drop-parcel"].includes(selected.type) ? { ...state.player }
      : this.standFor(state, destination.center, belt, selected.type === "sort-parcel" ? 0 : null);
    if (!stand) { this.options.message("请从物体前方靠近"); return true; }
    this.options.stop();
    this.action = { id, entry, selected, pickup, belt, destination, stand, phase: "align", time: 0, total: 0, committed: false };
    if (!this.walk.begin(stand, stand.yaw)) this.action = null;
    return true;
  }
  motionInput(state) { return this.action?.phase === "align" ? this.walk.input(state) : this.action ? idle() : null; }
  posture(dt, crouch, bend) {
    this.crouch += THREE.MathUtils.clamp(crouch - this.crouch, -dt * .8, dt * .8);
    this.bend += THREE.MathUtils.clamp(bend - this.bend, -dt * .9, dt * .9);
    const model = this.robot.userData.officialModel, set = this.robot.userData.robotProfile.setJointAngle;
    const feet = ["left", "right"].map(side => model.getObjectByName(side + "_ankle_roll_link"));
    const center = () => feet.reduce((sum, foot) => sum.add(foot.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).multiplyScalar(.5);
    this.robot.updateMatrixWorld(true); const before = center();
    for (const side of ["left", "right"]) {
      const knee = this.crouch * 2.3, ankle = -this.crouch * .75;
      set(model, side + "_hip_pitch_link", -knee - ankle);
      set(model, side + "_knee_link", knee); set(model, side + "_ankle_pitch_link", ankle - this.bend * .4);
    }
    this.robot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.bend * .4));
    set(model, "torso_link", this.bend * .5);
    this.robot.updateMatrixWorld(true); this.robot.position.add(before.sub(center())); this.robot.updateMatrixWorld(true);
  }
  solve(points, dt, initial = false) {
    this.arms.forEach((arm, index) => {
      if (!arm.active) arm.capture();
      if (initial) arm.plan(points[index]); else arm.solve(points[index], null, 5);
      arm.update(dt * 2.3); arm.apply();
    });
    return Math.max(...this.arms.map((arm, i) => arm.graspPose().position.distanceTo(points[i])));
  }
  showHeld(entry, desiredCenter, rotation, points) {
    const palms = this.arms.map(arm => arm.graspPose().position);
    const desiredMid = points[0].clone().add(points[1]).multiplyScalar(.5);
    const actualMid = palms[0].clone().add(palms[1]).multiplyScalar(.5);
    const center = desiredCenter.clone().add(actualMid.sub(desiredMid));
    entry.model.position.copy(center).sub(entry.center.clone().applyQuaternion(rotation));
    entry.model.quaternion.copy(rotation); entry.model.visible = true;
    this.robot.userData.rackPayload.visible = false;
    const relative = new THREE.Quaternion().setFromAxisAngle(up, -this.options.getState().player.yaw).multiply(rotation);
    this.held = { entry, center, rotation: rotation.clone(), relative };
  }
  commit() {
    const a = this.action, state = this.options.getState(), runtime = this.options.runtime;
    const selected = runtime.getInteraction(state);
    if (selected?.type !== a.selected.type || (a.pickup && a.id.startsWith("parcel-") && selected.parcelType !== a.selected.parcelType)) return false;
    const next = runtime.interact(state);
    const success = a.pickup ? (a.id === "battery" ? next.battery.location === "carried" : next.carriedItem === a.id)
      : a.id === "battery" ? next.battery.location !== "carried" : next.carriedItem !== a.id;
    if (!success) return false;
    if (next.complete) { a.completion = true; next.complete = false; next.cargoActionPending = true; }
    this.options.setState(next); a.committed = true;
    this.lastResult = { id: a.id, event: next.lastEvent, contactErrors: [...a.errors] };
    this.contacts.push(this.lastResult);
    return true;
  }
  frame(delta, running) {
    const dt = running ? Math.min(.05, Math.max(0, delta)) : 0;
    const state = this.options.getState(), a = this.action;
    const heldId = state.battery.location === "carried" ? "battery" : state.carriedItem;
    if (state.failed) { this.reset(); return; }
    if (!a && !this.held) return;
    this.robot.userData.rackPayload.visible = false;
    if (a?.phase === "align") { this.walk.update(dt); this.walk.draw(dt); }
    const reaching = a && ["prepare", "reach", "wait", "close", "release"].includes(a.phase);
    const y = a?.destination.center.y ?? 1;
    if (a?.phase !== "align") this.posture(dt, reaching ? THREE.MathUtils.clamp((.5 - y) * 1.6, 0, 1) : 0, reaching ? (y < .3 ? 2.0 : y < .8 ? 1.65 : 1.05) : 0);
    for (const arm of this.arms) if (arm.active) arm.apply();
    if (a && dt) {
      a.time += dt; a.total += dt;
      if (a.total > 28 && a.phase !== "recover") { this.options.message("取放位置受阻，请靠近后重试"); this.cancel(); }
      if (a.phase === "align" && this.walk.ready) {
        for (const arm of this.arms) arm.capture();
        a.rest = this.arms.map(arm => [...arm.angles]); this.phase("prepare");
      } else if (a.phase === "prepare" && a.time > 1.15) {
        a.starts = this.arms.map(arm => arm.graspPose().position);
        a.rotationStart = this.held?.rotation.clone();
        this.phase("reach");
      }
      if (["reach", "wait", "close", "release"].includes(a.phase)) {
        let destination = a.destination;
        if (a.belt && a.phase === "close") destination = this.pose(a.entry);
        const t = a.phase === "reach" ? smooth(a.time / 1.3) : 1;
        if (!a.pickup && a.rotationStart) destination = { ...destination, rotation: a.rotationStart.clone().slerp(a.destination.rotation, t) };
        const points = this.grips(a.entry, destination.center, destination.rotation, a.stand.yaw);
        const targets = points.map((p, i) => a.starts[i].clone().lerp(p, t));
        const replan = a.phase === "reach" && a.time > 2 && a.time - (a.lastPlan ?? 0) > 2;
        if (replan) a.lastPlan = a.time;
        const error = this.solve(targets, dt, replan || (a.phase === "reach" && a.time <= dt * 1.1));
        a.errors = this.arms.map((arm, i) => arm.graspPose().position.distanceTo(points[i]));
        if (!a.pickup && this.held) this.showHeld(a.entry, destination.center, destination.rotation, points);
        if (a.phase === "reach" && a.time >= 1.3 && error < .045) this.phase(a.belt ? "wait" : a.pickup ? "close" : "release");
        if (a.phase === "wait") {
          const parcel = state.parcels[a.selected.parcelType];
          if (parcel.onBelt && Math.abs(parcel.x - a.destination.center.x) < .018) {
            const actual = this.pose(a.entry), contact = this.grips(a.entry, actual.center, actual.rotation, a.stand.yaw);
            a.errors = this.arms.map((arm, i) => arm.graspPose().position.distanceTo(contact[i]));
            if (Math.max(...a.errors) < .035 && this.commit()) {
              a.destination = actual; this.held = { entry: a.entry, ...actual }; this.phase("grip");
            }
          }
        } else if (a.phase === "close" && a.time > .28 && Math.max(...a.errors) < .045) {
          if (this.commit()) { this.held = { entry: a.entry, ...destination }; this.phase("grip"); }
          else this.cancel();
        } else if (a.phase === "release" && a.time > .35 && Math.max(...a.errors) < .045) {
          if (this.commit()) {
            a.entry.model.position.copy(a.destination.center).sub(a.entry.center.clone().applyQuaternion(a.destination.rotation));
            a.entry.model.quaternion.copy(a.destination.rotation); a.entry.model.visible = true;
            this.held = null; this.phase("recover");
          } else this.cancel();
        }
      } else if (a.phase === "grip") {
        const points = this.grips(a.entry, a.destination.center, a.destination.rotation, a.stand.yaw);
        this.solve(points, dt); this.showHeld(a.entry, a.destination.center, a.destination.rotation, points);
        if (a.time > .3) { a.liftStart = this.held.center.clone(); a.liftRotation = this.held.rotation.clone(); this.phase("lift"); }
      } else if (a.phase === "lift") {
        const t = smooth(a.time / 1.8), center = a.liftStart.clone().lerp(this.carryCenter(), t);
        const rotation = a.liftRotation.clone();
        const points = this.grips(a.entry, center, rotation, state.player.yaw);
        const replan = a.time > 2 && a.time - (a.lastLiftPlan ?? 0) > 2;
        if (replan) a.lastLiftPlan = a.time;
        const error = this.solve(points, dt, replan); this.showHeld(a.entry, center, rotation, points);
        if (a.time > 1.8 && error < .05 && this.crouch < .01 && this.bend < .01) this.action = null;
      } else if (a.phase === "recover") {
        if (!heldId && a.rest) this.arms.forEach((arm, i) => { arm.targetAngles = a.rest[i]; arm.update(dt * 2); });
        if (a.time > 1.6 && this.crouch < .01 && this.bend < .01) {
          if (a.completion) this.options.setState({ ...this.options.getState(), complete: true, cargoActionPending: false });
          this.action = null;
          if (!heldId) for (const arm of this.arms) arm.active = false;
        }
      }
    }
    if (this.held && (!this.action || ["align", "prepare", "recover"].includes(this.action.phase))) {
      const center = this.carryCenter(), rotation = new THREE.Quaternion().setFromAxisAngle(up, state.player.yaw).multiply(this.held.relative ?? new THREE.Quaternion());
      const points = this.grips(this.held.entry, center, rotation, state.player.yaw);
      this.solve(points, dt); this.showHeld(this.held.entry, center, rotation, points);
    }
    this.robot.userData.robotProfile.setGrip(this.robot.userData.officialModel, this.held ? .62 : .12);
  }
  snapshot() {
    return { phase: this.action?.phase ?? "idle", selected: this.action?.id, errors: this.action?.errors, held: this.held?.entry.id, contacts: this.contacts, walk: this.walk.snapshot(), crouch: this.crouch, bend: this.bend };
  }
}
