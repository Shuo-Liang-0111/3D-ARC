import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { NodeIO } from "../.tooling/gltf-transform/node_modules/@gltf-transform/core/dist/index.js";
import { ALL_EXTENSIONS } from "../.tooling/gltf-transform/node_modules/@gltf-transform/extensions/dist/index.js";
import { getBounds } from "../.tooling/gltf-transform/node_modules/@gltf-transform/functions/dist/index.js";
import draco from "../.tooling/gltf-transform/node_modules/draco3dgltf/draco3dgltf.js";
import { SORTING, SORTING_COLLIDERS, PARCEL_TYPES, PARCEL_META } from "../game/rf01-sorting-layout.js";
import { SORTING_ASSETS as ASSETS, SORTING_SOURCE_ASSETS } from "../game/rf01-sorting-assets.js";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const report = { revision: SORTING.revision, date: new Date().toISOString(), assets: [], instances: [],
  collisionBoxes: SORTING_COLLIDERS, technicalPassed: false, visualStatus: "requires-browser-review" };
const documents = new Map();
for (const asset of [...new Set([...SORTING.placements.map(placement => placement.asset), "routeCage", "parcel"])]) {
  const url = ASSETS[asset];
  const path = "public" + url;
  const bytes = await readFile(path);
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  assert.equal(bytes.readUInt32LE(4), 2);
  const doc = await io.read(path);
  const bounds = getBounds(doc.getRoot().getDefaultScene());
  const size = bounds.max.map((value, index) => value - bounds.min[index]);
  assert.ok(doc.getRoot().listTextures().every(texture => texture.getImage()?.byteLength > 0));
  const served = await fetch("http://127.0.0.1:4173" + url);
  assert.equal(served.status, 200);
  assert.equal(hash(Buffer.from(await served.arrayBuffer())), hash(bytes));
  const sourcePath = "public" + SORTING_SOURCE_ASSETS[asset];
  const entry = { id: asset, provider: "Cardinal RF-03 reuse with mesh simplification", sourcePath, runtimePath: path,
    sourceSha256: hash(await readFile(sourcePath)), runtimeSha256: hash(bytes), bytes: bytes.length, bounds, size,
    textures: doc.getRoot().listTextures().length, servedMatches: true };
  report.assets.push(entry);
  documents.set(asset, doc);
}
for (const placement of SORTING.placements) {
  const asset = report.assets.find(entry => entry.id === placement.asset);
  asset.size.forEach((value, axis) => assert.ok(Math.abs(value * SORTING.lineScale - placement.size[axis]) < .015, placement.id + " size"));
  const minimum = asset.bounds.min.map((value, axis) => value * SORTING.lineScale + placement.position[axis]);
  const maximum = asset.bounds.max.map((value, axis) => value * SORTING.lineScale + placement.position[axis]);
  assert.ok(minimum[0] >= -4.55 && maximum[0] <= 4.55 && minimum[2] >= -6.45 && maximum[2] <= -1.9);
  report.instances.push({ ...placement, measuredWorldBounds: { min: minimum, max: maximum } });
}
for (const type of PARCEL_TYPES) {
  report.instances.push({ id: "sorting-cage-" + type, asset: "routeCage", position: [SORTING.bins[type].x,.04,SORTING.bins[type].z],
    rotation: [0,SORTING.bins[type].yaw,0], scale: SORTING.cageScale,
    targetSize: [.82,1.72,1.12].map(value => value * SORTING.cageScale), deckTop: SORTING.bins[type].floor });
  report.instances.push({ id: "sorting-parcel-" + type, asset: "parcel", targetSize: PARCEL_META[type].dimensions,
    nonUniformScaleReason: "RF-03 parcel size variants; rectangular corrugated cartons" });
}
const beltMeshes = [];
for (const node of documents.get("beltConveyor").getRoot().listNodes()) {
  for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    const geometry = new THREE.BufferGeometry().setAttribute("position",
      new THREE.BufferAttribute(primitive.getAttribute("POSITION").getArray(), 3));
    if (primitive.getIndices()) geometry.setIndex(new THREE.BufferAttribute(primitive.getIndices().getArray(), 1));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
    mesh.updateMatrixWorld(true);
    beltMeshes.push(mesh);
  }
}
report.beltSupport = [-.7,-.3,0,.3,.7].map(sample => {
  const ray = new THREE.Raycaster(new THREE.Vector3(sample, 3, 0), new THREE.Vector3(0,-1,0));
  const hit = ray.intersectObjects(beltMeshes)[0];
  assert.ok(hit);
  const surface = hit.point.y * SORTING.lineScale + .04;
  assert.ok(Math.abs(surface - SORTING.conveyor.beltHeight) < .005);
  return { localX: sample, surface, parcelBottom: SORTING.conveyor.beltHeight };
});
report.totalReusedBytes = report.assets.reduce((sum, asset) => sum + asset.bytes, 0);
report.technicalPassed = true;
const output = process.argv[2];
assert.ok(output?.startsWith("./authoring/server-production/"), "Output must remain in the task production directory");
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ revision: report.revision, assets: report.assets.length, instances: report.instances.length,
  totalReusedBytes: report.totalReusedBytes, technicalPassed: report.technicalPassed }));
