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
  const parcelId = state.carriedItem?.startsWith("parcel-") ? state.carriedItem
    : action.active && action.beforeVisualState?.carriedItem?.startsWith("parcel-") ? action.beforeVisualState.carriedItem : null;
  const parcelAction = action.active && parcelId && ["crate_collected", "crate_dropped", "crate_delivered"].includes(action.event);
  if (state.battery.location !== "carried" && !batteryAction && !parcelId) return;
  const model = data.officialModel;
  if (!model || data.robotId !== "g1") return;
  // Preserve the calibrated 3e01ef5 two-arm hold. Never write the legs or torso here.
  const reach = batteryAction || parcelAction ? pose.reach : 0;
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
  // Parcels rest on the same two palms; their own local offset must be accounted for.
  const parcel = parcelId && data.rackPayload.getObjectByName("sorting-" + parcelId);
  data.cargoGrip.position.copy(midpoint).add(new THREE.Vector3(0, parcel ? -parcel.position.y : -height / 2, 0));
  data.rackPayload.rotation.set(0, 0, 0);
  data.collisionRig?.sync({ step: data.collisionRig.ownsWorld });
}

// Completion can replace lastEvent, but must not skip the final physical gesture.
export function getRF01ActionEvent(before, after) {
  if (after.lastEvent !== "mission_complete") return after.lastEvent;
  if (before.carriedItem && !after.carriedItem) return "crate_delivered";
  if (!before.lightsOn && after.lightsOn) return "workshop_lit";
  return after.lastEvent;
}
