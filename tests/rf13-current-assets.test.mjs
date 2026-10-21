import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { REVISION, STATIC_BOXES } from "../game/levels/rf13/level.js";

const root = "public/local-assets/levels/rf13/" + REVISION + "/";
function readGlb(name) {
  const bytes = readFileSync(root + name + ".glb");
  assert.equal(bytes.toString("utf8", 0, 4), "glTF");
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  return JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
}
function boundsFor(document, index, inherited = new Matrix4()) {
  const node = document.nodes[index];
  const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
    new Vector3().fromArray(node.translation || [0, 0, 0]),
    new Quaternion().fromArray(node.rotation || [0, 0, 0, 1]),
    new Vector3().fromArray(node.scale || [1, 1, 1]),
  );
  const transform = inherited.clone().multiply(local);
  const bounds = new Box3();
  for (const primitive of document.meshes?.[node.mesh]?.primitives || []) {
    const accessor = document.accessors[primitive.attributes.POSITION];
    bounds.union(new Box3(new Vector3().fromArray(accessor.min), new Vector3().fromArray(accessor.max)).applyMatrix4(transform));
  }
  for (const child of node.children || []) bounds.union(boundsFor(document, child, transform));
  return bounds;
}
test("current revision includes every required runtime GLB", () => {
  for (const name of ["environment", "collision", "gloves", "gauze", "dressings", "forms", "empty-box", "opening-terminal", "chair", "trolley"]) {
    const document = readGlb(name);
    assert.ok(document.meshes.length > 0, name);
  }
});
test("exported environment floor, walls and worktops match authoritative layout", () => {
  const document = readGlb("environment");
  assert.ok(document.images?.length >= 2, "environment must contain actual surface textures");
  for (const box of STATIC_BOXES.filter(entry => !entry.id.startsWith("waiting-seat"))) {
    const index = document.nodes.findIndex(node => node.name === box.id);
    assert.ok(index >= 0, "missing visible fixture: " + box.id);
    const bounds = boundsFor(document, index);
    for (const [axis, coordinate] of ["x", "y", "z"].entries()) {
      assert.ok(Math.abs(bounds.min[coordinate] - (box.position[axis] - box.size[axis] / 2)) < 0.025, box.id + " min " + coordinate);
      assert.ok(Math.abs(bounds.max[coordinate] - (box.position[axis] + box.size[axis] / 2)) < 0.025, box.id + " max " + coordinate);
    }
  }
});
test("current collision GLB retains authoritative wall and doorway bounds", () => {
  const document = readGlb("collision");
  for (const box of STATIC_BOXES) {
    const index = document.nodes.findIndex(node => node.name === "COLLIDER_" + box.id);
    assert.ok(index >= 0);
    const bounds = boundsFor(document, index);
    for (const [axis, coordinate] of ["x", "y", "z"].entries()) {
      assert.ok(Math.abs(bounds.min[coordinate] - box.position[axis] + box.size[axis] / 2) < 0.0001);
      assert.ok(Math.abs(bounds.max[coordinate] - box.position[axis] - box.size[axis] / 2) < 0.0001);
    }
  }
});
