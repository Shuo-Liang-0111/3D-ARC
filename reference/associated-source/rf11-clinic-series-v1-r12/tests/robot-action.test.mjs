import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ROBOT_ACTION_CONTACT_PROGRESS,
  ROBOT_ACTION_DURATION,
  actionKindForEvent,
  advanceRobotAction,
  beginRobotAction,
  createRobotActionState,
  finishRobotAction,
  getRobotActionPose,
  getRobotPresentationState,
  isRobotActionActive,
} from "../game/robot-action.js";

const appSource = await readFile(new URL("../game/app.js", import.meta.url), "utf8");

function stateWithBattery(location, overrides = {}) {
  return {
    battery: location === "carried" ? { location } : { location, x: 1, z: 2 },
    powered: false,
    doorOpen: false,
    terminalOpen: false,
    complete: false,
    failed: false,
    ...overrides,
  };
}

test("RF-01 interaction events map to pickup and place actions", () => {
  assert.equal(ROBOT_ACTION_DURATION, 0.8);
  assert.equal(ROBOT_ACTION_CONTACT_PROGRESS, 0.5);
  assert.equal(actionKindForEvent("battery_collected"), "pickup");
  assert.equal(actionKindForEvent("battery_dropped"), "place");
  assert.equal(actionKindForEvent("power_restored"), "place");
  assert.equal(actionKindForEvent("door_opened"), "operate");
});

test("RF-09 device events use the shared G1 pickup and place actions", () => {
  const beforePickup = { carriedItem: null, terminalOpen: false };
  const afterPickup = { carriedItem: "adapter", terminalOpen: false };
  let action = beginRobotAction(createRobotActionState(), "item_collected_adapter", beforePickup, afterPickup);
  action = advanceRobotAction(action, ROBOT_ACTION_DURATION * ROBOT_ACTION_CONTACT_PROGRESS);
  assert.equal(getRobotActionPose(action, true).visualCarrying, true);

  const afterPlace = { carriedItem: null, terminalOpen: false };
  action = beginRobotAction(createRobotActionState(), "device_installed_adapter", afterPickup, afterPlace);
  action = advanceRobotAction(action, ROBOT_ACTION_DURATION * ROBOT_ACTION_CONTACT_PROGRESS);
  assert.equal(getRobotActionPose(action, false).visualCarrying, false);
});

test("pickup keeps the world payload grounded until the shared contact frame", () => {
  const before = stateWithBattery("ground");
  const after = stateWithBattery("carried");
  let action = beginRobotAction(createRobotActionState(), "battery_collected", before, after);

  assert.equal(isRobotActionActive(action), true);
  action = advanceRobotAction(action, action.duration * action.contactProgress - 0.01);
  let pose = getRobotActionPose(action, true);
  assert.equal(pose.contactReached, false);
  assert.equal(pose.visualCarrying, false);
  assert.equal(getRobotPresentationState(action, after).battery.location, "ground");

  action = advanceRobotAction(action, 0.01);
  pose = getRobotActionPose(action, true);
  assert.equal(pose.contactReached, true);
  assert.equal(pose.visualCarrying, true);
  assert.equal(getRobotPresentationState(action, after).battery.location, "carried");
});

test("place keeps the payload carried until contact, then reveals the destination", () => {
  const before = stateWithBattery("carried");
  const after = stateWithBattery("slotted", { powered: true });
  let action = beginRobotAction(createRobotActionState(), "power_restored", before, after);

  action = advanceRobotAction(action, action.duration * action.contactProgress - 0.001);
  assert.equal(getRobotActionPose(action, false).visualCarrying, true);
  const beforeContact = getRobotPresentationState(action, after);
  assert.equal(beforeContact.battery.location, "carried");
  assert.equal(beforeContact.powered, false);

  action = advanceRobotAction(action, 0.001);
  assert.equal(getRobotActionPose(action, false).visualCarrying, false);
  const afterContact = getRobotPresentationState(action, after);
  assert.equal(afterContact.battery.location, "slotted");
  assert.equal(afterContact.powered, true);
});

test("action remains locked for its event duration and reset finishes it", () => {
  const before = stateWithBattery("ground");
  const after = stateWithBattery("carried");
  let action = beginRobotAction(createRobotActionState(), "battery_collected", before, after);

  action = advanceRobotAction(action, 1.349);
  assert.equal(isRobotActionActive(action), true);
  action = advanceRobotAction(action, 0.01);
  assert.equal(isRobotActionActive(action), false);

  action = beginRobotAction(action, "battery_collected", before, after);
  assert.deepEqual(finishRobotAction(action), createRobotActionState());
});

test("both view renderers consume one pose and one presentation state per frame", () => {
  assert.match(appSource, /const pose = getRobotActionPose\(robotAction, runtime\.isCarrying\(state\)\);/);
  assert.match(appSource, /const presentationState = getRobotPresentationState\(robotAction, state\);/);
  assert.match(appSource, /if \(!sampledMujocoState\) updateRobotAnimation\(robot, delta, state\.elapsed, isCooperativeLevel \? state\.motion\.alpha : state\.motion, pose, gaitDistance, d435LookPitch\);/);
  assert.doesNotMatch(appSource, /updateFirstPersonRobot\(firstPersonRig/);
  assert.match(appSource, /runtime\.syncVisuals\(world, presentationState, delta\);/);
});

test("movement, repeated E, and agent observations respect the action lock", () => {
  assert.match(appSource, /\? \(isCooperativeLevel \? \{ alpha: \{\}, beta: \{\} \} : \{ move: 0, strafe: 0, turn: 0, drain: false \}\)/);
  assert.match(appSource, /state\.failed \|\| isRobotActionActive\(robotAction\)\) return false/);
  assert.match(appSource, /isRobotActionActive\(robotAction\)\) await waitForRobotAction\(\)/);
  assert.match(appSource, /else await delay\(durationMs\)/);
});

test("view switching preserves the in-progress action", () => {
  const selectViewModeSource = appSource.slice(
    appSource.indexOf("function selectViewMode"),
    appSource.indexOf("const audioSystem"),
  );
  assert.doesNotMatch(selectViewModeSource, /createRobotActionState|finishRobotAction/);
  assert.match(appSource, /getRobotAction: \(\) => structuredClone\(robotAction\)/);
});
