import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createInitialState, interact, isWalkable, updateMovement } from "../game/levels/rf04/engine.js";
import { CLOTHING_TYPES, LEVEL } from "../game/levels/rf04/level.js";

function at(state, point) {
  return { ...state, player: { ...state.player, x: point.x, z: point.z } };
}

function collect(state, type) {
  return interact(at(state, state.clothes[type]));
}

function load(state, type) {
  state = collect(state, type);
  return interact(at(state, { x: LEVEL.washer.drumX, z: LEVEL.washer.drumZ }));
}

function loadAll(state = createInitialState()) {
  for (const type of CLOTHING_TYPES) state = load(state, type);
  return state;
}

function waitSeconds(state, seconds) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) state = updateMovement(state, { x: 0, z: 0 }, 0.05);
  return state;
}

test("RF-04 starts with three separate dirty clothes in the living room", () => {
  const state = createInitialState();
  assert.deepEqual(CLOTHING_TYPES.map((type) => state.clothes[type].location), ["living-room", "living-room", "living-room"]);
  assert.equal(state.washerPhase, "loading");
  assert.equal(state.progress, 100);
});

test("direction input costs 1.5 reserve per second even against a wall", () => {
  const initial = createInitialState();
  const againstWall = at(initial, { x: LEVEL.bounds.minX + LEVEL.playerRadius, z: 3 });
  const blocked = updateMovement(againstWall, { x: -1, z: 0 }, 0.05);
  assert.equal(blocked.player.x, againstWall.player.x);
  assert.ok(Math.abs(blocked.progress - 99.925) < 1e-9);

  const waiting = updateMovement(initial, { x: 0, z: 0 }, 0.05);
  assert.equal(waiting.progress, 100);
});

test("every interaction attempt costs five reserve", () => {
  const state = interact(at(createInitialState(), { x: -2, z: -4 }));
  assert.equal(state.lastEvent, "empty_interaction");
  assert.equal(state.progress, 95);
});

test("clothes are carried and loaded one at a time", () => {
  let state = collect({ ...createInitialState(), progress: 50 }, "shirt");
  assert.equal(state.carriedItem, "shirt");
  assert.equal(state.clothes.shirt.location, "carried");
  assert.equal(state.progress, 75);
  state = interact(at(state, { x: LEVEL.washer.drumX, z: LEVEL.washer.drumZ }));
  assert.equal(state.progress, 100);
  assert.equal(state.carriedItem, null);
  assert.equal(state.clothes.shirt.location, "washer");
  assert.equal(state.washerPhase, "loading");
});

test("each clothing pickup reward can only be earned once", () => {
  let state = collect({ ...createInitialState(), progress: 50 }, "shirt");
  assert.equal(state.progress, 75);
  state = interact(at(state, { x: -5, z: 5 }));
  assert.equal(state.progress, 70);
  state = interact(state);
  assert.equal(state.lastEvent, "clothing_recollected_shirt");
  assert.equal(state.progress, 65);
});

test("the washer becomes ready only after all three clothes are loaded", () => {
  let state = load(createInitialState(), "shirt");
  state = load(state, "pants");
  state = collect(state, "towel");
  state = { ...state, progress: 50 };
  state = interact(at(state, { x: LEVEL.washer.drumX, z: LEVEL.washer.drumZ }));
  assert.equal(state.washerPhase, "ready");
  assert.equal(state.lastEvent, "all_clothes_loaded");
  assert.equal(state.progress, 100);
  assert.deepEqual(CLOTHING_TYPES.map((type) => state.clothes[type].location), ["washer", "washer", "washer"]);
});

test("completed washing and unloading each grant fifteen reserve", () => {
  let state = { ...loadAll(), progress: 50 };
  state = interact(at(state, { x: LEVEL.washer.panelX, z: LEVEL.washer.panelZ }));
  assert.equal(state.washerPhase, "washing");
  assert.equal(state.progress, 45);
  state = waitSeconds(state, 8.05);
  assert.equal(state.washerPhase, "done");
  assert.equal(state.progress, 60);
  state = interact(at(state, { x: LEVEL.washer.drumX, z: LEVEL.washer.drumZ }));
  assert.equal(state.carriedItem, "wet-batch");
  assert.equal(state.progress, 70);
});

test("the eight-second wash advances during WAIT without draining reserve", () => {
  let state = loadAll();
  state = interact(at(state, { x: LEVEL.washer.panelX, z: LEVEL.washer.panelZ }));
  const startedAt = state.progress;
  state = waitSeconds(state, 7.9);
  assert.equal(state.washerPhase, "washing");
  state = waitSeconds(state, 0.15);
  assert.equal(state.washerPhase, "done");
  assert.equal(state.lastEvent, "washer_finished");
  assert.equal(state.progress, Math.min(LEVEL.progress.maximum, startedAt + LEVEL.progress.taskCompletionReward));
});

test("wet laundry can be dropped and collected as one batch", () => {
  let state = loadAll();
  state = interact(at(state, { x: LEVEL.washer.panelX, z: LEVEL.washer.panelZ }));
  state = waitSeconds(state, 8.05);
  state = interact(at(state, { x: LEVEL.washer.drumX, z: LEVEL.washer.drumZ }));
  state = interact(at(state, { x: 4, z: 3 }));
  assert.equal(state.carriedItem, null);
  assert.deepEqual(CLOTHING_TYPES.map((type) => state.clothes[type].location), ["wet-ground", "wet-ground", "wet-ground"]);
  state = interact(state);
  assert.equal(state.carriedItem, "wet-batch");
});

test("hanging the wet batch immediately completes RF-04 and restores reserve", () => {
  let state = loadAll();
  state = interact(at(state, { x: LEVEL.washer.panelX, z: LEVEL.washer.panelZ }));
  state = waitSeconds(state, 8.05);
  state = interact(at(state, { x: LEVEL.washer.drumX, z: LEVEL.washer.drumZ }));
  state = { ...state, progress: 12 };
  state = interact(at(state, LEVEL.dryingRack));
  assert.equal(state.complete, true);
  assert.equal(state.progress, 100);
  assert.equal(state.lastEvent, "laundry_hung");
  assert.deepEqual(CLOTHING_TYPES.map((type) => state.clothes[type].location), ["hung", "hung", "hung"]);
});

test("all RF-04 objectives have reachable interaction positions", () => {
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
  const targets = [...CLOTHING_TYPES.map((type) => LEVEL.clothes[type]), LEVEL.washer, LEVEL.dryingRack];
  targets.forEach((target) => {
    assert.ok(queue.some((point) => Math.hypot(point.x - target.x, point.z - target.z) <= LEVEL.interactionRange), `unreachable target ${JSON.stringify(target)}`);
  });
});

test("RF-04 scene exposes a rotating drum and blue/green status lights", async () => {
  const source = await readFile(new URL("../game/levels/rf04/scene.js", import.meta.url), "utf8");
  assert.match(source, /washerDrum\.rotation\.z = -state\.washElapsed/);
  assert.match(source, /0x4ba6df/);
  assert.match(source, /0x58c77b/);
});

test("RF-04 scene keeps household assets at human-scale proportions", async () => {
  const source = await readFile(new URL("../game/levels/rf04/scene.js", import.meta.url), "utf8");
  assert.match(source, /box\(housing, \[0\.95, 1\.08, 0\.68\]/);
  assert.match(source, /RF04_CARDINAL_WASHER_HEIGHT = 0\.85/);
  assert.match(source, /height: RF04_CARDINAL_WASHER_HEIGHT/);
  assert.match(source, /rotationY: RF04_CARDINAL_WASHER_ROTATION/);
  assert.match(source, /RF04_CLOTHING_LONGEST/);
  assert.match(source, /shirt: 0\.62/);
  assert.match(source, /pants: 0\.85/);
  assert.match(source, /towel: 0\.72/);
  assert.match(source, /longest: 0\.85/);
});

test("RF-04 loads only the finalized roofless home asset", async () => {
  const source = await readFile(new URL("../game/levels/rf04/scene.js", import.meta.url), "utf8");
  assert.match(source, /rf04_final\.glb/);
  assert.doesNotMatch(source, /rf04_v3_static|rf04_reference_home/);
  assert.match(source, /prepareHomeModel\(prepareAsset\(/);
});

test("RF-04 restores semantic colors for neutral generated materials", async () => {
  const source = await readFile(new URL("../game/levels/rf04/scene.js", import.meta.url), "utf8");
  assert.match(source, /RF04_HOME_MATERIAL_PALETTE/);
  assert.match(source, /living\[-_ \]room\.\*floor/);
  assert.match(source, /wall\|plaster\|shelves_white/);
  assert.match(source, /rug\|carpet/);
  assert.match(source, /material\.color\.setHex\(paletteEntry\.color\)/);
});

test("RF-04 hides generator artifacts and geometry outside the playable home", async () => {
  const source = await readFile(new URL("../game/levels/rf04/scene.js", import.meta.url), "utf8");
  assert.match(source, /RF04_HOME_IGNORED_NODE_PATTERNS/);
  assert.match(source, /carnivorefactory\|herbivorefactory/);
  assert.match(source, /hoof_parent_temp/);
  assert.match(source, /RF04_HOME_PLAYABLE_BOUNDS/);
  assert.match(source, /bounds\.intersectsBox\(RF04_HOME_PLAYABLE_BOUNDS\)/);
});

test("RF-04 removes ceilings and corrects the generated television placement", async () => {
  const source = await readFile(new URL("../game/levels/rf04/scene.js", import.meta.url), "utf8");
  assert.match(source, /ceiling\|roof/);
  assert.match(source, /bounds\.min\.y > 2\.1 && size\.x > 2 && size\.z > 2/);
  assert.match(source, /fallbackEnvironment\.visible = false/);
  assert.match(source, /fallbackEnvironment\.visible = true/);
  assert.match(source, /\^TVFactory/);
  assert.doesNotMatch(source, /object\.rotation\.y \+= Math\.PI/);
  assert.match(source, /object\.position\.x -= 0\.13/);
});

test("RF-04 blocks the generated home's outer walls", () => {
  const state = createInitialState();
  assert.equal(isWalkable(state, -9.35, 5), false);
  assert.equal(isWalkable(state, 9.38, 2), false);
  assert.equal(isWalkable(state, 0, 7.19), false);
  assert.equal(isWalkable(state, 6, -7.3), false);
});

test("RF-04 restores the dining table beneath generated tabletop props", async () => {
  const source = await readFile(new URL("../game/levels/rf04/scene.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /object\.name\.includes\("TableDiningFactory"\)/);
  assert.equal(isWalkable(createInitialState(), 1.44, -4.18), false);
  assert.ok(LEVEL.staticColliders.some((collider) => collider.id === "dining-table"));
});

test("RF-04 moves the washer into the drying-rack room with aligned interaction and collision", async () => {
  const source = await readFile(new URL("../game/levels/rf04/scene.js", import.meta.url), "utf8");
  assert.match(source, /root\.position\.set\(LEVEL\.washer\.modelX, 0, LEVEL\.washer\.modelZ\)/);
  assert.match(source, /x: LEVEL\.washer\.modelX/);
  assert.match(source, /z: LEVEL\.washer\.modelZ/);
  assert.deepEqual(
    { x: LEVEL.washer.modelX, z: LEVEL.washer.modelZ },
    { x: 8.5, z: -6.3 },
  );
  assert.ok(Math.hypot(
    LEVEL.washer.modelX - LEVEL.dryingRack.modelX,
    LEVEL.washer.modelZ - LEVEL.dryingRack.modelZ,
  ) < 3.2);
  const state = createInitialState();
  assert.equal(isWalkable(state, LEVEL.washer.modelX, LEVEL.washer.modelZ), false);
  assert.equal(isWalkable(state, LEVEL.washer.drumX, LEVEL.washer.drumZ), true);
});

test("RF-04 preserves generated door openings without air walls", () => {
  const state = createInitialState();
  assert.equal(isWalkable(state, -5, 4.45), true);
  assert.equal(isWalkable(state, 2.85, 3.15), true);
  assert.equal(isWalkable(state, 3.8, -3), true);
});

test("RF-04 loads the normalized Cardinal washer and preserves runtime state overlays", async () => {
  const source = await readFile(new URL("../game/levels/rf04/scene.js", import.meta.url), "utf8");
  assert.match(source, /cardinal\/rf04\/models\/runtime\/washer\.glb/);
  assert.match(source, /rf04-cardinal-washer/);
  assert.match(source, /washerHousing\.visible = !world\.washerAsset/);
  assert.match(source, /washerDrum\.rotation\.z = -state\.washElapsed/);
});

test("RF-04 Cardinal washer runtime GLB satisfies the vertical-slice contract", async () => {
  const runtime = await readFile(new URL("../public/local-assets/cardinal/rf04/models/runtime/washer.glb", import.meta.url));
  assert.equal(runtime.subarray(0, 4).toString("utf8"), "glTF");
  assert.ok(runtime.byteLength < 9 * 1024 * 1024);
  const jsonLength = runtime.readUInt32LE(12);
  const document = JSON.parse(runtime.subarray(20, 20 + jsonLength).toString("utf8"));
  assert.equal(document.meshes.length, 1);
  assert.equal(document.materials.length, 1);
  assert.equal(document.images?.length ?? 0, 0);
  assert.equal(document.materials[0].name, "rf04_cardinal_washer_enamel");
  const position = document.accessors.find((accessor) => accessor.type === "VEC3" && accessor.min && accessor.max);
  assert.ok(position.count < 170000);
  const size = position.max.map((value, index) => value - position.min[index]);
  assert.ok(Math.abs(size[0] - 0.628) < 0.01);
  assert.ok(Math.abs(size[1] - 0.85) < 0.01);
  assert.ok(Math.abs(size[2] - 0.630) < 0.01);

  const manifest = JSON.parse(await readFile(new URL("../public/local-assets/cardinal/rf04/manifests/vertical-slice.json", import.meta.url), "utf8"));
  const washer = manifest.assets.find((asset) => asset.id === "washer");
  assert.equal(washer.modelForwardAxis, "-Z");
  assert.equal(washer.placement.rotationY, Math.PI);
  assert.equal(washer.review.status, "runtime_candidate");
});

test("RF-04 reuses Cardinal clothing and one Cardinal rack across dynamic states", async () => {
  const source = await readFile(new URL("../game/levels/rf04/scene.js", import.meta.url), "utf8");
  for (const asset of ["drying-rack", "shirt", "pants", "towel", "wet-bundle"]) {
    assert.match(source, new RegExp(`cardinal\\/rf04\\/models\\/runtime\\/${asset}\\.glb`));
  }
  assert.doesNotMatch(source, /interactables_v3/);
  assert.match(source, /loaded\.model\.clone\(true\)/);
  assert.match(source, /world\.hangers\[type\]\.add\(hangingAsset\)/);
  assert.match(source, /world\.rackFallback\.visible = !world\.rackAsset/);
  assert.match(source, /clothingFallbacks\[type\] = fallback/);
  assert.match(source, /world\.clothingFallbacks\[type\]\.visible = false/);
  assert.match(source, /rf04-cardinal-cargo-\$\{type\}/);
  assert.match(source, /group\.userData\.assetReady = Promise\.all\(assetReady\)/);
  assert.match(source, /slot\.visible = slotType === mode && hasLoadedAsset/);
  assert.match(source, /layer\.visible = !hasLoadedAsset/);
  assert.doesNotMatch(source, /createClothingModel\(type, true\)/);
  assert.doesNotMatch(source, /rackLoadedAsset|rackEmptyAsset/);
});

test("RF-04 replaces all four generated beds only after the Cardinal bed loads", async () => {
  const source = await readFile(new URL("../game/levels/rf04/scene.js", import.meta.url), "utf8");
  assert.match(source, /cardinal\/rf04\/models\/runtime\/bed\.glb/);
  assert.match(source, /RF04_BED_PLACEMENTS/);
  assert.equal((source.match(/longest: 2\.1/g) ?? []).length, 4);
  assert.match(source, /hideHomeBedFallbacks\(homeModel\)/);
  assert.match(source, /world\.bedAssets\.length === RF04_BED_PLACEMENTS\.length/);

  const runtime = await readFile(new URL("../public/local-assets/cardinal/rf04/models/runtime/bed.glb", import.meta.url));
  assert.equal(runtime.subarray(0, 4).toString("utf8"), "glTF");
  assert.ok(runtime.byteLength < 7 * 1024 * 1024);
  const jsonLength = runtime.readUInt32LE(12);
  const document = JSON.parse(runtime.subarray(20, 20 + jsonLength).toString("utf8"));
  assert.equal(document.meshes.length, 1);
  assert.ok((document.images?.length ?? 0) > 0);
  const position = document.accessors.filter((accessor) => accessor.type === "VEC3" && accessor.min && accessor.max).sort((left, right) => right.count - left.count)[0];
  assert.ok(position.count < 130000);
  const size = position.max.map((value, index) => value - position.min[index]);
  const expected = [1.65, 1.05, 2.1];
  size.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 0.002, `bed axis ${index}: ${value}`));

  const manifest = JSON.parse(await readFile(new URL("../public/local-assets/cardinal/rf04/manifests/asset-expansion.json", import.meta.url), "utf8"));
  const bed = manifest.assets.find((asset) => asset.id === "bed");
  assert.equal(bed.taskId, "aigc_704931e1a95447ddb803e7f0215993bb");
  assert.deepEqual(bed.targetSizeMeters, expected);
  assert.equal(bed.placements.length, 4);
  assert.equal(bed.review.status, "runtime_candidate");
});

test("RF-04 applies the realistic Cardinal walnut-oak floor with RF-05-style surface depth", async () => {
  const source = await readFile(new URL("../game/levels/rf04/scene.js", import.meta.url), "utf8");
  assert.match(source, /cardinal\/rf04\/textures\/realistic-walnut-oak-floor\.png/);
  assert.match(source, /THREE\.SRGBColorSpace/);
  assert.match(source, /THREE\.RepeatWrapping/);
  assert.match(source, /rf04WoodFloorTextureLoader\.load\(RF04_CARDINAL_WOOD_FLOOR_TEXTURE\)/);
  assert.doesNotMatch(source, /new THREE\.DataTexture/);
  assert.match(source, /size\.x \/ 1\.8/);
  assert.match(source, /size\.z \/ 1\.8/);
  assert.match(source, /roughness: 0\.7/);
  assert.match(source, /createWoodFloorMaterial\(sourceMaterial, size\)/);
  assert.match(source, /new THREE\.MeshStandardMaterial/);
  assert.match(source, /cardinal-warm-oak/);
  assert.match(source, /object\.material = hasMaterialArray \? materials : materials\[0\]/);
  assert.match(source, /bumpMap: map/);
  assert.match(source, /bumpScale: 0\.012/);
  assert.match(source, /side: THREE\.DoubleSide/);
  assert.match(source, /object\.geometry = object\.geometry\.clone\(\)/);
  assert.match(source, /object\.geometry\.computeVertexNormals\(\)/);
  assert.match(source, /const planarUv = new Float32Array\(position\.count \* 2\)/);
  assert.match(source, /object\.geometry\.setAttribute\("uv", new THREE\.BufferAttribute\(planarUv, 2\)\)/);
  assert.doesNotMatch(source, /emissive: 0x6f4327/);
  const texture = await readFile(new URL("../public/local-assets/cardinal/rf04/textures/realistic-walnut-oak-floor.png", import.meta.url));
  assert.equal(texture.subarray(1, 4).toString("ascii"), "PNG");
  assert.ok(texture.byteLength > 1024 * 1024);

  const manifest = JSON.parse(await readFile(new URL("../public/local-assets/cardinal/rf04/manifests/asset-expansion.json", import.meta.url), "utf8"));
  const floor = manifest.assets.find((asset) => asset.id === "warm-oak-floor");
  assert.equal(floor.taskId, "aigc_d1bf4ab2e1e94b2784f77c4750114614");
  assert.equal(floor.artifact, "textures/realistic-walnut-oak-floor.png");
  assert.deepEqual(floor.tileSizeMeters, [1.8, 1.8]);
});

test("RF-04 applies Cardinal warm plaster only to generated wall plaster materials", async () => {
  const source = await readFile(new URL("../game/levels/rf04/scene.js", import.meta.url), "utf8");
  assert.match(source, /cardinal\/rf04\/textures\/realistic-warm-plaster-wall\.png/);
  assert.match(source, /const RF04_WALL_NODE_PATTERN = \/\\\.wall\$\/i/);
  assert.match(source, /const RF04_WALL_PLASTER_MATERIAL_PATTERN = \/plaster\/i/);
  assert.match(source, /rf04WallTextureLoader\.load\(RF04_CARDINAL_WALL_TEXTURE\)/);
  assert.match(source, /RF04_WALL_TILE_METERS = 1\.5/);
  assert.match(source, /applyMetricWallUvs\(object\.geometry\)/);
  assert.match(source, /position\.getY\(vertexIndex\) \/ RF04_WALL_TILE_METERS/);
  assert.match(source, /isWall && RF04_WALL_PLASTER_MATERIAL_PATTERN\.test/);
  assert.match(source, /createWallMaterial\(sourceMaterial\)/);
  assert.match(source, /cardinal-warm-plaster/);
  assert.match(source, /bumpScale: 0\.004/);
  assert.match(source, /roughness: 0\.9/);
  assert.match(source, /metalness: 0\.01/);

  const texture = await readFile(new URL("../public/local-assets/cardinal/rf04/textures/realistic-warm-plaster-wall.png", import.meta.url));
  assert.equal(texture.subarray(1, 4).toString("ascii"), "PNG");
  assert.ok(texture.byteLength > 1024 * 1024);

  const manifest = JSON.parse(await readFile(new URL("../public/local-assets/cardinal/rf04/manifests/asset-expansion.json", import.meta.url), "utf8"));
  const wall = manifest.assets.find((asset) => asset.id === "warm-plaster-wall");
  assert.equal(wall.taskId, "aigc_5c59c57288534fb9b4a98b4aaaa463fc");
  assert.equal(wall.artifact, "textures/realistic-warm-plaster-wall.png");
  assert.deepEqual(wall.tileSizeMeters, [1.5, 1.5]);
});

test("RF-04 suppresses directional-light self-shadow ripples without removing contact shadows", async () => {
  const source = await readFile(new URL("../game/levels/rf04/scene.js", import.meta.url), "utf8");
  assert.match(source, /sun\.shadow\.camera\.near = 4/);
  assert.match(source, /sun\.shadow\.camera\.far = 40/);
  assert.match(source, /sun\.shadow\.bias = -0\.0002/);
  assert.match(source, /sun\.shadow\.normalBias = 0\.03/);
  assert.match(source, /sun\.shadow\.radius = 2/);
  assert.match(source, /const RF04_FLOOR_PATTERN = \/floor\/i/);
  assert.match(source, /object\.castShadow = !isFloor/);
  assert.match(source, /object\.receiveShadow = true/);
});

test("RF-04 Cardinal expansion GLBs meet runtime size and meter contracts", async () => {
  const specs = [
    ["drying-rack", [3.3, 2.2, 0.45], 100000],
    ["shirt", [0.56, 0.07, 0.62], 90000],
    ["pants", [0.66, 0.16, 0.85], 90000],
    ["towel", [0.72, 0.045, 0.58], 90000],
    ["wet-bundle", [0.85, 0.42, 0.72], 100000],
  ];
  for (const [name, expectedSize, maximumVertices] of specs) {
    const runtime = await readFile(new URL(`../public/local-assets/cardinal/rf04/models/runtime/${name}.glb`, import.meta.url));
    assert.equal(runtime.subarray(0, 4).toString("utf8"), "glTF");
    assert.ok(runtime.byteLength < 6 * 1024 * 1024);
    const jsonLength = runtime.readUInt32LE(12);
    const document = JSON.parse(runtime.subarray(20, 20 + jsonLength).toString("utf8"));
    assert.equal(document.meshes.length, 1);
    assert.equal(document.materials.length, 1);
    assert.ok((document.images?.length ?? 0) > 0);
    const position = document.accessors.filter((accessor) => accessor.type === "VEC3" && accessor.min && accessor.max).sort((left, right) => right.count - left.count)[0];
    assert.ok(position.count < maximumVertices);
    const size = position.max.map((value, index) => value - position.min[index]);
    size.forEach((value, index) => assert.ok(Math.abs(value - expectedSize[index]) < 0.002, `${name} axis ${index}: ${value}`));
  }
  const manifest = JSON.parse(await readFile(new URL("../public/local-assets/cardinal/rf04/manifests/asset-expansion.json", import.meta.url), "utf8"));
  assert.equal(manifest.successfulTokenCost, 33900);
  assert.equal(manifest.billedTokenCost, 34200);
  assert.deepEqual(manifest.assets.map((asset) => asset.id), ["drying-rack", "shirt", "pants", "towel", "wet-bundle", "bed", "warm-oak-floor", "warm-plaster-wall"]);
  assert.ok(manifest.runtimeBytes < 30 * 1024 * 1024);
});
