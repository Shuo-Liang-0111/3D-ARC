import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

const SYSTEM_CHROMIUM_PATHS = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

function playwrightChromiumPaths(homeDirectory, existsImpl) {
  const cacheRoots = [
    join(homeDirectory, ".cache", "ms-playwright"),
    join(homeDirectory, "Library", "Caches", "ms-playwright"),
  ];
  return cacheRoots.filter((cacheRoot) => existsImpl(cacheRoot)).flatMap((cacheRoot) =>
    readdirSync(cacheRoot)
      .filter((entry) => /^chromium-\d+$/.test(entry))
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
      .flatMap((entry) => [
        join(cacheRoot, entry, "chrome-linux64", "chrome"),
        join(cacheRoot, entry, "chrome-linux", "chrome"),
        ...["chrome-mac", "chrome-mac-arm64", "chrome-mac-x64"].flatMap((directory) => [
          join(cacheRoot, entry, directory, "Chromium.app", "Contents", "MacOS", "Chromium"),
          join(cacheRoot, entry, directory, "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"),
        ]),
      ]),
  );
}

export function resolveChromiumExecutable({
  explicitPath,
  environment = process.env,
  homeDirectory = homedir(),
  existsImpl = existsSync,
} = {}) {
  if (explicitPath) return explicitPath;
  const candidates = [
    environment.ARC_CHROMIUM_EXECUTABLE,
    ...playwrightChromiumPaths(homeDirectory, existsImpl),
    ...SYSTEM_CHROMIUM_PATHS,
    join(homeDirectory, "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
    join(homeDirectory, "Applications", "Chromium.app", "Contents", "MacOS", "Chromium"),
  ].filter(Boolean);
  return candidates.find((candidate) => existsImpl(candidate)) || null;
}

export function managedGameUrl(gameUrl, baseUrl = process.env.ARC_MANAGED_GAME_URL || process.env.ARC_AGENT_API_URL) {
  const result = new URL(gameUrl);
  if (!baseUrl) return result.toString();
  const localBase = new URL(baseUrl);
  result.protocol = localBase.protocol;
  result.hostname = localBase.hostname;
  result.port = localBase.port;
  return result.toString();
}

function viewportDimension(value, fallback, minimum) {
  const dimension = Number(value);
  return Number.isFinite(dimension) && dimension > 0
    ? Math.max(minimum, Math.round(dimension))
    : fallback;
}

export class ManagedEpisodeBrowser {
  constructor({
    executablePath,
    launchImpl,
    environment = process.env,
    platform = process.platform,
    spawnImpl = spawn,
  } = {}) {
    this.executablePath = executablePath;
    this.launchImpl = launchImpl;
    this.environment = environment;
    this.platform = platform;
    this.spawnImpl = spawnImpl;
    this.browser = null;
    this.page = null;
    this.sleepInhibitor = null;
  }

  preventIdleSleep() {
    if (this.platform !== "darwin") return;
    try {
      // Scope the idle-sleep assertion to this runner; -w also releases it if Node exits.
      // macOS lid-closure sleep is outside this assertion's control.
      this.sleepInhibitor = this.spawnImpl("/usr/bin/caffeinate", ["-i", "-w", String(process.pid)], { stdio: "ignore" });
      this.sleepInhibitor.on("error", () => {});
      this.sleepInhibitor.unref?.();
    } catch {
      // A missing or unavailable power utility must not block browser startup.
      this.releaseIdleSleep();
    }
  }

  releaseIdleSleep() {
    const inhibitor = this.sleepInhibitor;
    this.sleepInhibitor = null;
    try {
      inhibitor?.kill();
    } catch {}
  }

  async open(gameUrl, { baseUrl } = {}) {
    await this.close();
    const environment = this.environment;
    const executablePath = resolveChromiumExecutable({ explicitPath: this.executablePath, environment });
    if (!executablePath) throw new Error("未找到 Chromium；请设置 ARC_CHROMIUM_EXECUTABLE");
    const puppeteer = this.launchImpl
      ? null
      : await import(environment.ARC_PUPPETEER_ENTRY ? pathToFileURL(environment.ARC_PUPPETEER_ENTRY).href : "puppeteer-core");
    const launch = this.launchImpl || puppeteer.launch;
    this.preventIdleSleep();
    try {
      const browser = await launch({
        executablePath,
        headless: environment.ARC_HEADLESS !== "0",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=CalculateNativeWinOcclusion",
          ...(environment.ARC_SOFTWARE_RENDERING === "1" ? [
            "--enable-unsafe-swiftshader",
            "--ignore-gpu-blocklist",
            "--use-angle=swiftshader",
          ] : []),
        ],
      });
      this.browser = browser;
      browser.once?.("disconnected", () => {
        if (this.browser === browser) this.releaseIdleSleep();
      });
      const page = await browser.newPage();
      const width = viewportDimension(environment.ARC_BROWSER_WIDTH, 1440, 640);
      const height = viewportDimension(environment.ARC_BROWSER_HEIGHT, 900, 480);
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.bringToFront?.();
      await page.exposeFunction("__ARC_CAPTURE_VIEWPORT__", async () => {
        const screenshot = await page.screenshot({
          type: "png",
          encoding: "base64",
          fullPage: false,
          captureBeyondViewport: false,
        });
        return `data:image/png;base64,${screenshot}`;
      });
      const url = managedGameUrl(gameUrl, baseUrl ?? environment.ARC_MANAGED_GAME_URL ?? environment.ARC_AGENT_API_URL);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForFunction(
        () => Boolean(window.__ARC_AGENT__?.ready?.().ready),
        { timeout: 60_000 },
      );
      this.page = page;
      return { managed: true, url };
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async close() {
    const browser = this.browser;
    this.browser = null;
    this.page = null;
    this.releaseIdleSleep();
    if (browser) await browser.close().catch(() => {});
  }
}

export async function runManagedBrowserCli({
  input = process.stdin,
  output = process.stdout,
  signals = process,
  createBrowser = () => new ManagedEpisodeBrowser(),
} = {}) {
  const lines = createInterface({ input, terminal: false, crlfDelay: Infinity });
  let browser;
  let browserEvents;
  let closing;
  let stopped = false;
  let outputFailed = false;
  let exitCode = 0;
  let receiveUrl;
  let receiveStop;
  const firstLine = new Promise((resolve) => { receiveUrl = resolve; });
  const parentStopped = new Promise((resolve) => { receiveStop = resolve; });
  const stop = (code = 0) => {
    if (stopped) return;
    stopped = true;
    exitCode = code;
    receiveUrl(null);
    receiveStop();
    // Also interrupt navigation/readiness waits when the parent goes away.
    if (browser) closing = Promise.resolve().then(() => browser.close()).catch(() => {});
  };
  const onParentClosed = () => stop();
  const onInputError = () => stop(1);
  const onOutputError = () => { outputFailed = true; stop(1); };
  const onSignal = () => stop();
  const onBrowserClosed = () => stop(1);
  const writeRecord = (record) => new Promise((resolve, reject) => {
    output.write(JSON.stringify(record) + '\n', (error) => error ? reject(error) : resolve());
  });
  lines.once("line", receiveUrl);
  lines.once("close", onParentClosed);
  lines.on("error", onInputError);
  output.on("error", onOutputError);
  signals.on("SIGINT", onSignal);
  signals.on("SIGTERM", onSignal);
  try {
    const gameUrl = await firstLine;
    if (stopped) return exitCode;
    const parsedUrl = new URL(gameUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Unsupported game URL");
    browser = createBrowser();
    await browser.open(gameUrl);
    browserEvents = browser.browser;
    browserEvents?.once?.("disconnected", onBrowserClosed);
    if (!stopped) {
      await writeRecord({ ready: true });
      await parentStopped;
    }
    return exitCode;
  } catch {
    if (!stopped) {
      exitCode = 1;
      // Browser errors can contain the navigation URL and its browser token.
      if (!outputFailed) await writeRecord({ ready: false, error: "managed_browser_startup_failed" }).catch(() => {});
    }
    return exitCode;
  } finally {
    lines.off("close", onParentClosed);
    lines.off("line", receiveUrl);
    lines.off("error", onInputError);
    lines.close();
    input.pause();
    signals.off("SIGINT", onSignal);
    signals.off("SIGTERM", onSignal);
    browserEvents?.off?.("disconnected", onBrowserClosed);
    await closing;
    // A browser launch that completed after EOF or a signal still needs closing.
    if (browser) await browser.close().catch(() => {});
    output.off("error", onOutputError);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3 || process.argv[2] !== "--game-url-stdin") {
    process.stderr.write("Usage: node arc-managed-browser.mjs --game-url-stdin\n");
    process.exitCode = 2;
  } else {
    process.exitCode = await runManagedBrowserCli();
  }
}
