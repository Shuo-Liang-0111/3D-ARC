import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createInitialState, interact, isWalkable, updateMovement } from "../game/levels/rf05/engine.js";
import { ITEM_TYPES, LEVEL } from "../game/levels/rf05/level.js";

const at = (state, point) => ({ ...state, player: { ...state.player, x: point.x, z: point.z } });
const collect = (state, type) => interact(at(state, state.items[type]));
const deliver = (state, type) => interact(at(collect(state, type), LEVEL.targets[LEVEL.itemTargets[type]]));

test("RF-05 starts with three room items and full reserve", () => {
  const state = createInitialState();
  assert.deepEqual(ITEM_TYPES.map((type) => state.items[type].location), ["room", "room", "room"]);
  assert.equal(state.progress, 100);
});

test("movement costs reserve even when blocked, while idle does not", () => {
  const state = at(createInitialState(), { x: 0, z: LEVEL.bounds.minZ + LEVEL.playerRadius });
  const blocked = updateMovement(state, { move: 1, turn: 0 }, 0.05);
  assert.equal(blocked.player.x, state.player.x);
  assert.ok(Math.abs(blocked.progress - 99.925) < 1e-9);
  assert.equal(updateMovement(createInitialState(), { move: 0, turn: 0 }, 0.05).progress, 100);
});

test("each first pickup and correct delivery grants fifteen reserve", () => {
  let state = { ...createInitialState(), progress: 50 };
  state = deliver(state, "towel");
  assert.equal(state.items.towel.location, "laundry");
  assert.equal(state.progress, 70);
});

test("wrong target charges interaction but leaves item carried", () => {
  let state = collect(createInitialState(), "cup");
  state = interact(at(state, LEVEL.targets.bin));
  assert.equal(state.lastEvent, "wrong_target");
  assert.equal(state.carriedItem, "cup");
  assert.equal(state.progress, 95);
});

test("three correct deliveries complete the room reset", () => {
  let state = createInitialState();
  for (const type of ITEM_TYPES) state = deliver(state, type);
  assert.equal(state.complete, true);
  assert.equal(state.progress, 100);
});

test("all RF-05 task points are connected to the player start", () => {
  const state = createInitialState();
  const step = 0.25;
  const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
  const queue = [{ x: LEVEL.playerStart.x, z: LEVEL.playerStart.z }];
  const visited = new Set([key(queue[0].x, queue[0].z)]);
  for (let i = 0; i < queue.length; i += 1) {
    const point = queue[i];
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const next = { x: point.x + dx, z: point.z + dz };
      const nextKey = key(next.x, next.z);
      if (!visited.has(nextKey) && isWalkable(state, next.x, next.z)) {
        visited.add(nextKey);
        queue.push(next);
      }
    }
  }
  for (const target of [...Object.values(LEVEL.items), ...Object.values(LEVEL.targets)]) {
    assert.ok(queue.some((point) => Math.hypot(point.x - target.x, point.z - target.z) <= LEVEL.interactionRange), `unreachable ${JSON.stringify(target)}`);
  }
});

test("final furniture colliders block geometry while the entrance remains open", () => {
  const state = createInitialState();
  for (const id of ["desk-chair", "tv-console", "bathroom-partition", "bathroom-room-side-wall", "bathroom-vanity", "cleaning-cart", "trash-bin"]) {
    const collider = LEVEL.staticColliders.find((entry) => entry.id === id);
    assert.ok(collider, `missing ${id}`);
    assert.equal(isWalkable(state, (collider.minX + collider.maxX) / 2, (collider.minZ + collider.maxZ) / 2), false, id);
  }
  for (const x of [-0.3, 0, 0.3]) assert.equal(isWalkable(state, x, 5.05), true, `blocked entrance at x=${x}`);
});

test("RF-05 scene references the complete Cardinal furniture, task, and surface set", async () => {
  const source = await readFile(new URL("../game/levels/rf05/scene.js", import.meta.url), "utf8");
  const modelMatches = [...source.matchAll(/\/local-assets\/cardinal\/rf05\/models\/runtime\/([^\"'?]+\.glb)(?:\?[^\"']+)?/g)].map((match) => match[1]);
  assert.deepEqual(modelMatches, [
    "twin_bed.glb",
    "bedside_table.glb",
    "writing_desk.glb",
    "desk_chair.glb",
    "television_console.glb",
    "wardrobe.glb",
    "luggage_bench.glb",
    "curtain_window_module.glb",
    "bathroom_vanity.glb",
    "toilet.glb",
    "shower_fixture.glb",
    "ceiling_light.glb",
    "towel.glb",
    "drinking_cup.glb",
    "paper_trash.glb",
    "laundry_basket.glb",
    "cleaning_cart.glb",
    "trash_bin.glb",
  ]);
  assert.doesNotMatch(source, /local-assets\/embodiedgen\/rf05/);
  assert.doesNotMatch(source, /\[0, 2\.86, 0\], wall, "Ceiling"/, "fixed overhead camera must keep the room open-top");
  for (const surface of ["guestroom_wood_floor.png", "warm_gray_wall.png", "bathroom_floor_tile.png", "bathroom_wall_tile.png"]) {
    assert.match(source, new RegExp(`/local-assets/cardinal/rf05/textures/source/${surface.replace(".", "\\.")}`));
  }
  assert.doesNotMatch(source, /candidate|draft|backup|old|round[0-9]/i);
});

test("RF-05 rests the towel on the bed and faces the television into the room", async () => {
  const source = await readFile(new URL("../game/levels/rf05/scene.js", import.meta.url), "utf8");
  assert.match(source, /const surfaceY = item\.location === "floor" \? 0\.02 : type === "towel" \? 0\.40/);
  assert.match(source, /const surfaceZ = type === "towel" && item\.location === "room" \? item\.z - 0\.30 : item\.z/);
  assert.match(source, /add\("televisionConsole", ASSETS\.televisionConsole, \[3\.70, 0, 0\.25\], -Math\.PI \/ 2\);/);
});

test("RF-05 rotates side-facing Cardinal furniture before meter fitting", async () => {
  const source = await readFile(new URL("../tools/rf05-prepare-cardinal-assets.mjs", import.meta.url), "utf8");
  assert.match(source, /\["twin_bed", \{[^\n]+rotateY: -90/);
  assert.match(source, /\["television_console", \{[^\n]+rotateY: -90/);
  assert.match(source, /normalizeArgs\.push\("--rotate-y", String\(options\.rotateY\)\)/);
});

test("RF-05 reuses interactable GLBs for cargo, has no world-following duplicate, and preserves delivered items", async () => {
  const source = await readFile(new URL("../game/levels/rf05/scene.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /world\.cargo|cargo\.position\.set/);
  assert.match(source, /loadAsset\(ASSETS\[type\], slot\)/);
  assert.match(source, /DELIVERED_ITEM_POSES/);
  assert.match(source, /\["room", "floor", LEVEL\.itemTargets\[type\]\]\.includes\(item\.location\)/);
});

function parseGlb(buffer, label) {
  assert.equal(buffer.toString("ascii", 0, 4), "glTF", `${label} is not a binary glTF`);
  assert.equal(buffer.readUInt32LE(4), 2, `${label} must be glTF 2.0`);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a, `${label} has no JSON chunk`);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength).replace(/\u0000+$/g, "").trim());
}

test("RF-05 production GLBs contain embedded textures and match the reviewed physical scale manifest", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/local-assets/cardinal/rf05/manifests/runtime.json", import.meta.url), "utf8"));
  assert.equal(manifest.productionStatus, "visual_complete");
  assert.equal(manifest.visualReview, "pass");
  assert.equal(manifest.referenceMatch, "pass");
  assert.deepEqual(manifest.layout.roomMeters, [8.4, 2.8, 10.8]);
  assert.equal(manifest.assets.length, 18);
  assert.equal(manifest.surfaces.length, 4);

  for (const asset of manifest.assets) {
    const file = asset.path.split("/").at(-1);
    const url = new URL(`../public${asset.path}`, import.meta.url);
    const fileStat = await stat(url);
    assert.ok(fileStat.size >= 75_000, `${file} is unexpectedly small (${fileStat.size} bytes)`);
    const gltf = parseGlb(await readFile(url), file);
    assert.ok(gltf.meshes?.length > 0, `${file} has no meshes`);
    assert.ok(gltf.images?.length > 0, `${file} has no embedded images`);
    assert.ok(gltf.textures?.length > 0, `${file} has no textures`);
    assert.ok(gltf.images.every((image) => Number.isInteger(image.bufferView)), `${file} has external images`);
  }

  for (const surface of manifest.surfaces) {
    const url = new URL(`../public${surface.path}`, import.meta.url);
    assert.ok((await stat(url)).size >= 50_000, `${surface.id} texture is unexpectedly small`);
  }

  const cup = manifest.assets.find((asset) => asset.id === "drinking_cup").dimensions;
  assert.ok(cup[0] >= 0.09 && cup[0] <= 0.12, `cup width ${cup[0]}m`);
  assert.ok(cup[1] >= 0.11 && cup[1] <= 0.15, `cup height ${cup[1]}m`);
  assert.ok(cup[2] >= 0.09 && cup[2] <= 0.12, `cup depth ${cup[2]}m`);

  const trash = manifest.assets.find((asset) => asset.id === "paper_trash").dimensions;
  assert.ok(Math.max(...trash) <= 0.2, `trash exceeds 0.20m: ${trash.join(" x ")}`);
});

test("RF-05 production build copies Cardinal models and surfaces", async () => {
  const source = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");
  assert.match(source, /"cardinal\/rf05\/models\/runtime"/);
  assert.match(source, /"cardinal\/rf05\/textures\/source"/);
});
