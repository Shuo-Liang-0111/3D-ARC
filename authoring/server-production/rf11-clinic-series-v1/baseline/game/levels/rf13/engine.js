import { LEVEL, STATIONS, SUPPLIES, PREPARATIONS, STATIC_COLLIDERS, WALL_COLLIDERS, boundsFor } from "./level.js";
import { applyRobotMovement } from "../../movement.js";

export function createInitialState() {
  return {
    player: { ...LEVEL.playerStart },
    items: Object.fromEntries([
      ...SUPPLIES.map(item => [item.id, { ...item, kind: "supply", location: "shelf", y: 0.9 }]),
      ...STATIONS.map(station => [`empty-${station.id}`, { id: `empty-${station.id}`, name: `${station.name}空周转盒`, kind: "empty", station: station.id, location: "station", x: station.x + 0.5, y: 0.9, z: station.z }]),
    ]),
    carriedItem: null, delivered: [], returned: [], prepared: [], complete: false, failed: false,
    terminalOpen: false, progress: LEVEL.progress.initial, motion: "idle", elapsed: 0, interactions: 0, lastEvent: "clinic_started",
  };
}
function cloneState(state) {
  return { ...state, player: { ...state.player }, items: Object.fromEntries(Object.entries(state.items).map(([id, item]) => [id, { ...item }])), delivered: [...state.delivered], returned: [...state.returned], prepared: [...state.prepared] };
}
function overlaps(x, z, radius, rect) {
  return (x - Math.max(rect.minX, Math.min(x, rect.maxX))) ** 2 + (z - Math.max(rect.minZ, Math.min(z, rect.maxZ))) ** 2 < radius ** 2;
}
export function getColliders(state, ignoreItem = null) {
  return [...STATIC_COLLIDERS,
    ...PREPARATIONS.map(preparation => {
      const point = state.prepared.includes(preparation.id) ? preparation.destination : preparation;
      return boundsFor({ id: preparation.id, size: preparation.size, position: [point.x, preparation.size[1] / 2, point.z] });
    }),
    ...Object.values(state.items).filter(item => item.location === "floor" && item.id !== ignoreItem).map(item => boundsFor({ id: item.id, size: [0.38, 0.22, 0.28], position: [item.x, 0.11, item.z] })),
  ];
}
export function isWalkable(state, x, z) {
  const { playerRadius, playerForwardOffset, bounds } = LEVEL;
  const circles = [{ x, z }, { x: x + Math.sin(state.player.yaw) * playerForwardOffset, z: z + Math.cos(state.player.yaw) * playerForwardOffset }];
  return circles.every(point => point.x - playerRadius >= bounds.minX && point.x + playerRadius <= bounds.maxX && point.z - playerRadius >= bounds.minZ && point.z + playerRadius <= bounds.maxZ && !getColliders(state).some(rect => overlaps(point.x, point.z, playerRadius, rect)));
}
export function canReach(state, point) {
  const offsetX = point.x - state.player.x;
  const offsetZ = point.z - state.player.z;
  const distance = Math.hypot(offsetX, offsetZ);
  if (distance > LEVEL.interactionRange) return false;
  if (distance > 0.1 && (Math.sin(state.player.yaw) * offsetX + Math.cos(state.player.yaw) * offsetZ) / distance < 0.2) return false;
  for (let step = 1; step < 30; step += 1) {
    const x = state.player.x + offsetX * step / 30;
    const z = state.player.z + offsetZ * step / 30;
    if (WALL_COLLIDERS.some(rect => x > rect.minX && x < rect.maxX && z > rect.minZ && z < rect.maxZ)) return false;
  }
  return true;
}
export function isReady(state) {
  return state.delivered.length === 4 && state.returned.length === 4 && state.prepared.length === 2 && !state.carriedItem;
}
export function updateMovement(state, input, deltaSeconds) {
  const next = cloneState(state);
  const delta = Math.min(Math.max(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0), 0.05);
  if (state.complete || state.failed || state.terminalOpen) return next;
  next.elapsed += delta;
  const movement = applyRobotMovement(next, state, input, delta, LEVEL, isWalkable);
  if (movement.translating && input.drain !== false) next.progress = Math.max(0, next.progress - LEVEL.progress.actionDrainPerSecond * delta);
  next.motion = movement.motionTurning ? "turning" : state.carriedItem ? "carrying" : movement.translating ? "moving" : "idle";
  if (next.progress <= 0) { next.failed = true; next.motion = "idle"; next.lastEvent = "progress_depleted"; }
  return next;
}
export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  if (state.terminalOpen) return { type: "open", label: "确认开诊" };
  if (state.carriedItem) {
    const item = state.items[state.carriedItem];
    if (canReach(state, LEVEL.returns)) return { type: "return", label: "归还空周转盒" };
    const station = STATIONS.find(entry => canReach(state, entry));
    if (station) return { type: "deliver", station: station.id, label: `向${station.name}补给` };
    return { type: "drop", label: `放下${item.name}` };
  }
  const candidates = Object.values(state.items).filter(item => ["shelf", "floor", "station"].includes(item.location) && canReach(state, item) && (item.kind !== "empty" || state.delivered.includes(item.station)))
    .map(item => ({ type: "pickup", item: item.id, label: `拿起${item.name}`, distance: Math.hypot(state.player.x - item.x, state.player.z - item.z) }));
  for (const preparation of PREPARATIONS) {
    if (!state.prepared.includes(preparation.id) && canReach(state, preparation)) candidates.push({ type: "prepare", preparation: preparation.id, label: preparation.name, distance: Math.hypot(state.player.x - preparation.x, state.player.z - preparation.z) });
  }
  if (candidates.length) return candidates.sort((left, right) => left.distance - right.distance)[0];
  if (canReach(state, LEVEL.terminal)) return { type: "terminal", label: "检查开诊清单" };
  return null;
}
export function interact(state) {
  const next = cloneState(state);
  if (state.complete || state.failed) return next;
  const interaction = getInteraction(state);
  next.lastEvent = "empty_interaction";
  if (!interaction) return next;
  next.interactions += 1;
  if (interaction.type === "pickup") {
    next.carriedItem = interaction.item;
    next.items[interaction.item].location = "carried";
    next.motion = "carrying";
    next.lastEvent = "battery_collected";
  } else if (interaction.type === "deliver") {
    const station = STATIONS.find(entry => entry.id === interaction.station);
    if (state.carriedItem !== station.item || state.delivered.includes(station.id)) { next.lastEvent = "wrong_station"; return next; }
    Object.assign(next.items[state.carriedItem], { location: "delivered", x: station.x - 0.4, y: 0.9, z: station.z });
    next.delivered.push(station.id);
    next.carriedItem = null;
    next.lastEvent = "power_restored";
  } else if (interaction.type === "return") {
    if (state.items[state.carriedItem].kind !== "empty") { next.lastEvent = "wrong_return"; return next; }
    Object.assign(next.items[state.carriedItem], { location: "returned", x: LEVEL.returns.x - 0.75 + next.returned.length * 0.5, y: 0.9, z: LEVEL.returns.z });
    next.returned.push(state.carriedItem);
    next.carriedItem = null;
    next.lastEvent = "power_restored";
  } else if (interaction.type === "drop") {
    const point = { x: state.player.x + Math.sin(state.player.yaw) * 0.95, z: state.player.z + Math.cos(state.player.yaw) * 0.95 };
    if (point.x - 0.24 < LEVEL.bounds.minX || point.x + 0.24 > LEVEL.bounds.maxX || point.z - 0.24 < LEVEL.bounds.minZ || point.z + 0.24 > LEVEL.bounds.maxZ || getColliders(state).some(rect => overlaps(point.x, point.z, 0.24, rect))) { next.lastEvent = "drop_blocked"; return next; }
    Object.assign(next.items[state.carriedItem], { ...point, location: "floor", y: 0 });
    next.carriedItem = null;
    next.lastEvent = "battery_dropped";
  } else if (interaction.type === "prepare") {
    next.prepared.push(interaction.preparation);
    if (!isWalkable(next, state.player.x, state.player.z)) { next.prepared.pop(); next.lastEvent = "move_blocked"; return next; }
    next.lastEvent = "clinic_prepared";
  } else if (interaction.type === "terminal") {
    if (!isReady(state)) { next.lastEvent = "terminal_not_ready"; return next; }
    next.terminalOpen = true;
    next.lastEvent = "terminal_opened";
  } else if (interaction.type === "open" && isReady(state)) {
    next.complete = true;
    next.terminalOpen = false;
    next.lastEvent = "clinic_opened";
  }
  next.motion = next.carriedItem ? "carrying" : "idle";
  next.progress = Math.max(0, next.progress - LEVEL.progress.interactionCost);
  if (["power_restored", "clinic_prepared", "clinic_opened"].includes(next.lastEvent)) next.progress = Math.min(100, next.progress + LEVEL.progress.reward);
  if (next.progress <= 0 && !next.complete) { next.failed = true; next.terminalOpen = false; next.lastEvent = "progress_depleted"; }
  return next;
}
export function closeTerminal(state) { return { ...cloneState(state), terminalOpen: false, lastEvent: "terminal_closed" }; }
export function getObjective(state) {
  if (state.failed) return { step: 0, title: "准备余量耗尽", detail: "重新开始可恢复全部物品。" };
  if (state.complete) return { step: 4, title: "社区诊所已开诊", detail: "补给、空盒回收和开诊准备全部完成。" };
  if (state.carriedItem) {
    const item = state.items[state.carriedItem];
    const station = STATIONS.find(entry => entry.item === item.id);
    return { step: 1, title: item.kind === "empty" ? "归还空盒" : `送到${station.name}`, detail: item.kind === "empty" ? "前往西侧走廊周转台。" : `携带${item.name}；对准目标工位按 F。` };
  }
  if (state.delivered.length < 4 || state.returned.length < 4) return { step: 1, title: `补给 ${state.delivered.length}/4 · 回收 ${state.returned.length}/4`, detail: "储物间领取对应用品，送达后回收该工位的空盒。" };
  if (state.prepared.length < 2) return { step: 2, title: `开诊准备 ${state.prepared.length}/2`, detail: "归正候诊椅，将推车移出通道。" };
  return { step: 3, title: state.terminalOpen ? "确认开诊" : "前往前台确认", detail: "清单全部完成后，再按 F 确认开诊。" };
}

