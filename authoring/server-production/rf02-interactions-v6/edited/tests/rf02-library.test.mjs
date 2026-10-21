import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ASSETS } from "../game/levels/rf02/scene.js";
import { BOOK_COLORS, LEVEL } from "../game/levels/rf02/level.js";
import { createInitialState, getInteraction, interact, isWalkable, updateMovement } from "../game/levels/rf02/engine.js";

const RUNTIME_MANIFEST = new URL("../public/local-assets/cardinal/rf02/manifests/vertical-slice.json", import.meta.url);
const assetPath = (asset) => asset.split("?", 1)[0];

function at(state, point) {
  return { ...state, player: { ...state.player, x: point.x, z: point.z } };
}

function collect(state, color) {
  return interact(at(state, state.books[color]));
}

function shelve(state, color) {
  return interact(at(state, LEVEL.shelves[color]));
}

test("RF-02 direction input drains reserve even when movement is blocked", () => {
  const initial = createInitialState();
  const idle = updateMovement(initial, { x: 0, z: 0 }, 0.05);
  const moved = updateMovement(initial, { x: 0, z: -1 }, 0.05);
  const againstWall = {
    ...initial,
    player: { x: initial.player.x, z: LEVEL.bounds.maxZ - LEVEL.playerRadius, yaw: 0 },
  };
  const blocked = updateMovement(againstWall, { x: 0, z: 1 }, 0.05);
  assert.equal(idle.progress, initial.progress);
  assert.ok(moved.progress < initial.progress);
  assert.deepEqual(blocked.player, againstWall.player);
  assert.ok(blocked.progress < againstWall.progress);
});

test("RF-02 relative controls turn in place and move along the robot heading", () => {
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

test("a library book can be collected, dropped and collected again", () => {
  let state = collect({ ...createInitialState(), progress: 70 }, "red");
  assert.equal(state.progress, 100);
  assert.equal(state.carriedBook, "red");
  state = interact(at(state, { x: 0, z: 5.8 }));
  assert.equal(state.carriedBook, null);
  assert.equal(state.books.red.location, "ground");
  state = interact(state);
  assert.equal(state.carriedBook, "red");
});

test("a wrong shelf rejects the carried book without rewarding reserve", () => {
  let state = collect({ ...createInitialState(), progress: 70 }, "red");
  assert.equal(state.progress, 100);
  const progress = state.progress;
  state = interact(at(state, LEVEL.shelves.black));
  assert.equal(state.lastEvent, "wrong_shelf");
  assert.equal(state.carriedBook, "red");
  assert.equal(state.books.red.location, "carried");
  assert.equal(state.progress, progress);
});

test("pickup and correct shelving each restore 30 reserve", () => {
  let state = collect({ ...createInitialState(), progress: 70 }, "red");
  assert.equal(state.progress, 100);
  state = shelve({ ...state, progress: 70 }, "red");
  assert.equal(state.progress, 100);
});

test("three correct shelf placements immediately complete RF-02", () => {
  let state = createInitialState();
  for (const color of BOOK_COLORS) {
    state = collect(state, color);
    state = shelve(state, color);
    if (color !== "white") assert.equal(state.complete, false);
  }
  assert.equal(state.complete, true);
  assert.equal(state.lastEvent, "all_books_shelved");
  assert.equal(state.progress, 100);
  assert.deepEqual(BOOK_COLORS.map((color) => state.books[color].location), ["shelved", "shelved", "shelved"]);
});

test("every RF-02 objective has a reachable interaction position", () => {
  const state = createInitialState();
  const step = 0.2;
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
  const targets = [...BOOK_COLORS.map((color) => LEVEL.books[color]), ...BOOK_COLORS.map((color) => LEVEL.shelves[color]), LEVEL.terminal];
  targets.forEach((target) => {
    assert.ok(queue.some((point) => Math.hypot(point.x - target.x, point.z - target.z) <= LEVEL.interactionRange), `unreachable target ${JSON.stringify(target)}`);
  });
});

test("RF-02 uses realistic public-library clearances and furniture collisions", () => {
  assert.ok(LEVEL.bounds.maxX - LEVEL.bounds.minX >= 23.5);
  assert.ok(LEVEL.bounds.maxZ - LEVEL.bounds.minZ >= 15.5);
  const state = createInitialState();
  for (const id of [
    "security-gate-west",
    "circulation-desk",
    "catalog-terminal",
    "return-table",
    "red-target-shelf",
    "black-target-shelf",
    "white-target-shelf",
    "west-stack-one",
    "east-stack-two",
    "west-reading-zone",
  ]) {
    const collider = LEVEL.staticColliders.find((entry) => entry.id === id);
    assert.ok(collider, `missing ${id}`);
    assert.equal(isWalkable(state, (collider.minX + collider.maxX) / 2, (collider.minZ + collider.maxZ) / 2), false, id);
  }
  for (const x of [-0.45, 0, 0.45]) {
    assert.equal(isWalkable(state, x, 7.1), true, `2m entrance blocked at x=${x}`);
    assert.equal(isWalkable(state, x, 6.65), true, `security-gate aisle blocked at x=${x}`);
  }
});

test("RF-02 registers the Cardinal vertical slice and preserves two validated books", () => {
  assert.deepEqual(Object.keys(ASSETS).sort(), [
    "black",
    "catalogTerminal",
    "circulationDesk",
    "environment",
    "indoorPlanter",
    "readingChair",
    "readingTable",
    "red",
    "returnCart",
    "returnSortingTable",
    "securityGateModule",
    "suspendedLinearLight",
    "white",
  ]);
  for (const key of ["environment", "red", "returnSortingTable", "readingTable", "readingChair", "catalogTerminal", "securityGateModule", "circulationDesk", "returnCart", "indoorPlanter", "suspendedLinearLight"]) {
    assert.match(assetPath(ASSETS[key]), /^\/local-assets\/cardinal\/rf02\/models\/runtime\/.+\.glb$/);
  }
  for (const color of ["black", "white"]) {
    assert.match(assetPath(ASSETS[color]), new RegExp(`/embodiedgen/rf02/models/runtime/interactables/${color}_book\\.glb$`));
  }
});

function parseGlb(buffer, label) {
  assert.equal(buffer.subarray(0, 4).toString("ascii"), "glTF", `${label}: GLB magic`);
  assert.equal(buffer.readUInt32LE(4), 2, `${label}: GLB version`);
  assert.equal(buffer.readUInt32LE(8), buffer.length, `${label}: byte length`);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a, `${label}: JSON chunk`);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8").replace(/\u0000+$/g, "").trim());
}

test("RF-02 Cardinal manifest and runtime GLBs satisfy the vertical-slice contract", async () => {
  const manifest = JSON.parse(await readFile(RUNTIME_MANIFEST, "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.rfId, "RF-02");
  assert.equal(manifest.productionStatus, "runtime_candidate");
  assert.equal(manifest.visualReview, "approved_by_user");
  assert.equal(manifest.units, "meters");
  assert.equal(manifest.upAxis, "Y");
  assert.equal(manifest.toolchain.gltfTransform, "4.4.2");
  assert.deepEqual(manifest.assets.map(({ id }) => id).sort(), [
    "catalog_terminal",
    "circulation_desk",
    "indoor_planter",
    "reading_chair",
    "reading_table",
    "red_book",
    "return_cart",
    "return_sorting_table",
    "security_gate_module",
    "static_shell",
    "suspended_linear_light",
  ]);

  let totalBytes = 0;
  for (const record of manifest.assets) {
    assert.match(record.path, /^\/local-assets\/cardinal\/rf02\/models\/runtime\/.+\.glb$/);
    assert.match(record.sha256, /^[a-f0-9]{64}$/);
    assert.equal(record.texturesEmbedded, true, `${record.id}: embedded textures`);
    assert.equal(record.draco, true, `${record.id}: Draco`);
    assert.ok(record.primitiveCount <= (record.id === "static_shell" ? 24 : 1), `${record.id}: draw-call budget`);
    assert.equal(record.review.status, record.id === "static_shell" ? "approved_after_browser_review" : "approved_by_user");
    const buffer = await readFile(new URL(`../public${record.path}`, import.meta.url));
    totalBytes += buffer.length;
    assert.equal(buffer.length, record.bytes, `${record.id}: byte count`);
    assert.equal(createHash("sha256").update(buffer).digest("hex"), record.sha256, `${record.id}: hash`);
    const gltf = parseGlb(buffer, record.id);
    assert.ok(gltf.meshes?.length > 0, `${record.id}: mesh`);
    assert.ok(gltf.images?.length > 0, `${record.id}: images`);
    assert.ok(gltf.images.every((image) => Number.isInteger(image.bufferView) && !image.uri), `${record.id}: embedded images`);
    assert.ok(gltf.materials.some((entry) => Number.isInteger(entry.pbrMetallicRoughness?.baseColorTexture?.index)), `${record.id}: base-color texture`);
    assert.ok(gltf.extensionsRequired?.includes("KHR_draco_mesh_compression"), `${record.id}: Draco extension`);
    if (record.sourceType === "cardinal_text_to_model") {
      assert.match(record.taskId, /^aigc_[a-f0-9]+$/);
      assert.equal(record.webp, true, `${record.id}: WebP`);
      assert.ok(gltf.extensionsRequired.includes("EXT_texture_webp"), `${record.id}: WebP extension`);
    }
  }
  assert.equal(totalBytes, manifest.totalBytes);
  assert.ok(totalBytes <= 40 * 1024 * 1024, `RF-02 budget exceeded: ${totalBytes}`);

  const environment = manifest.assets.find(({ id }) => id === "static_shell").dimensions;
  assert.ok(environment[0] >= 24 && environment[0] <= 24.5, `environment width ${environment[0]}`);
  assert.ok(environment[1] >= 3.6 && environment[1] <= 3.9, `environment height ${environment[1]}`);
  assert.ok(environment[2] >= 16 && environment[2] <= 16.5, `environment depth ${environment[2]}`);
  const redBook = manifest.assets.find(({ id }) => id === "red_book");
  assert.deepEqual(redBook.dimensions, [0.172, 0.041, 0.245]);
  assert.equal(redBook.pivot, "bottom_center");
  assert.deepEqual(manifest.generationAttempts.map(({ id }) => id).sort(), [
    "freestanding_stack_module",
    "reading_table_retry",
    "reading_table_set",
    "red_target_shelf",
    "wall_shelf_module",
  ]);
  assert.ok(manifest.generationAttempts.every(({ status }) => status === "failed"));
  assert.deepEqual(manifest.assets.find(({ id }) => id === "return_cart").placement.position, [2.45, 0, 4.55]);
  assert.equal(manifest.assets.find(({ id }) => id === "indoor_planter").placements.length, 4);
  assert.equal(manifest.assets.find(({ id }) => id === "suspended_linear_light").placements.length, 12);
  assert.deepEqual(manifest.assets.find(({ id }) => id === "reading_table").placements.length, 2);
  const chairAsset = manifest.assets.find(({ id }) => id === "reading_chair");
  assert.equal(chairAsset.modelForwardAxis, "+X");
  const chairs = chairAsset.placements;
  assert.equal(chairs.length, 8);
  assert.deepEqual(chairs.map(({ rotationY }) => rotationY), [-Math.PI / 2, -Math.PI / 2, Math.PI / 2, Math.PI / 2, -Math.PI / 2, -Math.PI / 2, Math.PI / 2, Math.PI / 2]);
  chairs.forEach(({ position, rotationY }) => {
    const facingX = Math.cos(rotationY);
    const facingZ = -Math.sin(rotationY);
    assert.ok(Math.abs(facingX) < 1e-12, `chair at ${position} faces along the table instead of toward it`);
    assert.ok(facingZ * (2.35 - position[2]) > 0, `chair at ${position} faces away from the table`);
  });

  assert.equal(manifest.materials.length, 1);
  const floor = manifest.materials.find(({ id }) => id === "library_terrazzo_floor");
  assert.equal(floor.sourceType, "cardinal_image_generation");
  assert.equal(floor.requestFile, "public/local-assets/cardinal/rf02/requests/library-terrazzo-floor.json");
  assert.equal(floor.taskId, "aigc_e838989a1db147f5a3461f5f3188e295");
  assert.equal(floor.sourceArtifact, "public/local-assets/cardinal/rf02/textures/source/library-terrazzo-floor.png");
  assert.equal(floor.sourceBytes, 7987453);
  assert.equal(floor.sourceSha256, "fbcd25b58d6999015527fd068773f0b8d50abf22528e489d31988410335e0594");
  assert.deepEqual(floor.resolution, [2048, 2048]);
  assert.equal(floor.usage, "embedded_in_static_shell");
  assert.equal(floor.review.status, "approved_by_user");
});

test("RF-02 scene atomically swaps the meter-scale Cardinal slice", async () => {
  const source = await readFile(new URL("../game/levels/rf02/scene.js", import.meta.url), "utf8");
  assert.match(source, /DRACOLoader/);
  assert.match(source, /assetCache/);
  assert.match(source, /STATIC_SLICE_KEYS/);
  assert.match(source, /staticResults\.every\(\(result\) => result\.loaded\)/);
  assert.match(source, /fallbackEnvironment\.visible = !staticSliceLoaded/);
  assert.match(source, /loadAsset\(ASSETS\[color\], slot\)/);
  assert.match(source, /placeRepeatedStaticModel/);
  assert.match(source, /readingTable/);
  assert.match(source, /readingChair/);
  assert.match(source, /CHAIR_FACE_POSITIVE_Z = -Math\.PI \/ 2/);
  assert.match(source, /CHAIR_FACE_NEGATIVE_Z = Math\.PI \/ 2/);
  assert.match(source, /\[-5\.76, 0, 1\.49, CHAIR_FACE_POSITIVE_Z\]/);
  assert.match(source, /\[-5\.76, 0, 3\.21, CHAIR_FACE_NEGATIVE_Z\]/);
  assert.match(source, /root\.position\.set\(book\.x, 0\.78, book\.z\)/);
  assert.match(source, /createLibraryCargoModel/);
  assert.doesNotMatch(source, /function fitModel|targetSize/);
});

test("RF-02 production build copies Cardinal and retained EmbodiedGen assets", async () => {
  const source = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");
  assert.match(source, /"cardinal\/rf02\/models\/runtime"/);
  assert.match(source, /"embodiedgen\/rf02\/models\/runtime"/);
});

test("RF-02 preserves animation metadata and preferred targets across book actions", () => {
  for (const color of BOOK_COLORS) {
    let state = at(createInitialState(), LEVEL.books[color]);
    const target = { type: "book", bookId: color };
    assert.equal(getInteraction(state, target).bookId, color);
    state = interact(state, target);
    assert.equal(state.books[color].id, color);
    assert.ok(Number.isFinite(state.books[color].y));
    state = at(state, { x: 0, z: 5.8 });
    assert.equal(getInteraction(state, { type: "shelf", color }), null);
    assert.equal(interact(state, { type: "shelf", color }).carriedBook, color);
    state = interact(state);
    assert.equal(state.books[color].y, 0.012);
    assert.ok(Math.abs(Math.hypot(state.books[color].x - state.player.x, state.books[color].z - state.player.z) - 0.6) < 1e-8);
    state = interact(state, target);
    assert.equal(state.carriedBook, color);
    state = shelve(state, color);
    assert.equal(state.books[color].id, color);
    assert.equal(state.books[color].y, 1.16);
  }
});
