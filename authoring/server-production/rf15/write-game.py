from pathlib import Path
import json
import subprocess

root = Path('.')
files = {}
files['game/levels/rf15/level.js'] = r'''import { G1_LOCOMOTION } from "../../g1-locomotion.js";
import { LEVEL as SHARED } from "../../level.js";

export const REVISION = "realism-v0.2.1";
export const PRODUCE = [
  { id: "tomato", name: "番茄", code: "T01", weight: 8.6, x: -6.4, y: 0.82, z: -4.2 },
  { id: "apple", name: "苹果", code: "A02", weight: 9.4, x: -5.3, y: 0.82, z: -4.2 },
];
export const LEVEL = Object.freeze({
  id: "rf15", title: "Harvest Cold Chain", revision: REVISION,
  bounds: { minX: -8.6, maxX: 8.6, minZ: -6.8, maxZ: 7.5 },
  playerStart: { x: -5.9, z: 2.5, yaw: Math.PI },
  playerRadius: SHARED.playerRadius, playerForwardOffset: SHARED.playerForwardOffset,
  interactionRange: 1.55, ...G1_LOCOMOTION,
  scale: { x: -2.6, y: 0.84, z: -4.2, collider: "scale-table" },
  pack: { x: 0.6, y: 0.84, z: -3.8, collider: "pack-table" },
  tail: { x: 5.3, y: 0.12, z: 1.45, collider: "tail-lift" },
  lift: { x: 7.15, y: 1.05, z: 1.45, collider: "lift-control" },
  dispatch: { x: -6.8, y: 1.1, z: 4.9, collider: "dispatch" },
  progress: { initial: 100, maximum: 100, movementPerMeter: 0.8, blockedPerSecond: 1.8, interactionCost: 1, errorCost: 5, milestoneReward: 2 },
});
export const STRUCTURES = [
  { id: "west-wall", size: [0.2, 3.8, 9], position: [-8.5, 1.9, -2.4] },
  { id: "north-wall", size: [10.1, 3.8, 0.2], position: [-3.55, 1.9, -6.7] },
  { id: "intake", size: [3.4, 0.82, 1.0], position: [-5.9, 0.41, -4.2] },
  { id: "scale-table", size: [1.4, 0.76, 1.1], position: [-2.6, 0.38, -4.2] },
  { id: "pack-table", size: [2.1, 0.84, 1.2], position: [0.6, 0.42, -3.8] },
  { id: "truck", size: [2.45, 3.15, 6.1], position: [5.3, 1.575, -3.0] },
  { id: "tail-lift", size: [2.3, 0.12, 1.85], position: [5.3, 0.06, 1.0] },
  { id: "lift-control", size: [0.18, 1.15, 0.18], position: [7.15, 0.575, 1.45] },
  { id: "dispatch", size: [1.1, 1.0, 0.55], position: [-6.8, 0.5, 4.9] },
  { id: "crate-stack", size: [1.3, 1.2, 0.85], position: [-7.4, 0.6, -1.3] },
  { id: "pallet-jack", size: [0.75, 1.25, 1.5], position: [1.5, 0.625, 4.9] },
  ...[-8.4, 2.0].map(x => ({ id: `shed-post-${x}`, size: [0.16, 4.2, 0.16], position: [x, 2.1, 1.8] })),
];
export function boundsFor(structure) { return { id: structure.id, minX: structure.position[0] - structure.size[0] / 2, maxX: structure.position[0] + structure.size[0] / 2, minZ: structure.position[2] - structure.size[2] / 2, maxZ: structure.position[2] + structure.size[2] / 2 }; }
export const STATIC_COLLIDERS = STRUCTURES.map(boundsFor);
'''
files['game/levels/rf15/engine.js'] = r'''import { LEVEL, PRODUCE, STATIC_COLLIDERS } from "./level.js";
import { applyRobotMovement } from "../../movement.js";

const distance = (left, right) => Math.hypot(left.x - right.x, left.z - right.z);
const overlaps = (point, radius, rectangle) => (point.x - Math.max(rectangle.minX, Math.min(point.x, rectangle.maxX))) ** 2 + (point.z - Math.max(rectangle.minZ, Math.min(point.z, rectangle.maxZ))) ** 2 < radius ** 2;
export function createInitialState() {
  return { player: { ...LEVEL.playerStart }, items: Object.fromEntries(PRODUCE.map(item => [item.id, { ...item, location: "intake", weighed: false, packed: false }])), carriedItem: null, scaleItem: null, packItem: null, tailItem: null, liftTime: 0, liftActive: false, loaded: [], rewards: [], records: [], complete: false, failed: false, terminalOpen: false, progress: 100, minimumReserve: 100, distanceMoved: 0, blockedSeconds: 0, elapsed: 0, interactions: 0, errors: 0, motion: "idle", lastEvent: "harvest_started" };
}
export function cloneState(state) { return { ...state, player: { ...state.player }, items: Object.fromEntries(Object.entries(state.items).map(([id, item]) => [id, { ...item }])), loaded: [...state.loaded], rewards: [...state.rewards], records: [...state.records] }; }
export function getColliders(state, ignoreItem = null) { return [...STATIC_COLLIDERS, ...Object.values(state.items).filter(item => item.location === "floor" && item.id !== ignoreItem).map(item => ({ id: item.id, minX: item.x - 0.3, maxX: item.x + 0.3, minZ: item.z - 0.22, maxZ: item.z + 0.22 }))]; }
export function isWalkable(state, x, z) {
  const points = [{ x, z }, { x: x + Math.sin(state.player.yaw) * LEVEL.playerForwardOffset, z: z + Math.cos(state.player.yaw) * LEVEL.playerForwardOffset }];
  if (state.carriedItem) points.push({ x: x + Math.sin(state.player.yaw) * 0.5, z: z + Math.cos(state.player.yaw) * 0.5 });
  return points.every(point => point.x - LEVEL.playerRadius >= LEVEL.bounds.minX && point.x + LEVEL.playerRadius <= LEVEL.bounds.maxX && point.z - LEVEL.playerRadius >= LEVEL.bounds.minZ && point.z + LEVEL.playerRadius <= LEVEL.bounds.maxZ && !getColliders(state).some(rectangle => overlaps(point, LEVEL.playerRadius, rectangle)));
}
export function canReach(state, point, ignored = []) {
  const deltaX = point.x - state.player.x;
  const deltaZ = point.z - state.player.z;
  const separation = Math.hypot(deltaX, deltaZ);
  if (separation > LEVEL.interactionRange || (separation > 0.05 && (Math.sin(state.player.yaw) * deltaX + Math.cos(state.player.yaw) * deltaZ) / separation < 0.45)) return false;
  return !getColliders(state, point.id).filter(rectangle => rectangle.id !== point.collider && !ignored.includes(rectangle.id)).some(rectangle => {
    for (let sample = 1; sample < 40; sample += 1) {
      const x = state.player.x + deltaX * sample / 40;
      const z = state.player.z + deltaZ * sample / 40;
      if (x > rectangle.minX && x < rectangle.maxX && z > rectangle.minZ && z < rectangle.maxZ) return true;
    }
    return false;
  });
}
function settle(before, next, cost, rewardId = null) {
  const reward = rewardId && !before.rewards.includes(rewardId) ? LEVEL.progress.milestoneReward : 0;
  const reserve = Math.min(LEVEL.progress.maximum, before.progress - cost + reward);
  if (reserve <= 0) {
    const failed = cloneState(before);
    Object.assign(failed, { progress: 0, minimumReserve: 0, failed: true, motion: "idle", lastEvent: "progress_depleted", interactions: next.interactions, errors: next.errors });
    return failed;
  }
  if (reward) next.rewards.push(rewardId);
  next.progress = reserve;
  next.minimumReserve = Math.min(before.minimumReserve, reserve);
  return next;
}
export function updateMovement(state, input = {}, deltaSeconds = 0) {
  const next = cloneState(state);
  if (state.complete || state.failed) return next;
  const delta = Math.min(0.05, Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
  next.elapsed += delta;
  const movement = applyRobotMovement(next, state, input, delta, LEVEL, isWalkable);
  const traveled = distance(next.player, state.player);
  const blocked = movement.translating && traveled < 0.00001 && !movement.motionTurning;
  next.distanceMoved += traveled;
  next.blockedSeconds += blocked ? delta : 0;
  next.motion = movement.motionTurning ? "turning" : state.carriedItem ? "carrying" : movement.translating ? "moving" : "idle";
  if (next.liftActive) {
    next.liftTime = Math.min(4, state.liftTime + delta);
    if (next.liftTime >= 4) {
      const item = next.items[next.tailItem];
      Object.assign(item, { location: "loaded", x: 4.85 + next.loaded.length * 0.9, y: 1.0, z: -1.2 });
      next.loaded.push(item.id); next.tailItem = null; next.liftActive = false; next.liftTime = 0; next.lastEvent = "load_finished";
    }
  }
  return settle(state, next, traveled * LEVEL.progress.movementPerMeter + (blocked ? delta * LEVEL.progress.blockedPerSecond : 0));
}
export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  if (canReach(state, LEVEL.lift)) return { type: "lift", label: state.liftActive ? "尾板运行中" : "启动尾板装车" };
  if (canReach(state, LEVEL.dispatch)) return { type: "dispatch", label: "确认装车清单" };
  if (state.carriedItem) {
    if (canReach(state, LEVEL.scale)) return { type: "place-scale", label: "放到电子秤" };
    if (canReach(state, LEVEL.pack)) return { type: "place-pack", label: "放到包装工位" };
    if (canReach(state, LEVEL.tail)) return { type: "place-tail", label: "放到货车尾板" };
    return { type: "drop", label: "放到前方地面" };
  }
  if (state.scaleItem && canReach(state, LEVEL.scale)) return { type: state.items[state.scaleItem].weighed ? "pickup-scale" : "weigh", item: state.scaleItem, label: state.items[state.scaleItem].weighed ? "取回已称重采摘筐" : "读取并记录净重" };
  if (state.packItem && canReach(state, LEVEL.pack)) return { type: state.items[state.packItem].packed ? "pickup-pack" : "pack", item: state.packItem, label: state.items[state.packItem].packed ? "搬起已封好的纸箱" : "装箱、封箱并贴重量标签" };
  const candidates = Object.values(state.items).filter(item => ["intake", "floor"].includes(item.location) && canReach(state, item, item.location === "intake" ? ["intake"] : []));
  candidates.sort((left, right) => distance(state.player, left) - distance(state.player, right));
  return candidates.length ? { type: "pickup", item: candidates[0].id, label: `拿起${candidates[0].name}${candidates[0].packed ? "箱" : "采摘筐"}` } : null;
}
export function interact(state) {
  if (state.complete || state.failed) return cloneState(state);
  const next = cloneState(state);
  next.interactions += 1;
  const action = getInteraction(state);
  const item = next.items[state.carriedItem || action?.item];
  let invalid = null;
  let reward = null;
  if (!action) invalid = "empty_interaction";
  else if (["pickup", "pickup-scale", "pickup-pack"].includes(action.type)) {
    next.carriedItem = item.id;
    item.location = "carried";
    if (!isWalkable(next, next.player.x, next.player.z)) invalid = "pickup_blocked";
    else {
      item.location = "carried";
      if (action.type === "pickup-scale") next.scaleItem = null;
      if (action.type === "pickup-pack") next.packItem = null;
      next.lastEvent = "basket_picked";
    }
  } else if (action.type === "place-scale") {
    if (state.scaleItem || item.packed) invalid = "wrong_station";
    else { Object.assign(item, { ...LEVEL.scale, location: "scale" }); next.scaleItem = item.id; next.carriedItem = null; next.lastEvent = "on_scale"; }
  } else if (action.type === "weigh") {
    item.weighed = true; next.records.push({ id: item.id, netKg: item.weight }); reward = `weigh-${item.id}`; next.lastEvent = "weight_recorded";
  } else if (action.type === "place-pack") {
    if (!item.weighed || state.packItem || item.packed) invalid = "weigh_first";
    else { Object.assign(item, { ...LEVEL.pack, location: "pack" }); next.packItem = item.id; next.carriedItem = null; next.lastEvent = "on_pack"; }
  } else if (action.type === "pack") {
    item.packed = true; reward = `pack-${item.id}`; next.lastEvent = "box_sealed";
  } else if (action.type === "place-tail") {
    if (!item.packed || state.tailItem || state.liftActive) invalid = "pack_first";
    else { Object.assign(item, { ...LEVEL.tail, location: "tail" }); next.tailItem = item.id; next.carriedItem = null; reward = `tail-${item.id}`; next.lastEvent = "on_tail"; }
  } else if (action.type === "lift") {
    if (state.carriedItem || !state.tailItem || state.liftActive) invalid = "tail_not_ready";
    else { next.liftActive = true; next.liftTime = 0; next.lastEvent = "lift_started"; }
  } else if (action.type === "dispatch") {
    if (state.loaded.length !== PRODUCE.length || state.carriedItem) invalid = "dispatch_not_ready";
    else { next.complete = true; next.lastEvent = "harvest_complete"; }
  } else if (action.type === "drop") {
    const point = { x: state.player.x + Math.sin(state.player.yaw) * 1.02, z: state.player.z + Math.cos(state.player.yaw) * 1.02 };
    if (point.x - 0.34 < LEVEL.bounds.minX || point.x + 0.34 > LEVEL.bounds.maxX || point.z - 0.34 < LEVEL.bounds.minZ || point.z + 0.34 > LEVEL.bounds.maxZ || getColliders(state).some(rectangle => overlaps(point, 0.34, rectangle))) invalid = "drop_blocked";
    else { Object.assign(item, { ...point, y: 0, location: "floor" }); next.carriedItem = null; next.lastEvent = "basket_dropped"; }
  }
  if (invalid) { const rejected = cloneState(state); rejected.interactions += 1; rejected.errors += 1; rejected.lastEvent = invalid; return settle(state, rejected, LEVEL.progress.errorCost); }
  next.motion = next.carriedItem ? "carrying" : "idle";
  return settle(state, next, LEVEL.progress.interactionCost, reward);
}
export function closeTerminal(state) { return cloneState(state); }
export function getObjective(state) {
  if (state.failed) return { step: 0, title: "装运余量耗尽", detail: "按 R 重新开始，两种农产品和称重记录会一起复位。" };
  if (state.complete) return { step: 5, title: "冷链装运完成", detail: "番茄 8.6 kg、苹果 9.4 kg 已封箱装车，清单已确认。" };
  if (state.liftActive) return { step: 4, title: "尾板正在装车", detail: "货箱会随尾板升起并送入车厢，请留在黄色警戒线外。" };
  if (state.tailItem) return { step: 4, title: "操作尾板", detail: "到尾板右侧绿色按钮处，面向按钮按 F。" };
  if (state.loaded.length === 2) return { step: 5, title: "确认装车清单", detail: "回到南侧出库记录台，核对两箱农产品并按 F 确认。" };
  if (state.carriedItem) { const item = state.items[state.carriedItem]; return { step: item.packed ? 4 : item.weighed ? 3 : 2, title: item.packed ? `装车：${item.name}箱` : item.weighed ? `包装：${item.name}` : `称重：${item.name}`, detail: item.packed ? "搬到冷藏车尾板，面向尾板按 F 放置。" : item.weighed ? "到东侧包装台按 F 放下，再按 F 装箱封箱。" : "到中间电子秤按 F 放下，再按 F 记录净重。" }; }
  if (state.scaleItem) return { step: 2, title: state.items[state.scaleItem].weighed ? "取回采摘筐" : "记录净重", detail: "面向电子秤按 F；确认记录后再按 F 取回。" };
  if (state.packItem) return { step: 3, title: state.items[state.packItem].packed ? "搬起纸箱" : "装箱封箱", detail: "面向包装工位按 F，完成后再按 F 搬走。" };
  return { step: 1, title: `领取采摘筐 · 已装车 ${state.loaded.length}/2`, detail: "北侧收货台领取番茄或苹果。按 F 取物，WASD 移动，Q/E 转向。" };
}
'''
for name, content in files.items():
    destination = root / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(content)
layout = subprocess.check_output(['node', '--input-type=module', '-e', "import {LEVEL,PRODUCE,STRUCTURES} from './game/levels/rf15/level.js'; console.log(JSON.stringify({LEVEL,PRODUCE,STRUCTURES}));"], cwd=root)
(Path('./authoring/server-production/rf15/v0.2') / 'layout.json').write_bytes(layout)
print('Wrote RF-15 engine and shared geometry layout')
