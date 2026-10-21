import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { REVISION } from '../game/levels/rf15/level.js';

const revision = process.env.RF15_ASSET_REVISION || REVISION;
const directory = new URL(`../public/local-assets/levels/rf15/${revision}/`, import.meta.url);
function asset(name) {
  const bytes = readFileSync(new URL(`${name}.glb`, directory));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  return JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
}
function requirePbr(document, name) {
  const material = document.materials.find(material => material.name === name);
  assert.ok(material, name);
  assert.ok(material.pbrMetallicRoughness.baseColorTexture, `${name}: base color missing`);
  assert.ok(material.pbrMetallicRoughness.metallicRoughnessTexture, `${name}: roughness missing`);
  assert.ok(material.normalTexture, `${name}: normal missing`);
  for (const image of document.images) {
    assert.equal(image.uri, undefined, 'Texture must be embedded');
    assert.ok(document.bufferViews[image.bufferView].byteLength > 100);
  }
}

test('RF-15 working surfaces, walls and ground retain embedded PBR after export', () => {
  const document = asset('rf15_final');
  for (const name of ['RF15-oak-PBR', 'RF15-plaster-PBR', 'RF15-floor-PBR', 'RF15-asphalt-PBR', 'RF15-brushed-steel-PBR', 'RF15-roof-PBR']) requirePbr(document, name);
  assert.ok(document.materials.some(material => material.name.includes('plastic_crate')));
});

test('RF-15 cartons and moving lift use exported texture maps', () => {
  for (const name of ['apple-box', 'tomato-box']) requirePbr(asset(name), 'RF15-kraft-PBR');
  requirePbr(asset('tail-lift'), 'RF15-brushed-steel-PBR');
});

test('RF-15 package manifest hashes match every shipped asset', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory)));
  assert.equal(manifest.revision, revision);
  assert.equal(manifest.assets.length, 10);
  for (const entry of manifest.assets) {
    const bytes = readFileSync(new URL(`${entry.id}.glb`, directory));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.id);
  }
  const previous = new URL('../public/local-assets/levels/rf15/realism-v0.2.8/rf15_collision.glb', import.meta.url);
  assert.deepEqual(readFileSync(new URL('rf15_collision.glb', directory)), readFileSync(previous));
});
