import { createArchiveEngine } from "../../game/levels/rf02/series-engine.js";
import { CART, CHAIRS } from "../../game/levels/rf02/series-layout.js";
import { furnitureStand } from "../../game/levels/rf02/furnishings-layout.js";

const distance = (left, right) => Math.hypot(left.x - right.x, left.z - right.z);
const angle = (target, current) => Math.atan2(Math.sin(target - current), Math.cos(target - current));

export function pathTo(engine, state, goal, radius = engine.LEVEL.playerRadius + 0.035) {
  const pitch = 0.18;
  const bounds = engine.LEVEL.bounds;
  const columns = Math.ceil((bounds.maxX - bounds.minX) / pitch);
  const key = (point) => Math.round((point.x - state.player.x) / pitch) + "," + Math.round((point.z - state.player.z) / pitch);
  const clear = (from, to) => {
    const steps = Math.max(1, Math.ceil(distance(from, to) / 0.025));
    for (let index = 1; index <= steps; index += 1) {
      const blend = index / steps;
      if (!engine.isWalkable(state, from.x + (to.x - from.x) * blend, from.z + (to.z - from.z) * blend, radius)) return false;
    }
    return true;
  };
  if (!engine.isWalkable(state, goal.x, goal.z, radius)) throw new Error("Unwalkable goal " + JSON.stringify({ goal, attachment: state.attachment }));
  if ((Math.abs(state.player.x - goal.x) < 0.001 || Math.abs(state.player.z - goal.z) < 0.001) && clear(state.player, goal)) return [state.player, goal];
  const queue = [{ ...state.player, previous: null }], seen = new Set([key(state.player)]);
  let found = null;
  for (let cursor = 0; cursor < queue.length && cursor < columns * 100; cursor += 1) {
    const current = queue[cursor];
    if (distance(current, goal) < pitch * 2 && clear(current, goal)) { found = current; break; }
    for (const [deltaX, deltaZ] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: current.x + deltaX * pitch, z: current.z + deltaZ * pitch, previous: current };
      const nextKey = key(next);
      if (seen.has(nextKey) || !clear(current, next)) continue;
      seen.add(nextKey); queue.push(next);
    }
  }
  if (!found) throw new Error("No path " + JSON.stringify({ start: state.player, goal, attachment: state.attachment }));
  const route = [goal];
  for (let current = found; current; current = current.previous) route.unshift({ x: current.x, z: current.z });
  const smooth = [route[0]];
  for (let index = 0; index < route.length - 1;) {
    let end = route.length - 1;
    while (end > index + 1 && ((Math.abs(route[index].x - route[end].x) > 0.001 && Math.abs(route[index].z - route[end].z) > 0.001) || !clear(route[index], route[end]))) end -= 1;
    smooth.push(route[end]); index = end;
  }
  return smooth;
}

export function walkPath(engine, state, points, environment = true) {
  let current = state;
  for (const point of points.slice(1)) {
    for (let count = 0; distance(current.player, point) > 0.012; count += 1) {
      if (count > 8000 || current.failed) throw new Error("Walking failed " + JSON.stringify({ point, state: current.player, reserve: current.progress }));
      const dx = point.x - current.player.x, dz = point.z - current.player.z, yaw = current.player.yaw;
      const magnitude = Math.hypot(dx, dz);
      const speed = Math.min(1, magnitude / (engine.LEVEL.moveSpeed * 0.05));
      const next = engine.updateMovement(current, { move: (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / magnitude * speed, strafe: (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / magnitude * speed }, 0.05);
      if (distance(next.player, current.player) < 1e-8) throw new Error("Blocked " + JSON.stringify({ point, player: current.player, attachment: current.attachment }));
      current = environment ? engine.updateEnvironment(next, 0.05) : next;
    }
  }
  return current;
}

export function face(engine, state, yaw) {
  let current = state;
  for (let count = 0; Math.abs(angle(yaw, current.player.yaw)) > 0.005; count += 1) {
    if (count > 2000) throw new Error("Cannot turn");
    const error = angle(yaw, current.player.yaw);
    current = engine.updateEnvironment(engine.updateMovement(current, { turn: Math.max(-1, Math.min(1, error / (engine.LEVEL.turnSpeed * 0.05))) }, 0.05), 0.05);
  }
  return current;
}

export function approach(engine, state, goal) {
  let current = walkPath(engine, state, pathTo(engine, state, goal));
  if (Number.isFinite(goal.yaw)) current = face(engine, current, goal.yaw);
  return current;
}

export function interactionGoal(engine, state, target) {
  const center = target.type === "book" ? state.books[target.bookId] : engine.LEVEL.shelves[target.color];
  const candidates = [];
  for (let ring = 0.6; ring <= 1.35; ring += 0.18) for (let step = 0; step < 32; step += 1) {
    const direction = step * Math.PI / 16;
    const point = { x: center.x + Math.sin(direction) * ring, z: center.z + Math.cos(direction) * ring, yaw: direction + Math.PI };
    if (!engine.isWalkable(state, point.x, point.z, engine.LEVEL.playerRadius + 0.04)) continue;
    const action = engine.getInteraction({ ...state, player: point });
    if (action?.type === target.type && (target.bookId ? action.bookId === target.bookId : action.color === target.color)) candidates.push(point);
  }
  candidates.sort((left, right) => distance(left, state.player) + distance(left, center) * 2 - distance(right, state.player) - distance(right, center) * 2);
  for (const candidate of candidates) {
    try { pathTo(engine, state, candidate); return candidate; } catch {}
  }
  throw new Error("No interaction approach " + JSON.stringify(target));
}

export function walkRoute(id, random = 0.5, errors = 0, waitForFalls = true) {
  const engine = createArchiveEngine(id);
  let state = engine.createInitialState({ random: () => random });
  const records = [{ operation: "start", state }];
  for (let index = 0; index < errors; index += 1) state = engine.interact(state);
  for (const definition of CHAIRS.filter((chair) => chair.task)) {
    state = approach(engine, state, furnitureStand(state.chairs[definition.id]));
    state = engine.interact(state);
    if (!state.attachment) throw new Error("Chair grip failed");
    const goal = furnitureStand({ ...state.chairs[definition.id], ...definition.home });
    state = walkPath(engine, state, pathTo(engine, state, goal, engine.LEVEL.playerRadius));
    state = engine.interact(state);
    if (!state.chairs[definition.id].restored) throw new Error("Chair not restored");
    records.push({ operation: definition.id, state });
  }
  state = approach(engine, state, furnitureStand(state.cart));
  state = engine.interact(state);
  if (!state.attachment) throw new Error("Cart grip failed");
  const parkingStand = furnitureStand({ ...state.cart, ...CART.parking });
  state = walkPath(engine, state, pathTo(engine, state, parkingStand, engine.LEVEL.playerRadius + 0.025));
  state = engine.interact(state);
  if (!state.cart.parked) throw new Error("Cart not parked");
  records.push({ operation: "cart", state });
  if (engine.LEVEL.dynamic) {
    for (let index = 0; index < 5500 && state.incident.drops < engine.LEVEL.maximumFalls; index += 1) state = engine.updateEnvironment(state, 0.05);
    for (let index = 0; index < 20; index += 1) state = engine.updateEnvironment(state, 0.05);
    for (const book of Object.values(state.books).filter((entry) => entry.fallen && entry.location !== "shelved")) {
      state = approach(engine, state, interactionGoal(engine, state, { type: "book", bookId: book.id }));
      state = engine.interact(state);
      if (state.carriedBook !== book.id) throw new Error("Pickup failed");
      state = approach(engine, state, interactionGoal(engine, state, { type: "shelf", color: book.color }));
      state = engine.interact(state);
      records.push({ operation: book.id, state });
    }
  }
  return { id, state, records, finalReserve: state.progress, minimumReserve: state.minimumProgress, distance: state.distanceTravelled, blockedTime: state.blockedTime };
}

if (typeof process !== "undefined" && process.argv[1]?.endsWith("route.mjs")) {
  const fs = await import("node:fs");
  const results = ["rf02-2", "rf02-3"].flatMap((id) => (id === "rf02-3" ? [0.1, 0.5, 0.9] : [0.1]).map((sample) => {
    const route = walkRoute(id, sample);
    return { id, color: route.state.incident.color, distance: route.distance, final: route.finalReserve, minimum: route.minimumReserve, complete: route.state.complete, drops: route.state.incident.drops };
  }));
  console.log(JSON.stringify(results, null, 2));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(results, null, 2) + "\n");
}
