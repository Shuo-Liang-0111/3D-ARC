import { getOfficePhysics } from './scan-physics.js';
import { LEVEL } from './level.js';
import { applyRobotMovement } from '../../movement.js';
const BIN = Object.freeze({ x: -0.82, z: 2.01, radius: 0.16, height: 0.31, reach: 0.85 });

export function createInitialState() {
  return { player: {...LEVEL.playerStart}, bin: {location: 'floor', x: BIN.x, z: BIN.z, yaw: 0}, carriedItem: null, complete: false, failed: false, terminalOpen: false, progress: LEVEL.progress.initial, motion: 'idle', elapsed: 0, interactions: 0, lastEvent: 'free_exploration_started' };
}
export function cloneState(state) { return {...state, player: {...state.player}, bin: {...state.bin}}; }
function physicsFor(state) { const physics = getOfficePhysics(); physics?.setBin(state.bin); return physics; }
export function isWalkable(state, x, z) { return physicsFor(state)?.canStand(x, z) ?? false; }
export function updateMovement(state, input, deltaSeconds) {
  const next = cloneState(state); const dt = Math.min(Math.max(deltaSeconds, 0), 0.05); next.elapsed += dt;
  const physics = physicsFor(state); if (!physics) return next;
  const movement = applyRobotMovement(next, state, input, dt, LEVEL, () => true);
  Object.assign(next.player, physics.move(state.player, {x: next.player.x - state.player.x, z: next.player.z - state.player.z}));
  next.motion = movement.motionTurning ? 'turning' : state.carriedItem ? 'carrying' : movement.translating ? 'moving' : 'idle';
  if (movement.translating && input.drain !== false) next.progress = Math.max(0, state.progress - LEVEL.progress.movementDrainPerSecond * dt);
  return next;
}
function dropPosition(state) {
  const physics = physicsFor(state); if (!physics) return null;
  for (const distance of [0.57, 0.67, 0.77]) {
    const target = {x: state.player.x + Math.sin(state.player.yaw) * distance, z: state.player.z + Math.cos(state.player.yaw) * distance};
    if (physics.canPlaceBin(target.x, target.z) && physics.binPathClear(state.player, target)) return target;
  }
  return null;
}
export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  const physics = physicsFor(state); if (!physics) return null;
  if (state.carriedItem) return {type: 'drop', itemType: 'bin', label: '放下垃圾桶', target: dropPosition(state)};
  if (state.bin.location === 'floor' && Math.hypot(state.player.x - state.bin.x, state.player.z - state.bin.z) <= BIN.reach && physics.binPathClear(state.player, state.bin)) return {type: 'pickup', itemType: 'bin', label: '拿起垃圾桶'};
  return null;
}
export function interact(state) {
  const next = cloneState(state); const interaction = getInteraction(state); next.interactions += 1;
  if (!interaction) { next.lastEvent = 'bin_out_of_reach'; return next; }
  if (interaction.type === 'pickup') { next.bin.location = 'carried'; next.carriedItem = 'bin'; next.motion = 'carrying'; next.lastEvent = 'office_bin_picked_up'; }
  else if (interaction.target) { next.bin = {location: 'floor', ...interaction.target, yaw: state.player.yaw}; next.carriedItem = null; next.motion = 'idle'; next.lastEvent = 'office_bin_placed'; }
  else next.lastEvent = 'office_bin_place_blocked';
  physicsFor(next); return next;
}
export function closeTerminal(state) { return cloneState(state); }
export function getObjective(state) { return {step: 1, title: state.carriedItem ? '将垃圾桶放到空地' : '探索办公室并搬动垃圾桶', detail: state.carriedItem ? '面向无障碍地面按 F 放下。' : '靠近墙边黑色垃圾桶，按 F 拿起。'}; }
