import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { RF01_VISUAL_SPEC } from "../game/rf01-environment.js";
import * as THREE from "three";
import {
  RF01_COLLISION_ASSET_URL,
  RF01_COLLISION_PROXIES,
} from "../game/rf01-collision-proxies.js";
import {
  fitModelUniformlyToSize,
  fitModelToSize,
  RF01_PRODUCTION_ASSETS,
} from "../game/rf01-production-assets.js";
import { RF01_RENDER_PROFILE } from "../game/rf01-postprocessing.js";
import { RF01_ASSETS } from "../game/scene.js";

test("RF-01 runtime separates one static park environment and four interactables", () => {
  assert.deepEqual(Object.keys(RF01_ASSETS), ["environment", "battery", "powerSlot", "slidingGate", "terminal"]);
  assert.match(RF01_ASSETS.environment, /^\/local-assets\/embodiedgen\/rf01\/models\/runtime\/rf01_industrial_park\.glb$/);
  for (const [key, path] of Object.entries(RF01_ASSETS)) {
    if (key === "environment") continue;
    assert.match(path, /^\/local-assets\/cardinal\/rf01\/models\/runtime\/rf01_(battery|power_slot|door_panel|terminal)\.glb$/);
  }
});

test("RF-01 realism layer keeps deterministic multi-channel environment contracts", () => {
  assert.equal(RF01_VISUAL_SPEC.revision, "cardinal-vertical-slice-20260814");
  assert.deepEqual(RF01_VISUAL_SPEC.surfaceChannels, ["base-color", "roughness", "height", "contact-occlusion"]);
  assert.deepEqual(RF01_VISUAL_SPEC.environmentLayers, ["playable-yard", "installed-details", "atmosphere"]);
  assert.equal(RF01_VISUAL_SPEC.deterministicSeed, 60101);
});

test("RF-01 production slice uses 2K runtime CC0 PBR assets and an 8K industrial HDRI", () => {
  assert.match(RF01_PRODUCTION_ASSETS.environment, /factory_yard_8k\.hdr$/);
  for (const material of Object.values(RF01_PRODUCTION_ASSETS.textures)) {
    assert.deepEqual(Object.keys(material), ["diffuse", "normal", "roughness", "ao", "displacement"]);
    for (const path of Object.values(material)) assert.match(path, /_2k\.jpg$/);
  }
  assert.deepEqual(Object.keys(RF01_PRODUCTION_ASSETS.models), [
    "batteryRack",
    "controlCabinet",
    "cargoCrate",
    "pipeManifold",
    "pumpUnit",
    "lightFixture",
    "workshop",
    "fenceModule",
    "guardKiosk",
    "fireStation",
    "drainGrate",
    "hedgePlanter",
  ]);
  for (const path of Object.values(RF01_PRODUCTION_ASSETS.models)) assert.match(path, /^\/local-assets\/cardinal\/rf01\/models\/runtime\/rf01_.*\.glb$/);
});

test("RF-01 Cardinal pass avoids tactile paving and duplicate facade layers", () => {
  const source = fs.readFileSync("game/rf01-production-assets.js", "utf8");
  assert.match(RF01_PRODUCTION_ASSETS.textures.concrete.diffuse, /hangar_concrete_floor_diff_2k\.jpg$/);
  assert.doesNotMatch(source, /anti_slip_concrete|createFacadeSlice|createPipeRuns/);
  assert.match(source, /rf01-cardinal-/);
  assert.ok(source.includes("material.envMapIntensity = 0.7"));
  assert.ok(source.includes("position: [7.75, 0.55, -2.1]"));
});

test("RF-01 final Cardinal pass removes perimeter context and replaces remaining legacy props", () => {
  const environmentSource = fs.readFileSync("game/rf01-environment.js", "utf8");

  const productionSource = fs.readFileSync("game/rf01-production-assets.js", "utf8");
  assert.doesNotMatch(environmentSource, /createPerimeterContext\(root, surfaces\)/);
  assert.match(productionSource, /MeshoptDecoder/);
  assert.match(productionSource, /CARDINAL_TARGET_SIZES/);
  assert.match(productionSource, /rotation: \[0, Math\.PI, 0\]/);
  assert.match(productionSource, /rf01-procedural-drainage-grates/);
  assert.match(productionSource, /EmbodiedGenWorkshop/);
  assert.match(productionSource, /WorkshopHedge/);
  assert.doesNotMatch(productionSource, /models\.doorFrame/);
  assert.match(productionSource, /object\.frustumCulled = false/);
  assert.match(productionSource, /position: \[x, 0, -7\.68\]/);
  assert.match(productionSource, /material\.side = THREE\.DoubleSide/);
});

test("RF-01 Cardinal fitting keeps swapped footprint axes in world target dimensions", () => {
  const source = new THREE.Group();
  source.name = "swapped-footprint-fixture";
  source.add(new THREE.Mesh(new THREE.BoxGeometry(0.83, 0.73, 0.98)));
  const fitted = fitModelToSize(source, [10.4, 4.6, 6]);
  fitted.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(fitted).getSize(new THREE.Vector3());

  assert.ok(Math.abs(size.x - 10.4) < 1e-9);
  assert.ok(Math.abs(size.y - 4.6) < 1e-9);
  assert.ok(Math.abs(size.z - 6) < 1e-9);
});

test("RF-01 pump fitting clears embedded anisotropic scale and preserves proportions", () => {
  const source = new THREE.Group();
  source.name = "cardinal-pump-fixture";
  const normalizedRoot = new THREE.Group();
  normalizedRoot.name = "RuntimeNormalizedRoot";
  normalizedRoot.position.set(-0.0017, 0.5748, 0.00004);
  normalizedRoot.scale.set(4.72, 1.97, 0.97);
  normalizedRoot.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.98)));
  source.add(normalizedRoot);

  const targetSize = [0.85, 1.05, 1.75];
  const fitted = fitModelUniformlyToSize(source, targetSize);
  fitted.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(fitted);
  const size = bounds.getSize(new THREE.Vector3());

  assert.deepEqual(normalizedRoot.position.toArray(), [0, 0, 0]);
  assert.deepEqual(normalizedRoot.scale.toArray(), [1, 1, 1]);
  assert.equal(fitted.scale.x, fitted.scale.y);
  assert.equal(fitted.scale.y, fitted.scale.z);
  assert.ok(size.x <= targetSize[0] + 1e-9);
  assert.ok(size.y <= targetSize[1] + 1e-9);
  assert.ok(size.z <= targetSize[2] + 1e-9);
  assert.ok(Math.abs(size.z - targetSize[2]) < 1e-9);
  assert.ok(Math.abs(bounds.min.y) < 1e-9);
});

test("RF-01 pipe manifold fitting preserves round sections and uses wall-local axes", () => {
  const source = new THREE.Group();
  source.name = "cardinal-pipe-manifold-fixture";
  const normalizedRoot = new THREE.Group();
  normalizedRoot.name = "RuntimeNormalizedRoot";
  normalizedRoot.position.set(0.0036, 0.8499, -0.0002);
  normalizedRoot.scale.set(12.3, 2.12, 0.46);
  normalizedRoot.add(new THREE.Mesh(new THREE.BoxGeometry(0.211, 0.801, 0.978)));
  source.add(normalizedRoot);

  const targetSize = [2.6, 1.7, 0.42];
  const fitted = fitModelUniformlyToSize(source, targetSize);
  fitted.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(fitted);
  const size = bounds.getSize(new THREE.Vector3());

  assert.deepEqual(normalizedRoot.scale.toArray(), [1, 1, 1]);
  assert.equal(source.rotation.y, Math.PI / 2);
  assert.equal(fitted.scale.x, fitted.scale.y);
  assert.equal(fitted.scale.y, fitted.scale.z);
  assert.ok(size.x <= targetSize[0] + 1e-9);
  assert.ok(size.y <= targetSize[1] + 1e-9);
  assert.ok(Math.abs(size.z - targetSize[2]) < 1e-9);
  assert.ok(Math.abs(bounds.min.y) < 1e-9);
});

test("RF-01 collision GLB ships named low-poly world-space proxies", () => {
  const path = `public${RF01_COLLISION_ASSET_URL}`;
  const binary = fs.readFileSync(path);
  const jsonLength = binary.readUInt32LE(12);
  const document = JSON.parse(binary.subarray(20, 20 + jsonLength).toString("utf8").trim());

  assert.ok(binary.length < 4096);
  assert.equal(document.meshes.length, 1);
  assert.deepEqual(document.nodes.map((node) => node.name), RF01_COLLISION_PROXIES.map((proxy) => proxy.name));
  assert.ok(document.nodes.every((node) => node.extras?.collision === true && node.extras?.shape === "box"));
});

test("RF-01 installs collision bounds from the loaded GLB nodes", () => {
  const productionSource = fs.readFileSync("game/rf01-production-assets.js", "utf8");
  const sceneSource = fs.readFileSync("game/scene.js", "utf8");
  const engineSource = fs.readFileSync("game/engine.js", "utf8");

  assert.match(productionSource, /loadRF01CollisionProxies/);
  assert.match(productionSource, /new THREE\.Box3\(\)\.setFromObject\(object\)/);
  assert.match(sceneSource, /installRF01CollisionProxies\(result\.colliders\)/);
  assert.match(engineSource, /getRF01StaticColliders\(\)/);
});

test("RF-01 high-end render profile includes contact AO, morphological AA and restrained bloom", () => {
  assert.equal(RF01_RENDER_PROFILE.target, "desktop-1080p-30fps");
  assert.deepEqual(RF01_RENDER_PROFILE.effects, ["gtao", "smaa", "selective-threshold-bloom", "aces"]);
  assert.equal(RF01_RENDER_PROFILE.gtao.samples, 16);
  assert.ok(RF01_RENDER_PROFILE.bloom.strength <= 0.2);
  assert.ok(RF01_RENDER_PROFILE.bloom.threshold >= 1);
});

test("RF-01 manifest records real meter-space asset bounds and hashes", () => {
  const manifest = JSON.parse(fs.readFileSync("public/local-assets/embodiedgen/rf01/models/runtime/manifest.json", "utf8"));
  assert.equal(manifest.site.width, 20);
  assert.equal(manifest.site.depth, 16);
  assert.equal(manifest.site.slidingGateClearWidth, 4);
  assert.equal(manifest.production, "EmbodiedGen Kolors + SAM3D, Blender meter normalization");
  assert.deepEqual(manifest.assetBoundary.interactables, ["battery", "power_slot", "sliding_gate", "terminal"]);
  assert.deepEqual(manifest.assets.environment.dimensions, [20, 4.76, 16]);
  assert.deepEqual(manifest.assets.battery.dimensions, [0.7, 0.28, 0.42]);
  assert.deepEqual(manifest.assets.power_slot.dimensions, [1.25, 0.36, 0.9]);
  assert.deepEqual(manifest.assets.sliding_gate.dimensions, [4, 2, 0.15]);
  assert.deepEqual(manifest.assets.terminal.dimensions, [0.55, 1.25, 0.45]);
  for (const entry of Object.values(manifest.assets)) {
    assert.ok(entry.fileBytes > 1_000_000);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  }
});
