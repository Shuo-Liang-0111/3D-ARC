import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";

// Run against a candidate directory, then the same directory with the live origin.
// This checks the published chunks instead of accidentally testing Vite source.
const directory = resolve(process.argv[2] ?? "");
assert.ok(process.argv[2], "Usage: node tools/check-rf01-release.mjs RELEASE_DIRECTORY [ORIGIN]");
const origin = process.argv[3];
const manifest = JSON.parse(await readFile(resolve(directory, ".vite/manifest.json"), "utf8"));
const entry = manifest["index.html"];
const entrySource = await readFile(resolve(directory, entry.file), "utf8");
const ids = ["rf01", "rf01-2", "rf01-3"];
const at = (state, target, offset = 1.1) => ({
  ...state, player: { x: target.x, z: target.z + offset, yaw: offset > 0 ? Math.PI : 0 },
});
const controls = [[{ x: -.68, z: -1.08 }, 1.1], [{ x: 4.05, z: -1.53 }, -1.1]];
const dependencies = new Set();
function collect(key) {
  if (dependencies.has(key)) return;
  dependencies.add(key);
  for (const child of manifest[key].imports ?? []) collect(child);
}
collect("index.html");
for (const id of ids) {
  const key = "game/levels/" + id + "/runtime.js";
  const record = manifest[key];
  assert.ok(entry.dynamicImports.includes(key), id + " must be routed from the game entry");
  assert.ok(entrySource.includes(basename(record.file)), id + " chunk must be linked");
  collect(key);
  const runtime = await import(pathToFileURL(resolve(directory, record.file)));
  assert.equal(runtime.LEVEL.id, id);
  assert.equal(runtime.createInteractionAnimation, undefined, id + " must use the original action timeline");
  assert.equal(typeof runtime.syncRobotPose, "function", id + " must use the restored two-arm hold");
  let state = runtime.createInitialState();
  for (const [control, offset] of controls) {
    const initial = at(state, control, offset);
    assert.equal(runtime.getInteraction(initial)?.type, "shutter");
    const result = runtime.interact(initial);
    assert.equal(result.shutterPhase, id === "rf01" ? "opening" : "closed");
    if (id !== "rf01") {
      assert.equal(runtime.updateEnvironment(result, .1).shutterLift, 0);
      assert.equal(result.shutterRequested, false);
      assert.equal(result.rewardedMilestones.shutter, undefined);
      assert.equal(runtime.isWalkable(result, 1.6, -1.4), false);
    }
  }
  state = runtime.interact(at(state, runtime.LEVEL.batteryStart));
  assert.equal(state.battery.location, "carried");
  if (id !== "rf01") {
    for (const [control, offset] of controls) {
      assert.equal(runtime.interact(at(state, control, offset)).shutterPhase, "closed");
    }
  }
  state = runtime.interact(at(state, runtime.LEVEL.powerSlot));
  assert.equal(state.battery.location, "slotted");
  assert.equal(state.powered, true);
  for (const [control, offset] of controls) {
    let opened = runtime.interact(at(state, control, offset));
    assert.equal(opened.shutterPhase, "opening");
    for (let frame = 0; frame < 32; frame++) opened = runtime.updateEnvironment(opened, .1);
    assert.equal(opened.shutterLift, 2.36);
    assert.equal(runtime.isWalkable(opened, 1.6, -1.4), true);
  }
  if (id !== "rf01") {
    const reset = runtime.createInitialState();
    assert.equal(runtime.interact(at(reset, controls[0][0])).shutterPhase, "closed");
  }
  // Exercise the actual bundled render sync without a WebGL canvas.
  const object = () => new THREE.Group();
  const material = () => new THREE.MeshStandardMaterial();
  const world = {
    doorPanel: object(), doorOpenX: 2, doorClosedX: 0,
    doorLampMaterial: material(), slotGlowMaterial: material(), terminalScreenMaterial: material(),
    exitMaterial: material(), beacon: { intensity: 0 }, battery: object(),
    crates: state.crates.map(object),
    sorting: {
      indicatorMaterial: material(), beltTexture: { offset: { x: 0 } }, rollers: [], rollerRadius: .075,
      parcels: Object.fromEntries(Object.keys(state.parcels).map(type => [type, object()])),
    },
  };
  state.enteredWorkshop = true;
  for (const lightsOn of [false, true, false]) {
    state.lightsOn = lightsOn;
    runtime.syncVisuals(world, state, 0);
    for (const [type, model] of Object.entries(world.sorting.parcels)) {
      assert.equal(model.visible, lightsOn && state.parcels[type].onBelt !== false);
    }
  }
  console.log(id + ": bundled battery interlock, door clearance, reset and parcel visibility passed");
}
if (origin) {
  const release = basename(directory);
  for (const id of ids) {
    const response = await fetch(new URL("/?mode=play&level=" + id, origin));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-arc-release"), release);
    assert.match(response.headers.get("cache-control"), /no-store/);
    const html = await response.text();
    assert.ok(html.includes("/" + release + "/" + entry.file));
    assert.ok(!html.includes("/@vite/client"));
  }
  let checked = 0;
  for (const key of dependencies) {
    const record = manifest[key];
    for (const file of [record.file, ...(record.css ?? [])]) {
      const response = await fetch(new URL("/" + release + "/" + file, origin));
      assert.equal(response.status, 200, file);
      const expected = await readFile(resolve(directory, file));
      assert.ok(expected.equals(Buffer.from(await response.arrayBuffer())), file + " differs from HTTP bytes");
      checked++;
    }
  }
  console.log("Live root URLs select this release; " + checked + " entry/runtime/dependency files match HTTP bytes");
}
