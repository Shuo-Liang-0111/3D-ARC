const DEFAULT_API_URL = process.env.ARC_AGENT_API_URL || "http://127.0.0.1:4176";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class ArcAgentClient {
  constructor({ baseUrl = DEFAULT_API_URL, fetchImpl = fetch } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
  }

  async request(path, { token, body, method = body === undefined ? "GET" : "POST" } = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `ARC Agent API 返回 ${response.status}`);
    return payload;
  }

  createEpisode(options = {}) {
    return this.request("/api/v1/episodes", { body: options });
  }

  status(episodeId, agentToken) {
    return this.request(`/api/v1/episodes/${episodeId}/status`, { token: agentToken });
  }

  latestObservation(episodeId, agentToken) {
    return this.request(`/api/v1/episodes/${episodeId}/observations/latest`, { token: agentToken });
  }

  async waitForObservation(episodeId, agentToken, { timeoutMs = Number(process.env.ARC_BROWSER_OBSERVATION_TIMEOUT_MS || 120_000), intervalMs = 250 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        return await this.latestObservation(episodeId, agentToken);
      } catch (error) {
        lastError = error;
      }
      await delay(intervalMs);
    }
    throw new Error(lastError?.message || "等待浏览器观察超时");
  }

  command(episodeId, agentToken, payload) {
    return this.request(`/api/v1/episodes/${episodeId}/commands`, { token: agentToken, body: payload });
  }

  async waitForCommand(episodeId, agentToken, commandId, { timeoutMs = Number(process.env.ARC_COMMAND_TIMEOUT_MS || 180_000), intervalMs = 250 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        const observation = await this.latestObservation(episodeId, agentToken);
        if (observation.commandId === commandId) return observation;
      } catch (error) {
        lastError = error;
      }
      await delay(intervalMs);
    }
    throw new Error(lastError?.message || `等待动作 ${commandId} 超时`);
  }

  async act(episodeId, agentToken, action, options = {}) {
    const command = await this.command(episodeId, agentToken, {
      kind: "act",
      action,
      durationMs: options.durationMs || 300,
    });
    return this.waitForCommand(episodeId, agentToken, command.id, options);
  }

  async reset(episodeId, agentToken, options = {}) {
    const command = await this.command(episodeId, agentToken, { kind: "reset" });
    return this.waitForCommand(episodeId, agentToken, command.id, options);
  }

  async observe(episodeId, agentToken, options = {}) {
    if (!options.fresh) return this.waitForObservation(episodeId, agentToken, options);
    const command = await this.command(episodeId, agentToken, { kind: "observe" });
    return this.waitForCommand(episodeId, agentToken, command.id, options);
  }

  memory(episodeId, agentToken) {
    return this.request(`/api/v1/episodes/${episodeId}/memory`, { token: agentToken });
  }

  updateMemory(episodeId, agentToken, patch) {
    return this.request(`/api/v1/episodes/${episodeId}/memory`, { token: agentToken, method: "PATCH", body: patch });
  }
}
