import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const assetRoot = path.join(root, "public/local-assets/cardinal/rf05");
const sourceRoot = path.join(assetRoot, "models/source");
const runtimeRoot = path.join(assetRoot, "models/runtime");
const nodeBinary = path.join(root, ".tooling/node-v22.14.0-linux-x64/bin/node");
const toolRoot = path.join(root, ".tooling/gltf-transform/node_modules");
const optimizer = path.join(toolRoot, ".bin/gltf-transform");
const normalizer = path.join(root, "tools/rf03-normalize-cardinal-glb.mjs");
const manifestTool = path.join(root, "tools/rf05-cardinal-assets.py");

const assets = new Map([
  ["twin_bed", { size: [1.86, 0.68, 2.65], textureSize: 2048, ratio: 0.16, rotateY: -90 }],
  ["bedside_table", { size: [0.55, 0.55, 0.45], textureSize: 1024, ratio: 0.18 }],
  ["writing_desk", { size: [1.60, 0.76, 0.62], textureSize: 1024, ratio: 0.16 }],
  ["desk_chair", { size: [0.58, 0.90, 0.58], textureSize: 1024, ratio: 0.20 }],
  ["television_console", { size: [1.70, 1.25, 0.45], textureSize: 1024, ratio: 0.16, rotateY: -90 }],
  ["wardrobe", { size: [1.55, 2.55, 0.72], textureSize: 1024, ratio: 0.14 }],
  ["luggage_bench", { size: [1.50, 0.52, 0.62], textureSize: 1024, ratio: 0.18 }],
  ["curtain_window_module", { size: [2.60, 2.50, 0.25], textureSize: 2048, ratio: 0.20 }],
  ["bathroom_vanity", { size: [1.20, 0.85, 0.55], textureSize: 1024, ratio: 0.18 }],
  ["toilet", { size: [0.42, 0.78, 0.70], textureSize: 1024, ratio: 0.22 }],
  ["shower_fixture", { size: [0.32, 2.10, 0.22], textureSize: 1024, ratio: 0.30 }],
  ["ceiling_light", { size: [0.80, 0.10, 0.80], textureSize: 1024, ratio: 0.16 }],
  ["towel", { size: [0.68, 0.14, 0.45], textureSize: 1024, ratio: 0.30 }],
  ["drinking_cup", { size: [0.11, 0.12, 0.11], textureSize: 512, ratio: 0.35 }],
  ["paper_trash", { size: [0.16, 0.18, 0.16], textureSize: 512, ratio: 0.35 }],
  ["laundry_basket", { size: [0.72, 0.62, 0.72], textureSize: 1024, ratio: 0.30 }],
  ["cleaning_cart", { size: [0.95, 1.05, 0.55], textureSize: 1024, ratio: 0.22 }],
  ["trash_bin", { size: [0.54, 0.62, 0.54], textureSize: 1024, ratio: 0.28 }],
]);

const requested = process.argv.slice(2);
const selected = requested.length ? requested : [...assets.keys()];
for (const assetId of selected) {
  if (!assets.has(assetId)) throw new Error(`Unknown RF-05 asset: ${assetId}`);
}

await Promise.all([fs.access(nodeBinary), fs.access(optimizer), fs.access(normalizer)]);
await fs.mkdir(runtimeRoot, { recursive: true });
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "rf05-cardinal-"));

try {
  for (const assetId of selected) {
    const options = assets.get(assetId);
    const source = path.join(sourceRoot, `${assetId}.highpoly.glb`);
    const normalized = path.join(temporaryRoot, `${assetId}.normalized.glb`);
    const output = path.join(runtimeRoot, `${assetId}.glb`);
    await fs.access(source);
    const normalizeArgs = [
      normalizer,
      "--input", source,
      "--output", normalized,
      "--tool-root", toolRoot,
      "--target", ...options.size.map(String),
    ];
    if (options.rotateY) normalizeArgs.push("--rotate-y", String(options.rotateY));
    await run(nodeBinary, normalizeArgs, { maxBuffer: 16 * 1024 * 1024 });
    await run(optimizer, [
      "optimize",
      normalized,
      output,
      "--compress", "draco",
      "--simplify", "true",
      "--simplify-ratio", String(options.ratio),
      "--simplify-error", "0.002",
      "--simplify-lock-border", "true",
      "--texture-compress", "webp",
      "--texture-size", String(options.textureSize),
      "--palette", "false",
    ], {
      env: {
        ...process.env,
        PATH: `${path.dirname(nodeBinary)}:${process.env.PATH ?? ""}`,
      },
      maxBuffer: 64 * 1024 * 1024,
    });
    await run("python3", [manifestTool, "record-artifact", assetId, "runtime"]);
    const sourceMiB = (await fs.stat(source)).size / 1024 / 1024;
    const runtimeMiB = (await fs.stat(output)).size / 1024 / 1024;
    console.log(`[ready] ${assetId}: ${sourceMiB.toFixed(2)} MiB -> ${runtimeMiB.toFixed(2)} MiB`);
  }
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
