import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LEVEL } from "../game/levels/rf10/level.js";
import { createInitialState, interact, isWalkable, updateMovement } from "../game/levels/rf10/engine.js";
import { RF10_GAUSSIAN_ASSET, RF10_GAUSSIAN_TRANSFORM } from "../game/levels/rf10/gaussian.js";
import { getRF10MeshCollisionStatus, installRF10ExplorationCollision, isRF10MeshMoveAllowed } from "../game/levels/rf10/mesh-collision.js";
import { RF10_ASSETS } from "../game/levels/rf10/scene.js";

installRF10ExplorationCollision({ min: { x: -9.6, z: -3 }, max: { x: 4.2, z: 3 } });

test("RF-10 uses temporary room bounds for free exploration", () => {
  assert.equal(LEVEL.id, "rf10");
  assert.equal(getRF10MeshCollisionStatus().status, "ready");
  const state = createInitialState();
  assert.equal(isWalkable(state, LEVEL.playerStart.x, LEVEL.playerStart.z), true);
  assert.equal(isWalkable(state, -10, LEVEL.playerStart.z), false);
  assert.equal(isWalkable(state, LEVEL.playerStart.x, 3.5), false);
});

test("RF-10 free exploration does not expose task interactions or drain progress", () => {
  const state = createInitialState();
  assert.equal(interact(state).interactions, 0);
  const next = updateMovement(state, { move: 1 }, 1);
  assert.equal(next.failed, false);
  assert.equal(next.complete, false);
  assert.equal(next.progress, LEVEL.progress.maximum);
});

test("RF-10 uses the room Gaussian asset and calibrated transform", () => {
  assert.match(RF10_ASSETS.visualEnvironment, /rf10-room-full.ply$/);
  assert.match(RF10_GAUSSIAN_ASSET, /rf10-room-full.ply$/);
  assert.equal(RF10_GAUSSIAN_TRANSFORM.rotationX, 0);
  assert.equal(RF10_GAUSSIAN_TRANSFORM.rotationZ, Math.PI);
  assert.equal(RF10_GAUSSIAN_TRANSFORM.rotationY, 0);
  assert.equal(RF10_GAUSSIAN_TRANSFORM.scale, 1);
  assert.equal(RF10_GAUSSIAN_TRANSFORM.position.length, 3);
  const gaussianSource = fs.readFileSync("game/levels/rf10/gaussian.js", "utf8");
  const sceneSource = fs.readFileSync("game/levels/rf10/scene.js", "utf8");
  assert.match(gaussianSource, /maxPixelRadius: 6/);
  assert.match(gaussianSource, /sortRadial: false/);
  assert.match(gaussianSource, /minAlpha: 0.5/);
  assert.match(gaussianSource, /maxStdDev: Math\.sqrt\(2\)/);
  assert.match(gaussianSource, /return \{ root, spark, splats, ready \}/);
  assert.doesNotMatch(gaussianSource, /root\.add\(spark\)/);
  assert.match(sceneSource, /scene\.add\(gaussian\.spark\)/);
  assert.match(sceneSource, /installRF10ExplorationCollision/);
  assert.doesNotMatch(sceneSource, /IMG_7207_collider\.glb/);
});

test("RF-10 temporary collision keeps the robot inside the room bounds", () => {
  const { x, z } = LEVEL.playerStart;
  assert.equal(isRF10MeshMoveAllowed(x, z, x + 0.05, z, LEVEL.playerRadius, LEVEL.playerHeight), true);
  assert.equal(isRF10MeshMoveAllowed(x, z, 4.6, z, LEVEL.playerRadius, LEVEL.playerHeight), false);
});

test("RF-10 production build includes the Gaussian room asset directory", () => {
  const viteConfig = fs.readFileSync("vite.config.js", "utf8");
  assert.match(viteConfig, /"gaussian\/rf10"/);
});
