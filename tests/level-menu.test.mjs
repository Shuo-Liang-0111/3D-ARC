import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { getLevelMenu, installLevelNavigation, synchronizeLevelMenu } from "../server/level-menu.mjs";
import { createLevelMenuPlugin } from "../server/level-menu-plugin.mjs";

const canonical = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const anchors = [...getLevelMenu(canonical).matchAll(/<a\b[\s\S]*?<\/a>/g)].map(([html]) => html);
const ids = (html) => [...html.matchAll(/data-level-option="([^"]+)"/g)].map((match) => match[1]);
const documentWith = (links) => '<html><body><nav class="level-select" aria-label="选择关卡">' + links.join("") + '</nav><script type="module" src="/release/assets/game.js"></script></body></html>';

test("the canonical menu lists each supported runtime exactly once", () => {
  const options = ids(getLevelMenu(canonical));
  const app = readFileSync(new URL("../game/app.js", import.meta.url), "utf8");
  const loaders = app.match(/const runtimeLoaders = \{([\s\S]*?)\n\};/)[1];
  const supported = [...loaders.matchAll(/^\s*(?:"([^"]+)"|([a-z0-9_]+)):\s*\(\)\s*=>/gm)]
    .map((match) => match[1] || match[2]);
  assert.equal(options.length, new Set(options).size);
  assert.deepEqual(options, supported);
});

for (const size of [24, 32, 36]) {
  test("an archived " + size + "-entry page receives the full canonical menu without changing gameplay", () => {
    const source = documentWith(anchors.slice(0, size));
    const result = synchronizeLevelMenu(source, canonical);
    assert.equal(getLevelMenu(result), getLevelMenu(canonical));
    assert.equal(result.match(/<script data-arc-level-menu>/g).length, 1);
    assert.ok(result.includes('<script type="module" src="/release/assets/game.js"></script>'));
    assert.equal(synchronizeLevelMenu(result, canonical), result);
    // Ensure the injected function remains executable without module imports.
    runInNewContext(result.match(/<script data-arc-level-menu>([\s\S]*?)<\/script>/)[1], {
      document: { querySelector: () => null }, window: {},
    });
  });
}

test("pages without a level menu are unchanged", () => {
  const guide = "<html><body><nav>Help</nav></body></html>";
  assert.equal(synchronizeLevelMenu(guide, canonical), guide);
  assert.throws(() => synchronizeLevelMenu(canonical, guide), /canonical entry/);
});

function browserFixture(href) {
  const listeners = {};
  const shell = { dataset: { level: "rf01", viewMode: "third", controlMode: "velocity" } };
  const selections = { "data-robot-option": "g1" };
  const links = ["rf01", "rf13-03"].map((level) => ({
    dataset: { levelOption: level }, href: "http://example.test/old/index.html?level=" + level,
    attributes: { "aria-current": "page" },
    classList: { toggle(name, value) { this[name] = value; } },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
  }));
  const menu = { querySelectorAll: () => links, contains: (link) => links.includes(link), addEventListener() {} };
  const document = {
    querySelector(selector) {
      if (selector === ".level-select") return menu;
      if (selector === "#game-shell") return shell;
      const attribute = selector.match(/^\[([^\]]+)\]/)?.[1];
      return selections[attribute] ? { getAttribute: () => selections[attribute] } : null;
    },
    addEventListener(type, callback, capture) {
      assert.equal(capture, true);
      listeners[type] = callback;
    },
  };
  let refresh;
  const assigned = [];
  const window = {
    location: { href, assign: (url) => assigned.push(url) },
    MutationObserver: class { constructor(callback) { refresh = callback; } observe() {} },
  };
  installLevelNavigation(document, window);
  const event = (overrides = {}) => ({
    type: "click", button: 0, target: { closest: () => links[1] },
    stopImmediatePropagation() { this.stopped = true; },
    preventDefault() { this.prevented = true; },
    ...overrides,
  });
  return { links, shell, selections, assigned, listeners, refresh: () => refresh(), event };
}

test("archived entry clicks route to the root with current preferences, excluding stale task parameters", () => {
  const fixture = browserFixture("http://example.test/old/index.htm?mode=play&level=rf01&view=first&qa=1#debug");
  const event = fixture.event();
  fixture.listeners.click(event);
  assert.equal(fixture.assigned[0], "http://example.test/?mode=play&level=rf13-03&view=third&robot=g1&control=velocity");
  assert.equal(event.stopped, true);
  assert.equal(event.prevented, true);
  assert.equal(fixture.links[0].attributes["aria-current"], "page");
  assert.equal(fixture.links[1].attributes["aria-current"], undefined);
});

test("links recover after archived code rewrites them and retain changed view/control settings", () => {
  const fixture = browserFixture("http://example.test/old/index.html?mode=agent");
  fixture.links[1].href = "http://example.test/old/index.html?level=rf13-03";
  fixture.shell.dataset.viewMode = "dual";
  fixture.shell.dataset.controlMode = "joint";
  fixture.refresh();
  assert.equal(fixture.links[1].href, "http://example.test/?mode=agent&level=rf13-03&view=dual&robot=g1&control=joint");
});

test("modified and middle clicks retain native new-tab behavior while skipping old handlers", () => {
  const fixture = browserFixture("http://example.test/old/index.html?mode=play");
  for (const options of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { type: "auxclick", button: 1 }]) {
    const event = fixture.event(options);
    fixture.listeners[event.type](event);
    assert.equal(event.stopped, true);
    assert.equal(event.prevented, undefined);
  }
  assert.deepEqual(fixture.assigned, []);
});

test("agent session links preserve agent mode but never propagate session credentials", () => {
  const fixture = browserFixture("http://example.test/?episode=test&browser_token=fixture");
  const url = new URL(fixture.links[1].href);
  assert.equal(url.searchParams.get("mode"), "agent");
  assert.equal(url.searchParams.has("episode"), false);
  assert.equal(url.searchParams.has("browser_token"), false);
});

test("Vite covers direct .htm releases and source/build transforms, reading current menu on every request", (t) => {
  const root = mkdtempSync(join(tmpdir(), "arc-level-menu-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "public", "release"), { recursive: true });
  writeFileSync(join(root, "index.html"), canonical);
  writeFileSync(join(root, "public", "release", "index.htm"), documentWith(anchors.slice(0, 24)));
  const plugin = createLevelMenuPlugin();
  plugin.configResolved({ root });
  let middleware;
  plugin.configureServer({ middlewares: { use: (handler) => { middleware = handler; } } });
  for (const url of ["/release/index.htm?mode=play&level=rf01", "/release/"]) {
    const headers = {};
    let body;
    middleware({ method: "GET", url }, { setHeader: (key, value) => { headers[key] = value; }, end: (value) => { body = value; } }, () => assert.fail("release was skipped"));
    assert.equal(getLevelMenu(body), getLevelMenu(canonical));
    assert.equal(headers["cache-control"], "no-store");
  }
  for (const url of ["/", "/index.html", "/release/assets/game.js", "/missing.html"]) {
    let skipped = false;
    middleware({ method: "GET", url }, {}, () => { skipped = true; });
    assert.ok(skipped);
  }
  const updated = canonical.replace("</nav>", '<a data-level-option="future" href="/?level=future">Future</a></nav>');
  writeFileSync(join(root, "index.html"), updated);
  assert.equal(getLevelMenu(plugin.api.synchronize(documentWith(anchors))), getLevelMenu(updated));
  assert.equal(getLevelMenu(plugin.transformIndexHtml.handler(canonical)), getLevelMenu(updated));
});
