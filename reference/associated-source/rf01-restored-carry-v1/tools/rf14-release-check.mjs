import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { LEVEL } from '../game/levels/rf14/level.js';

const browser = await puppeteer.connect({ browserURL: process.env.RF14_BROWSER || 'http://127.0.0.1:4199' });
const base = process.env.RF14_URL || 'http://127.0.0.1:4173';
const output = `production/rf14/${LEVEL.revision}/review`;
mkdirSync(output, { recursive: true });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
const delay = duration => new Promise(resolve => setTimeout(resolve, duration));
const report = { base, revision: LEVEL.revision, browser: await browser.version(), viewport: [1920, 1080], errors, views: [], failures: [] };
try {
  const started = Date.now();
  await page.goto(`${base}/?level=rf14&view=third&review=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#game-shell')?.dataset.requiredAssetsReady === 'true', { timeout: 120000 });
  report.loadMs = Date.now() - started;
  await page.click('#start-button');
  report.gpu = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    const extension = context.getExtension('WEBGL_debug_renderer_info');
    return extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER);
  });
  for (const view of ['third', 'first', 'dual']) {
    await page.click(`#operator-console [data-view-option="${view}"]`);
    await delay(5000);
    const samples = [];
    for (let index = 0; index < 5; index += 1) {
      await delay(2200);
      samples.push(await page.$eval('#game-shell', element => Object.fromEntries(Object.entries(element.dataset).filter(([key]) => key.startsWith('review')))));
    }
    report.views.push({ view, samples });
    await page.screenshot({ path: `${output}/desktop-${view}.png` });
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#game-shell')?.dataset.requiredAssetsReady === 'true', { timeout: 120000 });
  report.refreshAssets = await page.$eval('#game-shell', element => ({ total: element.dataset.worldAssetsTotal, loaded: element.dataset.worldAssetsLoaded }));
  await page.setRequestInterception(true);
  let blocked = '';
  page.on('request', request => request.url().endsWith(`/${blocked}.${blocked === 'daylight' ? 'hdr' : 'glb'}`) ? request.respond({ status: 404, contentType: 'text/html', body: '<h1>Missing asset</h1>' }) : request.continue());
  for (const asset of ['environment', 'collision', 'ball', 'daylight']) {
    blocked = asset;
    await page.setCacheEnabled(false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#game-shell')?.dataset.requiredAssetsReady === 'false', { timeout: 120000 });
    const status = await page.$eval('#game-shell', element => ({ ready: element.dataset.requiredAssetsReady, errors: element.dataset.worldAssetErrors, robot: element.dataset.robotAssetState }));
    assert.equal(status.ready, 'false');
    assert.equal(status.robot, 'failed');
    report.failures.push({ asset, ...status });
  }
  assert.equal(errors.length, 0);
  report.passed = true;
} finally {
  writeFileSync(`${output}/release-check.json`, JSON.stringify(report, null, 2));
  await page.close();
  browser.disconnect();
}
console.log(JSON.stringify(report));
