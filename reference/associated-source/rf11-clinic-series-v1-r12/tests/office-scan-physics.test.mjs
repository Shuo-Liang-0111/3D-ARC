import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OfficePhysics } from '../game/levels/rf08/scan-physics.js';
const load = (file, Type) => { const buffer = readFileSync(new URL('../public/office-scan/' + file, import.meta.url)); return new Type(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)); };
const positions = load('collision-positions.bin', Float32Array);
const indices = load('collision-indices.bin', Uint32Array);
test('full scan mesh blocks furniture and walls without triangle-count bypass', () => {
  assert.ok(indices.length / 3 > 20000);
  const physics = new OfficePhysics(positions, indices);
  try {
    assert.equal(physics.canStand(2.6, 1.65), true);
    const clear = physics.move({ x: -2, z: -1.2 }, { x: 1, z: 0 });
    assert.ok(Math.abs(clear.x + 1) < 0.01);
    const wall = physics.move({ x: 2.6, z: 1.65 }, { x: 20, z: 0 });
    assert.ok(wall.x < 2.91 && wall.x > 2.6);
    const desk = physics.move({ x: -2, z: -1.2 }, { x: 0, z: 2 });
    assert.ok(desk.z < -0.7);
    const reverse = physics.move({ x: 0, z: 1.2 }, { x: 0, z: -2 });
    assert.ok(reverse.z > 0.6);
  } finally { physics.dispose(); }
});
