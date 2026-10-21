import test from "node:test";
import assert from "node:assert/strict";
import { extractAction, hasModelObservation, modelConfig, modelObservations, requestModelAction } from "../server/model-client.mjs";

test("extractAction accepts strict JSON and fenced model output", () => {
  assert.equal(extractAction('{"action":"W"}'), "W");
  assert.equal(extractAction('```json\n{"action":"WAIT"}\n```'), "WAIT");
  assert.equal(extractAction('{"action":"ACTION5"}'), "E");
});

test("extractAction rejects actions outside the environment", () => {
  assert.throws(() => extractAction('{"action":"R"}'), /合法动作/);
});

test("modelConfig normalizes an OpenAI-compatible base URL", () => {
  assert.deepEqual(modelConfig({ MODEL_BASE_URL: "https://example.test/v1/", MODEL_API_KEY: "key", MODEL_NAME: "vision" }), {
    baseUrl: "https://example.test/v1", apiKey: "key", model: "vision",
  });
});

test("requestModelAction sends an image observation and returns one action", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"action":"E"}' } }], usage: { total_tokens: 12 } }) };
  };
  const result = await requestModelAction({ level: "rf03", task: "sort", image: "data:image/jpeg;base64,abc", hud: {}, history: [] }, {
    MODEL_BASE_URL: "https://models.example/v1", MODEL_API_KEY: "secret", MODEL_NAME: "vision",
  }, fetchImpl);
  assert.equal(request.url, "https://models.example/v1/chat/completions");
  assert.equal(request.options.headers.authorization, "Bearer secret");
  const body = JSON.parse(request.options.body);
  assert.match(body.messages[0].content, /W\/S沿机器人当前朝向前进\/后退/);
  assert.match(body.messages[0].content, /A\/D原地向左\/向右转/);
  assert.doesNotMatch(body.messages[0].content, /屏幕上左下右/);
  assert.equal(body.messages[1].content[2].type, "image_url");
  assert.equal(result.action, "E");
  assert.equal(result.actionId, "ACTION5");
});

test("modelObservations accepts the frontend observation contract", () => {
  const payload = {
    observations: [{
      game_id: "rf04-v1",
      frame: [{ mime_type: "image/jpeg", data_url: "data:image/jpeg;base64,abc" }],
      state: "NOT_FINISHED",
      levels_completed: 0,
      win_levels: 1,
      action_input: { id: "ACTION1", data: { duration_ms: 300 } },
      available_actions: ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION5", "WAIT"],
    }],
  };
  assert.equal(hasModelObservation(payload), true);
  assert.deepEqual(modelObservations(payload), [{
    image: "data:image/jpeg;base64,abc",
    gameId: "rf04-v1",
    state: "NOT_FINISHED",
    actionInput: "ACTION1",
    availableActions: ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION5", "WAIT"],
    levelsCompleted: 0,
    winLevels: 1,
  }]);
});

test("requestModelAction sends frontend observations in chronological order", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ choices: [{ message: { content: "ACTION1" } }] }) };
  };
  const observations = ["old", "new"].map((name) => ({
    game_id: "rf01-v1",
    frame: [{ data_url: `data:image/jpeg;base64,${name}` }],
    state: "NOT_FINISHED",
    available_actions: ["ACTION1", "WAIT"],
  }));
  const result = await requestModelAction({ observations }, { MODEL_API_KEY: "secret", MODEL_NAME: "vision" }, fetchImpl);
  const content = JSON.parse(request.options.body).messages[1].content;
  assert.deepEqual(content.filter((item) => item.type === "image_url").map((item) => item.image_url.url), [
    "data:image/jpeg;base64,old",
    "data:image/jpeg;base64,new",
  ]);
  assert.deepEqual(result, { action: "W", actionId: "ACTION1", model: "vision", usage: null, raw: "ACTION1" });
});

test("requestModelAction reports upstream timeouts", async () => {
  const fetchImpl = async () => {
    const error = new Error("timed out");
    error.name = "TimeoutError";
    throw error;
  };
  await assert.rejects(
    requestModelAction({ image: "data:image/jpeg;base64,abc" }, {
      MODEL_API_KEY: "secret",
      MODEL_NAME: "vision",
      MODEL_TIMEOUT_MS: "12500",
    }, fetchImpl),
    /模型请求超过 13 秒，请重试/,
  );
});
