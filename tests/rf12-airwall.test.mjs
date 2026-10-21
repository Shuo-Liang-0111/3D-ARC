import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL } from '../game/levels/rf12/level.js';
import { createInitialState, isWalkable } from '../game/levels/rf12/engine.js';

test('RF-12 can pass through the entrance plane into the landing', () => {
  const state = createInitialState();
  for (let positionZ = 2.5; positionZ <= 4.2; positionZ += 0.05) assert.equal(isWalkable(state, 0, positionZ), true, `doorway at ${positionZ}`);
});

test('RF-12 does not collide with the old invisible terminal cabinet', () => {
  assert.equal(isWalkable(createInitialState(), -3.1, 1.8), true);
});

test('RF-12 counter does not have a walk-through gap', () => {
  for (let positionX = -3.5; positionX <= 3.3; positionX += 0.1) assert.equal(isWalkable(createInitialState(), positionX, -2.55), false);
});

test('RF-12 fridge collision follows the visible 92 by 68 cm appliance', () => {
  const fridge = LEVEL.staticColliders.find((entry) => entry.id === 'refrigerator');
  assert.ok(Math.abs(fridge.maxX - fridge.minX - 0.92) < 1e-6);
  assert.ok(Math.abs(fridge.maxZ - fridge.minZ - 0.68) < 1e-6);
  assert.equal(isWalkable(createInitialState(), -3.55, -1), false);
  assert.equal(isWalkable(createInitialState(), -2.7, -1), true);
});
