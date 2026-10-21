import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createInitialState, interact, isWalkable, updateMovement } from "../game/levels/rf06/engine.js";
import { ITEM_TYPES, LEVEL } from "../game/levels/rf06/level.js";
import { ASSETS, KITCHEN_SOUTH_WALL_REPAIR, WASHROOM_WEST_WALL_REPAIR, createWaterLeakCargoModel, createWaterLeakScene, normalizeFloorFurniture, setWaterLeakCargoModel, syncWaterLeakVisuals } from "../game/levels/rf06/scene.js";

const RUNTIME_MANIFEST = new URL("../public/local-assets/embodiedgen/rf06/models/runtime/manifest.json", import.meta.url);
const assetPath = (asset) => asset.split("?", 1)[0];

const at = (state, point) => ({ ...state, player: { ...state.player, x: point.x, z: point.z } });
const pick = (state, type) => interact(at(state, state.items[type]));
const moveTo = (state, point) => at(state, point);

test("RF-06 starts walkable with three tools and active leak", () => { const state = createInitialState(); assert.equal(isWalkable(state, state.player.x, state.player.z), true); assert.deepEqual(ITEM_TYPES.map((type) => state.items[type].location), ["room", "room", "room"]); assert.equal(state.valveClosed, false); assert.equal(state.progress, 100); });
test("movement drains reserve even when blocked, idle does not", () => { const state = at(createInitialState(), { x: LEVEL.bounds.minX + LEVEL.playerRadius, z: 3 }); const blocked = updateMovement(state, { move: -1, turn: 0 }, 0.05); assert.equal(blocked.player.x, state.player.x); assert.equal(blocked.progress, 99.925); assert.equal(updateMovement(state, { move: 0, turn: 0 }, 0.05).progress, 100); });
test("wrench closes valve and awards stage reward", () => { let state = pick(createInitialState(), "wrench"); state = interact(moveTo(state, LEVEL.valve)); assert.equal(state.valveClosed, true); assert.equal(state.carriedItem, null); assert.equal(state.lastEvent, "valve_closed"); });
test("bucket placement requires closed valve", () => { let state = pick(createInitialState(), "bucket"); state = interact(moveTo(state, LEVEL.bucketDrop)); assert.equal(state.bucketPlaced, false); state = pick(state, "wrench"); state = interact(moveTo(state, LEVEL.valve)); state = pick(state, "bucket"); state = interact(moveTo(state, LEVEL.bucketDrop)); assert.equal(state.bucketPlaced, true); });
test("mop cleans puddle and tools return to rack to complete", () => { let state = createInitialState(); state = pick(state, "wrench"); state = interact(moveTo(state, LEVEL.valve)); state = pick(state, "bucket"); state = interact(moveTo(state, LEVEL.bucketDrop)); state = pick(state, "mop"); state = interact(moveTo(state, LEVEL.puddle)); state = pick(state, "wrench"); state = interact(moveTo(state, LEVEL.toolRack)); state = pick(state, "mop"); state = interact(moveTo(state, LEVEL.toolRack)); assert.equal(state.puddleClean, true); assert.equal(state.complete, true); assert.equal(state.progress, 100); });
test("a cleaned puddle cannot award reserve again", () => {
  let state = createInitialState();
  state = pick(state, "wrench");
  state = interact(moveTo(state, LEVEL.valve));
  state = pick(state, "bucket");
  state = interact(moveTo(state, LEVEL.bucketDrop));
  state = pick(state, "mop");
  state = interact(moveTo(state, LEVEL.puddle));
  assert.equal(state.lastEvent, "puddle_cleaned");

  state = pick({ ...state, progress: 40 }, "mop");
  assert.equal(state.progress, 35);
  state = interact(moveTo(state, LEVEL.puddle));
  assert.equal(state.lastEvent, "item_dropped_mop");
  assert.equal(state.progress, 30);
  assert.equal(state.puddleClean, true);
});
test("all task locations are reachable through graybox", () => { const state = createInitialState(); const step = 0.1; const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`; const queue = [{ x: LEVEL.playerStart.x, z: LEVEL.playerStart.z }]; const visited = new Set([key(queue[0].x, queue[0].z)]); for (let i = 0; i < queue.length; i += 1) { const p = queue[i]; for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) { const n = { x: p.x + dx, z: p.z + dz }; if (!visited.has(key(n.x, n.z)) && isWalkable(state, n.x, n.z)) { visited.add(key(n.x, n.z)); queue.push(n); } } } [ ...ITEM_TYPES.map((type) => LEVEL.items[type]), LEVEL.valve, LEVEL.bucketDrop, LEVEL.puddle, LEVEL.toolRack ].forEach((target) => assert.ok(queue.some((point) => Math.hypot(point.x - target.x, point.z - target.z) <= LEVEL.interactionRange), `unreachable ${JSON.stringify(target)}`)); });
test("RF-06 keeps environment and interactables as separate GLBs", () => { assert.match(assetPath(ASSETS.environment), /rf06_final\.glb$/); ITEM_TYPES.forEach((type) => assert.match(assetPath(ASSETS[type]), new RegExp(`/rf06/models/runtime/interactables/${type}\\.glb$`))); });

test("RF-06 references exactly one final environment and six independent interactables", () => {
  assert.deepEqual(Object.keys(ASSETS).sort(), ["bucket", "environment", "leak", "mop", "toolRack", "valve", "wrench"]);
  assert.equal(Object.values(ASSETS).filter((asset) => assetPath(asset).endsWith("rf06_final.glb")).length, 1);
  for (const name of ["wrench", "bucket", "mop", "valve", "leak", "tool_rack"]) {
    assert.ok(Object.values(ASSETS).some((asset) => assetPath(asset).endsWith(`/interactables/${name}.glb`)), `missing ${name}`);
  }
  assert.ok(Object.values(ASSETS).every((asset) => !/(candidate|draft|backup|old)/i.test(asset)));
});

test("RF-06 final furniture colliders block while the south entry remains open", () => {
  const state = createInitialState();
  for (const point of [
    { x: -1.4, z: 3.95 },
    { x: -4.9, z: 2.0 },
    { x: -2.85, z: -3.0 },
    { x: 0.7, z: -1.25 },
    { x: 5.05, z: -2.6 },
    { x: 3.1, z: 3.5 },
  ]) assert.equal(isWalkable(state, point.x, point.z), false, `expected blocked ${JSON.stringify(point)}`);
  for (const x of [3.9, 4.1]) {
    assert.equal(isWalkable(state, x, -3.52), true, `entry gap blocked at x=${x}`);
  }
});

test("RF-06 closes the unfinished washroom west wall and preserves its south entrance", () => {
  const state = createInitialState();
  assert.deepEqual(WASHROOM_WEST_WALL_REPAIR, {
    size: [0.12, 2.75, 0.87],
    position: [2.68, 1.375, 1.915],
  });
  assert.equal(isWalkable(state, 2.68, 1.915), false, "repaired west wall must block traversal");
  assert.equal(isWalkable(state, 3.95, 1.1), true, "south doorway must remain open");
  assert.ok(LEVEL.staticColliders.some(({ id }) => id === "washroom-west-wall-repair"));
});

test("RF-06 closes the unintended kitchen south opening and preserves its east doorway", async () => {
  const state = createInitialState();
  assert.deepEqual(KITCHEN_SOUTH_WALL_REPAIR, {
    size: [1.65, 2.75, 0.12],
    position: [-2.475, 1.375, 0.62],
  });
  assert.equal(isWalkable(state, -2.475, 0.62), false, "repaired south wall must block traversal");
  assert.equal(isWalkable(state, -1.41, 1.76), true, "east doorway must remain open");
  assert.ok(LEVEL.staticColliders.some(({ id }) => id === "kitchen-south-wall-repair"));
  const source = await readFile(new URL("../game/levels/rf06/scene.js", import.meta.url), "utf8");
  assert.match(source, /RF06_V13_Kitchen_Slider_A/);
  assert.match(source, /RF06_V13_Kitchen_Slider_B/);
});

test("RF-06 scene keeps placed and returned tools visible and uses GLBs for robot cargo", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../game/levels/rf06/scene.js", import.meta.url), "utf8");
  assert.match(source, /"room", "floor", "placed", "tool-rack"/);
  assert.match(source, /FIXED_ITEM_POSES/);
  assert.match(source, /loadAsset\(ASSETS\[type\], slot\)/);
  assert.match(source, /rackIndicator/);
  assert.match(source, /NON_SHADOW_NAME_PATTERN/);
  assert.match(source, /NON_SHADOW_MATERIAL_PATTERN/);
  assert.match(source, /object\.castShadow = (?:shouldCastShadow\(object\)|false)/);
  assert.match(source, /sun\.shadow\.bias = -0\.00008/);
  assert.doesNotMatch(source, /object\.castShadow = true/);
  assert.doesNotMatch(source, /rf06-graybox-baseline-environment/);
});

test("RF-06 re-anchors Cardinal sofa geometry to a centered floor contact", () => {
  const model = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.94, 2.35), new THREE.MeshStandardMaterial());
  mesh.position.set(0.2, -0.47, -1.175);
  model.add(mesh);
  normalizeFloorFurniture(model);
  const bounds = new THREE.Box3().setFromObject(model);
  assert.ok(Math.abs(bounds.min.x + bounds.max.x) < 1e-6, "x center is normalized");
  assert.ok(Math.abs(bounds.min.z + bounds.max.z) < 1e-6, "z center is normalized");
  assert.ok(Math.abs(bounds.min.y) < 1e-6, "bottom rests on floor");
});

function parseGlb(buffer, label) {
  assert.equal(buffer.subarray(0, 4).toString("ascii"), "glTF", `${label}: GLB magic`);
  assert.equal(buffer.readUInt32LE(4), 2, `${label}: GLB version`);
  assert.equal(buffer.readUInt32LE(8), buffer.length, `${label}: declared byte length`);
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a, `${label}: first chunk is JSON`);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8").replace(/[\\0 ]+$/g, ""));
}

function checkDimensions(id, dimensions) {
  assert.equal(dimensions.length, 3, `${id}: dimensions must be [x,y,z]`);
  assert.ok(dimensions.every((value) => Number.isFinite(value) && value > 0), `${id}: positive dimensions`);
  const sorted = [...dimensions].sort((a, b) => a - b);
  if (id === "environment") {
    assert.ok(dimensions[0] >= 10.7 && dimensions[0] <= 10.9, `${id}: 10.8 m width`);
    assert.ok(dimensions[1] >= 2.7 && dimensions[1] <= 3.0, `${id}: 2.75 m household height`);
    assert.ok(dimensions[2] >= 7.9 && dimensions[2] <= 8.1, `${id}: 8 m depth`);
  } else if (id === "wrench") {
    assert.ok(sorted[2] >= 0.25 && sorted[2] <= 0.45, `${id}: plausible length`);
  } else if (id === "bucket") {
    assert.ok(sorted[2] >= 0.30 && sorted[2] <= 0.55, `${id}: plausible size`);
  } else if (id === "mop") {
    assert.ok(sorted[2] >= 1.10 && sorted[2] <= 1.60, `${id}: plausible handle length`);
  } else if (id === "valve") {
    assert.ok(sorted[2] >= 0.20 && sorted[2] <= 0.50, `${id}: plausible size`);
  } else if (id === "leak") {
    assert.ok(dimensions[1] >= 0.005 && dimensions[1] <= 0.05, `${id}: thin water surface`);
    assert.ok(Math.max(dimensions[0], dimensions[2]) >= 1.0 && Math.max(dimensions[0], dimensions[2]) <= 1.8, `${id}: plausible puddle span`);
  } else if (id === "tool_rack") {
    assert.ok(dimensions[0] >= 0.65 && dimensions[0] <= 0.80, `${id}: 0.72 m rack width`);
    assert.ok(dimensions[1] >= 1.3 && dimensions[1] <= 1.6, `${id}: 1.5 m rack height`);
    assert.ok(dimensions[2] >= 0.18 && dimensions[2] <= 0.28, `${id}: 0.22 m rack depth`);
  }
}
test("RF-06 runtime manifest and seven textured Draco GLBs satisfy the release contract", async () => {
  const manifest = JSON.parse(await readFile(RUNTIME_MANIFEST, "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.rfId, "RF-06");
  assert.equal(manifest.productionStatus, "visual_complete");
  assert.equal(manifest.humanVisualReview, "pass");
  assert.equal(manifest.referenceMatch, "pass");
  assert.equal(manifest.units, "meters");
  assert.equal(manifest.upAxis, "Y");
  assert.equal(manifest.assets.length, 7);
  assert.deepEqual(manifest.assets.map(({ id }) => id).sort(), ["bucket", "environment", "leak", "mop", "tool_rack", "valve", "wrench"]);

  let totalBytes = 0;
  for (const record of manifest.assets) {
    assert.match(record.path, /^\/local-assets\/embodiedgen\/rf06\/models\/runtime\/.+\.glb$/);
    assert.match(record.sha256, /^[a-f0-9]{64}$/);
    assert.ok(record.source && (typeof record.source === "string" || record.source.length > 0), `${record.id}: source provenance`);
    assert.ok(record.pivot, `${record.id}: pivot contract`);
    assert.equal(record.humanVisualReview, "pass", `${record.id}: visual review`);
    checkDimensions(record.id, record.dimensions);

    const fileUrl = new URL(`../public${record.path}`, import.meta.url);
    const buffer = await readFile(fileUrl);
    totalBytes += buffer.length;
    assert.equal(buffer.length, record.bytes, `${record.id}: byte count`);
    assert.equal(createHash("sha256").update(buffer).digest("hex"), record.sha256, `${record.id}: SHA-256`);
    const gltf = parseGlb(buffer, record.id);
    assert.ok(gltf.meshes?.length > 0, `${record.id}: mesh`);
    assert.ok(gltf.materials?.length > 0, `${record.id}: material`);
    assert.ok(gltf.images?.length > 0, `${record.id}: image`);
    assert.ok(gltf.textures?.length > 0, `${record.id}: texture`);
    assert.ok(gltf.images.every((image) => Number.isInteger(image.bufferView) && !image.uri), `${record.id}: images embedded by bufferView`);
    assert.ok(gltf.materials.some((material) => Number.isInteger(material.pbrMetallicRoughness?.baseColorTexture?.index)), `${record.id}: base-color texture is referenced`);
    assert.ok(gltf.extensionsRequired?.includes("KHR_draco_mesh_compression"), `${record.id}: Draco required`);
    assert.ok(gltf.meshes.some((mesh) => mesh.primitives?.some((primitive) => primitive.extensions?.KHR_draco_mesh_compression)), `${record.id}: Draco primitive`);
  }
  assert.equal(totalBytes, manifest.totalBytes);
  assert.ok(totalBytes <= 40 * 1024 * 1024, `RF-06 download budget exceeded: ${totalBytes}`);
});

test("RF-06 shares asynchronous GLB loads across world and cargo while preserving fallbacks", async () => {
  const originalLoad = GLTFLoader.prototype.load;
  const originalWarn = console.warn;
  const calls = new Map();
  console.warn = () => {};
  GLTFLoader.prototype.load = function fakeLoad(url, onLoad, _onProgress, onError) {
    calls.set(url, (calls.get(url) ?? 0) + 1);
    setTimeout(() => {
      if (url === ASSETS.mop) return onError(new Error("intentional mop load failure"));
      const source = new THREE.Group();
      source.name = `fake-${url}`;
      source.position.set(Number.NaN, Number.NaN, Number.NaN);
      source.pivot = "bottom_center";
      source.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial()));
      onLoad({ scene: source });
    }, url === ASSETS.bucket ? 20 : 0);
    return this;
  };

  try {
    const cargoA = createWaterLeakCargoModel();
    setWaterLeakCargoModel(cargoA, "bucket");
    assert.equal(cargoA.userData.fallback.visible, true, "fallback remains while the bucket is pending");
    const cargoB = createWaterLeakCargoModel();
    setWaterLeakCargoModel(cargoB, "bucket");
    const world = createWaterLeakScene();
    const [cargoAResults, cargoBResults, worldResults] = await Promise.all([cargoA.userData.assetReady, cargoB.userData.assetReady, world.assetReady]);

    assert.equal(calls.size, 7);
    assert.ok([...calls.values()].every((count) => count === 1), "each URL is parsed once");
    assert.equal(cargoAResults.length, 3);
    assert.equal(cargoBResults.length, 3);
    assert.equal(worldResults.length, 7);
    assert.equal(worldResults.find((result) => result.url === ASSETS.mop)?.loaded, false);
    assert.equal(cargoA.userData.fallback.visible, false);
    assert.equal(cargoB.userData.fallback.visible, false);
    assert.equal(cargoA.userData.assetSlots.bucket.visible, true);
    assert.equal(cargoB.userData.assetSlots.bucket.visible, true);

    setWaterLeakCargoModel(cargoA, "mop");
    assert.equal(cargoA.userData.fallback.visible, true, "failed asset keeps its fallback");
    assert.equal(cargoA.userData.assetSlots.mop.children.length, 0);

    const state = createInitialState();
    syncWaterLeakVisuals(world, state);
    assert.equal(world.assetRoots.items.wrench.visible, true);
    assert.ok(world.assetRoots.items.wrench.children[0].position.toArray().every(Number.isFinite), "loaded item transforms are sanitized");
    assert.ok(world.assetRoots.items.wrench.children[0].matrix.elements.every(Number.isFinite), "loaded item matrices stay finite");
    assert.equal(world.itemRoots.mop.visible, true, "world fallback remains visible for failed mop");
    const completed = {
      ...state,
      items: {
        ...state.items,
        wrench: { ...state.items.wrench, location: "tool-rack" },
        mop: { ...state.items.mop, location: "tool-rack" },
      },
      returned: { wrench: true, mop: true },
    };
    syncWaterLeakVisuals(world, completed);
    assert.equal(world.assetRoots.items.wrench.visible, true, "returned loaded wrench stays visible");
    assert.equal(world.itemRoots.mop.visible, true, "returned fallback mop stays visible");
    assert.equal(world.rackIndicator.material.color.getHex(), 0x58b66a);
  } finally {
    GLTFLoader.prototype.load = originalLoad;
    console.warn = originalWarn;
  }
});
