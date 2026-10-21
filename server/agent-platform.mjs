import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdirSync, existsSync, readFileSync as readFileSyncFs, writeFileSync as writeFileSyncFs } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getSeedPolicy, SEED_PROTOCOL_VERSION } from "../game/environment-seed.js";

const LEVELS = new Set([
  "rf01", "rf01-2", "rf01-3",
  "rf02", "rf02-2", "rf02-3",
  "rf03",
  "rf04", "rf04-2", "rf04-3",
  "rf05", "rf05-2", "rf05-3",
  "rf06", "rf06-2", "rf06-3",
  "rf07", "rf07-2", "rf07-3",
  "rf08",
  "rf09", "rf09-2", "rf09-3",
  "rf10", "rf11",
  "rf12", "rf12-2", "rf12-3",
  "rf13", "rf13-02", "rf13-03",
  "rf14", "rf14-2", "rf14-3",
  "rf15", "rf15-1", "rf15-2", "rf15-3",
  "test_zpf", "test_zpf2",
]);
const VIEWS = new Set(["first", "third", "dual"]);
const HARNESSES = new Set(["visual", "hybrid", "state"]);
const ACTIONS = new Set(["W", "A", "S", "D", "Q", "E", "F", "R", "ARROW_UP", "ARROW_DOWN", "ESCAPE", "WAIT", "TURN_LEFT", "TURN_RIGHT"]);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function tokenHash(token) {
  return createHash("sha256").update(String(token)).digest();
}

function tokenMatches(token, expectedHex) {
  if (!token || !expectedHex) return false;
  const actual = tokenHash(token);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function createToken() {
  return randomBytes(32).toString("base64url");
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function seedMetadata(row) {
  const environment = parseJson(row.environment_json);
  const seedPolicy = getSeedPolicy(row.level);
  const seedVerified = Boolean(environment);
  const seedApplied = seedPolicy === "seeded" && seedVerified && environment.seedApplied === true;
  return {
    seed: row.environment_seed === null || row.environment_seed === undefined ? null : Number(row.environment_seed),
    seedSource: row.seed_source || null,
    seedPolicy,
    seedApplied,
    seedVerified,
    initialStateFingerprint: seedApplied ? environment.initialStateFingerprint : null,
  };
}

const ENVIRONMENT_FIELDS = ["protocolVersion", "seed", "seedPolicy", "seedApplied", "initialStateFingerprint"];

function validateEnvironment(observation, row) {
  const stored = parseJson(row.environment_json);
  const policy = getSeedPolicy(row.level);
  if (!Object.prototype.hasOwnProperty.call(observation || {}, "environment")) {
    if (stored || (policy === "seeded" && row.seed_source === "provided")) {
      throw httpError(400, "观察缺少 environment 种子验证元数据");
    }
    return null; // Legacy fixed/generated clients are explicitly unverified.
  }
  const input = observation.environment;
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).length !== ENVIRONMENT_FIELDS.length
    || ENVIRONMENT_FIELDS.some((key) => !Object.prototype.hasOwnProperty.call(input, key))) {
    throw httpError(400, "environment 必须仅包含规定的种子元数据字段");
  }
  const expectedSeed = policy === "seeded" ? (row.environment_seed ?? null) : null;
  if (input.protocolVersion !== SEED_PROTOCOL_VERSION || input.seedPolicy !== policy
    || input.seed !== expectedSeed || typeof input.seedApplied !== "boolean"
    || input.seedApplied !== (policy === "seeded" && expectedSeed !== null)) {
    throw httpError(400, "environment 种子、策略或应用状态与 Episode 不一致");
  }
  if (input.seedApplied) {
    if (typeof input.initialStateFingerprint !== "string" || !/^fnv1a64-v1:[0-9a-f]{16}$/.test(input.initialStateFingerprint)) {
      throw httpError(400, "environment 初态指纹格式无效");
    }
  } else if (input.initialStateFingerprint !== null) {
    throw httpError(400, "未应用种子的 environment 初态指纹必须为 null");
  }
  const normalized = Object.fromEntries(ENVIRONMENT_FIELDS.map((key) => [key, input[key]]));
  if (stored && JSON.stringify(stored) !== JSON.stringify(normalized)) {
    throw httpError(400, "environment 元数据在 Episode 内不能改变");
  }
  return normalized;
}

function publicEpisode(row) {
  if (!row) return null;
  return {
    id: row.id,
    ...seedMetadata(row),
    level: row.level,
    view: row.view,
    harness: row.harness,
    engine: row.engine || "prime",
    agent: row.agent_name ? { name: row.agent_name, version: row.agent_version || "1" } : null,
    model: row.model_name || null,
    instructionVersion: row.instruction_version || null,
    participantId: row.participant_id || null,
    processScore: Number(row.process_score || 0),
    processTasks: parseJson(row.process_tasks_json, []),
    energyRemaining: row.energy_remaining === null || row.energy_remaining === undefined ? null : Number(row.energy_remaining),
    energySpent: row.energy_spent === null || row.energy_spent === undefined ? null : Number(row.energy_spent),
    status: row.status,
    result: row.result,
    stepCount: row.step_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
    memory: parseJson(row.memory_json, {}),
  };
}

function extractFrame(observation) {
  const value = observation?.screenshot;
  if (typeof value !== "string") return null;
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw httpError(400, "截图必须是 JPEG、PNG 或 WebP data URL");
  const extension = match[1] === "image/jpeg" ? "jpg" : match[1].split("/")[1];
  return { mimeType: match[1], extension, bytes: Buffer.from(match[2], "base64") };
}

function withoutFrame(observation) {
  const result = structuredClone(observation || {});
  delete result.screenshot;
  return result;
}

const FORBIDDEN_JUDGE_FIELDS = new Set(["score", "result", "success", "reward", "rank", "durationMs", "energyRemaining", "submittedScore"]);
const OBSERVATION_FIELDS = new Set(["protocolVersion", "observedAt", "gameId", "level", "view", "harness", "ready", "status", "availableActions", "actionDescriptions", "hud", "actionResult", "player", "motion", "lastEvent", "interaction", "debug", "state", "judge", "environment"]);
const PROCESS_TASKS = Object.freeze({
  rf01: ["battery_collected", "power_restored", "door_opened"],
  rf02: ["book_collected_red", "book_collected_black", "book_collected_white", "book_shelved_red", "book_shelved_black", "book_shelved_white", "all_books_shelved"],
  rf03: ["parcel_collected_red", "parcel_collected_yellow", "parcel_collected_blue", "parcel_sorted_red", "parcel_sorted_yellow", "parcel_sorted_blue", "all_parcels_sorted"],
  rf04: ["clothing_collected_shirt", "clothing_collected_pants", "clothing_collected_towel", "clothing_loaded_shirt", "clothing_loaded_pants", "clothing_loaded_towel", "all_clothes_loaded", "washer_started", "washer_unloaded", "laundry_hung"],
  rf05: ["item_collected_towel", "item_collected_cup", "item_collected_trash", "item_delivered_towel", "item_delivered_cup", "item_delivered_trash", "room_reset_complete"],
  rf06: ["item_collected_wrench", "item_collected_bucket", "item_collected_mop", "valve_closed", "bucket_placed", "puddle_cleaned", "tool_returned_wrench", "tool_returned_mop", "leak_resolved"],
  rf07: ["sample_collected_samplea", "sample_collected_sampleb", "sample_collected_samplec", "sample_loaded_samplea", "sample_loaded_sampleb", "sample_loaded_samplec", "samples_ordered", "cooling_collected", "cooling_installed", "case_sealed", "temperature_activated", "case_collected", "cold_chain_complete"],
  rf08: ["office_bin_picked_up", "office_bin_placed"],
  rf09: ["item_collected_adapter", "item_collected_clicker", "device_installed_adapter", "device_installed_clicker", "terminal_opened", "presentation_started"],
  rf12: ["checklist_read", "cloth_collected", "cloth_secured", "gas_knob_reset", "hood_started", "window_opened", "gas_valve_closed", "kitchen_safety_complete"],
  test_zpf: ["checkpoint_inspected_whiteboard", "checkpoint_inspected_workbench", "checkpoint_inspected_window_ac", "inspection_complete"],
  test_zpf2: ["whiteboard_reviewed", "workstation_checked", "aircon_started", "door_opened"],
});
const PROCESS_TASK_TOTALS = Object.freeze({ rf01: 3, rf02: 6, rf03: 6, rf04: 9, rf05: 6, rf06: 8, rf07: 12, rf08: 2, rf09: 6, rf12: 8, test_zpf: 3, test_zpf2: 4 });

function baseLevelId(level) {
  if (/^rf13-0[23]$/.test(level)) return "rf13";
  return String(level).replace(/-[123]$/, "");
}

function processTaskKey(observation, level) {
  if (!["E", "F"].includes(String(observation?.actionResult?.action || "").toUpperCase())) return null;
  const event = String(observation?.actionResult?.event || observation?.lastEvent || "").trim().toLowerCase();
  const allowed = PROCESS_TASKS[level] || PROCESS_TASKS[baseLevelId(level)] || [];
  if (!event || !allowed.includes(event)) return null;
  return event.replace(/_recollected(?=_|$)/, "_collected");
}

function validateObservationPayload(observation) {
  if (!observation || typeof observation !== "object" || Array.isArray(observation)) throw httpError(400, "观察必须是对象");
  for (const key of Object.keys(observation)) {
    if (FORBIDDEN_JUDGE_FIELDS.has(key)) throw httpError(400, "禁止客户端提交裁判字段：" + key);
  }
  return observation;
}

function sanitizeObservation(observation) {
  const result = {};
  for (const [key, value] of Object.entries(withoutFrame(observation))) {
    if (OBSERVATION_FIELDS.has(key)) result[key] = value;
  }
  return result;
}

function observationDigest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function scoreEpisode({ result, steps, durationMs, energyRemaining, processScore = 0 }) {
  const successBase = result === "success" ? 10000 : 0;
  const stepPenalty = Math.min(3000, Math.max(0, Number(steps || 0)) * 20);
  const timePenalty = Math.min(2000, Math.round(Math.max(0, Number(durationMs || 0)) / 1000));
  const energyBonus = result === "success" && Number.isFinite(Number(energyRemaining)) ? Math.min(1000, Math.max(0, Math.round(Number(energyRemaining) * 10))) : 0;
  return Math.max(0, successBase - stepPenalty - timePenalty + energyBonus + Math.max(0, Number(processScore || 0)));
}

function deriveEnergy(observation) {
  const candidates = [observation?.hud?.reserve, observation?.hud?.energy, observation?.state?.reserve, observation?.state?.energy];
  const value = candidates.find((candidate) => Number.isFinite(Number(candidate)));
  return value === undefined ? null : Number(value);
}

function deriveEnergySpent(observation) {
  const candidates = [observation?.hud?.energySpent, observation?.state?.energySpent];
  const value = candidates.find((candidate) => Number.isFinite(Number(candidate)) && Number(candidate) >= 0);
  return value === undefined ? null : Number(value);
}

function nextEnergySpent(previousSpent, previousEnergy, observedEnergy, observedSpent = null) {
  const spent = Math.max(0, Number(previousSpent || 0));
  if (Number.isFinite(observedSpent)) return Math.max(spent, observedSpent);
  if (!Number.isFinite(previousEnergy) || !Number.isFinite(observedEnergy)) return spent;
  return spent + Math.max(0, previousEnergy - observedEnergy);
}

function resultForEpisode(row) {
  const details = parseJson(row.result_json, null);
  if (details) {
    return {
      ...details,
      ...seedMetadata(row),
      energySpent: details.energySpent ?? (row.energy_spent === null || row.energy_spent === undefined ? null : Number(row.energy_spent)),
    };
  }
  return {
    episodeId: row.id,
    ...seedMetadata(row),
    level: row.level,
    harness: row.harness,
    view: row.view,
    engine: row.engine || "prime",
    agent: { name: row.agent_name, version: row.agent_version },
    model: row.model_name || null,
    status: row.status,
    result: row.result,
    success: row.result === "success",
    score: Number(row.score || 0),
    steps: Number(row.step_count || 0),
    durationMs: Number(row.duration_ms || 0),
    energyRemaining: row.energy_remaining === null || row.energy_remaining === undefined ? null : Number(row.energy_remaining),
    energySpent: row.energy_spent === null || row.energy_spent === undefined ? null : Number(row.energy_spent),
    processScore: Number(row.process_score || 0),
    processTasks: parseJson(row.process_tasks_json, []),
    integrity: { signature: row.integrity_signature || null, chainHead: row.integrity_head || null },
    completedAt: row.updated_at,
  };
}

export class AgentPlatformStore {
  constructor({ root, databasePath, commandLeaseMs } = {}) {
    this.root = root || join(process.cwd(), "data", "agent-platform");
    const configuredLease = Number(commandLeaseMs ?? process.env.ARC_COMMAND_LEASE_MS ?? 60_000);
    this.commandLeaseMs = Number.isFinite(configuredLease) ? Math.max(1, configuredLease) : 60_000;
    mkdirSync(this.root, { recursive: true });
    mkdirSync(join(this.root, "episodes"), { recursive: true });
    this.db = new DatabaseSync(databasePath || join(this.root, "episodes.sqlite"));
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS episodes (
        id TEXT PRIMARY KEY,
        agent_token_hash TEXT NOT NULL,
        browser_token_hash TEXT NOT NULL,
        level TEXT NOT NULL,
        view TEXT NOT NULL,
        harness TEXT NOT NULL,
        engine TEXT NOT NULL DEFAULT 'prime',
        agent_name TEXT NOT NULL DEFAULT 'anonymous-agent',
        agent_version TEXT NOT NULL DEFAULT '1',
        model_name TEXT,
        instruction_version TEXT,
        status TEXT NOT NULL DEFAULT 'waiting_for_browser',
        result TEXT,
        step_count INTEGER NOT NULL DEFAULT 0,
        memory_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_seen_at TEXT,
        participant_id TEXT NOT NULL,
        score INTEGER,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        energy_remaining REAL,
        energy_spent REAL NOT NULL DEFAULT 0,
        result_json TEXT,
        integrity_head TEXT,
        integrity_signature TEXT,
        process_score INTEGER NOT NULL DEFAULT 0,
        process_tasks_json TEXT NOT NULL DEFAULT '[]',
        environment_seed INTEGER,
        seed_source TEXT,
        environment_json TEXT
      );
      CREATE TABLE IF NOT EXISTS commands (
        id TEXT PRIMARY KEY,
        episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        dispatched_at TEXT,
        dispatch_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        result_json TEXT
      );
      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        command_id TEXT,
        step INTEGER NOT NULL,
        metadata_json TEXT NOT NULL,
        frame_path TEXT,
        frame_mime_type TEXT,
        created_at TEXT NOT NULL,
        prev_hash TEXT,
        record_hash TEXT,
        server_signature TEXT
      );
      CREATE INDEX IF NOT EXISTS commands_episode_status ON commands(episode_id, status, created_at);
      CREATE INDEX IF NOT EXISTS observations_episode_id ON observations(episode_id, id DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS observations_command_id ON observations(command_id) WHERE command_id IS NOT NULL;
    `);
    const commandColumns = new Set(this.db.prepare("PRAGMA table_info(commands)").all().map((column) => column.name));
    if (!commandColumns.has("dispatched_at")) this.db.exec("ALTER TABLE commands ADD COLUMN dispatched_at TEXT");
    if (!commandColumns.has("dispatch_count")) this.db.exec("ALTER TABLE commands ADD COLUMN dispatch_count INTEGER NOT NULL DEFAULT 0");
    const episodeColumns = new Set(this.db.prepare("PRAGMA table_info(episodes)").all().map((column) => column.name));
    const episodeMigrations = [
      ["environment_seed", "INTEGER"], ["seed_source", "TEXT"], ["environment_json", "TEXT"],
      ["participant_id", "TEXT NOT NULL DEFAULT 'anonymous'"], ["score", "INTEGER"], ["duration_ms", "INTEGER NOT NULL DEFAULT 0"],
      ["energy_remaining", "REAL"], ["energy_spent", "REAL"], ["result_json", "TEXT"], ["integrity_head", "TEXT"], ["integrity_signature", "TEXT"], ["process_score", "INTEGER NOT NULL DEFAULT 0"], ["process_tasks_json", "TEXT NOT NULL DEFAULT '[]'"],
    ];
    for (const [name, definition] of episodeMigrations) if (!episodeColumns.has(name)) this.db.exec("ALTER TABLE episodes ADD COLUMN " + name + " " + definition);
    const observationColumns = new Set(this.db.prepare("PRAGMA table_info(observations)").all().map((column) => column.name));
    for (const [name, definition] of [["prev_hash", "TEXT"], ["record_hash", "TEXT"], ["server_signature", "TEXT"]]) if (!observationColumns.has(name)) this.db.exec("ALTER TABLE observations ADD COLUMN " + name + " " + definition);
    const legacyEnergyRows = this.db.prepare("SELECT id FROM episodes WHERE energy_spent IS NULL").all();
    const updateEnergySpent = this.db.prepare("UPDATE episodes SET energy_spent = ? WHERE id = ?");
    for (const row of legacyEnergyRows) {
      const observations = this.db.prepare("SELECT metadata_json FROM observations WHERE episode_id = ? ORDER BY id ASC").all(row.id);
      let previousEnergy = null;
      let energySpent = 0;
      let hasEnergy = false;
      for (const observation of observations) {
        const energy = deriveEnergy(parseJson(observation.metadata_json, {}));
        if (!Number.isFinite(energy)) continue;
        if (hasEnergy) energySpent += Math.max(0, previousEnergy - energy);
        previousEnergy = energy;
        hasEnergy = true;
      }
      if (hasEnergy) updateEnergySpent.run(energySpent, row.id);
    }
    this.signingKeyPath = join(this.root, ".observation-signing-key");
    if (!existsSync(this.signingKeyPath)) writeFileSyncFs(this.signingKeyPath, randomBytes(32).toString("hex"), { mode: 0o600 });
    this.signingKey = readFileSyncFs(this.signingKeyPath, "utf8").trim();
    if (!episodeColumns.has("engine")) this.db.exec("ALTER TABLE episodes ADD COLUMN engine TEXT NOT NULL DEFAULT 'prime'");
    if (!episodeColumns.has("agent_name")) this.db.exec("ALTER TABLE episodes ADD COLUMN agent_name TEXT NOT NULL DEFAULT 'anonymous-agent'");
    if (!episodeColumns.has("agent_version")) this.db.exec("ALTER TABLE episodes ADD COLUMN agent_version TEXT NOT NULL DEFAULT '1'");
    if (!episodeColumns.has("model_name")) this.db.exec("ALTER TABLE episodes ADD COLUMN model_name TEXT");
    if (!episodeColumns.has("instruction_version")) this.db.exec("ALTER TABLE episodes ADD COLUMN instruction_version TEXT");
  }

  close() {
    this.db.close();
  }

  createEpisode({ level = "rf01", view = "dual", harness = "visual", engine = "prime", agent, model, instructionVersion, participantId, gameBaseUrl, seed }) {
    if (!LEVELS.has(level)) throw httpError(400, `不支持的关卡：${level}`);
    if (!VIEWS.has(view)) throw httpError(400, `不支持的视角：${view}`);
    if (!HARNESSES.has(harness)) throw httpError(400, `不支持的 Harness：${harness}`);
    const normalizedEngine = String(engine || "prime").toLowerCase();
    if (!["prime", "token", "tool"].includes(normalizedEngine)) throw httpError(400, `不支持的引擎：${normalizedEngine}`);
    if (seed !== undefined && (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)) {
      throw httpError(400, "seed 必须是 0 到 4294967295 的 JSON 整数");
    }
    const seedPolicy = getSeedPolicy(level);
    const environmentSeed = seed === undefined ? (seedPolicy === "seeded" ? randomBytes(4).readUInt32BE() : null) : seed;
    const seedSource = seed !== undefined ? "provided" : environmentSeed === null ? null : "generated";
    const agentName = String(agent?.name || agent?.id || "anonymous-agent").slice(0, 120);
    const agentVersion = String(agent?.version || "1").slice(0, 80);
    const modelName = model ? String(model.name || model.id || model).slice(0, 120) : null;
    const normalizedInstructionVersion = instructionVersion ? String(instructionVersion).slice(0, 120) : null;
    const id = randomUUID();
    const participant = String(participantId || `anonymous-${randomUUID()}`).slice(0, 160);
    const agentToken = createToken();
    const browserToken = createToken();
    const now = new Date().toISOString();
    const memory = {
      goal: null,
      completed: [],
      inventory: [],
      landmarks: {},
      failedAttempts: [],
      nextPlan: null,
      recentEvents: [],
      step: 0,
    };
    this.db.prepare(`
      INSERT INTO episodes (
        id, agent_token_hash, browser_token_hash, level, view, harness,
        engine, agent_name, agent_version, model_name, instruction_version, participant_id,
        status, step_count, memory_json, energy_spent, created_at, updated_at, environment_seed, seed_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting_for_browser', 0, ?, 0, ?, ?, ?, ?)
    `).run(id, tokenHash(agentToken).toString("hex"), tokenHash(browserToken).toString("hex"), level, view, harness, normalizedEngine, agentName, agentVersion, modelName, normalizedInstructionVersion, participant, JSON.stringify(memory), now, now, environmentSeed, seedSource);

    const gameUrl = new URL(gameBaseUrl || "http://127.0.0.1:4175/");
    gameUrl.searchParams.set("mode", "agent");
    gameUrl.searchParams.set("level", level);
    gameUrl.searchParams.set("view", view);
    gameUrl.searchParams.set("harness", harness);
    gameUrl.searchParams.set("episode", id);
    gameUrl.searchParams.set("browser_token", browserToken);
    gameUrl.searchParams.delete("seed");
    if (seedPolicy === "seeded") gameUrl.searchParams.set("seed", String(environmentSeed));
    return { episode: publicEpisode(this.getEpisodeRow(id)), agentToken, gameUrl: gameUrl.toString() };
  }

  getSeedCapabilities() {
    return {
      protocolVersion: SEED_PROTOCOL_VERSION, minSeed: 0, maxSeed: 0xffffffff,
      levels: [...LEVELS].map((id) => ({ id, seedPolicy: getSeedPolicy(id) })),
      verification: "seedApplied becomes true only after validated browser environment metadata. Fingerprints attest the browser-reported initial state, not an independent server replay.",
    };
  }

  getEpisodeRow(id) {
    return this.db.prepare("SELECT * FROM episodes WHERE id = ?").get(id);
  }

  getLeaderboard(level, { harness, view, engine } = {}) {
    if (!LEVELS.has(level)) throw httpError(400, `不支持的关卡：${level}`);
    const rows = this.db.prepare("SELECT id, level, view, harness, engine, agent_name, agent_version, model_name, instruction_version, status, result, score, process_score, duration_ms, energy_remaining, energy_spent, step_count, created_at, updated_at, environment_seed, seed_source, environment_json FROM episodes WHERE level = ? AND status = 'completed' AND result IN ('success', 'failure') ORDER BY created_at ASC, updated_at ASC, id ASC").all(level);
    const filtered = rows.filter((row) => (!harness || row.harness === harness) && (!view || row.view === view) && (!engine || row.engine === engine));
    const groups = new Map();
    for (const row of filtered) {
      const key = [row.agent_name || "anonymous-agent", row.agent_version || "1", row.model_name || "unknown", row.harness, row.view, row.engine || "prime", row.instruction_version || "default"].join("\u001f");
      const group = groups.get(key) || { agent: row.agent_name || "anonymous-agent", version: row.agent_version || "1", model: row.model_name || "unknown", harness: row.harness, view: row.view, engine: row.engine || "prime", instructionVersion: row.instruction_version || "default", totalAttempts: 0, attemptResults: [], protocolRows: [], lastRunAt: row.updated_at };
      group.totalAttempts += 1;
      if (group.attemptResults.length < 10) {
        group.attemptResults.push(row.result);
        group.protocolRows.push(row);
      }
      if (row.updated_at > group.lastRunAt) group.lastRunAt = row.updated_at;
      groups.set(key, group);
    }
    const entries = [...groups.values()].map((group) => {
      const attempts = group.attemptResults.length;
      const wins = group.attemptResults.filter((result) => result === "success").length;
      const steps = group.protocolRows.map((row) => Number(row.step_count || 0));
      const scores = group.protocolRows.map((row) => Number(row.score || 0));
      const processScores = group.protocolRows.map((row) => Number(row.process_score || 0));
      const sortedSteps = steps.sort((a, b) => a - b);
      const medianSteps = sortedSteps.length ? sortedSteps[Math.floor((sortedSteps.length - 1) / 2)] : null;
      const passRate = attempts ? wins / attempts : 0;
      const meanScore = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
      const bestScore = scores.length ? Math.max(...scores) : 0;
      const processScore = processScores.length ? Math.round(processScores.reduce((sum, value) => sum + value, 0) / processScores.length) : 0;
      const score = meanScore;
      const firstSuccessIndex = group.attemptResults.indexOf("success");
      const firstSuccessAttempt = firstSuccessIndex >= 0 ? firstSuccessIndex + 1 : null;
      const successRate = (limit) => attempts >= limit
        ? group.attemptResults.slice(0, limit).filter((result) => result === "success").length / limit
        : null;
      const successRate1 = successRate(1);
      const successRate5 = successRate(5);
      const successRate10 = successRate(10);
      const averageSuccessfulEnergySpent = (limit) => {
        if (attempts < limit) return null;
        const successfulRows = group.protocolRows.slice(0, limit).filter((row) => row.result === "success");
        if (!successfulRows.length || successfulRows.some((row) => row.energy_spent === null || row.energy_spent === undefined || !Number.isFinite(Number(row.energy_spent)))) return null;
        return Math.round((successfulRows.reduce((sum, row) => sum + Number(row.energy_spent), 0) / successfulRows.length) * 100) / 100;
      };
      const averageEnergySpent1 = averageSuccessfulEnergySpent(1);
      const averageEnergySpent5 = averageSuccessfulEnergySpent(5);
      const averageEnergySpent10 = averageSuccessfulEnergySpent(10);
      const environments = group.protocolRows.map(seedMetadata);
      const seeds = [...new Set(environments.map((value) => value.seed))];
      const fingerprints = [...new Set(environments.map((value) => value.initialStateFingerprint))];
      return {
        ...group,
        seed: seeds.length === 1 ? seeds[0] : null,
        seeds,
        seedPolicy: getSeedPolicy(level),
        seedApplied: environments.every((value) => value.seedApplied),
        seedVerified: environments.every((value) => value.seedVerified),
        initialStateFingerprint: fingerprints.length === 1 ? fingerprints[0] : null,
        protocolRows: undefined,
        attemptResults: undefined,
        attempts,
        wins,
        passRate,
        medianSteps,
        processScore,
        meanScore,
        bestScore,
        score,
        firstSuccessAttempt,
        protocolAttempts: attempts,
        attemptLimit: 10,
        evaluationComplete: attempts === 10,
        evaluationWins: wins,
        challengeSteps: medianSteps,
        successRate1,
        successRate5,
        successRate10,
        averageEnergySpent1,
        averageEnergySpent5,
        averageEnergySpent10,
        passWithin1: successRate1,
        passWithin5: successRate5,
        passWithin10: successRate10,
      };
    }).sort((a, b) => Number(b.evaluationComplete) - Number(a.evaluationComplete) || (b.successRate10 ?? -1) - (a.successRate10 ?? -1) || (b.successRate5 ?? -1) - (a.successRate5 ?? -1) || (b.successRate1 ?? -1) - (a.successRate1 ?? -1) || (a.averageEnergySpent10 ?? Infinity) - (b.averageEnergySpent10 ?? Infinity) || b.processScore - a.processScore || (a.medianSteps ?? Infinity) - (b.medianSteps ?? Infinity) || String(a.lastRunAt).localeCompare(String(b.lastRunAt)));
    let rankedEntries = 0;
    return {
      level,
      filters: { harness: harness || null, view: view || null, engine: engine || null },
      attemptLimit: 10,
      entries: entries.map((entry) => ({ rank: entry.evaluationComplete ? ++rankedEntries : null, ...entry })),
    };
  }

  requireEpisode(id) {
    const row = this.getEpisodeRow(id);
    if (!row) throw httpError(404, "Episode 不存在");
    return row;
  }

  authenticateAgent(id, token) {
    const row = this.requireEpisode(id);
    if (!tokenMatches(token, row.agent_token_hash)) throw httpError(401, "Agent Token 无效");
    return row;
  }

  authenticateBrowser(id, token) {
    const row = this.requireEpisode(id);
    if (!tokenMatches(token, row.browser_token_hash)) throw httpError(401, "Browser Token 无效");
    return row;
  }

  getStatus(id, token) {
    const episode = this.authenticateAgent(id, token);
    const active = this.db.prepare("SELECT id, kind, status, dispatched_at, dispatch_count, created_at FROM commands WHERE episode_id = ? AND status IN ('pending', 'dispatched') ORDER BY created_at LIMIT 1").get(id);
    return {
      ...publicEpisode(episode),
      activeCommand: active ? {
        id: active.id,
        kind: active.kind,
        status: active.status,
        dispatchedAt: active.dispatched_at,
        dispatchCount: active.dispatch_count,
        createdAt: active.created_at,
      } : null,
    };
  }

  enqueueCommand(id, token, command) {
    this.authenticateAgent(id, token);
    const pending = this.db.prepare("SELECT id FROM commands WHERE episode_id = ? AND status IN ('pending', 'dispatched') LIMIT 1").get(id);
    if (pending) throw httpError(409, "上一个动作尚未完成");
    const kind = command.kind || "act";
    if (!new Set(["act", "reset", "observe"]).has(kind)) throw httpError(400, `不支持的命令：${kind}`);
    const payload = { ...command };
    if (kind === "act") {
      payload.action = String(payload.action || "").toUpperCase();
      if (!ACTIONS.has(payload.action)) throw httpError(400, `非法动作：${payload.action}`);
      const durationMs = payload.durationMs === undefined ? 300 : payload.durationMs;
      if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 50 || durationMs > 1000) {
        throw httpError(400, "durationMs 必须是 50–1000 之间的有限数字");
      }
      payload.durationMs = durationMs;
    }
    const commandId = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO commands (id, episode_id, kind, payload_json, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)")
      .run(commandId, id, kind, JSON.stringify(payload), now);
    this.db.prepare("UPDATE episodes SET updated_at = ? WHERE id = ?").run(now, id);
    return { id: commandId, episodeId: id, kind, payload, status: "pending", createdAt: now };
  }

  nextCommand(id, token) {
    const episode = this.authenticateBrowser(id, token);
    const now = new Date().toISOString();
    if (episode.status === "completed") {
      this.db.prepare("UPDATE episodes SET last_seen_at = ? WHERE id = ?").run(now, id);
      return null;
    }
    const leaseCutoff = new Date(Date.now() - this.commandLeaseMs).toISOString();
    const row = this.db.prepare(`
      SELECT * FROM commands
      WHERE episode_id = ? AND (
        status = 'pending' OR
        (status = 'dispatched' AND COALESCE(dispatched_at, created_at) <= ?)
      )
      ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at
      LIMIT 1
    `).get(id, leaseCutoff);
    this.db.prepare("UPDATE episodes SET status = 'running', last_seen_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
    if (!row) return null;
    this.db.prepare("UPDATE commands SET status = 'dispatched', dispatched_at = ?, dispatch_count = COALESCE(dispatch_count, 0) + 1 WHERE id = ?").run(now, row.id);
    return {
      id: row.id,
      episodeId: row.episode_id,
      kind: row.kind,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      dispatchedAt: now,
      dispatchCount: Number(row.dispatch_count || 0) + 1,
      redelivered: row.status === "dispatched",
    };
  }

  validateEpisodeEnvironment(episode, observation) {
    const environment = validateEnvironment(observation, episode);
    if (environment && !episode.environment_json
      && this.db.prepare("SELECT 1 FROM observations WHERE episode_id = ? LIMIT 1").get(episode.id)) {
      throw httpError(400, "environment 必须随首张观察提交；缺少初始证据的 Episode 不能后补为已验证");
    }
    return environment;
  }

  async submitObservation(id, token, observation, commandId = null) {
    const episode = this.authenticateBrowser(id, token);
    validateObservationPayload(observation);
    const environment = this.validateEpisodeEnvironment(episode, observation);
    const environmentJson = environment ? JSON.stringify(environment) : episode.environment_json;
    const environmentFields = seedMetadata({ ...episode, environment_json: environmentJson });
    let command = null;
    if (commandId) {
      command = this.db.prepare("SELECT * FROM commands WHERE id = ? AND episode_id = ?").get(commandId, id);
      if (!command) throw httpError(404, "命令不存在");
      if (command.status === "completed") {
        const existing = this.db.prepare("SELECT id, step FROM observations WHERE episode_id = ? AND command_id = ?").get(id, commandId);
        return {
          observationId: Number(existing?.id || 0),
          step: existing?.step ?? episode.step_count,
          status: episode.status,
          result: episode.result,
          duplicate: true,
        };
      }
    }
    const frame = extractFrame(observation);
    const step = episode.step_count + (command ? 1 : 0);
    const now = new Date().toISOString();
    const episodeDirectory = join(this.root, "episodes", id);
    await mkdir(join(episodeDirectory, "frames"), { recursive: true });
    let framePath = null;
    if (frame) {
      framePath = join("episodes", id, "frames", `${String(step).padStart(6, "0")}.${frame.extension}`);
      await writeFile(join(this.root, framePath), frame.bytes);
    }
    validateObservationPayload(observation);
    const metadata = sanitizeObservation(observation);
    if (environment) metadata.environment = environment;
    // Only the server adds this record; client-supplied seedConfiguration is discarded.
    metadata.seedConfiguration = environmentFields;
    for (const [field, expected] of [["level", episode.level], ["view", episode.view], ["harness", episode.harness]]) {
      if (metadata[field] !== undefined && metadata[field] !== expected) throw httpError(400, `观察 ${field} 与 Episode 不一致`);
    }
    if (["WIN", "GAME_OVER"].includes(metadata.status) && (!command || command.kind !== "act")) throw httpError(400, "终态必须由已下发的动作产生");
    if (command?.kind === "act" && metadata.actionResult?.action && metadata.actionResult.action !== parseJson(command.payload_json, {}).action) throw httpError(400, "动作结果与已下发命令不一致");
    // Recheck after asynchronous frame IO so concurrent initial observations cannot change a frozen seed record.
    this.validateEpisodeEnvironment(this.requireEpisode(id), observation);
    const previous = this.db.prepare("SELECT record_hash FROM observations WHERE episode_id = ? ORDER BY id DESC LIMIT 1").get(id);
    const prevHash = previous?.record_hash || null;
    const recordHash = observationDigest({ episodeId: id, commandId, step, metadata, framePath, prevHash });
    const serverSignature = createHmac("sha256", this.signingKey).update(recordHash).digest("hex");
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO observations (episode_id, command_id, step, metadata_json, frame_path, frame_mime_type, created_at, prev_hash, record_hash, server_signature)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, commandId, step, JSON.stringify(metadata), framePath, frame?.mimeType || null, now, prevHash, recordHash, serverSignature);

    if (commandId && insert.changes === 0) {
      const existing = this.db.prepare("SELECT id, step FROM observations WHERE episode_id = ? AND command_id = ?").get(id, commandId);
      const latestEpisode = this.requireEpisode(id);
      return {
        observationId: Number(existing?.id || 0),
        step: existing?.step ?? latestEpisode.step_count,
        status: latestEpisode.status,
        result: latestEpisode.result,
        duplicate: true,
      };
    }

    if (command) {
      this.db.prepare("UPDATE commands SET status = 'completed', completed_at = ?, result_json = ? WHERE id = ?")
        .run(now, JSON.stringify(metadata.actionResult || {}), commandId);
    }
    const result = metadata.status === "WIN" ? "success" : metadata.status === "GAME_OVER" ? "failure" : null;
    const status = result ? "completed" : "running";
    const previousProcessTasks = parseJson(episode.process_tasks_json, []) || [];
    const taskKey = processTaskKey(metadata, episode.level);
    const processTasks = taskKey && !previousProcessTasks.includes(taskKey) ? [...previousProcessTasks, taskKey] : previousProcessTasks;
    const processTaskTotal = PROCESS_TASK_TOTALS[episode.level] || PROCESS_TASK_TOTALS[baseLevelId(episode.level)] || 0;
    const mappedProcessScore = processTaskTotal ? Math.min(100, Math.round((processTasks.length / processTaskTotal) * 10000) / 100) : 0;
    const processScore = Math.max(Number(episode.process_score || 0), mappedProcessScore);
    const durationMs = command ? Number(parseJson(command.payload_json, {}).durationMs || 0) : 0;
    const totalDurationMs = Number(episode.duration_ms || 0) + durationMs;
    const observedEnergy = deriveEnergy(metadata);
    const previousEnergy = episode.energy_remaining === null || episode.energy_remaining === undefined ? null : Number(episode.energy_remaining);
    const energyRemaining = Number.isFinite(observedEnergy) ? observedEnergy : previousEnergy;
    const energySpent = nextEnergySpent(Number(episode.energy_spent || 0), previousEnergy, observedEnergy, deriveEnergySpent(metadata));
    const score = result ? scoreEpisode({ result, steps: step, durationMs: totalDurationMs, energyRemaining, processScore }) : null;
    const resultDetails = result ? { ...environmentFields, episodeId: id, level: episode.level, harness: episode.harness, view: episode.view, engine: episode.engine || "prime", agent: { name: episode.agent_name, version: episode.agent_version }, model: episode.model_name || null, participantId: episode.participant_id || null, status, result, success: result === "success", score, steps: step, durationMs: totalDurationMs, energyRemaining, energySpent, processScore, processTasks, integrity: { signature: serverSignature, chainHead: recordHash }, completedAt: now } : null;
    const memory = parseJson(episode.memory_json, {});
    const event = metadata.actionResult?.event || metadata.lastEvent;
    const recentEvents = [...(memory.recentEvents || []), ...(event ? [{ step, event }] : [])].slice(-20);
    const nextMemory = {
      ...memory,
      goal: memory.goal || metadata.hud?.objective || null,
      recentEvents,
      step,
      lastAction: metadata.actionResult?.action || null,
      lastEvent: event || null,
      result,
    };
    this.db.prepare(`
      UPDATE episodes SET status = ?, result = ?, step_count = ?, memory_json = ?, duration_ms = ?, energy_remaining = ?, energy_spent = ?, score = ?, result_json = ?, integrity_head = ?, integrity_signature = ?, process_score = ?, process_tasks_json = ?, environment_json = ?, last_seen_at = ?, updated_at = ? WHERE id = ?
    `).run(status, result, step, JSON.stringify(nextMemory), totalDurationMs, energyRemaining, energySpent, score, resultDetails ? JSON.stringify(resultDetails) : null, recordHash, serverSignature, processScore, JSON.stringify(processTasks), environmentJson, now, now, id);

    const trajectory = {
      ...environmentFields,
      step,
      commandId,
      command: command ? { kind: command.kind, ...parseJson(command.payload_json, {}) } : null,
      result: metadata.actionResult || null,
      observation: metadata,
      integrity: { recordHash, prevHash, serverSignature },
      framePath,
      createdAt: now,
    };
    await appendFile(join(episodeDirectory, "trajectory.jsonl"), `${JSON.stringify(trajectory)}\n`);
    return { observationId: Number(insert.lastInsertRowid), step, status, result };
  }

  async getLatestObservation(id, token) {
    const episode = this.authenticateAgent(id, token);
    const row = this.db.prepare("SELECT * FROM observations WHERE episode_id = ? ORDER BY id DESC LIMIT 1").get(id);
    if (!row) throw httpError(409, "浏览器尚未提交观察，请先打开 gameUrl");
    const observation = parseJson(row.metadata_json, {});
    delete observation.judge;
    if (episode.harness === "visual") {
      for (const key of ["actionResult", "player", "motion", "lastEvent", "interaction", "debug", "state", "seedConfiguration"]) delete observation[key];
    }
    if (row.frame_path && episode.harness !== "state") {
      const bytes = await readFile(join(this.root, row.frame_path));
      observation.screenshot = `data:${row.frame_mime_type};base64,${bytes.toString("base64")}`;
    }
    return { id: Number(row.id), commandId: row.command_id, step: row.step, createdAt: row.created_at, ...observation };
  }


  getResult(id, token) {
    const row = this.authenticateAgent(id, token);
    return { ready: row.status === "completed" && Boolean(row.result), ...resultForEpisode(row) };
  }

  getMemory(id, token) {
    const row = this.authenticateAgent(id, token);
    return parseJson(row.memory_json, {});
  }

  updateMemory(id, token, patch) {
    const row = this.authenticateAgent(id, token);
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw httpError(400, "记忆更新必须是对象");
    const memory = { ...parseJson(row.memory_json, {}), ...patch, step: row.step_count };
    const now = new Date().toISOString();
    this.db.prepare("UPDATE episodes SET memory_json = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(memory), now, id);
    return memory;
  }
}

function bearerToken(req) {
  const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function sendJson(res, status, value) {
  res.writeHead(status, {
    ...(status === 429 ? { "retry-after": String(value?.retryAfter || 1) } : {}),
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
  });
  res.end(JSON.stringify(value));
}

export function createAgentPlatformRouter({ store, readBody, gameBaseUrl }) {

  const rateState = new Map();
  const rateLimit = (req, key, limit, windowMs = 60_000, identity = req.socket?.remoteAddress || "unknown") => {
    const now = Date.now();
    const bucketKey = identity + ":" + key;
    const current = rateState.get(bucketKey);
    if (!current || now >= current.resetAt) { rateState.set(bucketKey, { count: 1, resetAt: now + windowMs }); return; }
    current.count += 1;
    if (current.count > limit) { const error = httpError(429, "请求过于频繁，请稍后重试"); error.retryAfter = Math.ceil((current.resetAt - now) / 1000); throw error; }
  };
  return async function routeAgentPlatform(req, res, url) {
    if (!url.pathname.startsWith("/api/v1/episodes") && !url.pathname.startsWith("/api/v1/leaderboards") && url.pathname !== "/api/v1/seed-capabilities") return false;
    if (req.method === "OPTIONS") {
      sendJson(res, 204, null);
      return true;
    }
    try {
      // Public endpoints retain address-based protection. Authenticated episode
      // traffic is scoped below: reverse proxies otherwise merge all clients.
      if (url.pathname === "/api/v1/episodes") rateLimit(req, "episodes", 10);
      else if (url.pathname.startsWith("/api/v1/leaderboards") || url.pathname === "/api/v1/seed-capabilities") rateLimit(req, "read", 600);
      if (req.method === "GET" && url.pathname === "/api/v1/seed-capabilities") {
        sendJson(res, 200, store.getSeedCapabilities());
        return true;
      }
      if (req.method === "GET" && (url.pathname === "/api/v1/leaderboards" || url.pathname.match(/^\/api\/v1\/leaderboards\/[^/]+$/))) {
        const pathLevel = url.pathname.match(/^\/api\/v1\/leaderboards\/([^/]+)$/)?.[1];
        const level = pathLevel || url.searchParams.get("level") || "rf01";
        sendJson(res, 200, store.getLeaderboard(level, {
          harness: url.searchParams.get("harness") || undefined,
          view: url.searchParams.get("view") || undefined,
          engine: url.searchParams.get("engine") || undefined,
        }));
        return true;
      }
      if (req.method === "POST" && url.pathname === "/api/v1/episodes") {
        const payload = await readBody(req);
        sendJson(res, 201, store.createEpisode({ ...payload, gameBaseUrl }));
        return true;
      }
      const match = url.pathname.match(/^\/api\/v1\/episodes\/([^/]+)(?:\/(.*))?$/);
      if (!match) throw httpError(404, "Endpoint 不存在");
      const episodeId = match[1];
      const resource = match[2] || "status";
      const agentToken = bearerToken(req);
      const browserToken = url.searchParams.get("browser_token") || "";
      const browserRequest = (req.method === "GET" && resource === "commands/next") || (req.method === "POST" && resource === "observations");
      try {
        if (browserRequest) store.authenticateBrowser(episodeId, browserToken);
        else store.authenticateAgent(episodeId, agentToken);
      } catch (error) {
        // Invalid credentials cannot create arbitrary per-episode rate buckets.
        rateLimit(req, "authentication-failures", 180);
        throw error;
      }
      const rateKey = browserRequest
        ? (resource === "commands/next" ? "browser-poll" : "browser-observations")
        : (req.method === "POST" && resource === "commands" ? "agent-commands" : resource === "observations/latest" ? "agent-observations" : "agent-read");
      const limit = rateKey === "browser-poll" ? 1200 : rateKey === "agent-commands" ? 180 : rateKey.endsWith("observations") ? 360 : 600;
      rateLimit(req, rateKey, limit, 60_000, episodeId);

      if (req.method === "GET" && resource === "status") sendJson(res, 200, store.getStatus(episodeId, agentToken));
      else if (req.method === "GET" && resource === "result") sendJson(res, 200, store.getResult(episodeId, agentToken));
      else if (req.method === "POST" && resource === "commands") sendJson(res, 202, store.enqueueCommand(episodeId, agentToken, await readBody(req)));
      else if (req.method === "GET" && resource === "commands/next") {
        const command = store.nextCommand(episodeId, browserToken);
        if (command) sendJson(res, 200, command);
        else {
          res.writeHead(204, { "cache-control": "no-store", "access-control-allow-origin": "*" });
          res.end();
        }
      } else if (req.method === "POST" && resource === "observations") {
        const payload = await readBody(req);
        sendJson(res, 201, await store.submitObservation(episodeId, browserToken, payload.observation, payload.commandId || null));
      } else if (req.method === "GET" && resource === "observations/latest") sendJson(res, 200, await store.getLatestObservation(episodeId, agentToken));
      else if (req.method === "GET" && resource === "memory") sendJson(res, 200, store.getMemory(episodeId, agentToken));
      else if (req.method === "PATCH" && resource === "memory") sendJson(res, 200, store.updateMemory(episodeId, agentToken, await readBody(req)));
      else throw httpError(404, "Endpoint 不存在");
      return true;
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message || "agent platform error", ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}) });
      return true;
    }
  };
}

export { ACTIONS, HARNESSES, LEVELS, VIEWS };
