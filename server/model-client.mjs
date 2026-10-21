const ACTIONS = Object.freeze(["W", "A", "S", "D", "E", "WAIT"]);
const ACTION_IDS = Object.freeze({ W: "ACTION1", A: "ACTION2", S: "ACTION3", D: "ACTION4", E: "ACTION5", WAIT: "WAIT" });
const ACTION_BY_ID = Object.freeze(Object.fromEntries(Object.entries(ACTION_IDS).map(([action, id]) => [id, action])));

function normalizeAction(value) {
  const candidate = String(value || "").toUpperCase();
  return ACTIONS.includes(candidate) ? candidate : ACTION_BY_ID[candidate] || null;
}

export function extractAction(content) {
  const text = typeof content === "string" ? content : JSON.stringify(content ?? "");
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidate = fenced[1].trim();
  try {
    const parsed = JSON.parse(candidate);
    const action = normalizeAction(parsed?.action);
    if (action) return action;
  } catch {}
  const match = candidate.toUpperCase().match(/\b(ACTION[1-5]|WAIT|W|A|S|D|E)\b/);
  if (match) return normalizeAction(match[1]);
  throw new Error("模型没有返回合法动作");
}

export function modelConfig(env = process.env) {
  return {
    baseUrl: (env.MODEL_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    apiKey: env.MODEL_API_KEY || "",
    model: env.MODEL_NAME || "",
  };
}

function isDataImage(value) {
  return typeof value === "string" && value.startsWith("data:image/");
}

export function modelObservations(payload = {}) {
  if (isDataImage(payload.image)) {
    return [{
      image: payload.image,
      gameId: payload.level || "unknown",
      state: payload.hud?.state || "NOT_FINISHED",
      actionInput: payload.history?.at(-1)?.action || null,
      hud: payload.hud || {},
    }];
  }

  const observations = Array.isArray(payload.observations) ? payload.observations.slice(-4) : [];
  return observations.flatMap((observation) => {
    const image = observation?.frame?.find((frame) => isDataImage(frame?.data_url))?.data_url;
    if (!image) return [];
    return [{
      image,
      gameId: observation.game_id || "unknown",
      state: observation.state || "NOT_FINISHED",
      actionInput: observation.action_input?.id || null,
      availableActions: observation.available_actions || [],
      levelsCompleted: observation.levels_completed ?? 0,
      winLevels: observation.win_levels ?? 1,
    }];
  });
}

export function hasModelObservation(payload) {
  return modelObservations(payload).length > 0;
}

function buildUserContent(payload) {
  const observations = modelObservations(payload);
  if (!observations.length) throw new Error("缺少游戏截图");
  const history = (payload.history || []).slice(-24)
    .map((item, index) => `${index + 1}. ${item.action} -> ${item.event || "running"}`)
    .join("\n") || "无";
  const latest = observations.at(-1);
  const content = [{
    type: "text",
    text: `关卡：${payload.level || latest.gameId}\n任务：${payload.task || "根据画面完成当前关卡目标"}\n当前状态：${latest.state}\n当前HUD：${JSON.stringify(latest.hud || {})}\n旧版动作历史：\n${history}\n以下观察按时间顺序排列。`,
  }];
  observations.forEach((observation, index) => {
    content.push({
      type: "text",
      text: `观察 ${index + 1}/${observations.length}：状态 ${observation.state}；上一动作 ${observation.actionInput || "无"}；进度 ${observation.levelsCompleted ?? 0}/${observation.winLevels ?? 1}。`,
    });
    content.push({ type: "image_url", image_url: { url: observation.image } });
  });
  content.push({ type: "text", text: "请选择下一步动作。" });
  return content;
}

export async function requestModelAction(payload, env = process.env, fetchImpl = fetch) {
  const config = modelConfig(env);
  if (!config.apiKey || !config.model) throw new Error("模型尚未配置，请设置 MODEL_API_KEY 和 MODEL_NAME");
  const configuredTimeoutMs = Number(env.MODEL_TIMEOUT_MS || 45_000);
  const timeoutMs = Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0 ? configuredTimeoutMs : 45_000;
  const signal = AbortSignal.timeout(timeoutMs);
  let response;
  try {
    response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      signal,
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: "你是一个控制3D机器人的游戏智能体。只根据画面、可见HUD和动作历史行动。每轮只能输出一个JSON对象，格式为 {\"action\":\"W\"}。合法动作只有 W,A,S,D,E,WAIT。W/S沿机器人当前朝向前进/后退，A/D原地向左/向右转，每次最多执行300ms；E互动；WAIT等待300ms。记录动作ID映射为 W=ACTION1,A=ACTION2,S=ACTION3,D=ACTION4,E=ACTION5,WAIT=WAIT。不要输出解释或Markdown。",
          },
          {
            role: "user",
            content: buildUserContent(payload),
          },
        ],
      }),
    });
  } catch (error) {
    if (signal.aborted || error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw new Error(`模型请求超过 ${Math.round(timeoutMs / 1000)} 秒，请重试`);
    }
    throw error;
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`模型接口返回 ${response.status}: ${detail}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const action = extractAction(content);
  return { action, actionId: ACTION_IDS[action], model: config.model, usage: data.usage ?? null, raw: content };
}

export { ACTIONS, ACTION_IDS };
