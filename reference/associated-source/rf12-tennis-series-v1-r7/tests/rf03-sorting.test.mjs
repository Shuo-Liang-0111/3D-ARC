import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createInitialState, interact, isWalkable, updateMovement } from "../game/levels/rf03/engine.js";
import { LEVEL, PARCEL_META, PARCEL_TYPES } from "../game/levels/rf03/level.js";
import { ASSETS } from "../game/levels/rf03/scene.js";

const RUNTIME_MANIFEST = new URL("../public/local-assets/cardinal/rf03/manifests/runtime.json", import.meta.url);
const assetPath = (asset) => asset.split("?", 1)[0];

function at(state, point) {
  return { ...state, player: { ...state.player, x: point.x, z: point.z } };
}

function collect(state, type) {
  return interact(at(state, state.parcels[type]));
}

function sort(state, type) {
  return interact(at(state, LEVEL.bins[type]));
}

test("RF-03 conveyor moves while passive operation does not drain reserve", () => {
  const initial = createInitialState();
  const advanced = updateMovement(initial, { x: 0, z: 0 }, 0.05);
  assert.notEqual(advanced.parcels.red.x, initial.parcels.red.x);
  assert.equal(advanced.progress, initial.progress);
});

test("direction input drains 1.5 reserve per second even when movement is blocked", () => {
  const initial = createInitialState();
  const moved = updateMovement(initial, { x: 1, z: 0 }, 0.05);
  assert.ok(Math.abs(moved.progress - 99.925) < 1e-9);

  const againstWall = at(initial, { x: LEVEL.bounds.maxX - LEVEL.playerRadius, z: 3 });
  const blocked = updateMovement(againstWall, { x: 1, z: 0 }, 0.05);
  assert.equal(blocked.player.x, againstWall.player.x);
  assert.ok(Math.abs(blocked.progress - 99.925) < 1e-9);
});

test("RF-03 relative controls turn in place and move along the robot heading", () => {
  const initial = createInitialState();
  const left = updateMovement(initial, { move: 0, turn: -1 }, 0.05);
  const right = updateMovement(initial, { move: 0, turn: 1 }, 0.05);
  assert.deepEqual({ x: left.player.x, z: left.player.z }, { x: initial.player.x, z: initial.player.z });
  assert.deepEqual({ x: right.player.x, z: right.player.z }, { x: initial.player.x, z: initial.player.z });
  assert.ok(left.player.yaw < initial.player.yaw);
  assert.ok(right.player.yaw > initial.player.yaw);
  assert.ok(left.progress < initial.progress);

  const forward = updateMovement(initial, { move: 1, turn: 0 }, 0.05);
  const backward = updateMovement(initial, { move: -1, turn: 0 }, 0.05);
  const heading = { x: Math.sin(initial.player.yaw), z: Math.cos(initial.player.yaw) };
  assert.equal(forward.player.yaw, initial.player.yaw);
  assert.equal(backward.player.yaw, initial.player.yaw);
  assert.ok((forward.player.x - initial.player.x) * heading.x + (forward.player.z - initial.player.z) * heading.z > 0);
  assert.ok((backward.player.x - initial.player.x) * heading.x + (backward.player.z - initial.player.z) * heading.z < 0);
});

test("every interaction attempt costs five reserve", () => {
  const initial = createInitialState();
  const empty = interact(at(initial, { x: 0, z: 5.5 }));
  assert.equal(empty.lastEvent, "empty_interaction");
  assert.equal(empty.progress, 95);

  const collected = collect(initial, "red");
  assert.equal(collected.carriedParcel, "red");
  assert.equal(collected.progress, 95);
});

test("a parcel can be dropped and collected again", () => {
  let state = collect(createInitialState(), "yellow");
  state = interact(at(state, { x: 8, z: 2.5 }));
  assert.equal(state.carriedParcel, null);
  assert.equal(state.parcels.yellow.location, "ground");
  state = interact(state);
  assert.equal(state.carriedParcel, "yellow");
});

test("a wrong bin rejects the parcel and still charges the action", () => {
  let state = collect(createInitialState(), "red");
  state = interact(at(state, LEVEL.bins.blue));
  assert.equal(state.lastEvent, "wrong_bin");
  assert.equal(state.carriedParcel, "red");
  assert.equal(state.parcels.red.location, "carried");
  assert.equal(state.progress, 90);
});

test("a correct delivery has a net reward of ten reserve", () => {
  let state = { ...collect(createInitialState(), "blue"), progress: 50 };
  state = sort(state, "blue");
  assert.equal(state.parcels.blue.location, "sorted");
  assert.equal(state.progress, 60);
});

test("three correct deliveries immediately complete RF-03", () => {
  let state = createInitialState();
  for (const type of PARCEL_TYPES) {
    state = collect(state, type);
    state = sort(state, type);
  }
  assert.equal(state.complete, true);
  assert.equal(state.lastEvent, "all_parcels_sorted");
  assert.equal(state.progress, 100);
  assert.deepEqual(PARCEL_TYPES.map((type) => state.parcels[type].location), ["sorted", "sorted", "sorted"]);
});

test("conveyor parcels loop instead of falling off the line", () => {
  let state = createInitialState();
  for (let index = 0; index < 220; index += 1) state = updateMovement(state, { x: 0, z: 0 }, 0.05);
  for (const type of PARCEL_TYPES) {
    assert.ok(state.parcels[type].x >= LEVEL.conveyor.minX);
    assert.ok(state.parcels[type].x < LEVEL.conveyor.maxX);
  }
});

test("RF-03 rollers rotate around their local cylinder axis at conveyor speed", async () => {
  const sceneSource = await readFile(new URL("../game/levels/rf03/scene.js", import.meta.url), "utf8");
  assert.match(sceneSource, /LEVEL\.conveyor\.speed \/ LEVEL\.conveyor\.rollerRadius/);
  assert.match(sceneSource, /roller\.rotation\.y = -state\.elapsed \* angularSpeed/);
  assert.doesNotMatch(sceneSource, /roller\.rotation\.z/);
});

test("every RF-03 objective has a reachable interaction position", () => {
  const state = createInitialState();
  const step = 0.25;
  const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
  const queue = [{ x: LEVEL.playerStart.x, z: LEVEL.playerStart.z }];
  const visited = new Set([key(queue[0].x, queue[0].z)]);
  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index];
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const next = { x: point.x + dx, z: point.z + dz };
      const nextKey = key(next.x, next.z);
      if (!visited.has(nextKey) && isWalkable(state, next.x, next.z)) {
        visited.add(nextKey);
        queue.push(next);
      }
    }
  }
  const targets = [
    ...PARCEL_TYPES.map((type) => ({ x: 0, z: LEVEL.conveyor.z + LEVEL.parcels[type].laneZ })),
    ...PARCEL_TYPES.map((type) => LEVEL.bins[type]),
    LEVEL.terminal,
  ];
  targets.forEach((target) => {
    assert.ok(queue.some((point) => Math.hypot(point.x - target.x, point.z - target.z) <= LEVEL.interactionRange), `unreachable target ${JSON.stringify(target)}`);
  });
});

test("RF-03 uses a meter-scale Chinese DWS line with a west-end automatic infeed machine", () => {
  assert.ok(LEVEL.bounds.maxX - LEVEL.bounds.minX >= 25);
  assert.ok(LEVEL.bounds.maxZ - LEVEL.bounds.minZ >= 15);
  assert.ok(LEVEL.conveyor.width >= 0.8 && LEVEL.conveyor.width <= 1.2);
  assert.ok(LEVEL.conveyor.beltHeight >= 0.75 && LEVEL.conveyor.beltHeight <= 0.9);
  assert.ok(LEVEL.conveyor.infeedX < LEVEL.conveyor.minX);
  assert.ok(LEVEL.staticColliders.some(({ id }) => id === "automatic-infeed-machine"));
  assert.ok(LEVEL.staticColliders.some(({ id }) => id === "main-conveyor"));
  assert.equal(isWalkable(createInitialState(), LEVEL.conveyor.infeedX, LEVEL.conveyor.z), false);
  assert.deepEqual(PARCEL_TYPES.map((type) => PARCEL_META[type].dimensions), [
    [0.52, 0.32, 0.38],
    [0.44, 0.26, 0.32],
    [0.58, 0.38, 0.42],
  ]);
});

test("RF-03 uses twelve unique Cardinal GLBs and shares parcel and cage sources", () => {
  assert.deepEqual(Object.keys(ASSETS).sort(), [
    "automaticInfeed",
    "beltConveyor",
    "blueBin",
    "blueParcel",
    "dwsGantry",
    "electricalCabinet",
    "fireStation",
    "gravityChute",
    "ledFixture",
    "palletStack",
    "parcel",
    "redBin",
    "redParcel",
    "routeCage",
    "swingSorter",
    "terminal",
    "yellowBin",
    "yellowParcel",
  ]);
  assert.equal(new Set(Object.values(ASSETS)).size, 12);
  assert.ok(Object.values(ASSETS).every((value) => /^\/local-assets\/cardinal\/rf03\/models\/runtime\/.+\.glb$/.test(assetPath(value))));
  for (const type of PARCEL_TYPES) {
    assert.equal(ASSETS[`${type}Parcel`], ASSETS.parcel);
    assert.equal(ASSETS[`${type}Bin`], ASSETS.routeCage);
  }
  assert.ok(Object.values(ASSETS).every((value) => !/(candidate|draft|backup|old)/i.test(value)));
});

function parseGlb(buffer, label) {
  assert.equal(buffer.subarray(0, 4).toString("ascii"), "glTF", `${label}: GLB magic`);
  assert.equal(buffer.readUInt32LE(4), 2, `${label}: GLB version`);
  assert.equal(buffer.readUInt32LE(8), buffer.length, `${label}: declared byte length`);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a, `${label}: first chunk is JSON`);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8").replace(/[\0 ]+$/g, ""));
}

function checkDimensions(id, dimensions) {
  assert.equal(dimensions.length, 3, `${id}: dimensions must be [x,y,z]`);
  assert.ok(dimensions.every((value) => Number.isFinite(value) && value > 0), `${id}: positive dimensions`);
  const targets = {
    automatic_infeed_machine: [2.5, 2.04, 1.8],
    belt_conveyor_module: [2, 1.02, 1.1],
    dws_scanner_gantry: [1.32, 2.85, 1.78],
    swing_wheel_sorter: [1.65, 0.95, 1.12],
    gravity_roller_chute: [1.08, 0.95, 3],
    route_roll_cage: [1.12, 1.72, 0.82],
    corrugated_parcel: [0.52, 0.32, 0.38],
    dws_control_terminal: [0.64, 1.58, 0.62],
    industrial_electrical_cabinet: [0.72, 2.12, 0.72],
    palletized_carton_stack: [1.2, 1.35, 1],
    fire_safety_station: [0.85, 1.8, 0.35],
    industrial_led_fixture: [1.2, 0.12, 0.24],
  };
  assert.deepEqual(dimensions, targets[id], `${id}: normalized meter dimensions`);
}

test("RF-03 manifest and twelve textured Draco GLBs satisfy the release contract", async () => {
  const manifest = JSON.parse(await readFile(RUNTIME_MANIFEST, "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.rfId, "RF-03");
  assert.equal(manifest.productionStatus, "visual_complete");
  assert.equal(manifest.visualReview, "pass");
  assert.equal(manifest.referenceMatch, "pass");
  assert.equal(manifest.units, "meters");
  assert.equal(manifest.upAxis, "Y");
  assert.equal(manifest.layout.mainConveyor.widthMeters, 1);
  assert.equal(manifest.layout.mainConveyor.beltHeightMeters, 0.82);
  assert.match(manifest.layout.infeedMachine, /automatic/i);
  assert.equal(manifest.assets.length, 12);
  assert.deepEqual(manifest.assets.map(({ id }) => id).sort(), [
    "automatic_infeed_machine",
    "belt_conveyor_module",
    "corrugated_parcel",
    "dws_control_terminal",
    "dws_scanner_gantry",
    "fire_safety_station",
    "gravity_roller_chute",
    "industrial_electrical_cabinet",
    "industrial_led_fixture",
    "palletized_carton_stack",
    "route_roll_cage",
    "swing_wheel_sorter",
  ]);

  let totalBytes = 0;
  for (const record of manifest.assets) {
    assert.match(record.path, /^\/local-assets\/cardinal\/rf03\/models\/runtime\/.+\.glb$/);
    assert.match(record.sha256, /^[a-f0-9]{64}$/);
    assert.equal(record.texturesEmbedded, true, `${record.id}: embedded base color textures`);
    assert.equal(record.draco, true, `${record.id}: Draco compression`);
    assert.equal(record.visualReview, "pass", `${record.id}: visual review`);
    checkDimensions(record.id, record.dimensions);
    const buffer = await readFile(new URL(`../public${record.path}`, import.meta.url));
    totalBytes += buffer.length;
    assert.equal(buffer.length, record.bytes, `${record.id}: byte count`);
    assert.equal(createHash("sha256").update(buffer).digest("hex"), record.sha256, `${record.id}: SHA-256`);
    const gltf = parseGlb(buffer, record.id);
    assert.ok(gltf.meshes?.length > 0, `${record.id}: mesh`);
    assert.ok(gltf.materials?.length > 0, `${record.id}: material`);
    assert.ok(gltf.images?.length > 0, `${record.id}: image`);
    assert.ok(gltf.images.every((image) => Number.isInteger(image.bufferView) && !image.uri), `${record.id}: images embedded by bufferView`);
    assert.ok(gltf.materials.some((material) => Number.isInteger(material.pbrMetallicRoughness?.baseColorTexture?.index)), `${record.id}: base-color texture referenced`);
    assert.ok(gltf.extensionsRequired?.includes("KHR_draco_mesh_compression"), `${record.id}: Draco required`);
  }
  assert.equal(totalBytes, manifest.totalBytes);
});

test("RF-03 runtime preserves meter-scale fallbacks and shared asynchronous asset loading", async () => {
  const sceneSource = await readFile(new URL("../game/levels/rf03/scene.js", import.meta.url), "utf8");
  assert.match(sceneSource, /const assetCache = new Map\(\)/);
  assert.match(sceneSource, /LEVEL\.conveyor\.infeedX/);
  assert.match(sceneSource, /createRouteCageFallback/);
  assert.match(sceneSource, /createParcelModel/);
  assert.match(sceneSource, /fallback\.equipment\.visible = false/);
  assert.match(sceneSource, /ASSETS\[`\$\{parcelType\}Parcel`\]/);
  assert.match(sceneSource, /setDRACOLoader\(dracoLoader\)/);
  assert.match(sceneSource, /loadAsset\(ASSETS\.routeCage, root\)/);
});

test("RF-03 uses tiled PBR concrete and overlapping conveyor modules", async () => {
  const sceneSource = await readFile(new URL("../game/levels/rf03/scene.js", import.meta.url), "utf8");
  assert.match(sceneSource, /hangar_concrete_floor_diff_2k\.jpg/);
  assert.match(sceneSource, /hangar_concrete_floor_nor_gl_2k\.jpg/);
  assert.match(sceneSource, /hangar_concrete_floor_rough_2k\.jpg/);
  assert.match(sceneSource, /hangar_concrete_floor_ao_2k\.jpg/);
  assert.match(sceneSource, /hangar_concrete_floor_disp_2k\.jpg/);
  assert.match(sceneSource, /texture\.repeat\.set\(6\.5, 4\)/);
  assert.match(sceneSource, /Array\.from\(\{ length: 9 \}/);
  assert.match(sceneSource, /position: \[-8 \+ index \* 2, 0, LEVEL\.conveyor\.z\]/);
  assert.match(sceneSource, /scale: \[1\.06, 1, 1\]/);
  assert.match(sceneSource, /model\.scale\.set\(\.\.\.\(placement\.scale/);
});

test("RF-03 production build copies the finalized runtime directory", async () => {
  const configSource = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");
  assert.match(configSource, /"cardinal\/rf03\/models\/runtime"/);
});
