import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { LEVEL, REVISION, PRODUCE, STRUCTURES } from '../game/levels/rf15/level.js';
import { createInitialState, updateMovement, isWalkable } from '../game/levels/rf15/engine.js';

const directory = new URL(`../public/local-assets/levels/rf15/${REVISION}/`, import.meta.url);
function readGlb(name) {
  const bytes = readFileSync(new URL(`${name}.glb`, directory));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', name);
  assert.equal(bytes.readUInt32LE(8), bytes.length, name);
  const jsonLength = bytes.readUInt32LE(12);
  return { json: JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)), binary: bytes.subarray(28 + jsonLength) };
}
function triangles(asset, nodeName) {
  const result = [];
  function accessorValues(index) {
    const accessor = asset.json.accessors[index];
    const view = asset.json.bufferViews[accessor.bufferView];
    const count = accessor.type === 'VEC3' ? 3 : 1;
    const width = accessor.componentType === 5123 ? 2 : 4;
    const stride = view.byteStride || count * width;
    const reader = accessor.componentType === 5126 ? 'readFloatLE' : width === 2 ? 'readUInt16LE' : 'readUInt32LE';
    return Array.from({ length: accessor.count }, (_, row) => Array.from({ length: count }, (_, column) => asset.binary[reader]((view.byteOffset || 0) + (accessor.byteOffset || 0) + row * stride + column * width)));
  }
  function visit(index, parent) {
    const node = asset.json.nodes[index];
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(new Vector3().fromArray(node.translation || [0, 0, 0]), new Quaternion().fromArray(node.rotation || [0, 0, 0, 1]), new Vector3().fromArray(node.scale || [1, 1, 1]));
    const world = parent.clone().multiply(local);
    if (node.name === nodeName) {
      for (const primitive of asset.json.meshes[node.mesh].primitives) {
        const positions = accessorValues(primitive.attributes.POSITION).map(position => new Vector3().fromArray(position).applyMatrix4(world));
        const indices = primitive.indices === undefined ? positions.map((_, index) => index) : accessorValues(primitive.indices).flat();
        for (let offset = 0; offset < indices.length; offset += 3) result.push(indices.slice(offset, offset + 3).map(index => positions[index]));
      }
    }
    for (const child of node.children || []) visit(child, world);
  }
  for (const node of asset.json.scenes[asset.json.scene || 0].nodes) visit(node, new Matrix4());
  return result;
}

test('RF-15 active revision contains every required binary asset', () => {
  for (const name of ['rf15_final', 'rf15_collision', 'tail-lift', 'platform-scale', 'pallet-jack', 'plane-tree', ...PRODUCE.flatMap(item => [`${item.id}-crate`, `${item.id}-box`])]) readGlb(name);
});

test('RF-15 MuJoCo walls use the authoritative level layout', () => {
  const definition = JSON.parse(readFileSync(new URL('../simulation/levels/rf15.json', import.meta.url), 'utf8'));
  assert.deepEqual(definition.walls, STRUCTURES.filter(structure => ['west-wall', 'north-wall'].includes(structure.id)));
});

test('RF-15 shed walls form one closed union without duplicate surfaces', () => {
  const faces = triangles(readGlb('rf15_final'), 'STATIC_shed-wall-shell');
  assert.ok(faces.length > 20, 'Semantic wall shell missing');
  const key = point => point.toArray().map(value => value.toFixed(4)).join(',');
  const edges = new Map();
  const uniqueFaces = new Set();
  let volume = 0;
  for (const face of faces) {
    const keys = face.map(key);
    const faceKey = [...keys].sort().join('|');
    assert.equal(uniqueFaces.has(faceKey), false, 'Duplicate wall triangle');
    uniqueFaces.add(faceKey);
    for (let edge = 0; edge < 3; edge += 1) {
      const edgeKey = [keys[edge], keys[(edge + 1) % 3]].sort().join('|');
      edges.set(edgeKey, (edges.get(edgeKey) || 0) + 1);
    }
    volume += face[0].dot(new Vector3().crossVectors(face[1], face[2])) / 6;
  }
  assert.ok([...edges.values()].every(count => count === 2), 'Open or non-manifold wall edge');
  assert.ok(Math.abs(volume - 14.364) < .001, `Unexpected wall union volume: ${volume}`);
});

test('RF-15 west and north walls block empty and loaded robots continuously', () => {
  for (const carried of [false, true]) for (const wall of ['west', 'north']) {
    let state = createInitialState();
    state.player = wall === 'west' ? { x: -7.3, z: .5, yaw: -Math.PI / 2 } : { x: -2, z: -5.5, yaw: Math.PI };
    if (carried) { state.carriedItem = 'tomato'; state.items.tomato.location = 'carried'; }
    assert.equal(isWalkable(state, state.player.x, state.player.z), true);
    for (let frame = 0; frame < 120; frame += 1) {
      state = updateMovement(state, { move: 1 }, .05);
      assert.equal(isWalkable(state, state.player.x, state.player.z), true);
      assert.equal(state.failed, false);
      const reach = carried ? .5 : LEVEL.playerForwardOffset;
      const clearance = wall === 'west' ? state.player.x + 8.4 : state.player.z + 6.6;
      assert.ok(clearance >= LEVEL.playerRadius + reach - .001, `${wall} penetration`);
    }
    assert.ok(state.blockedSeconds > 3);
  }
});
