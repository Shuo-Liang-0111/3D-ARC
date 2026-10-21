#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const ARC_URL = required("ARC_AGENT_API_URL").replace(/\/$/, "");
const MODEL_URL = required("MODEL_API_URL");
const MODEL_KEY = required("MODEL_API_KEY");
const MODEL_NAME = required("MODEL_NAME");
const LEVEL = process.env.ARC_LEVEL || "rf01";
const VIEW = process.env.ARC_VIEW || "dual";
const HARNESS = process.env.ARC_HARNESS || "state";
const SEED = seedFromEnvironment(process.env.ARC_SEED);
const ACTIONS = new Set(["W", "A", "S", "D", "E", "TURN_LEFT", "TURN_RIGHT", "WAIT"]);
const RETRY_DELAYS = [2000, 5000, 10_000, 20_000, 30_000];
let browserSession = null;

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function seedFromEnvironment(value) {
  if (value === undefined) return undefined;
  const seed = Number(value);
  if (!/^[0-9]+$/.test(value) || !Number.isInteger(seed) || seed < 0 || seed > 4294967295) {
    throw new Error("ARC_SEED must be an integer from 0 through 4294967295.");
  }
  return seed;
}

function browserEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|^(MODEL|OPENAI|GEILI|ANTHROPIC|AZURE_OPENAI)_/i.test(name)));
}

async function startManagedBrowser(gameUrl) {
  const script = process.env.ARC_MANAGED_BROWSER_SCRIPT || [
    fileURLToPath(new URL("./arc-managed-browser.mjs", import.meta.url)),
    fileURLToPath(new URL("../../tools/arc-managed-browser.mjs", import.meta.url)),
  ].find((path) => existsSync(path));
  const infrastructureError = () => new Error("Managed browser infrastructure failed. Install Node.js, puppeteer-core and Chromium; check ARC_MANAGED_BROWSER_SCRIPT, ARC_CHROMIUM_EXECUTABLE and ARC_PUPPETEER_ENTRY. No screenshot fallback is available.");
  if (!script || !existsSync(script)) throw infrastructureError();
  const child = spawn(process.execPath, [script, "--game-url-stdin"], {
    env: browserEnvironment(), stdio: ["pipe", "pipe", "pipe"],
  });
  let exited = false;
  const completion = new Promise((resolve) => {
    child.once("error", () => { exited = true; resolve(); });
    child.once("close", () => { exited = true; resolve(); });
  });
  child.stderr.resume(); // Never forward Chromium errors that could contain the private game URL.
  child.stdin.on("error", () => {});
  let closing;
  const signals = new Map();
  const close = () => closing ||= (async () => {
    for (const [signal, handler] of signals) process.off(signal, handler);
    if (exited) return;
    child.stdin.end();
    const terminate = setTimeout(() => child.kill("SIGTERM"), 5000);
    const kill = setTimeout(() => child.kill("SIGKILL"), 10_000);
    try { await completion; } finally { clearTimeout(terminate); clearTimeout(kill); }
  })();
  for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]]) {
    const handler = () => { void close().finally(() => process.exit(code)); };
    signals.set(signal, handler);
    process.on(signal, handler);
  }
  const lines = createInterface({ input: child.stdout });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(infrastructureError()), 180_000);
      completion.then(() => { clearTimeout(timeout); reject(infrastructureError()); });
      lines.on("line", (line) => {
        try {
          const result = JSON.parse(line);
          if (result.ready === true) { clearTimeout(timeout); resolve(); }
          else if (result.ready === false) { clearTimeout(timeout); reject(infrastructureError()); }
        } catch { clearTimeout(timeout); reject(infrastructureError()); }
      });
      child.stdin.write(`${gameUrl}\n`);
    });
    return {
      close,
      assertRunning() { if (exited) throw infrastructureError(); },
    };
  } catch {
    await close();
    throw infrastructureError();
  } finally {
    lines.close();
    child.stdout.resume();
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function timing(label, startedAt, details = "") {
  console.log(`TIMING ${label} elapsedMs=${Math.round(performance.now() - startedAt)} ${details}`.trim());
}

function isTransient(error) {
  return error.status === undefined || [408, 429].includes(error.status) || error.status >= 500;
}

async function requestJson(url, { method = "GET", token, body, modelRequest = false } = {}) {
  // Only reads and model inference are safe to replay. ARC mutations are reconciled separately.
  const retrySafe = method === "GET" || modelRequest;
  for (let attempt = 0; ; attempt += 1) {
    const startedAt = performance.now();
    let outcome = "error";
    try {
      const response = await fetch(url, {
        method,
        headers: {
          accept: "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      });
      const payload = response.status === 204 ? null : await response.json().catch((error) => {
        if (error instanceof SyntaxError) return {};
        throw error;
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      outcome = "ok";
      return payload;
    } catch (error) {
      if (!retrySafe || !isTransient(error)) throw error;
      if (attempt >= RETRY_DELAYS.length) {
        const failure = new Error(`${modelRequest ? "Model" : "ARC read"} request failed after ${attempt + 1} attempts; check connectivity and service availability before resuming.`);
        failure.status = error.status;
        throw failure;
      }
      console.warn(`Transient ${modelRequest ? "model" : "read"} request failure; retrying in ${RETRY_DELAYS[attempt] / 1000}s.`);
    } finally {
      if (modelRequest) timing("model_request", startedAt, `attempt=${attempt + 1} outcome=${outcome}`);
    }
    await delay(RETRY_DELAYS[attempt]);
  }
}

function episodeRequest(episodeId, token, resource, options = {}) {
  browserSession?.assertRunning();
  return requestJson(`${ARC_URL}/api/v1/episodes/${episodeId}/${resource}`, { token, ...options });
}

async function waitForBrowser(episodeId, token) {
  let reported = false;
  for (;;) {
    try {
      return await episodeRequest(episodeId, token, "observations/latest");
    } catch (error) {
      if (error.status !== 409) throw error;
      if (!reported) {
        console.warn(`Episode ${episodeId}: waiting for the game browser to connect. Keep its host awake; model inference has not started.`);
        reported = true;
      }
      await delay(500);
    }
  }
}

function browserConnection(status) {
  if (status.status === "waiting_for_browser" || status.lastSeenAt === null) {
    return "Browser has not connected. Open the original Episode game URL and keep its host awake.";
  }
  const lastSeen = Date.parse(status.lastSeenAt);
  if (Number.isFinite(lastSeen) && Date.now() - lastSeen > 90_000) {
    return "Browser heartbeat is stale; the game browser or its connection may be paused. Check the browser host and keep it awake.";
  }
  return Number.isFinite(lastSeen) ? "Browser heartbeat is recent." : "Browser connection is not confirmed by status.";
}

async function latestForCommand(episodeId, token) {
  try {
    return await episodeRequest(episodeId, token, "observations/latest");
  } catch (error) {
    if (error.status === 409) return null;
    throw error;
  }
}

function commandFinished(observation, commandId) {
  return observation && (observation.commandId === commandId || ["WIN", "GAME_OVER"].includes(observation.status));
}

async function waitForCommand(episodeId, token, commandId) {
  for (let window = 1; ; window += 1) {
    const deadline = performance.now() + 90_000;
    while (performance.now() < deadline) {
      const observation = await latestForCommand(episodeId, token);
      if (commandFinished(observation, commandId)) return observation;
      await delay(250);
    }
    console.warn(`Episode ${episodeId}: command ${commandId} wait window ${window} expired; checking command delivery and browser connection.`);
    const status = await episodeRequest(episodeId, token, "status");
    const latest = await latestForCommand(episodeId, token);
    if (commandFinished(latest, commandId)) return latest;
    const connection = browserConnection(status);
    if (status.activeCommand?.id === commandId) {
      console.warn(`Episode ${episodeId}: ${connection} Command ${commandId} is still active; continuing another 90s window without resending or requesting another model decision.`);
      continue;
    }
    throw new Error(`Episode ${episodeId}: command ${commandId} delivery is uncertain after checking status and latest observation. ${connection} No action was resent; inspect this Episode before resuming.`);
  }
}

function modelContent(observation, memory) {
  const screenshot = observation.screenshot;
  let copy;
  if (HARNESS === "visual") {
    if (!screenshot) throw new Error("Visual harness requires a screenshot before model inference.");
    copy = { actionDescriptions: Object.fromEntries(Object.entries(observation.actionDescriptions || {})
      .filter(([action, description]) => ACTIONS.has(action) && typeof description === "string")) };
  } else {
    copy = structuredClone(observation);
    delete copy.screenshot;
  }
  const text = JSON.stringify({ observation: copy, memory });
  if (!screenshot) return text;
  return [
    { type: "text", text },
    { type: "image_url", image_url: { url: screenshot } },
  ];
}

async function actAndObserve(episodeId, token, decision, previous) {
  const startedAt = performance.now();
  let outcome = "error";
  try {
    let command;
    try {
      command = await episodeRequest(episodeId, token, "commands", {
        method: "POST",
        body: { kind: "act", action: decision.action, durationMs: decision.durationMs },
      });
      if (!command?.id) throw new Error("Command acknowledgment was incomplete.");
    } catch (error) {
      if (!isTransient(error) && error.status !== 409) throw error;
      // The POST may have succeeded before its response was lost. Never replay it blindly.
      const status = await episodeRequest(episodeId, token, "status");
      const latest = await episodeRequest(episodeId, token, "observations/latest");
      if (["WIN", "GAME_OVER"].includes(latest.status)
          || (latest.commandId && latest.commandId !== previous.commandId)) {
        outcome = "recovered";
        return latest;
      }
      if (status.activeCommand?.id) {
        const observation = await waitForCommand(episodeId, token, status.activeCommand.id);
        outcome = "recovered";
        return observation;
      }
      throw new Error(`Episode ${episodeId}: Action delivery is uncertain after checking status and latest observation. ${browserConnection(status)} No action was resent; inspect this Episode before resuming.`);
    }
    const observation = await waitForCommand(episodeId, token, command.id);
    outcome = "ok";
    return observation;
  } catch (error) {
    if (error.message.includes(`Episode ${episodeId}:`)) throw error;
    throw new Error(`Episode ${episodeId}: ${error.message} No action was resent; inspect this Episode before resuming.`);
  } finally {
    timing("action_ack", startedAt, `action=${decision.action} durationMs=${decision.durationMs} outcome=${outcome}`);
  }
}

function parseModelJson(content) {
  const text = Array.isArray(content)
    ? content.map((part) => typeof part?.text === "string" ? part.text : "").join("")
    : content;
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error("Return strict JSON with action and durationMs.");
  }
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("The decision must be a JSON object.");
  }
  if (!ACTIONS.has(result.action)) {
    throw new Error("action must be one of W,A,S,D,E,TURN_LEFT,TURN_RIGHT,WAIT.");
  }
  if (typeof result.durationMs !== "number" || !Number.isFinite(result.durationMs)
      || result.durationMs < 50 || result.durationMs > 1000) {
    throw new Error("durationMs must be a number from 50 through 1000 milliseconds.");
  }
  return { action: result.action, durationMs: result.durationMs, memory: result.memory };
}

async function chooseAction(observation, memory) {
  const messages = [
    {
      role: "system",
      content: "You control a robot in ARC. Choose exactly one action from W,A,S,D,E,TURN_LEFT,TURN_RIGHT,WAIT. W moves forward; S moves backward; A strafes left; D strafes right; TURN_LEFT and TURN_RIGHT rotate heading; E interacts (legacy E always means interaction); WAIT applies no input. Follow the published actionDescriptions. In visual mode use only the current screenshot, published action descriptions, and your own memory. Keep memory concise. Choose its durationMs from 50 through 1000 milliseconds based on the observation and your plan. Use observation and memory, avoid repeating failed moves, and stop planning after WIN or GAME_OVER. Return strict JSON with action, durationMs, and optional memory. action must be one of the listed strings; durationMs must be a JSON number, not a string. There is no action-count limit; continue until WIN or GAME_OVER.",
    },
    { role: "user", content: modelContent(observation, memory) },
  ];
  let validationError;
  for (;;) {
    browserSession?.assertRunning();
    const response = await requestJson(MODEL_URL, {
      method: "POST",
      token: MODEL_KEY,
      modelRequest: true,
      body: {
        model: MODEL_NAME,
        temperature: 0,
        messages: validationError ? [
          ...messages,
          { role: "user", content: `Your previous response was invalid: ${validationError} Choose again using the same observation. No action has been sent.` },
        ] : messages,
      },
    });
    try {
      return parseModelJson(response?.choices?.[0]?.message?.content);
    } catch (error) {
      validationError = error.message;
      console.warn(`Invalid model decision: ${validationError} Retrying the same observation.`);
    }
  }
}

const created = await requestJson(`${ARC_URL}/api/v1/episodes`, {
  method: "POST",
  body: { level: LEVEL, view: VIEW, harness: HARNESS, ...(SEED === undefined ? {} : { seed: SEED }) },
});
const episodeId = created.episode.id;
const token = created.agentToken;
try {
  if (["visual", "hybrid"].includes(HARNESS)) {
    console.log(`Episode ${episodeId}: starting managed browser.`);
    browserSession = await startManagedBrowser(created.gameUrl);
    console.log(`Episode ${episodeId}: managed browser ready; original viewport PNG capture enabled.`);
  } else {
    console.log("\nOpen this game URL in a browser:\n");
    console.log(`${created.gameUrl}\n`);
  }
  let observation = await waitForBrowser(episodeId, token);
  let ownMemory = {};
  for (let step = 0; ; step += 1) {
    if (["WIN", "GAME_OVER"].includes(observation.status)) {
      console.log(`Episode finished: ${observation.status} after ${step} actions`);
      break;
    }
    const startedAt = performance.now();
    let outcome = "error";
    try {
      const memory = HARNESS === "visual" ? ownMemory : await episodeRequest(episodeId, token, "memory");
      const decision = await chooseAction(observation, memory);
      if (decision.memory && typeof decision.memory === "object" && !Array.isArray(decision.memory)) {
        await episodeRequest(episodeId, token, "memory", { method: "PATCH", body: decision.memory });
        ownMemory = { ...ownMemory, ...decision.memory };
      }
      console.log(`${String(step + 1).padStart(3, "0")}  ${decision.action}  ${decision.durationMs}ms`);
      observation = await actAndObserve(episodeId, token, decision, observation);
      outcome = "ok";
    } finally {
      timing("step", startedAt, `step=${step + 1} outcome=${outcome}`);
    }
  }
} finally {
  await browserSession?.close();
}
