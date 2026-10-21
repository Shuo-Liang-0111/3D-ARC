import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";

const root = "public/local-assets/cardinal/rf12-v2";
function glbBounds(filename) {
  const buffer = readFileSync(`${root}/models/runtime/${filename}`);
  assert.equal(buffer.readUInt32LE(0), 0x46546c67);
  const document = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
  const result = new Map();
  function visit(index, parent) {
    const node = document.nodes[index];
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(new Vector3(...(node.translation ?? [0, 0, 0])), new Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new Vector3(...(node.scale ?? [1, 1, 1])));
    const world = parent.clone().multiply(local);
    const bounds = new Box3();
    for (const primitive of document.meshes?.[node.mesh]?.primitives ?? []) {
      const accessor = document.accessors[primitive.attributes.POSITION];
      bounds.union(new Box3(new Vector3(...accessor.min), new Vector3(...accessor.max)).applyMatrix4(world));
    }
    for (const child of node.children ?? []) bounds.union(visit(child, world));
    result.set(node.name, bounds);
    return bounds;
  }
  for (const index of document.scenes[document.scene ?? 0].nodes) visit(index, new Matrix4());
  return result;
}
const environment = glbBounds("kitchen_environment_installed.glb");
const source = readFileSync("game/levels/rf12/scene.js", "utf8");

test("RF-12 sliding door clears the entrance and lies parallel to its wall", () => {
  const door = environment.get("RF12_ENTRY_GLASS_PANEL");
  const size = door.getSize(new Vector3());
  assert.ok(door.min.x > 0.95);
  assert.ok(size.x > 1.6 && size.z < 0.03);
});

test("RF-12 cupboard clears window opening and sill", () => {
  const cabinet = environment.get("RF12_UPPER_WEST_BODY");
  assert.ok(cabinet.max.x < -1.52);
  assert.ok(cabinet.min.y >= 1.49);
  assert.ok(environment.get("RF12_NORTH_WALL_WINDOW_LEFT").max.x <= -1.424);
  assert.ok(environment.get("RF12_NORTH_WALL_WINDOW_RIGHT").min.x >= -0.076);
  assert.ok(environment.get("RF12_NORTH_WALL_TILE_LOW").max.y < 1.151);
  assert.ok(environment.get("RF12_NORTH_WALL_TILE_HIGH").min.y > 2.399);
});

test("RF-12 cupboard bodies do not overlap", () => {
  assert.ok(environment.get("RF12_BASE_WEST_BODY").max.x <= environment.get("RF12_BASE_EAST_BODY").min.x);
});

test("RF-12 replacement basin closes all sampled bottom positions", () => {
  const sink = glbBounds("kitchen_sink_repaired.glb");
  assert.ok(sink.has("RF12_SINK_CONTINUOUS_BASIN"));
  const report = JSON.parse(readFileSync(`${root}/manifests/sink-repair-checks.json`, "utf8"));
  assert.equal(report.rays.length, 9);
  for (const ray of report.rays) assert.ok(ray.height > 0.02 && ray.height < 0.04);
  assert.match(source, /kitchen_sink_repaired\.glb/);
});

test("RF-12 preview and gameplay reuse repaired assets and cloth clones", () => {
  assert.match(source, /source\.clone\(true\)/);
  assert.match(source, /kitchen_environment_installed\.glb/);
  assert.match(source, /wallTexture\.repeat\.set\(1, 1\)/);
  assert.match(source, /y: 0\.81/);
  assert.match(readFileSync("game/levels/rf12/preview.js", "utf8"), /syncKitchenVisuals\(world, state\)/);
});

test("RF-12 range hood has a closed housing and mounted chimney", () => {
  const hood = glbBounds("range_hood_repaired.glb");
  assert.ok(hood.has("RF12_HOOD_SLOPED_HOUSING"));
  assert.ok(hood.has("RF12_HOOD_CHIMNEY"));
  const size = hood.get("RF12_HOOD_CANOPY").getSize(new Vector3());
  assert.ok(Math.abs(size.x - 0.98) < 0.002);
  assert.match(source, /range_hood_repaired\.glb/);
});

test("RF-12 entrance has a full depth hall and matching end wall", () => {
  assert.ok(environment.get("RF12_ENTRY_LANDING").max.z > 6.89);
  assert.ok(environment.get("RF12_ENTRY_LANDING_END").min.z > 6.81);
  assert.ok(environment.has("RF12_GAS_RISER_UPPER"));
});
