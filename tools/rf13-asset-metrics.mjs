import { readFileSync } from "node:fs";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";

export function readGlb(path) {
  const bytes = readFileSync(path);
  if (bytes.toString("utf8", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error(`Invalid GLB: ${path}`);
  return JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
}
export function nodeBounds(document, index, parent = new Matrix4()) {
  const node = document.nodes[index];
  const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(new Vector3().fromArray(node.translation || [0, 0, 0]), new Quaternion().fromArray(node.rotation || [0, 0, 0, 1]), new Vector3().fromArray(node.scale || [1, 1, 1]));
  const transform = parent.clone().multiply(local);
  const bounds = new Box3();
  for (const primitive of document.meshes?.[node.mesh]?.primitives || []) {
    const accessor = document.accessors[primitive.attributes.POSITION];
    bounds.union(new Box3(new Vector3().fromArray(accessor.min), new Vector3().fromArray(accessor.max)).applyMatrix4(transform));
  }
  for (const child of node.children || []) bounds.union(nodeBounds(document, child, transform));
  return bounds;
}
export function assetBounds(document) {
  const bounds = new Box3();
  for (const index of document.scenes[document.scene || 0].nodes) bounds.union(nodeBounds(document, index));
  return bounds;
}
if (process.argv[1]?.endsWith("rf13-asset-metrics.mjs")) {
  for (const path of process.argv.slice(2)) {
    const document = readGlb(path);
    const bounds = assetBounds(document);
    console.log(JSON.stringify({ path, min: bounds.min.toArray(), max: bounds.max.toArray(), size: bounds.getSize(new Vector3()).toArray(), meshes: document.meshes.length, materials: document.materials?.length, images: document.images?.length }));
  }
}
