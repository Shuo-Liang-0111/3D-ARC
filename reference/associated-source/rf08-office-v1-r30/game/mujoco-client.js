import * as THREE from "three";

const BUFFER_DELAY_MS = 50;
const MAX_BUFFER_SIZE = 8;
const JOINT_ROLL_AXIS = new THREE.Vector3(0, 0, -1);
const JOINT_YAW_AXIS = new THREE.Vector3(0, -1, 0);
const BASE_YAW_AXIS = new THREE.Vector3(0, 1, 0);
const PITCH_AXIS = new THREE.Vector3(1, 0, 0);
const FORWARD_AXIS = new THREE.Vector3(0, 0, 1);
const MAX_BASE_HEIGHT_DELTA = 0.2;
export const MUJOCO_CONTROL_MODES = Object.freeze({
  velocity: "velocity_policy",
  joint: "joint_position",
});
export const G1_29DOF_JOINT_ORDER = "g1_29dof_policy_v1";
export const G1_MUJOCO_VELOCITY_LIMITS = Object.freeze({
  forward: 1.0,
  backward: 0.5,
  lateral: 0.3,
  yaw: 0.6,
});

export function scaleMujocoVelocityForFrontend(input = {}, level = {}) {
  const moveSpeed = Math.max(Math.abs(Number(level.moveSpeed) || 0), Number.EPSILON);
  const turnSpeed = Math.max(Math.abs(Number(level.turnSpeed) || 0), Number.EPSILON);
  const move = Number.isFinite(input.move) ? input.move : 0;
  const strafe = Number.isFinite(input.strafe) ? input.strafe : 0;
  const turn = Number.isFinite(input.turn) ? input.turn : 0;
  const targetForwardSpeed = move >= 0
    ? G1_MUJOCO_VELOCITY_LIMITS.forward
    : G1_MUJOCO_VELOCITY_LIMITS.backward;
  return {
    ...input,
    move: move * targetForwardSpeed / moveSpeed,
    strafe: strafe * G1_MUJOCO_VELOCITY_LIMITS.lateral / moveSpeed,
    turn: turn * G1_MUJOCO_VELOCITY_LIMITS.yaw / turnSpeed,
  };
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function projectMujocoDeltaToFrontendInput(previous, current, level, delta, input = {}) {
  if (!previous || !current || !Array.isArray(previous.position) || !Array.isArray(current.position) || delta <= 0) return null;
  if (previous.position.length < 3 || current.position.length < 3) return null;
  const moveSpeed = Math.max(Math.abs(Number(level?.moveSpeed) || 0), Number.EPSILON);
  const turnSpeed = Math.max(Math.abs(Number(level?.turnSpeed) || 0), Number.EPSILON);
  const yaw = Number.isFinite(current.yaw) ? current.yaw : previous.yaw;
  const previousYaw = Number.isFinite(previous.yaw) ? previous.yaw : yaw;
  const dx = current.position[0] - previous.position[0];
  const dz = current.position[2] - previous.position[2];
  return {
    ...input,
    move: (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / (moveSpeed * delta),
    strafe: (Math.cos(yaw) * dx - Math.sin(yaw) * dz) / (moveSpeed * delta),
    turn: normalizeAngle(yaw - previousYaw) / (turnSpeed * delta),
    drain: Boolean(input.move || input.strafe),
  };
}

export class MujocoStateBuffer {
  constructor(delayMs = BUFFER_DELAY_MS) {
    this.delayMs = delayMs;
    this.states = [];
  }

  push(state, receivedAt = performance.now()) {
    if (!state?.base?.position || !state.base.quaternion) return;
    this.states.push({ state, receivedAt });
    if (this.states.length > MAX_BUFFER_SIZE) this.states.splice(0, this.states.length - MAX_BUFFER_SIZE);
  }

  sample(now = performance.now()) {
    if (!this.states.length) return null;
    const target = now - this.delayMs;
    while (this.states.length > 2 && this.states[1].receivedAt <= target) this.states.shift();
    if (this.states.length === 1 || this.states[0].receivedAt >= target) return this.states[0].state;
    const before = this.states[0];
    const after = this.states[1];
    const alpha = THREE.MathUtils.clamp((target - before.receivedAt) / Math.max(1, after.receivedAt - before.receivedAt), 0, 1);
    const position = before.state.base.position.map((value, index) => THREE.MathUtils.lerp(value, after.state.base.position[index], alpha));
    const quaternion = new THREE.Quaternion(...before.state.base.quaternion).slerp(new THREE.Quaternion(...after.state.base.quaternion), alpha);
    return { ...after.state, base: { ...after.state.base, position, quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] } };
  }
}

export class MujocoClient {
  constructor({ url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/mujoco/ws`, onState = () => {}, onStatus = () => {} } = {}) {
    this.url = url;
    this.onState = onState;
    this.onStatus = onStatus;
    this.buffer = new MujocoStateBuffer();
    this.socket = null;
    this.pendingMessages = [];
    this.sequence = 0;
    this.reconnectTimer = null;
    this.closed = false;
    this.status = "offline";
    this.controlMode = MUJOCO_CONTROL_MODES.velocity;
  }

  connect() {
    if (this.closed || this.socket) return;
    this.setStatus("connecting");
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.setStatus("online");
      socket.send(JSON.stringify({ type: "control_mode", mode: this.controlMode }));
      this.pendingMessages.splice(0).forEach((message) => socket.send(message));
    });
    socket.addEventListener("message", (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === "state") {
        this.buffer.push(message);
        this.onState(message);
      }
    });
    socket.addEventListener("error", () => this.setStatus("error"));
    socket.addEventListener("close", () => {
      if (this.socket === socket) this.socket = null;
      if (!this.closed) {
        this.setStatus("offline");
        this.reconnectTimer = window.setTimeout(() => { this.reconnectTimer = null; this.connect(); }, 1000);
      }
    });
  }

  setCommand(velocity, level, spawn) {
    this.send({ type: "command", sequence: ++this.sequence, level, spawn, velocity });
  }

  setControlMode(mode) {
    const normalizedMode = MUJOCO_CONTROL_MODES[mode] ?? mode;
    if (!Object.values(MUJOCO_CONTROL_MODES).includes(normalizedMode)) {
      throw new Error(`Unsupported MuJoCo control mode: ${mode}`);
    }
    this.controlMode = normalizedMode;
    this.send({ type: "control_mode", mode: normalizedMode });
  }

  setJointTargets(targets, durationMs = 100) {
    if (this.controlMode !== MUJOCO_CONTROL_MODES.joint) {
      throw new Error("Joint targets require joint_position mode");
    }
    if (!Array.isArray(targets) && !ArrayBuffer.isView(targets)) {
      throw new TypeError("Joint targets must be an array or typed array");
    }
    const normalizedTargets = Array.from(targets, Number);
    if (normalizedTargets.length !== 29 || !normalizedTargets.every(Number.isFinite)) {
      throw new TypeError("Joint targets must contain exactly 29 finite numbers");
    }
    const normalizedDuration = Number(durationMs);
    if (!Number.isFinite(normalizedDuration) || normalizedDuration < 0) {
      throw new TypeError("Joint command duration must be finite and non-negative");
    }
    this.send({
      type: "joint_command",
      sequence: ++this.sequence,
      jointOrder: G1_29DOF_JOINT_ORDER,
      targets: normalizedTargets,
      durationMs: normalizedDuration,
    });
  }

  reset(spawn) {
    this.buffer.states.length = 0;
    this.send({ type: "reset", spawn, level: new URLSearchParams(location.search).get("level") });
  }
  stop() { this.send({ type: "stop" }); }
  sample(now) { return this.buffer.sample(now); }

  send(message) {
    const serialized = JSON.stringify(message);
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(serialized);
    else if (!this.closed) {
      this.pendingMessages.push(serialized);
      if (this.pendingMessages.length > 8) this.pendingMessages.shift();
    }
  }

  setStatus(status) {
    this.status = status;
    this.onStatus(status);
  }

  close() {
    this.closed = true;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
    this.setStatus("offline");
  }
}

export function applyMujocoState(robot, state, profile = robot?.userData?.robotProfile, options = {}) {
  if (!robot || !state?.base) return false;
  const [x, y, z] = state.base.position;
  const baseQuaternion = new THREE.Quaternion(...state.base.quaternion).normalize();
  const forward = FORWARD_AXIS.clone().applyQuaternion(baseQuaternion);
  const yaw = Number.isFinite(state.base.yaw) ? state.base.yaw : Math.atan2(forward.x, forward.z);
  const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(BASE_YAW_AXIS, yaw);
  const sequence = Number(state.sequence);
  let projection = robot.userData.mujocoBaseProjection;
  if (!projection || (Number.isFinite(sequence) && Number.isFinite(projection.sequence) && sequence < projection.sequence)) {
    projection = { height: y, sequence };
    robot.userData.mujocoBaseProjection = projection;
  } else if (Number.isFinite(sequence)) {
    projection.sequence = sequence;
  }
  const heightDelta = THREE.MathUtils.clamp(y - projection.height, -MAX_BASE_HEIGHT_DELTA, MAX_BASE_HEIGHT_DELTA);
  const projectedY = (Number.isFinite(options.groundY) ? options.groundY : projection.height) + heightDelta;
  if (options.projectWorldPose === false) {
    robot.position.y = projectedY;
  } else {
    robot.position.set(x, projectedY, z);
    robot.quaternion.copy(yawQuaternion);
  }
  const model = robot.userData?.officialModel;
  if (!model || profile?.id !== "g1") return true;
  const official = model.children[0];
  const pelvis = official?.getObjectByName("pelvis");
  const pelvisRest = model.userData?.restPose?.get("pelvis");
  if (pelvis && pelvisRest) {
    const tiltQuaternion = yawQuaternion.clone().invert().multiply(baseQuaternion);
    const mirroredTiltQuaternion = new THREE.Quaternion(
      tiltQuaternion.x,
      -tiltQuaternion.y,
      -tiltQuaternion.z,
      tiltQuaternion.w,
    );
    pelvis.quaternion.copy(pelvisRest).multiply(mirroredTiltQuaternion);
  }
  const positions = state.joints?.positions ?? [];
  const names = state.joints?.names ?? [];
  for (let index = 0; index < Math.min(names.length, positions.length); index += 1) {
    const linkName = names[index].replace(/_joint$/, "_link");
    const axis = linkName.includes("_roll_") || linkName.endsWith("_roll_link")
      ? JOINT_ROLL_AXIS
      : linkName.includes("_yaw_") || linkName.endsWith("_yaw_link")
        ? JOINT_YAW_AXIS
        : PITCH_AXIS;
    profile.setJointAngle(model, linkName, positions[index], axis);
  }
  if (Number.isFinite(options.lookPitch)) {
    profile.setJointAngle(model, "runtime_head_pitch_link", -options.lookPitch);
  }
  model.userData.collisionRig?.sync({ step: model.userData.collisionRig.ownsWorld });
  return true;
}
