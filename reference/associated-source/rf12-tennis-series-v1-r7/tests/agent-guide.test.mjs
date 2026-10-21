import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const guideHtml = readFileSync(new URL("../agent-guide.html", import.meta.url), "utf8");
const guideScript = readFileSync(new URL("../agent-guide.js", import.meta.url), "utf8");
const viteSource = readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");

test("agent guide exposes bilingual OpenCode, Python, and Node.js paths", () => {
  assert.match(guideHtml, /data-language-button="zh"/);
  assert.match(guideHtml, /data-language-button="en"/);
  assert.match(guideHtml, /id="opencode"/);
  assert.match(guideHtml, /id="python"/);
  assert.match(guideHtml, /id="nodejs"/);
  assert.match(guideHtml, /模型 API Key 只保存在/);
  assert.match(guideHtml, /model credential is never sent to ARC/);
});

test("agent guide uses the deployed site origin and provides copy controls", () => {
  assert.match(guideHtml, /data-site-origin/);
  assert.match(guideHtml, /data-copy-target="create-episode"/);
  assert.match(guideScript, /window\.location\.origin/);
  assert.match(guideScript, /navigator\.clipboard\.writeText/);
});

test("agent starter kit contains all advertised adapters", () => {
  for (const path of [
    "../public/agent-kit/python-agent.py",
    "../public/agent-kit/node-agent.mjs",
    "../public/agent-kit/ARC_AGENT_PROMPT.md",
  ]) assert.equal(existsSync(new URL(path, import.meta.url)), true, path);
  assert.match(viteSource, /agentGuide: resolve\("agent-guide\.html"\)/);
  assert.match(viteSource, /public\/agent-kit/);
  assert.match(viteSource, /tools\/arc-agent-client\.mjs/);
  assert.match(viteSource, /tools\/arc-opencode-mcp\.mjs/);
});

test("published examples contain no committed model credential", () => {
  const paths = [
    "../agent-guide.html",
    "../docs/AGENT_INTEGRATION_GUIDE.md",
    "../public/agent-kit/python-agent.py",
    "../public/agent-kit/node-agent.mjs",
  ];
  for (const path of paths) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /sk-[A-Za-z0-9_-]{20,}/, path);
  }
});
