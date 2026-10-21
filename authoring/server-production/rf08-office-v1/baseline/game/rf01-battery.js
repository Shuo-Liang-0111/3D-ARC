import * as THREE from "three";

export const BATTERY_WIDTH = .44;
const JOINTS = ["shoulder_pitch", "shoulder_roll", "shoulder_yaw", "elbow", "wrist_roll", "wrist_pitch", "wrist_yaw"];
const HOLD = [-.9697, .5838, -.8340, .7107, .7692, .4209, -.5573];
const AXES = JOINTS.map((name) => new THREE.Vector3(...(
  name.includes("roll") ? [0, 0, -1] : name.includes("yaw") ? [0, -1, 0] : [1, 0, 0]
)));
const BATTERY_EVENTS = new Set(["battery_collected", "battery_dropped", "power_restored"]);

export function fitRF01Battery(root) {
  const model = root?.children.find((child) => child.name === "rf01-battery" || child.name === "rf01-battery-cargo-model");
  if (!model || model.userData.batteryFitted) return root;
  const parent = model.parent;
  parent.remove(model);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = BATTERY_WIDTH / size.x;
  model.scale.multiplyScalar(scale);
  model.position.add(new THREE.Vector3(-center.x, -bounds.min.y, -center.z).multiplyScalar(scale));
  model.userData.batteryFitted = true;
  parent.add(model);
  root.userData.batterySize = size.multiplyScalar(scale).toArray();
  return root;
}

export function syncRF01BatteryPose(robot, pose, state, action) {
  const data = robot.userData;
  const batteryAction = action.active && BATTERY_EVENTS.has(action.event);
  if (state.battery.location !== "carried" && !batteryAction) return;
  const model = data.officialModel;
  if (!model || data.robotId !== "g1") return;
  const reach = batteryAction ? pose.reach : 0;
  for (const side of ["left", "right"]) {
    const mirror = side === "left" ? 1 : -1;
    JOINTS.forEach((name, index) => {
      const angle = HOLD[index] * (name.includes("roll") || name.includes("yaw") ? mirror : 1);
      const offset = index === 0 ? reach * .32 : index === 3 ? -reach * .18 : 0;
      data.robotProfile.setJointAngle(model, `${side}_${name}_link`, angle + offset, AXES[index]);
    });
  }
  data.robotProfile.setGrip(model, pose.visualCarrying ? .65 : pose.grip);
  robot.updateMatrixWorld(true);
  const palms = ["left", "right"].map(side => {
    const wrist = model.getObjectByName(`${side}_wrist_yaw_link`);
    const point = new THREE.Vector3(side === "left" ? .04 : -.04, 0, .14);
    return robot.worldToLocal(wrist.localToWorld(point));
  });
  const midpoint = palms[0].add(palms[1]).multiplyScalar(.5);
  const battery = data.rackPayload.getObjectByName("rf01-carried-battery");
  const height = battery?.userData.batterySize?.[1] ?? .1833;
  data.cargoGrip.position.copy(midpoint).add(new THREE.Vector3(0, -height / 2, 0));
  data.rackPayload.rotation.set(0, 0, 0);
  data.collisionRig?.sync({ step: data.collisionRig.ownsWorld });
}
