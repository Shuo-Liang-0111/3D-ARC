import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const output = './authoring/server-production/rf14/baseline-tests';
mkdirSync(output, { recursive: true });
const results = [];
for (const file of ['robot-action.test.mjs', 'shared-movement-controls.test.mjs']) {
  const source = readFileSync(`tests/${file}`, 'utf8')
    .replaceAll('"../game/', `"file://${root}/game/`)
    .replaceAll('new URL("file://' + root + '/game/app.js", import.meta.url)', 'new URL("file://./authoring/server-production/rf14/app.baseline.js")');
  const path = resolve(output, file);
  writeFileSync(path, source);
  const result = spawnSync(process.execPath, ['--test', path], { encoding: 'utf8' });
  writeFileSync(`${path}.log`, result.stdout + result.stderr);
  results.push({ file, exit: result.status, summary: result.stdout.split('\n').filter(line => /^(not ok|# tests|# pass|# fail)/.test(line)) });
}
writeFileSync(`${output}/summary.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
