import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { fitModelToSize } from "../game/rf01-production-assets.js";
import { separateShutter } from "../game/rf01-workshop.js";
import assert from "node:assert/strict";

const sourcePath = "public/local-assets/cardinal/rf01/models/runtime/rf01_factory_workshop.glb";
const source = readFileSync(sourcePath);
const jsonLength = source.readUInt32LE(12);
const description = JSON.parse(source.subarray(20, 20 + jsonLength));
description.materials = description.materials.map(() => ({ doubleSided: true }));
delete description.images;
delete description.textures;
const encoded = Buffer.from(JSON.stringify(description));
const padding = (4 - encoded.length % 4) % 4;
const json = Buffer.concat([encoded, Buffer.alloc(padding, 32)]);
const binary = source.subarray(20 + jsonLength);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + json.length + binary.length, 8);
header.writeUInt32LE(json.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const data = Buffer.concat([header, json, binary]);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const gltf = await loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), "");
const fitted = fitModelToSize(gltf.scene, [10.4, 4.6, 6]);
fitted.position.set(0, 0, -4);
fitted.rotation.y = Math.PI;
fitted.updateMatrixWorld(true);
const meshes = [];
fitted.traverse(object => { if (object.isMesh) meshes.push(object); });
const results = [];
for (const mesh of meshes) {
  const { shell, door } = separateShutter(mesh);
  shell.updateMatrixWorld(true);
  door.updateMatrixWorld(true);
  const probes = [];
  for (const x of [.2, 1.6, 3.2]) {
    for (const y of [.5, 1.5, 2]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, y, .2), new THREE.Vector3(0, 0, -1), 0, 2.5);
      const closed = ray.intersectObject(door).length;
      const opened = ray.intersectObject(shell).length;
      assert.ok(closed > 0, "closed shutter has hole " + x + "," + y);
      assert.equal(opened, 0, "opened doorway still blocked " + x + "," + y);
      probes.push({ x, y, closedHits: closed, openHits: opened });
    }
  }
  results.push({ shellTriangles: shell.geometry.index.count / 3, shutterTriangles: door.geometry.index.count / 3, probes });
}
const report = { sourcePath, sha256: createHash("sha256").update(source).digest("hex"), results };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
