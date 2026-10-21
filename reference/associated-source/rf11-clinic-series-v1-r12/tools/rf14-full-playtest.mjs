import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { BALLS, LEVEL } from '../game/levels/rf14/level.js';

const base = process.env.RF14_URL || 'http://127.0.0.1:4173';
const output = resolve(`production/rf14/${LEVEL.revision}/review`);
mkdirSync(output, { recursive: true });
const browser = process.env.RF14_BROWSER ? await puppeteer.connect({ browserURL: process.env.RF14_BROWSER }) : await puppeteer.launch({ executablePath: '/opt/arc-runtime/browser/chrome/linux-153.0.8010.36/chrome-linux64/chrome', headless: true, userDataDir: './authoring/server-production/rf14/playtest-profile', args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-background-timer-throttling'] });
const page = await browser.newPage();
await page.setViewport({ width: process.env.RF14_BROWSER ? 1920 : 960, height: process.env.RF14_BROWSER ? 1080 : 540, deviceScaleFactor: 1 });
const errors = [];
const checkpoints = [];
page.on('pageerror', error => errors.push(String(error)));
const delay = duration => new Promise(resolveDelay => setTimeout(resolveDelay, duration));
async function state() { return page.evaluate(() => window.__RELAY_DEMO__.getState()); }
async function snapshot(name) {
  await delay(200);
  await page.screenshot({ path: `${output}/${name}.png` });
  checkpoints.push({ name, state: await state(), time: new Date().toISOString() });
  console.log(name, JSON.stringify(checkpoints.at(-1).state.player), flushMarker());
}
function flushMarker() { return ''; }
async function turn(yaw) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const current = await state();
    const difference = Math.atan2(Math.sin(yaw - current.player.yaw), Math.cos(yaw - current.player.yaw));
    if (Math.abs(difference) < 0.095) return;
    const key = difference > 0 ? 'q' : 'e';
    await page.keyboard.down(key);
    await delay(Math.max(20, Math.min(250, Math.abs(difference) / LEVEL.turnSpeed * 1000)));
    await page.keyboard.up(key);
  }
  throw new Error(`Turn failed: target ${yaw}, actual ${JSON.stringify((await state()).player)}`);
}
async function move(x, z) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const current = await state();
    const dx = x - current.player.x;
    const dz = z - current.player.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.065) return;
    await turn(Math.atan2(dx, dz));
    const durationMs = Math.min(1000, Math.max(50, (distance - 0.035) / LEVEL.moveSpeed * 1000));
    const before = await state();
    await page.evaluate(async duration => { await window.__ARC_AGENT__.act({ action: 'W', durationMs: duration, harness: 'state' }); }, durationMs);
    const after = await state();
    if (Math.hypot(after.player.x - before.player.x, after.player.z - before.player.z) < 0.008) throw new Error(`Blocked route to ${x},${z} at ${JSON.stringify(after.player)}`);
  }
  throw new Error('Route timed out');
}
async function interact() {
  await page.waitForFunction(() => !window.__RELAY_DEMO__.getRobotAction().active, { timeout: 60000 });
  await page.evaluate(async () => { await window.__ARC_AGENT__.act({ action: 'E', durationMs: 100, harness: 'state' }); });
  await page.waitForFunction(() => !window.__RELAY_DEMO__.getRobotAction().active, { timeout: 60000 });
}
try {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await page.goto(`${base}/?level=rf14&view=first&review=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      if (!response.ok() && response.status() !== 304) throw new Error(`HTTP ${response.status()}`);
      break;
    } catch (error) { if (attempt === 2) throw error; await delay(2000); }
  }
  await page.waitForFunction(() => document.querySelector('#game-shell')?.dataset.requiredAssetsReady === 'true', { timeout: 120000 });
  await page.click('#start-button');
  await snapshot('first-initial');
  await page.keyboard.down('ArrowUp'); await delay(6000); await page.keyboard.up('ArrowUp');
  await snapshot('first-look-up');
  await page.click('#operator-console [data-view-option="third"]');
  await snapshot('third-initial');
  const routeBalls = process.env.RF14_SMOKE ? BALLS.slice(0, 1) : BALLS;
  for (const ball of routeBalls) {
    const current = await state();
    if (current.player.z > 0 && ball.z < 0) { await move(7.3, 8); await move(7.3, -2); }
    await move(ball.x, ball.z + 0.8);
    await turn(Math.PI);
    if (ball.id === 'ball-1') await snapshot('before-pickup');
    if (ball.id === 'ball-8') {
      await page.click('#operator-console [data-view-option="first"]');
      await snapshot('first-far-end');
      await page.click('#operator-console [data-view-option="third"]');
    }
    await interact();
    assert.equal((await state()).carriedItem, ball.id);
    if (ball.id === 'ball-1') {
      await snapshot('carrying');
      await interact(); assert.equal((await state()).carriedItem, null);
      await snapshot('dropped');
      await interact(); assert.equal((await state()).carriedItem, ball.id);
    }
    await move(7.3, ball.z + 0.8);
    if (ball.z < 0) { await move(7.3, -0.9); if (ball.id === 'ball-5') await snapshot('loaded-net-passage'); await move(7.3, 2); }
    await move(7.3, 8);
    await turn(Math.PI / 2);
    if (ball.id === 'ball-1') {
      await page.click('#operator-console [data-view-option="first"]');
      await snapshot('cart-carrying-first');
    }
    await interact();
    assert.ok((await state()).delivered.includes(ball.id));
    if (ball.id === 'ball-1') {
      await snapshot('cart-delivered-first');
      await page.click('#operator-console [data-view-option="third"]');
    }
    console.log('delivered', ball.id);
  }
  assert.equal((await state()).complete, !process.env.RF14_SMOKE);
  await delay(700); await snapshot(process.env.RF14_SMOKE ? 'interaction-verified' : 'completed');
  await page.keyboard.press('r'); await delay(300);
  assert.equal((await state()).delivered.length, 0);
  await snapshot('reset');
  writeFileSync(`${output}/${process.env.RF14_SMOKE ? 'interaction-check' : 'full-playtest'}.json`, JSON.stringify({ revision: LEVEL.revision, base, errors, checkpoints, complete: !process.env.RF14_SMOKE, passed: true }, null, 2));
  console.log(process.env.RF14_SMOKE ? 'INTERACTION_CHECK_PASSED' : 'FULL_PLAYTEST_PASSED');
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  writeFileSync(`${output}/full-playtest-failure.json`, JSON.stringify({ error: String(error), errors, checkpoints }, null, 2));
  throw error;
} finally { if (process.env.RF14_BROWSER) { await page.close(); browser.disconnect(); } else await browser.close(); }
