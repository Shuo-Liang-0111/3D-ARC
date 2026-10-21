import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { RF07_CARDINAL_ASSETS, RF07_CARDINAL_FIXTURES, RF07_CARDINAL_SPECS, RF07_SURFACE_ASSETS } from "../game/levels/rf07/cardinal-assets.js";
import { createInitialState, getInteraction, getObjective, interact, isWalkable, updateMovement } from "../game/levels/rf07/engine.js";
import { LEVEL } from "../game/levels/rf07/level.js";

const at = (state, point) => ({ ...state, player: { ...state.player, x: point.x, z: point.z } });
const use = (state, point) => interact(at(state, point));
const collect = (state, type) => use(state, LEVEL.samples[type]);
const load = (state) => use(state, LEVEL.transportCase);

test("RF-07 starts with visible samples and full reserve", () => {
  const state = createInitialState();
  assert.equal(state.progress, 100);
  assert.deepEqual(Object.values(state.samples).map((sample) => sample.location), ["storage", "storage", "storage"]);
  assert.equal(getObjective(state).step, 2);
});

test("movement costs reserve even when collision blocks displacement", () => {
  const state = at(createInitialState(), { x: 0, z: LEVEL.bounds.minZ + LEVEL.playerRadius });
  const blocked = updateMovement(state, { move: 1, turn: 0 }, 0.05);
  assert.equal(blocked.player.x, state.player.x);
  assert.equal(blocked.player.z, state.player.z);
  assert.ok(Math.abs(blocked.progress - 99.925) < 1e-9);
});

test("wrong sample order can be corrected from the case top", () => {
  let state = collect(createInitialState(), "sampleB");
  state = load(state);
  assert.equal(state.casePhase, "misordered");
  state = use(state, LEVEL.transportCase);
  assert.equal(state.carriedItem, "sampleB");
  assert.equal(state.caseSamples.length, 0);
  state = load(state);
  state = collect(state, "sampleC");
  state = load(state);
  assert.equal(state.caseSamples.length, 2);
  assert.equal(getInteraction(state).type, "case-unload");
});

test("each sample awards 40 reserve only on its first case load", () => {
  let state = collect({ ...createInitialState(), progress: 50 }, "sampleB");
  assert.equal(state.progress, 60);
  state = load(state);
  assert.equal(state.progress, 95);
  state = use(state, LEVEL.transportCase);
  assert.equal(state.progress, 90);
  state = load(state);
  assert.equal(state.progress, 85);
});

test("ordered samples, cooling, temperature and target cabinet complete", () => {
  let state = createInitialState();
  for (const type of LEVEL.requiredOrder) {
    state = collect(state, type);
    state = load(state);
  }
  assert.equal(state.casePhase, "ordered");
  state = collectCooling(state);
  state = use(state, LEVEL.transportCase);
  assert.equal(state.casePhase, "cooled");
  state = use(state, LEVEL.transportCase);
  assert.equal(state.casePhase, "sealed");
  state = use(state, LEVEL.transportCase);
  assert.equal(state.casePhase, "active");
  state = use(state, LEVEL.transportCase);
  assert.equal(state.carriedItem, "transport-case");
  state = use(state, LEVEL.coldCabinets[LEVEL.targetCabinet]);
  assert.equal(state.complete, true);
  assert.equal(state.progress, 100);
});

function collectCooling(state) {
  state = use(state, LEVEL.coolingModule);
  assert.equal(state.carriedItem, "cooling-module");
  return state;
}

test("wrong cabinet leaves the case carried", () => {
  let state = createInitialState();
  state.caseSamples = [...LEVEL.requiredOrder];
  state.casePhase = "active";
  state = use(state, LEVEL.transportCase);
  state = use(state, LEVEL.coldCabinets["cold-01"]);
  assert.equal(state.lastEvent, "wrong_cold_cabinet");
  assert.equal(state.carriedItem, "transport-case");
  assert.equal(state.complete, false);
});

test("all interactive approach points are walkable", () => {
  const state = createInitialState();
  for (const point of [...Object.values(LEVEL.samples), LEVEL.transportCase, LEVEL.coolingModule, ...Object.values(LEVEL.coldCabinets)]) {
    assert.equal(isWalkable(state, point.x, point.z), true, JSON.stringify(point));
  }
});

test("Chinese BSL-2 layout uses meter-scale room and aisle dimensions", () => {
  assert.deepEqual(LEVEL.roomDimensions, { width: 24, depth: 16, clearHeight: 3.3 });
  assert.equal(LEVEL.aisleWidths.main, 1.5);
  assert.equal(LEVEL.aisleWidths.secondary, 1.2);
  for (const sample of Object.values(LEVEL.samples)) {
    assert.ok(sample.y >= 0.9 && sample.y <= 1.05, "sample carrier must sit on a laboratory worktop");
    assert.ok(Math.hypot(sample.assetX - sample.x, sample.assetZ - sample.z) <= LEVEL.interactionRange);
  }
  assert.ok(LEVEL.transportCaseAsset.y >= 0.9 && LEVEL.transportCaseAsset.y <= 1.05);
  assert.ok(LEVEL.coolingModuleAsset.y >= 0.9 && LEVEL.coolingModuleAsset.y <= 1.05);
});

test("visible fixtures have matching colliders while the anteroom route stays open", () => {
  const state = createInitialState();
  for (const id of ["sample-receiving-bench", "bsc-bank", "dry-reagent-cabinet", "transfer-cart-01", "transfer-cart-02", "packing-island", "wash-bench", "anteroom-left", "anteroom-right", "ppe-lockers", "task-board", "cold-01", "cold-02", "cold-03"]) {
    const collider = LEVEL.staticColliders.find((entry) => entry.id === id);
    assert.ok(collider, `missing ${id}`);
    assert.equal(isWalkable(state, (collider.minX + collider.maxX) / 2, (collider.minZ + collider.maxZ) / 2), false, id);
  }
  assert.equal(isWalkable(state, 0, 7.45), true, "south entry must remain open");
  assert.equal(isWalkable(state, 0, 4.85), true, "anteroom must open into the laboratory");
});

test("transport case uses a walkable approach point and stops colliding after pickup", () => {
  const state = createInitialState();
  assert.equal(isWalkable(state, LEVEL.transportCase.x, LEVEL.transportCase.z), true);
  assert.equal(isWalkable(state, LEVEL.transportCaseAsset.x, LEVEL.transportCaseAsset.z), false);
  const carried = { ...state, carriedItem: "transport-case", casePhase: "active" };
  assert.equal(isWalkable(carried, LEVEL.transportCaseAsset.x, LEVEL.transportCaseAsset.z), false, "packing island remains a fixed fixture");
});

test("all task targets are reachable from the entry", () => {
  const state = createInitialState();
  const targets = [...Object.values(LEVEL.samples), LEVEL.transportCase, LEVEL.coolingModule, ...Object.values(LEVEL.coldCabinets)];
  for (const target of targets) assert.equal(reachable(state, target), true, JSON.stringify(target));
});

const publicAsset = (url) => new URL(`../public${url.split("?")[0]}`, import.meta.url);

test("RF-07 ships twelve Cardinal runtime assets and four floor channels", () => {
  assert.equal(Object.keys(RF07_CARDINAL_ASSETS).length, 12);
  assert.equal(new Set(Object.values(RF07_CARDINAL_ASSETS)).size, 12);
  for (const url of [...Object.values(RF07_CARDINAL_ASSETS), ...Object.values(RF07_SURFACE_ASSETS)]) {
    assert.equal(existsSync(publicAsset(url)), true, url);
  }
  const manifest = JSON.parse(readFileSync(new URL("../public/local-assets/cardinal/rf07/manifests/runtime.json", import.meta.url), "utf8"));
  for (const [asset, spec] of Object.entries(RF07_CARDINAL_SPECS)) {
    const runtimeId = RF07_CARDINAL_ASSETS[asset].match(/\/([^/]+)\.glb/)[1];
    const entry = manifest.assets[runtimeId];
    assert.ok(entry, asset);
    const bounds = entry.runtimeBoundsBlender;
    const measured = [
      bounds.max[0] - bounds.min[0],
      bounds.max[2] - bounds.min[2],
      bounds.max[1] - bounds.min[1],
    ];
    measured.forEach((value, index) => assert.ok(Math.abs(value - spec.size[index]) <= spec.size[index] * 0.02, `${asset} axis ${index}`));
    assert.ok(Math.abs(bounds.min[2]) <= 0.0005, `${asset} must rest on its support plane`);
    assert.ok(entry.runtimeBytes < 10 * 1024 * 1024, `${asset} runtime exceeds 10 MiB`);
  }
});

test("Cardinal fixture placement records orientation and floor support", () => {
  assert.equal(RF07_CARDINAL_FIXTURES.length, 12);
  assert.equal(RF07_CARDINAL_FIXTURES.filter((fixture) => fixture.asset === "classIiA2Bsc").length, 3);
  assert.equal(RF07_CARDINAL_FIXTURES.filter((fixture) => fixture.asset === "transferCart").length, 2);
  assert.equal(RF07_CARDINAL_FIXTURES.filter((fixture) => fixture.asset === "wasteBin").length, 2);
  for (const fixture of RF07_CARDINAL_FIXTURES) {
    assert.equal(fixture.position[1], fixture.supportY, fixture.id);
    assert.equal(fixture.supportY, 0, fixture.id);
    assert.ok(fixture.position[0] >= LEVEL.bounds.minX && fixture.position[0] <= LEVEL.bounds.maxX, fixture.id);
    assert.ok(fixture.position[2] >= LEVEL.bounds.minZ && fixture.position[2] <= LEVEL.bounds.maxZ, fixture.id);
    assert.ok(fixture.hidePrefixes.length > 0, fixture.id);
  }
  assert.equal(RF07_CARDINAL_FIXTURES.find((fixture) => fixture.id === "handwash-station").yaw, Math.PI / 2);
  assert.equal(RF07_CARDINAL_FIXTURES.find((fixture) => fixture.id === "ppe-lockers").yaw, Math.PI);
  assert.ok(RF07_CARDINAL_FIXTURES.filter((fixture) => fixture.asset === "transferCart").every((fixture) => fixture.yaw === Math.PI));
});

test("scene applies laboratory surfaces and success-only Cardinal replacement", () => {
  const source = readFileSync(new URL("../game/levels/rf07/scene.js", import.meta.url), "utf8");
  const surfaces = readFileSync(new URL("../game/levels/rf07/surfaces.js", import.meta.url), "utf8");
  assert.equal((source.match(/rf07_realistic_bsl2_lab\.glb/g) ?? []).length, 1);
  for (const type of ["sampleA", "sampleB", "sampleC"]) {
    assert.match(source, new RegExp(`${type}: RF07_CARDINAL_ASSETS\\.secondaryCarrier`));
  }
  assert.doesNotMatch(source, /sample_(a17|b12|c04)\.glb/);
  assert.match(source, /ensureSampleLabel\(result\.model, type\)/);
  assert.match(source, /attachSampleAssetToCase\(world\.assetRoots\.case, type, result\.model\)/);
  assert.equal((source.match(/state\.player\.yaw \+ Math\.PI/g) ?? []).length, 2);
  assert.match(source, /root\.userData\.caseRoot = caseRoot/);
  assert.match(source, /caseRoot\.visible = state\.carriedItem === "transport-case"/);
  assert.doesNotMatch(source, /model\.visible = state\.carriedItem/);
  assert.match(source, /applyLaboratorySurfaceMaterials\(result\.model\)/);
  assert.match(source, /if \(result\.loaded\)[\s\S]*hideEnvironmentNodes/);
  assert.match(source, /environmentFallback\.visible = false/);
  assert.match(source, /return \{ loaded: true, url, model, error: null \}/);
  assert.match(source, /return \{ loaded: false, url, model: null, error:/);
  assert.doesNotMatch(source, /model\.rotation\.x|model\.scale\.setScalar/);
  assert.doesNotMatch(source, /world\.root\.visible = false/);
  assert.match(surfaces, /texture\.colorSpace = THREE\.SRGBColorSpace/);
  assert.match(surfaces, /normalMap: normal/);
  assert.match(surfaces, /roughnessMap: roughness/);
  assert.match(surfaces, /aoMap: ao/);
  assert.match(surfaces, /South_Wall_/);
});

function reachable(state, target) {
  const step = 0.4;
  const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
  const queue = [{ x: state.player.x, z: state.player.z }];
  const visited = new Set([key(queue[0].x, queue[0].z)]);
  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index];
    if (Math.hypot(point.x - target.x, point.z - target.z) <= 0.55) return true;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const next = { x: point.x + dx, z: point.z + dz };
      const nextKey = key(next.x, next.z);
      if (visited.has(nextKey) || !isWalkable(state, next.x, next.z)) continue;
      visited.add(nextKey);
      queue.push(next);
    }
  }
  return false;
}
