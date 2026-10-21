import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { G1_LOCOMOTION } from "../game/g1-locomotion.js";
import { LEVEL as RF01 } from "../game/level.js";
import { LEVEL as RF02 } from "../game/levels/rf02/level.js";
import { LEVEL as RF03 } from "../game/levels/rf03/level.js";
import { LEVEL as RF04 } from "../game/levels/rf04/level.js";
import { LEVEL as RF05 } from "../game/levels/rf05/level.js";
import { LEVEL as RF06 } from "../game/levels/rf06/level.js";
import { LEVEL as RF07 } from "../game/levels/rf07/level.js";
import { LEVEL as RF08 } from "../game/levels/rf08/level.js";
import { LEVEL as RF09 } from "../game/levels/rf09/level.js";

test("all levels share the calibrated G1 locomotion envelope", () => {
  for (const level of [RF01, RF02, RF03, RF04, RF05, RF06, RF07, RF08, RF09]) {
    assert.equal(level.moveSpeed, G1_LOCOMOTION.moveSpeed);
    assert.equal(level.turnSpeed, G1_LOCOMOTION.turnSpeed);
  }
});

test("level files use the shared G1 locomotion source", async () => {
  const files = [
    "../game/level.js",
    ...Array.from({ length: 8 }, (_, index) => `../game/levels/rf${String(index + 2).padStart(2, "0")}/level.js`),
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /G1_LOCOMOTION/);
    assert.doesNotMatch(source, /moveSpeed:\s*[0-9]|turnSpeed:\s*[0-9]/);
  }
});
