import { LEVEL, SAMPLE_META, SAMPLE_TYPES } from "./level.js";
import { applyRobotMovement } from "../../movement.js";

const EPSILON = 1e-6;

export function createInitialState() {
  return {
    player: { ...LEVEL.playerStart },
    samples: Object.fromEntries(SAMPLE_TYPES.map((type) => [type, { type, location: "storage", ...LEVEL.samples[type] }])),
    caseSamples: [],
    carriedItem: null,
    coolingModuleLocation: "prep-room",
    rewardedPickups: Object.fromEntries([...SAMPLE_TYPES, "cooling-module"].map((type) => [type, false])),
    rewardedLoads: Object.fromEntries(SAMPLE_TYPES.map((type) => [type, false])),
    rewardedPhases: { ordered: false, cooled: false, temperature: false },
    casePhase: "loading",
    complete: false,
    failed: false,
    progress: LEVEL.progress.initial,
    motion: "idle",
    elapsed: 0,
    interactions: 0,
    lastEvent: "cold_chain_started",
  };
}

export function cloneState(state) {
  return {
    ...state,
    player: { ...state.player },
    samples: Object.fromEntries(SAMPLE_TYPES.map((type) => [type, { ...state.samples[type] }])),
    caseSamples: [...state.caseSamples],
    rewardedPickups: { ...state.rewardedPickups },
    rewardedLoads: { ...state.rewardedLoads },
    rewardedPhases: { ...state.rewardedPhases },
  };
}

export function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function circleOverlapsRect(x, z, radius, rect) { const nearX = Math.max(rect.minX, Math.min(x, rect.maxX)); const nearZ = Math.max(rect.minZ, Math.min(z, rect.maxZ)); return (x - nearX) ** 2 + (z - nearZ) ** 2 < radius ** 2; }
export function isWalkable(state, x, z) {
  const { bounds, playerRadius } = LEVEL;
  if (x - playerRadius < bounds.minX || x + playerRadius > bounds.maxX || z - playerRadius < bounds.minZ || z + playerRadius > bounds.maxZ) return false;
  const caseIsPlaced = state?.carriedItem !== "transport-case" && state?.casePhase !== "delivered";
  const colliders = caseIsPlaced ? [...LEVEL.staticColliders, LEVEL.transportCaseCollider] : LEVEL.staticColliders;
  return !colliders.some((rect) => circleOverlapsRect(x, z, playerRadius, rect));
}
function failIfDepleted(state) { if (state.progress > EPSILON || state.complete) return state; state.progress = 0; state.failed = true; state.motion = "idle"; state.lastEvent = "progress_depleted"; return state; }
function reward(state, key) { if (state.rewardedPhases[key]) return; state.rewardedPhases[key] = true; state.progress = Math.min(LEVEL.progress.maximum, state.progress + LEVEL.progress.taskCompletionReward); }
function exactOrder(samples) { return samples.length === LEVEL.requiredOrder.length && samples.every((type, index) => type === LEVEL.requiredOrder[index]); }
function validPrefix(samples) { return samples.every((type, index) => type === LEVEL.requiredOrder[index]); }

export function updateMovement(state, input, deltaSeconds) {
  const next = cloneState(state); const dt = Math.min(Math.max(deltaSeconds, 0), 0.05); next.elapsed += dt;
  if (state.complete || state.failed) return next;
  const movement = applyRobotMovement(next, state, input, dt, LEVEL, isWalkable);
  if (!movement.active) {
    next.motion = state.carriedItem ? "carrying" : "idle";
    return next;
  }
  if (input.drain !== false) next.progress = Math.max(0, state.progress - LEVEL.progress.actionDrainPerSecond * dt); next.motion = movement.motionTurning ? "turning" : (state.carriedItem ? "carrying" : "moving"); return failIfDepleted(next);
}

function nearby(state, point) { return distance(state.player, point) <= LEVEL.interactionRange; }
export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  if (state.carriedItem === "transport-case") {
    const cabinet = Object.entries(LEVEL.coldCabinets).map(([id, point]) => ({ type: "cabinet", cabinet: id, distance: distance(state.player, point) })).filter((candidate) => candidate.distance <= LEVEL.interactionRange).sort((a, b) => a.distance - b.distance)[0];
    return cabinet ? { ...cabinet, label: `将运输箱放入${LEVEL.coldCabinets[cabinet.cabinet].label}` } : null;
  }
  if (state.carriedItem && SAMPLE_TYPES.includes(state.carriedItem)) {
    if (nearby(state, LEVEL.transportCase)) return { type: "case-load", sampleType: state.carriedItem, label: `将 ${SAMPLE_META[state.carriedItem].code} 放入运输箱` };
    return { type: "drop-sample", sampleType: state.carriedItem, label: `放下 ${SAMPLE_META[state.carriedItem].code}` };
  }
  if (state.carriedItem === "cooling-module") {
    if (nearby(state, LEVEL.transportCase)) return { type: "install-cooling", label: "安装冷却模块" };
    return { type: "drop-cooling", label: "放下冷却模块" };
  }
  if (!state.carriedItem) {
    const sample = SAMPLE_TYPES.map((type) => ({ type: "sample", sampleType: type, distance: distance(state.player, state.samples[type]) })).filter((candidate) => ["storage", "floor"].includes(state.samples[candidate.sampleType].location) && candidate.distance <= LEVEL.interactionRange).sort((a, b) => a.distance - b.distance)[0];
    if (sample) return { ...sample, label: `拿起${SAMPLE_META[sample.sampleType].name}` };
    if (state.coolingModuleLocation === "prep-room" && nearby(state, LEVEL.coolingModule)) return { type: "cooling-module", label: "拿起冷却模块" };
    if (state.coolingModuleLocation === "floor" && nearby(state, state.coolingModulePoint)) return { type: "cooling-module", label: "拿起冷却模块" };
    if (nearby(state, LEVEL.transportCase)) {
      if (!validPrefix(state.caseSamples) && state.caseSamples.length) return { type: "case-unload", label: `取出箱顶的 ${SAMPLE_META[state.caseSamples.at(-1)].code}` };
      if (state.casePhase === "ordered") return { type: "case-await-cooling", label: "需要安装冷却模块" };
      if (state.casePhase === "cooled") return { type: "case-seal", label: "关闭运输箱" };
      if (state.casePhase === "sealed") return { type: "case-activate", label: "启动温控" };
      if (state.casePhase === "active") return { type: "case-pickup", label: "拿起恒温运输箱" };
      if (state.caseSamples.length) return { type: "case-inspect", label: "检查装箱顺序" };
    }
  }
  return null;
}

export function interact(state) {
  if (state.complete || state.failed) return cloneState(state);
  const interaction = getInteraction(state); const next = cloneState(state); next.interactions += 1; next.progress = Math.max(0, next.progress - LEVEL.progress.interactionCost);
  if (!interaction) { next.lastEvent = "empty_interaction"; return failIfDepleted(next); }
  if (interaction.type === "sample") {
    const type = interaction.sampleType; const first = !next.rewardedPickups[type]; next.carriedItem = type; next.samples[type] = { type, location: "carried" }; next.motion = "carrying";
    if (first) { next.rewardedPickups[type] = true; next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.pickupReward); } next.lastEvent = `${first ? "sample_collected" : "sample_recollected"}_${type}`;
  } else if (interaction.type === "drop-sample") {
    const type = state.carriedItem; next.samples[type] = { type, location: "floor", x: state.player.x, z: state.player.z }; next.carriedItem = null; next.motion = "idle"; next.lastEvent = `sample_dropped_${type}`;
  } else if (interaction.type === "case-load") {
    const type = state.carriedItem; next.caseSamples.push(type); next.samples[type] = { type, location: "case" }; next.carriedItem = null; next.motion = "idle";
    if (!next.rewardedLoads[type]) { next.rewardedLoads[type] = true; next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.sampleLoadReward); }
    if (exactOrder(next.caseSamples)) { next.casePhase = "ordered"; reward(next, "ordered"); next.lastEvent = "samples_ordered"; } else if (!validPrefix(next.caseSamples)) { next.casePhase = "misordered"; next.lastEvent = "sample_loaded_wrong_order"; } else next.lastEvent = `sample_loaded_${type}`;
  } else if (interaction.type === "case-unload") {
    const type = next.caseSamples.pop(); next.samples[type] = { type, location: "carried" }; next.carriedItem = type; next.casePhase = "loading"; next.motion = "carrying"; next.lastEvent = `sample_unloaded_${type}`;
  } else if (interaction.type === "cooling-module") {
    const first = !next.rewardedPickups["cooling-module"]; next.carriedItem = "cooling-module"; next.coolingModuleLocation = "carried"; next.motion = "carrying"; if (first) { next.rewardedPickups["cooling-module"] = true; next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.pickupReward); } next.lastEvent = first ? "cooling_collected" : "cooling_recollected";
  } else if (interaction.type === "drop-cooling") {
    next.carriedItem = null; next.coolingModuleLocation = "floor"; next.coolingModulePoint = { x: state.player.x, z: state.player.z }; next.motion = "idle"; next.lastEvent = "cooling_dropped";
  } else if (interaction.type === "install-cooling") {
    if (state.casePhase !== "ordered") next.lastEvent = "cooling_rejected_order";
    else { next.carriedItem = null; next.coolingModuleLocation = "case"; next.casePhase = "cooled"; next.motion = "idle"; reward(next, "cooled"); next.lastEvent = "cooling_installed"; }
  } else if (interaction.type === "case-seal") { next.casePhase = "sealed"; next.lastEvent = "case_sealed";
  } else if (interaction.type === "case-activate") { next.casePhase = "active"; reward(next, "temperature"); next.lastEvent = "temperature_activated";
  } else if (interaction.type === "case-pickup") { next.carriedItem = "transport-case"; next.motion = "carrying"; next.lastEvent = "case_collected";
  } else if (interaction.type === "cabinet") {
    if (interaction.cabinet !== LEVEL.targetCabinet) next.lastEvent = "wrong_cold_cabinet";
    else { next.carriedItem = null; next.casePhase = "delivered"; next.complete = true; next.motion = "idle"; next.progress = LEVEL.progress.maximum; next.lastEvent = "cold_chain_complete"; }
  } else if (interaction.type === "case-await-cooling") next.lastEvent = "case_missing_cooling";
  else if (interaction.type === "case-inspect") next.lastEvent = validPrefix(state.caseSamples) ? "case_waiting_samples" : "case_order_invalid";
  return failIfDepleted(next);
}

export function closeTerminal(state) { return cloneState(state); }
export function getObjective(state) {
  if (state.failed) return { step: 0, title: "任务失败", detail: "状态余量已耗尽，冷链转运终止。" };
  if (state.complete) return { step: 6, title: "冷链转运完成", detail: "恒温运输箱已放入冷藏柜 02。" };
  if (state.carriedItem === "transport-case") return { step: 6, title: "送往冷藏柜 02", detail: "保持运输箱恒温，送入标有 02 的冷藏柜。" };
  if (state.casePhase === "active") return { step: 5, title: "转运恒温箱", detail: "靠近运输箱按 E 拿起，再送往冷藏柜 02。" };
  if (state.casePhase === "sealed") return { step: 5, title: "启动温控", detail: "运输箱已封闭，再次按 E 启动温控。" };
  if (state.casePhase === "cooled") return { step: 4, title: "关闭运输箱", detail: "冷却模块已安装，靠近运输箱按 E 封箱。" };
  if (state.carriedItem === "cooling-module") return { step: 4, title: "安装冷却模块", detail: "将冷却模块送到运输箱，靠近后按 E。" };
  if (state.casePhase === "ordered") return { step: 4, title: "获取冷却模块", detail: "装箱顺序正确。前往准备间拿取冷却模块。" };
  if (!validPrefix(state.caseSamples)) return { step: 3, title: "纠正装箱顺序", detail: `箱内顺序错误。靠近运输箱按 E，从箱顶逐个取出重排。正确顺序：${LEVEL.requiredOrder.map((type) => SAMPLE_META[type].code).join(" → ")}。` };
  if (state.carriedItem && SAMPLE_TYPES.includes(state.carriedItem)) return { step: 3, title: `装入 ${SAMPLE_META[state.carriedItem].code}`, detail: `送到运输箱。当前需要：${SAMPLE_META[LEVEL.requiredOrder[state.caseSamples.length]].code}。` };
  return { step: 2, title: "按任务板顺序装箱", detail: `任务板顺序：${LEVEL.requiredOrder.map((type) => SAMPLE_META[type].code).join(" → ")}。每次只携带一件样本。` };
}
