// Archive launcher only: starts the original programs with portable, isolated paths.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer, connect } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;
const ports = {
  web: Number(env.ARC_WEB_PORT || 4173),
  api: Number(env.ARC_API_PORT || 4176),
  sim: Number(env.ARC_SIM_PORT || 4186),
};
const host = env.ARC_BIND_HOST || '127.0.0.1';
const python = env.ARC_PYTHON || resolve(root, '.venv/bin/python');
const children = [];
let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => {
    for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
    process.exit(code);
  }, 1800);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => close());
async function available(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');
  await new Promise((ok, fail) => {
    const server = createServer(); server.once('error', fail);
    server.listen(port, host, () => server.close(ok));
  });
}
async function ready(port) {
  for (let n = 0; n < 120; n++) {
    if (closing) throw new Error('A child process stopped');
    if (port === ports.sim) {
      const connected = await new Promise(ok => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        const timer = setTimeout(() => { socket.terminate(); ok(false); }, 1000);
        socket.once('open', () => { clearTimeout(timer); socket.close(); ok(true); });
        socket.once('error', () => { clearTimeout(timer); ok(false); });
      });
      if (connected) return;
      await new Promise(ok => setTimeout(ok, 500));
      continue;
    }
    const result = await new Promise(ok => {
      const socket = connect({ host: '127.0.0.1', port });
      socket.setTimeout(500);
      socket.once('connect', () => { socket.destroy(); ok(true); });
      socket.once('error', () => { socket.destroy(); ok(false); });
      socket.once('timeout', () => { socket.destroy(); ok(false); });
    });
    if (result) return;
    await new Promise(ok => setTimeout(ok, 500));
  }
  throw new Error(`Service did not listen on ${port}`);
}
function start(command, args, extra) {
  const child = spawn(command, args, { cwd: root, env: { ...env, ...extra }, stdio: 'inherit' });
  children.push(child);
  child.on('error', error => { console.error(error.message); close(1); });
  child.on('exit', code => { if (!closing) { console.error('Service exited:', command, code); close(1); } });
}
try {
  if (new Set(Object.values(ports)).size !== 3) throw new Error('Choose three distinct ports');
  if (!existsSync(python)) throw new Error('Create .venv with simulation/requirements.txt, or set ARC_PYTHON');
  if (!existsSync(resolve(root, 'node_modules/vite/bin/vite.js'))) throw new Error('Run npm ci first');
  const model = resolve(root, 'vendor-data/unitree_mujoco/unitree_robots/g1/scene_29dof.xml');
  const policyRoot = resolve(root, 'vendor-data/unitree_rl_lab/deploy/robots/g1_29dof/config/policy/velocity/v0');
  for (const path of [model, policyRoot+'/exported/policy.onnx', policyRoot+'/params/deploy.yaml']) {
    if (!existsSync(path)) throw new Error('Run python3 archive/restore.py first: missing '+path);
  }
  for (const port of Object.values(ports)) await available(port);
  start(python, ['simulation/mujoco_server.py'], {
    ARC_MUJOCO_HOST: '127.0.0.1', ARC_MUJOCO_PORT: String(ports.sim),
    ARC_MUJOCO_MODEL: model, ARC_G1_POLICY: policyRoot+'/exported/policy.onnx',
    ARC_G1_POLICY_CONFIG: policyRoot+'/params/deploy.yaml',
    OPENBLAS_NUM_THREADS: '1', OMP_NUM_THREADS: '1', PYTHONUNBUFFERED: '1',
  });
  await ready(ports.sim);
  start(process.execPath, ['server.mjs'], {
    HOST: '127.0.0.1', PORT: String(ports.api),
    ARC_MUJOCO_WS_URL: `ws://127.0.0.1:${ports.sim}/ws`,
    ARC_GAME_PUBLIC_URL: `http://127.0.0.1:${ports.web}/`,
  });
  await ready(ports.api);
  start(process.execPath, ['node_modules/vite/bin/vite.js', '--host', host, '--port', String(ports.web), '--strictPort'], {
    ARC_API_URL: `http://127.0.0.1:${ports.api}`,
  });
  await ready(ports.web);
  console.log(`\nOriginal 36-task archive: http://127.0.0.1:${ports.web}/?mode=play&level=rf01&robot=g1`);
} catch (error) { console.error(error.message); close(1); }
