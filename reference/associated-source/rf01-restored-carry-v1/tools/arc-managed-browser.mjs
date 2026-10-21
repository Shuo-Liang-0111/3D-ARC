import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SYSTEM_CHROMIUM_PATHS = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
];

function playwrightChromiumPaths(homeDirectory = homedir()) {
  const cacheRoot = join(homeDirectory, ".cache", "ms-playwright");
  if (!existsSync(cacheRoot)) return [];
  return readdirSync(cacheRoot)
    .filter((entry) => /^chromium-\d+$/.test(entry))
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    .flatMap((entry) => [
      join(cacheRoot, entry, "chrome-linux64", "chrome"),
      join(cacheRoot, entry, "chrome-linux", "chrome"),
    ]);
}

export function resolveChromiumExecutable({ explicitPath, environment = process.env, homeDirectory } = {}) {
  if (explicitPath) return explicitPath;
  const candidates = [
    environment.ARC_CHROMIUM_EXECUTABLE,
    ...playwrightChromiumPaths(homeDirectory),
    ...SYSTEM_CHROMIUM_PATHS,
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
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

export class ManagedEpisodeBrowser {
  constructor({ executablePath, launchImpl } = {}) {
    this.executablePath = executablePath;
    this.launchImpl = launchImpl;
    this.browser = null;
    this.page = null;
  }

  async open(gameUrl, { baseUrl } = {}) {
    await this.close();
    const executablePath = resolveChromiumExecutable({ explicitPath: this.executablePath });
    if (!executablePath) throw new Error("未找到 Chromium；请设置 ARC_CHROMIUM_EXECUTABLE");
    const launch = this.launchImpl || (await import("puppeteer-core")).launch;
    const browser = await launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
        "--use-angle=swiftshader",
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
      const url = managedGameUrl(gameUrl, baseUrl);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForFunction(
        () => Boolean(window.__ARC_AGENT__?.ready?.().ready),
        { timeout: 60_000 },
      );
      this.browser = browser;
      this.page = page;
      return { managed: true, url };
    } catch (error) {
      await browser.close().catch(() => {});
      throw error;
    }
  }

  async close() {
    const browser = this.browser;
    this.browser = null;
    this.page = null;
    if (browser) await browser.close().catch(() => {});
  }
}
