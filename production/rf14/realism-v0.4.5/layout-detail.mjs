import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

const output = './production/rf14/realism-v0.4.5/review';
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:4199' });
const page = await browser.newPage();
try {
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4190/rf14-preview.html', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('#preview-status')?.dataset.ready === 'true');
  const inspection = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { createCourtScene } = await import('/game/levels/rf14/scene.js');
    for (const canvas of document.querySelectorAll('canvas')) {
      canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    }
    document.body.replaceChildren();
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.append(renderer.domElement);
    const world = createCourtScene(renderer);
    const results = await world.assetReady;
    const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, 0.1, 150);
    camera.position.set(-3.3, 3.3, 5.2);
    camera.lookAt(-7.1, 1.05, 0);
    renderer.render(world.scene, camera);
    const chair = world.scene.getObjectByName('umpire-chair');
    const bounds = new THREE.Box3().setFromObject(chair, true);
    return {
      revision: 'realism-v0.4.5',
      collectionCartCount: world.scene.getObjectsByProperty('name', 'collection-cart').length,
      hopperCount: results.filter(result => result.name === 'ball-hopper').length,
      ready: results.every(result => result.loaded),
      chair: { position: chair.position.toArray(), facing: new THREE.Vector3(0, 0, 1).applyQuaternion(chair.quaternion).toArray(), min: bounds.min.toArray(), max: bounds.max.toArray() },
      recordedAt: new Date().toISOString(),
    };
  });
  assert.equal(inspection.collectionCartCount, 1);
  assert.equal(inspection.hopperCount, 0);
  assert.equal(inspection.ready, true);
  assert.ok(inspection.chair.facing[0] > 0.999);
  await page.screenshot({ path: `${output}/chair-detail.png` });
  writeFileSync(`${output}/layout-inspection.json`, JSON.stringify(inspection, null, 2));
  console.log(JSON.stringify(inspection));
} finally {
  await page.close();
  browser.disconnect();
}
