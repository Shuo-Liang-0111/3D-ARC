import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { RF09_CARDINAL_ASSETS, RF09_CARDINAL_FIXTURES, RF09_CARDINAL_SPECS, RF09_SURFACE_ASSETS } from "../game/levels/rf09/cardinal-assets.js";

const publicAsset = (url) => new URL(`../public${url.split("?")[0]}`, import.meta.url);

test("RF-09 ships Cardinal runtime assets and both surface textures", () => {
  assert.equal(Object.keys(RF09_CARDINAL_ASSETS).length, 12);
  assert.equal(new Set(Object.values(RF09_CARDINAL_ASSETS)).size, 12);
  for (const url of [...Object.values(RF09_CARDINAL_ASSETS), ...Object.values(RF09_SURFACE_ASSETS)]) assert.equal(existsSync(publicAsset(url)), true, url);
  const manifest = JSON.parse(readFileSync(new URL("../public/local-assets/cardinal/rf09/manifests/runtime.json", import.meta.url), "utf8"));
  for (const [asset, spec] of Object.entries(RF09_CARDINAL_SPECS)) {
    const runtimeId = RF09_CARDINAL_ASSETS[asset].match(/\/([^/]+)\.glb/)[1]; const entry = manifest.assets[runtimeId]; assert.ok(entry, asset);
    const bounds = entry.runtimeBoundsBlender; const measured = [bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2], bounds.max[1] - bounds.min[1]];
    measured.forEach((value, index) => assert.ok(Math.abs(value - spec.size[index]) <= spec.size[index] * 0.02, `${asset} axis ${index}`));
    assert.ok(Math.abs(bounds.min[2]) <= 0.0005, `${asset} bottom-center support`); assert.equal(entry.frontAxis, "+Z"); assert.equal(entry.pivot, "bottom-center");
  }
});

test("RF-09 placements record orientation and physical support", () => {
  assert.ok(RF09_CARDINAL_FIXTURES.length >= 30);
  for (const fixture of RF09_CARDINAL_FIXTURES) { assert.equal(fixture.position[1], fixture.supportY, fixture.id); assert.ok(Number.isFinite(fixture.yaw), fixture.id); }
  assert.equal(RF09_CARDINAL_FIXTURES.find((fixture) => fixture.id === "reception-desk").yaw, Math.PI);
  assert.equal(RF09_CARDINAL_FIXTURES.find((fixture) => fixture.id === "podium").supportY, 0.78);
  assert.equal(RF09_CARDINAL_FIXTURES.find((fixture) => fixture.id === "terminal").supportY, 0.78);
  assert.ok(RF09_CARDINAL_FIXTURES.filter((fixture) => fixture.asset === "ceilingLight").every((fixture) => fixture.supportY === 3.22));
});

test("RF-09 scene uses textured surfaces and success-only replacement", () => {
  const scene = readFileSync(new URL("../game/levels/rf09/scene.js", import.meta.url), "utf8"); const surfaces = readFileSync(new URL("../game/levels/rf09/surfaces.js", import.meta.url), "utf8"); const assets = readFileSync(new URL("../game/levels/rf09/cardinal-assets.js", import.meta.url), "utf8");
  assert.match(scene, /if \(result\.loaded\) fallback\.groups\[fixture\.fallback\]\.visible = false/); assert.match(scene, /source\.clone\(true\)/); assert.match(scene, /device\.location === "floor"[^]*y: 0/); assert.match(scene, /device\.location === "office"[^]*y: 0\.96/); assert.match(scene, /device\.location[^]*"podium"/); assert.match(scene, /y: 0\.78, z: -5\.65/);
  assert.match(surfaces, /texture\.colorSpace = THREE\.SRGBColorSpace/); assert.match(assets, /carpet_floor-basecolor/); assert.match(assets, /painted_wall-basecolor/); assert.match(surfaces, /bumpMap:/);
});
