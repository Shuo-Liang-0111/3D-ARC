import * as THREE from 'three';

export const NATIVE_TO_MODEL = new THREE.Matrix4().set(0, -1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1);
const names = ['shoulder_pitch', 'shoulder_roll', 'shoulder_yaw', 'elbow', 'wrist_roll', 'wrist_pitch', 'wrist_yaw'];
const axes = names.map(name => new THREE.Vector3(...(name.includes('roll') ? [0, 0, -1] : name.includes('yaw') ? [0, -1, 0] : [1, 0, 0])));
const limits = [[-2.8, .5], [-1.8, 1], [-2, 2], [-1.04, 2], [-1.97, 1.97], [-1.61, 1.61], [-1.61, 1.61]];

function solveLinear(matrix, values) {
  const system = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < values.length; column++) {
    let pivot = column;
    for (let row = column + 1; row < values.length; row++) if (Math.abs(system[row][column]) > Math.abs(system[pivot][column])) pivot = row;
    [system[column], system[pivot]] = [system[pivot], system[column]];
    const divisor = system[column][column];
    if (Math.abs(divisor) < 1e-12) return values.map(() => 0);
    for (let index = column; index <= values.length; index++) system[column][index] /= divisor;
    for (let row = 0; row < values.length; row++) if (row !== column) {
      const factor = system[row][column];
      for (let index = column; index <= values.length; index++) system[row][index] -= factor * system[column][index];
    }
  }
  return system.map(row => row[values.length]);
}

export class BrowserArmScript {
  constructor(robot, side) {
    this.robot = robot;
    this.model = robot.userData.officialModel;
    this.side = side;
    this.joints = names.map(name => this.model.getObjectByName(`${side}_${name}_link`));
    this.rest = this.joints.map(joint => this.model.userData.restPose.get(joint.name).clone());
    this.angles = this.joints.map(() => 0);
    this.targetAngles = [...this.angles];
    this.active = false;
    this.wrist = this.joints.at(-1);
  }

  capture(preserveTarget = false) {
    this.angles = this.joints.map((joint, index) => {
      const delta = this.rest[index].clone().invert().multiply(joint.quaternion);
      return 2 * Math.atan2(new THREE.Vector3(delta.x, delta.y, delta.z).dot(axes[index]), delta.w);
    });
    if (!preserveTarget) this.targetAngles = [...this.angles];
    this.active = true;
  }

  apply(angles = this.angles) {
    this.joints.forEach((joint, index) => joint.quaternion.copy(this.rest[index]).multiply(new THREE.Quaternion().setFromAxisAngle(axes[index], angles[index])));
    this.robot.updateMatrixWorld(true);
  }

  nativePose() {
    this.wrist.updateWorldMatrix(true, false);
    const matrix = this.wrist.matrixWorld.clone().multiply(NATIVE_TO_MODEL);
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    matrix.decompose(position, rotation, new THREE.Vector3());
    return { position, rotation };
  }

  graspPose() {
    const { position, rotation } = this.nativePose();
    return { position: new THREE.Vector3(.14, this.side === 'right' ? .04 : -.04, 0).applyQuaternion(rotation).add(position), rotation };
  }

  solve(target, orientation, iterations = 45, effector = null) {
    const angles = [...this.targetAngles];
    const errorAt = values => {
      this.apply(values);
      const pose = this.graspPose();
      if (effector) { const wrist = this.nativePose(); pose.position.copy(effector).applyQuaternion(wrist.rotation).add(wrist.position); }
      const error = target.clone().sub(pose.position).toArray();
      if (orientation) {
        const rotation = orientation.clone().multiply(pose.rotation.clone().invert());
        if (rotation.w < 0) rotation.set(-rotation.x, -rotation.y, -rotation.z, -rotation.w);
        error.push(rotation.x * .35, rotation.y * .35, rotation.z * .35);
      }
      return error;
    };
    for (let iteration = 0; iteration < iterations; iteration++) {
      const error = errorAt(angles);
      if (Math.hypot(...error) < .002) break;
      const jacobian = Array.from({ length: error.length }, () => Array(7).fill(0));
      for (let joint = 0; joint < 7; joint++) {
        const sample = [...angles]; sample[joint] += .002;
        const changed = errorAt(sample);
        error.forEach((value, row) => { jacobian[row][joint] = (value - changed[row]) / .002; });
      }
      const matrix = jacobian.map((row, rowIndex) => jacobian.map((other, column) => row.reduce((sum, value, index) => sum + value * other[index], 0) + (rowIndex === column ? .0005 : 0)));
      const solution = solveLinear(matrix, error);
      const direction = [];
      for (let joint = 0; joint < 7; joint++) {
        const delta = jacobian.reduce((sum, row, index) => sum + row[joint] * solution[index], 0);
        direction.push(THREE.MathUtils.clamp(delta, -.12, .12));
      }
      let improved = false;
      for (const scale of [1, .5, .25, .125, .0625]) {
        const candidate = angles.map((value, joint) => THREE.MathUtils.clamp(value + direction[joint] * scale, ...(joint === 1 && this.side === 'left' ? [-1, 1.8] : limits[joint])));
        if (Math.hypot(...errorAt(candidate)) < Math.hypot(...error) - 1e-8) {
          angles.splice(0, angles.length, ...candidate);
          improved = true;
          break;
        }
      }
      if (!improved) break;
    }
    const finalError = Math.hypot(...errorAt(angles).slice(0, 3));
    this.error = finalError;
    this.solvedPosition = target.clone().sub(new THREE.Vector3(...errorAt(angles).slice(0, 3)));
    this.targetAngles = angles;
    this.apply();
    return finalError;
  }

  plan(target, orientation, effector = null) {
    const mirror = this.side === 'left' ? -1 : 1;
    const seeds = [this.targetAngles, [-1.37, -.77 * mirror, .46 * mirror, .36, -.73 * mirror, .4, .76 * mirror], [-.9, -.8 * mirror, .3 * mirror, -.6, -.5 * mirror, .8, .8 * mirror], [-1.2, -.5 * mirror, 0, 1.3, 0, .4, 0], [-1, -.3 * mirror, 1 * mirror, .7, -1 * mirror, .2, .7 * mirror]];
    let best = null;
    for (const seed of seeds) {
      this.targetAngles = [...seed];
      const error = this.solve(target, orientation, 100, effector);
      if (!best || error < best.error) best = { error, angles: [...this.targetAngles] };
    }
    if (effector && best.error > .02) {
      for (const pitch of [-2.3, -1, .3]) for (const elbow of [-1, .5, 1.8]) for (const wrist of [-1.3, 0, 1.3]) {
        this.targetAngles = [pitch, -.3 * mirror, wrist * mirror, elbow, wrist, -wrist, wrist];
        const error = this.solve(target, orientation, 80, effector);
        if (error < best.error) best = { error, angles: [...this.targetAngles] };
      }
    }
    this.targetAngles = best.angles;
    return best.error;
  }

  update(dt) {
    if (!this.active) return;
    const difference = this.targetAngles.map((value, index) => value - this.angles[index]);
    const ratio = Math.min(1, dt * .8 / Math.max(1e-8, ...difference.map(Math.abs)));
    this.angles = this.angles.map((value, index) => value + difference[index] * ratio);
    this.apply();
  }
}
