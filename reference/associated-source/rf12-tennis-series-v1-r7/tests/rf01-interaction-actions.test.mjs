import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  actionKindForEvent,
  advanceRobotAction,
  beginRobotAction,
  createRobotActionState,
  getRobotActionPose,
  getRobotPresentationState,
} from "../game/robot-action.js";

const appSource = await readFile(new URL("../game/app.js", import.meta.url), "utf8");
const robotSource = await readFile(new URL("../game/robot.js", import.meta.url), "utf8");

const baseState = {
  battery: { location: "slotted", x: 6.15, z: 0.4 },
  crates: [
    { id: "crate-0", x: -3.55, z: -4.8, location: "ground" },
    { id: "crate-1", x: -3.55, z: -3.3, location: "ground" },
  ],
  carriedItem: null,
  powered: true,
  shutterPhase: "closed",
  shutterLift: 0,
  lightsOn: false,
  dispatchConfirmed: false,
  complete: false,
};

test("RF-01 family maps cargo and control events to distinct gestures", () => {
  assert.equal(actionKindForEvent("crate_collected"), "pickup");
  assert.equal(actionKindForEvent("crate_delivered"), "place");
  assert.equal(actionKindForEvent("shutter_opening"), "operate");
  assert.equal(actionKindForEvent("workshop_lit"), "operate");
  assert.equal(actionKindForEvent("dynamic_stop_requested"), "operate");
  assert.equal(actionKindForEvent("dynamic_interlock_locked"), "operate");
  assert.equal(actionKindForEvent("dispatch_confirmed"), "operate");

  const afterPickup = structuredClone(baseState);
  afterPickup.crates[0].location = "carried";
  afterPickup.carriedItem = "crate-0";
  const pickup = beginRobotAction(createRobotActionState(), "crate_collected", baseState, afterPickup);
  assert.equal(pickup.gesture, "two-hand-lift");
  assert.ok(pickup.duration > 1.4);
  assert.ok(getRobotActionPose(pickup, true).crouch >= 0);

  const dynamicBefore = { ...baseState, dynamic: { phase: "moving" } };
  const dynamicAfter = { ...dynamicBefore, dynamic: { phase: "stopping" } };
  const dynamicControl = beginRobotAction(createRobotActionState(), "dynamic_stop_requested", dynamicBefore, dynamicAfter);
  assert.equal(dynamicControl.gesture, "right-hand-press");
  const dynamicLock = beginRobotAction(createRobotActionState(), "dynamic_interlock_locked", dynamicBefore, { ...dynamicBefore, dynamic: { phase: "locked" } });
  assert.equal(dynamicLock.gesture, "right-hand-confirm");
  const lightState = { ...baseState, lightsOn: true };
  const operate = beginRobotAction(createRobotActionState(), "workshop_lit", baseState, lightState);
  assert.equal(operate.gesture, "right-hand-press");
  assert.equal(getRobotActionPose(operate, false).operationBlend, 0);
});

test("RF-01 family visuals change at the configured contact frame", () => {
  const litState = { ...baseState, lightsOn: true };
  let action = beginRobotAction(createRobotActionState(), "workshop_lit", baseState, litState);
  action = advanceRobotAction(action, action.duration * action.contactProgress - 0.001);
  assert.equal(getRobotActionPresentation(action, litState).lightsOn, false);
  action = advanceRobotAction(action, 0.001);
  assert.equal(getRobotActionPresentation(action, litState).lightsOn, true);
});

function getRobotActionPresentation(action, state) {
  return getRobotPresentationState(action, state);
}

test("RF-01 family action rendering covers third-person, first-person, and MuJoCo", () => {
  assert.match(robotSource, /const operating = pose\.kind === "operate"/);
  assert.match(robotSource, /right_shoulder_pitch_link/);
  assert.match(robotSource, /presentation\.kind !== "operate" \|\| side > 0/);
  assert.match(appSource, /if \(isRobotActionActive\(robotAction\) \|\| pose\.visualCarrying\) applyRobotActionPose\(robot, pose\)/);
  assert.match(appSource, /robotAction\.kind === "operate" && !environmentActionPose\.contactReached/);
  assert.match(appSource, /state\.complete && !completeShown && !isRobotActionActive\(robotAction\)/);
});
