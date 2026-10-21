import * as THREE from "three";
import { approachPath } from "../rf15/interaction-walk.js";
import { shelfPose } from "./series-layout.js";

const up = new THREE.Vector3(0, 1, 0);
const idle = () => ({ move: 0, strafe: 0, turn: 0, drain: false });
const distance = (left, right) => Math.hypot(left.x - right.x, left.z - right.z);
const angle = (target, current) => Math.atan2(Math.sin(target - current), Math.cos(target - current));

export class BookController {
  constructor(owner) {
    this.owner = owner;
    this.robot = owner.robot;
    this.world = owner.world;
    this.options = owner.options;
    this.heldRoot = new THREE.Group();
    this.heldRoot.name = "hand-carried-library-book";
    this.world.scene.add(this.heldRoot);
    for (const [color, model] of Object.entries(this.world.assetRoots.books)) {
      const root = model.clone(true);
      root.name = color;
      root.visible = false;
      this.heldRoot.add(root);
    }
    this.reset();
  }

  reset() {
    this.action = null;
    this.crouch = 0;
    this.bend = 0;
    this.requestedBend = 0;
    this.requestedCrouch = 0;
    this.pendingCompletion = false;
    this.holding = false;
    this.heldRoot.visible = false;
  }

  get busy() { return Boolean(this.action); }
  get active() { return this.busy || Boolean(this.options.getState().carriedBook); }

  standFor(state, point, selected) {
    const candidates = [];
    for (const radius of (point.y < 0.15 ? [0.50] : [0.50, 0.58, 0.66, 0.74, 0.82])) for (let step = 0; step < 32; step += 1) {
      const yaw = step * Math.PI / 16;
      const stand = { x: point.x - Math.sin(yaw) * radius + Math.cos(yaw) * 0.15, z: point.z - Math.cos(yaw) * radius - Math.sin(yaw) * 0.15, yaw };
      if (!this.options.runtime.isWalkable(state, stand.x, stand.z, this.options.runtime.LEVEL.playerRadius + 0.01)) continue;
      if (!this.options.runtime.getInteraction({ ...state, player: stand }, selected)) continue;
      candidates.push({ stand, score: distance(state.player, stand) + radius * 0.25 });
    }
    candidates.sort((left, right) => left.score - right.score);
    for (const candidate of candidates) {
      const path = approachPath(state, candidate.stand, this.options.runtime);
      if (path) return { ...candidate, path };
    }
    return null;
  }

  interact() {
    if (this.action) return true;
    const state = this.options.getState();
    const selected = this.options.runtime.getInteraction(state);
    if (!selected || !["book", "shelf", "drop"].includes(selected.type)) return false;
    const book = state.books[selected.bookId ?? state.carriedBook];
    if (selected.type === "shelf" && selected.color !== book.color) {
      this.options.setState(this.options.runtime.interact(state, selected));
      this.options.message("这本书不属于该书架");
      return true;
    }
    const pose = selected.type === "shelf" ? shelfPose(book.color, book.id) : selected.type === "drop"
      ? { x: state.player.x + Math.sin(state.player.yaw) * 0.6, z: state.player.z + Math.cos(state.player.yaw) * 0.6, y: 0.012 }
      : book;
    const point = new THREE.Vector3(pose.x, pose.y + 0.025, pose.z);
    const approach = selected.type === "drop" ? { stand: { ...state.player }, path: [] } : this.standFor(state, point, selected);
    if (!approach) {
      this.options.message("请从桌边或书本旁的空位靠近");
      return true;
    }
    this.options.stop();
    this.action = { selected, bookId: book.id, point, stand: approach.stand, path: approach.path, index: 0, phase: "align", time: 0, total: 0 };
    this.previous = { ...state.player };
    return true;
  }

  motionInput(state) {
    const action = this.action;
    if (!action || action.phase !== "align") return idle();
    while (action.index < action.path.length && distance(state.player, action.path[action.index]) < 0.025) action.index += 1;
    if (action.index < action.path.length) {
      const point = action.path[action.index];
      const error = angle(Math.atan2(point.x - state.player.x, point.z - state.player.z), state.player.yaw);
      if (Math.abs(error) > 0.06) return { ...idle(), turn: THREE.MathUtils.clamp(error * 3, -0.6, 0.6) };
      return { ...idle(), move: Math.min(0.40, distance(state.player, point) * 3) / this.options.runtime.LEVEL.moveSpeed, drain: true };
    }
    const error = angle(action.stand.yaw, state.player.yaw);
    if (Math.abs(error) > 0.018) return { ...idle(), turn: THREE.MathUtils.clamp(error * 3, -0.6, 0.6) };
    action.ready = true;
    return idle();
  }

  posture(dt) {
    this.crouch += THREE.MathUtils.clamp(this.requestedCrouch - this.crouch, -dt * 0.65, dt * 0.65);
    this.bend += THREE.MathUtils.clamp(this.requestedBend - this.bend, -dt * 0.85, dt * 0.85);
    const model = this.robot.userData.officialModel;
    if (!model) return;
    const feet = ["left", "right"].map(side => model.getObjectByName(side + "_ankle_roll_link"));
    const center = () => feet.reduce((sum, foot) => sum.add(foot.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).multiplyScalar(0.5);
    this.robot.updateMatrixWorld(true);
    const before = center();
    const set = this.robot.userData.robotProfile.setJointAngle;
    if (this.crouch > 0.001) {
      const knee = this.crouch * 2.7, ankle = -this.crouch * 0.87;
      for (const side of ["left", "right"]) {
        set(model, side + "_hip_pitch_link", -knee - ankle);
        set(model, side + "_knee_link", knee);
        set(model, side + "_ankle_pitch_link", ankle);
      }
    }
    const ground = this.action?.point.y < 0.15;
    const extended = this.action && distance(this.action.stand, this.action.point) > 0.72;
    this.robot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.bend * (ground || extended ? 0.5 : 0.25)));
    set(model, "torso_link", 0.25 + this.bend * (ground ? 0.85 : this.action?.point.y > 1.1 ? 0.25 : 0.55));
    this.robot.updateMatrixWorld(true);
    if (this.bend > 0.001 || this.crouch > 0.001) this.robot.position.add(before.sub(center()));
    this.robot.updateMatrixWorld(true);
  }

  holdPoint() {
    return this.robot.localToWorld(new THREE.Vector3(-0.18, 0.96, 0.30));
  }

  phase(value) {
    this.action.phase = value;
    this.action.time = 0;
  }

  commit() {
    const before = this.options.getState();
    const next = this.options.runtime.interact(before, this.action.selected);
    if (next.complete) {
      next.complete = false;
      next.settling = true;
      this.pendingCompletion = true;
    }
    this.options.setState(next);
    this.options.message(this.options.runtime.eventMessages[next.lastEvent] ?? "");
    return next;
  }

  recover() {
    this.requestedCrouch = 0;
    this.requestedBend = 0;
    this.phase("recover");
    if (!this.options.getState().carriedBook) {
      for (const [side, arm] of Object.entries(this.owner.arms)) if (this.action.rest?.[side]) arm.targetAngles = [...this.action.rest[side]];
    }
  }

  cancel() {
    if (!this.action) return;
    this.options.stop();
    this.recover();
  }

  frame(delta, running) {
    const dt = running ? Math.min(0.05, Math.max(0, delta)) : 0;
    const state = this.options.getState(), action = this.action, arm = this.owner.arms.right;
    this.robot.userData.rackPayload.visible = false;
    if (!arm) return;
    if (action?.phase === "align") {
      const moved = distance(state.player, this.previous), turned = Math.abs(angle(state.player.yaw, this.previous.yaw));
      this.owner.drawWalking(dt, moved, turned);
      this.previous = { ...state.player };
    }
    this.posture(dt);
    for (const controller of Object.values(this.owner.arms)) if (controller.active) controller.apply();
    if (action && dt > 0) {
      action.time += dt;
      action.total += dt;
      if (action.total > 45 && action.phase !== "recover") {
        this.options.message("取放动作受阻，请换个空位重试");
        this.recover();
      }
      if (action.phase === "align" && action.ready) {
        action.rest = {};
        for (const [side, controller] of Object.entries(this.owner.arms)) {
          controller.capture();
          action.rest[side] = [...controller.angles];
        }
        this.requestedCrouch = action.point.y < 0.15 ? 1 : action.point.y < 0.9 ? 0.12 : 0;
        this.requestedBend = 1;
        this.phase("prepare");
      } else if (action.phase === "prepare" && Math.abs(this.crouch - this.requestedCrouch) < 0.01 && this.bend > 0.99) {
        action.error = arm.plan(action.point, null);
        this.phase("reach");
      } else if (action.phase === "reach") {
        if (action.time > 1.2 && arm.graspPose().position.distanceTo(action.point) < 0.065) {
          const next = this.commit();
          this.holding = Boolean(next.carriedBook);
          this.requestedCrouch = 0;
          this.requestedBend = 0;
          if (next.carriedBook) this.phase("lift");
          else this.recover();
        } else if (action.time > 3 && action.time - (action.lastPlan ?? 0) > 2) {
          action.error = arm.plan(action.point, null);
          action.lastPlan = action.time;
        }
      } else if (action.phase === "lift") {
        arm.solve(this.holdPoint(), null, 12);
        if (this.crouch < 0.01 && this.bend < 0.01 && action.time > 1.4) {
          arm.plan(this.holdPoint(), null);
          this.phase("hold");
        }
      } else if (action.phase === "hold" && arm.graspPose().position.distanceTo(this.holdPoint()) < 0.06) {
        this.action = null;
      } else if (action.phase === "recover" && this.crouch < 0.01 && this.bend < 0.01 && action.time > 1.2) {
        if (this.options.getState().carriedBook) arm.plan(this.holdPoint(), null);
        else for (const controller of Object.values(this.owner.arms)) controller.active = false;
        this.action = null;
        this.holding = false;
        if (this.pendingCompletion) {
          this.options.setState({ ...this.options.getState(), settling: false, complete: true });
          this.pendingCompletion = false;
        }
      }
    }
    for (const controller of Object.values(this.owner.arms)) if (controller.active) {
      controller.update(dt);
      controller.apply();
    }
    const bookId = this.options.getState().carriedBook;
    this.heldRoot.visible = Boolean(bookId);
    if (bookId) {
      const book = this.options.getState().books[bookId];
      for (const root of this.heldRoot.children) root.visible = root.name === book.color;
      this.heldRoot.position.copy(arm.graspPose().position).add(new THREE.Vector3(0, 0.015, 0));
      this.heldRoot.quaternion.setFromAxisAngle(up, this.options.getState().player.yaw);
      this.robot.userData.robotProfile?.setGrip?.(this.robot.userData.officialModel, 0.55);
    }
  }

  snapshot() {
    return { phase: this.action?.phase ?? (this.options.getState().carriedBook ? "holding" : "idle"), book: this.options.getState().carriedBook, target: this.action?.point.toArray(), stand: this.action?.stand, player: this.options.getState().player, root: this.robot.position.toArray(), error: this.action?.error, hand: this.owner.arms.right?.graspPose().position.toArray(), bookPosition: this.heldRoot.position.toArray() };
  }
}
