import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.env.RF14_URL || 'http://127.0.0.1:4173';
const output = resolve(process.env.RF14_REVIEW || 'production/rf14/graybox-v0.1/review');
mkdirSync(output, { recursive: true });
const browser = process.env.RF14_BROWSER ? await puppeteer.connect({ browserURL: process.env.RF14_BROWSER }) : await puppeteer.launch({ executablePath: '/opt/arc-runtime/browser/chrome/linux-153.0.8010.36/chrome-linux64/chrome', headless: true, userDataDir: './authoring/server-production/rf14/browser-profile', args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-background-timer-throttling'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
try {
  const started = Date.now();
  await page.goto(`${base}/?level=rf14&view=third&review=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('#game-shell')?.dataset.requiredAssetsReady === 'true', { timeout: 120000 });
  const loadMs = Date.now() - started;
  await page.click('#start-button');
  await new Promise(resolveDelay => setTimeout(resolveDelay, 1500));
  await page.screenshot({ path: `${output}/third-start.png` });
  await page.click('#operator-console [data-view-option="first"]');
  await new Promise(resolveDelay => setTimeout(resolveDelay, 500));
  await page.screenshot({ path: `${output}/first-start.png` });
  await page.click('#operator-console [data-view-option="dual"]');
  await new Promise(resolveDelay => setTimeout(resolveDelay, 500));
  await page.screenshot({ path: `${output}/dual-start.png` });
  const dataset = await page.$eval('#game-shell', element => ({ ...element.dataset }));
  await page.goto(`${base}/rf14-preview.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#preview-status')?.dataset.ready === 'true', { timeout: 120000 });
  await new Promise(resolveDelay => setTimeout(resolveDelay, 500));
  await page.screenshot({ path: `${output}/overview.png` });
  writeFileSync(`${output}/browser.json`, JSON.stringify({ base, viewport: [1920, 1080], loadMs, dataset, errors, browser: await browser.version() }, null, 2));
  console.log(JSON.stringify({ output, loadMs, errors, revision: dataset.levelRevision }));
} finally {
  if (process.env.RF14_BROWSER) { await page.close(); browser.disconnect(); } else await browser.close();
}
