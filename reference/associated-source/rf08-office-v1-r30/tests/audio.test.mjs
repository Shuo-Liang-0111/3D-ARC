import test from "node:test";
import assert from "node:assert/strict";
import { SOUND_ASSETS, soundKeyForEvent } from "../game/audio.js";

test("successful battery interactions map to the available Cardinal sounds", () => {
  assert.equal(soundKeyForEvent("battery_collected"), "pickup");
  assert.equal(soundKeyForEvent("battery_dropped"), "drop");
  assert.equal(soundKeyForEvent("power_restored"), "power");
  assert.equal(soundKeyForEvent("door_unpowered"), null);
  assert.equal(soundKeyForEvent("move"), null);
});

test("Cardinal sound assets use stable local-only browser paths", () => {
  assert.deepEqual(Object.keys(SOUND_ASSETS), ["pickup", "drop", "power"]);
  Object.values(SOUND_ASSETS).forEach((path) => {
    assert.match(path, /^\/local-assets\/cardinal\/rf01\/audio\/.*\.mp3$/);
  });
});
