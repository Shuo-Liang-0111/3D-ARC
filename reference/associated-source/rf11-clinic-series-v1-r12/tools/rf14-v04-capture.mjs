import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:4199' });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
const output = './authoring/server-production/rf14/realism-v0.4/review';
mkdirSync(output, { recursive: true });
try {
  for (const asset of ['ball-hopper', 'umpire-chair', 'windscreen', 'plane-tree']) {
    await page.goto(`http://127.0.0.1:4173/rf14-assets.html?asset=${asset}&revision=asset-review-v4`, { waitUntil: 'networkidle0', timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#preview-status')?.dataset.ready === 'true', { timeout: 120000 });
    await page.screenshot({ path: `${output}/${asset}.png` });
    console.log(asset, await page.$eval('#preview-status', node => node.textContent));
  }
} finally { await page.close(); browser.disconnect(); }
