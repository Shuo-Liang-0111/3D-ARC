import { LEVEL, STATIONS, SUPPLIES, PREPARATIONS } from "./level.js";
import { createInitialState, isWalkable, updateMovement, interact, getInteraction } from "./engine.js";

function key(x, z) { return `${Math.round(x / 0.14)},${Math.round(z / 0.14)}`; }
function safe(state, x, z) {
  return [state.player.yaw, ...Array.from({ length: 16 }, (_, index) => index * Math.PI / 8)].every(yaw => isWalkable({ ...state, player: { ...state.player, yaw } }, x, z));
}
function pathTo(state, target) {
  const start = { x: Math.round(state.player.x / 0.14) * 0.14, z: Math.round(state.player.z / 0.14) * 0.14 };
  const queue = [start]; const visited = new Map([[key(start.x, start.z), null]]);
  let final = null;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    if (Math.hypot(point.x - target.x, point.z - target.z) < 0.15) { final = point; break; }
    for (const [dx, dz] of [[0.14, 0], [-0.14, 0], [0, 0.14], [0, -0.14]]) {
      const next = { x: Math.round((point.x + dx) * 100) / 100, z: Math.round((point.z + dz) * 100) / 100 };
      const id = key(next.x, next.z);
      if (!visited.has(id) && safe(state, next.x, next.z)) { visited.set(id, point); queue.push(next); }
    }
  }
  if (!final) throw new Error(`No route to ${JSON.stringify(target)}`);
  const points = [target];
  while (final) { points.push(final); final = visited.get(key(final.x, final.z)); }
  return points.reverse();
}
export function createRouteSteps() {
  const steps = [];
  for (const station of STATIONS) {
    const supply = SUPPLIES.find(item => item.id === station.item);
    steps.push({ name: `领取${supply.name}`, x: supply.x + 0.95, z: supply.z, face: supply, expected: "pickup" });
    steps.push({ name: `补给${station.name}`, x: station.x, z: station.z + 0.95, face: station, expected: "deliver" });
    steps.push({ name: `回收${station.name}空盒`, x: station.x + 0.5, z: station.z + 0.95, face: { x: station.x + 0.5, z: station.z }, expected: "pickup" });
    steps.push({ name: "归还周转盒", x: LEVEL.returns.x, z: LEVEL.returns.z + 0.95, face: LEVEL.returns, expected: "return" });
  }
  for (const preparation of PREPARATIONS) steps.push({ name: preparation.name, x: preparation.x, z: preparation.z + 0.95, face: preparation, expected: "prepare" });
  steps.push({ name: "检查开诊清单", x: LEVEL.terminal.x, z: LEVEL.terminal.z + 0.95, face: LEVEL.terminal, expected: "terminal" });
  steps.push({ name: "确认开诊", x: LEVEL.terminal.x, z: LEVEL.terminal.z + 0.95, face: LEVEL.terminal, expected: "open" });
  return steps;
}
export function* walkRoute() {
  let state = createInitialState();
  for (const target of createRouteSteps()) {
    for (const point of state.terminalOpen ? [] : pathTo(state, target)) {
      let attempts = 0;
      while (Math.hypot(point.x - state.player.x, point.z - state.player.z) > 0.035) {
        if (attempts++ > 250) throw new Error(`Movement blocked: ${target.name} at ${JSON.stringify(state.player)} -> ${JSON.stringify(point)}`);
        const dx = point.x - state.player.x; const dz = point.z - state.player.z;
        const length = Math.hypot(dx, dz);
        const speed = Math.min(1, length / (LEVEL.moveSpeed * 0.05));
        const yaw = state.player.yaw;
        state = updateMovement(state, { move: (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / length * speed, strafe: (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / length * speed }, 0.05);
        yield { state, label: target.name, action: "move" };
      }
    }
    const yaw = Math.atan2(target.face.x - state.player.x, target.face.z - state.player.z);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const difference = Math.atan2(Math.sin(yaw - state.player.yaw), Math.cos(yaw - state.player.yaw));
      if (Math.abs(difference) < 0.03) break;
      state = updateMovement(state, { turn: Math.max(-1, Math.min(1, difference / (LEVEL.turnSpeed * 0.05))) }, 0.05);
      yield { state, label: target.name, action: "turn" };
    }
    const interaction = getInteraction(state);
    if (interaction?.type !== target.expected) throw new Error(`Unexpected interaction for ${target.name}: ${JSON.stringify(interaction)}`);
    state = interact(state);
    if (state.failed) throw new Error("Mission reserve depleted");
    yield { state, label: target.name, action: "interact" };
  }
  return state;
}
