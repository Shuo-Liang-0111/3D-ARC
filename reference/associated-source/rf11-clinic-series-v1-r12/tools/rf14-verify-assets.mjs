import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LEVEL, STRUCTURES, UMPIRE_CHAIR } from '../game/levels/rf14/level.js';

const root = `public/local-assets/levels/rf14/${LEVEL.revision}`;
const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, 'utf8'));
const records = [];
for (const [name, expected] of Object.entries(manifest.extraHashes ?? {})) {
  for (const bytes of [readFileSync(`${root}/${name}`), readFileSync(`dist/local-assets/levels/rf14/${LEVEL.revision}/${name}`), Buffer.from(await (await fetch(`http://127.0.0.1:4173/local-assets/levels/rf14/${LEVEL.revision}/${name}`)).arrayBuffer())]) assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
}
for (const name of Object.keys(manifest.hashes)) {
  const bytes = readFileSync(`${root}/${name}`);
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash, manifest.hashes[name]);
  const built = readFileSync(`dist/local-assets/levels/rf14/${LEVEL.revision}/${name}`);
  assert.equal(createHash('sha256').update(built).digest('hex'), hash);
  const served = Buffer.from(await (await fetch(`http://127.0.0.1:4173/local-assets/levels/rf14/${LEVEL.revision}/${name}`)).arrayBuffer());
  assert.equal(createHash('sha256').update(served).digest('hex'), hash);
  const document = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const imageCount = document.images?.length ?? 0;
  if (['court-bench.glb', 'tennis-bag.glb', 'ball.glb', 'environment.glb'].includes(name)) assert.ok(imageCount > 0);
  for (const image of document.images ?? []) assert.ok(Number.isInteger(image.bufferView) && !image.uri);
  const binary = bytes.subarray(28 + bytes.readUInt32LE(12));
  document.materials = [];
  document.images = [];
  document.textures = [];
  for (const mesh of document.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  const jsonBytes = Buffer.from(JSON.stringify(document));
  const padded = Buffer.concat([jsonBytes, Buffer.alloc((4 - jsonBytes.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + padded.length + binary.length, 8); header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binary.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  const input = Buffer.concat([header, padded, binHeader, binary]);
  const gltf = await new GLTFLoader().parseAsync(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gltf.scene, true);
  const size = bounds.getSize(new THREE.Vector3()).toArray();
  if (name === 'collision.glb') for (const structure of STRUCTURES) {
    let node;
    gltf.scene.traverse(object => { if (object.name === `COLLIDER_${structure.id}` || object.userData.name === `COLLIDER_${structure.id}`) node = object; });
    assert.ok(node?.userData.collision);
    const actual = new THREE.Box3().setFromObject(node, true);
    const actualSize = actual.getSize(new THREE.Vector3()).toArray();
    const actualCenter = actual.getCenter(new THREE.Vector3()).toArray();
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(Math.abs(actualSize[axis] - structure.size[axis]) < 0.002, structure.id);
      assert.ok(Math.abs(actualCenter[axis] - structure.position[axis]) < 0.002, structure.id);
    }
  }
  if (name === 'ball.glb') {
    assert.ok(size.every(value => Math.abs(value - 0.068) < 0.003), JSON.stringify({ name, size, min: bounds.min.toArray() }));
    assert.ok(Math.abs(bounds.min.y) < 0.002);
  }
  if (name === 'court-bench.glb') assert.ok(Math.abs(size[1] - 0.88) < 0.005);
  if (name === 'umpire-chair.glb') {
    gltf.scene.position.set(UMPIRE_CHAIR.x, 0, UMPIRE_CHAIR.z);
    gltf.scene.rotation.y = UMPIRE_CHAIR.yaw;
    gltf.scene.updateMatrixWorld(true);
    const placed = new THREE.Box3().setFromObject(gltf.scene, true);
    const structure = STRUCTURES.find(item => item.id === 'umpire-chair');
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(Math.abs(placed.getSize(new THREE.Vector3()).toArray()[axis] - structure.size[axis]) < 0.002);
      assert.ok(Math.abs(placed.getCenter(new THREE.Vector3()).toArray()[axis] - structure.position[axis]) < 0.002);
    }
  }
  if (name === 'tennis-bag.glb') assert.ok(Math.abs(size[0] - 0.72) < 0.005);
  records.push({ name, bytes: bytes.length, sha256: hash, images: imageCount, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size }, sourceBuildServedMatch: true });
}
const report = { revision: LEVEL.revision, checkedAt: new Date().toISOString(), passed: true, records, totalBytes: records.reduce((sum, record) => sum + record.bytes, 0), colliders: STRUCTURES.length };
writeFileSync(`production/rf14/${LEVEL.revision}/asset-verification.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
