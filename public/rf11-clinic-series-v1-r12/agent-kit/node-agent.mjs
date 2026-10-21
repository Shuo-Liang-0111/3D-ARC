#!/usr/bin/env node

const ARC_URL = required("ARC_AGENT_API_URL").replace(/\/$/, "");
const MODEL_URL = required("MODEL_API_URL");
const MODEL_KEY = required("MODEL_API_KEY");
const MODEL_NAME = required("MODEL_NAME");
const LEVEL = process.env.ARC_LEVEL || "rf01";
const VIEW = process.env.ARC_VIEW || "dual";
const HARNESS = process.env.ARC_HARNESS || "state";
const MAX_STEPS = Number(process.env.MAX_STEPS || 80);
const ACTIONS = new Set(["W", "A", "S", "D", "E", "WAIT"]);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestJson(url, { method = "GET", token, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function episodeRequest(episodeId, token, resource, options = {}) {
  return requestJson(`${ARC_URL}/api/v1/episodes/${episodeId}/${resource}`, { token, ...options });
}

async function waitForBrowser(episodeId, token) {
  for (;;) {
    try {
      return await episodeRequest(episodeId, token, "observations/latest");
    } catch (error) {
      if (error.status !== 409) throw error;
      await delay(500);
    }
  }
}

async function waitForCommand(episodeId, token, commandId) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const observation = await episodeRequest(episodeId, token, "observations/latest");
    if (observation.commandId === commandId) return observation;
    await delay(250);
  }
  throw new Error(`Timed out waiting for command ${commandId}`);
}

function modelContent(observation, memory) {
  const copy = structuredClone(observation);
  const screenshot = copy.screenshot;
  delete copy.screenshot;
  const text = JSON.stringify({ observation: copy, memory });
  if (!screenshot) return text;
  return [
    { type: "text", text },
    { type: "image_url", image_url: { url: screenshot } },
  ];
}

function parseModelJson(content) {
  const text = Array.isArray(content) ? content.map((part) => part.text || "").join("") : String(content);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Model did not return JSON: ${text}`);
  const result = JSON.parse(match[0]);
  const action = String(result.action || "").toUpperCase();
  if (!ACTIONS.has(action)) throw new Error(`Invalid action: ${action}`);
  return { action, memory: result.memory };
}

async function chooseAction(observation, memory) {
  const response = await requestJson(MODEL_URL, {
    method: "POST",
    token: MODEL_KEY,
    body: {
      model: MODEL_NAME,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "You control a robot in ARC. Choose exactly one action from W,A,S,D,E,WAIT. Use observation and memory, avoid repeating failed moves, and stop planning after WIN or GAME_OVER. Return strict JSON: {\"action\":\"W\",\"memory\":{\"nextPlan\":\"...\"}}",
        },
        { role: "user", content: modelContent(observation, memory) },
      ],
    },
  });
  return parseModelJson(response.choices[0].message.content);
}

const created = await requestJson(`${ARC_URL}/api/v1/episodes`, {
  method: "POST",
  body: { level: LEVEL, view: VIEW, harness: HARNESS },
});
const episodeId = created.episode.id;
const token = created.agentToken;
console.log("\nOpen this game URL in a browser:\n");
console.log(`${created.gameUrl}\n`);

let observation = await waitForBrowser(episodeId, token);
let finished = false;
for (let step = 0; step < MAX_STEPS; step += 1) {
  if (["WIN", "GAME_OVER"].includes(observation.status)) {
    console.log(`Episode finished: ${observation.status} after ${step} actions`);
    finished = true;
    break;
  }
  const memory = await episodeRequest(episodeId, token, "memory");
  const decision = await chooseAction(observation, memory);
  if (decision.memory && typeof decision.memory === "object") {
    await episodeRequest(episodeId, token, "memory", { method: "PATCH", body: decision.memory });
  }
  const command = await episodeRequest(episodeId, token, "commands", {
    method: "POST",
    body: { kind: "act", action: decision.action, durationMs: 300 },
  });
  console.log(`${String(step + 1).padStart(3, "0")}  ${decision.action}`);
  observation = await waitForCommand(episodeId, token, command.id);
}

if (!finished) console.log(`Stopped after MAX_STEPS=${MAX_STEPS}`);
