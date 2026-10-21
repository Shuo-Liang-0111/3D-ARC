import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const workspaceRoot = path.resolve(import.meta.dirname, "..");
const sourceDirectory = path.join(workspaceRoot, "public/local-assets/cardinal/rf02/models/generated");
const outputDirectory = path.join(workspaceRoot, "public/local-assets/cardinal/rf02/models/runtime");
const toolDirectory = path.join(workspaceRoot, "native/tools");
const optimizer = path.join(toolDirectory, "node_modules/.bin/gltf-transform");
const normalizer = path.join(toolDirectory, "normalize_glb.mjs");

const assets = [
  ["rf02_wooden_bookshelf.glb", 3.6, 2.8, 0.62, 0.035, 0.035, 1024],
  ["rf02_reading_table.glb", 4.0, 0.9, 1.9, 0.035, 0.035, 1024],
  ["rf02_red_book.glb", 0.54, 0.18, 0.76, 0.018, 0.06, 512],
  ["rf02_black_book.glb", 0.54, 0.18, 0.76, 0.018, 0.06, 512],
  ["rf02_white_book.glb", 0.54, 0.18, 0.76, 0.018, 0.06, 512],
  ["rf02_reading_chair.glb", 0.72, 1.3, 0.72, 0.035, 0.035, 1024],
  ["rf02_catalog_terminal.glb", 0.75, 1.35, 0.6, 0.03, 0.04, 1024],
  ["rf02_return_cart.glb", 1.3, 1.45, 0.7, 0.03, 0.04, 1024],
  ["rf02_pendant_light.glb", 0.8, 0.8, 0.8, 0.035, 0.04, 1024],
];

await fs.access(optimizer);
await fs.mkdir(outputDirectory, { recursive: true });
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "rf02-assets-"));
try {
  for (const [filename, x, y, z, ratio, simplifyError, textureSize] of assets) {
    const glbInput = path.join(sourceDirectory, filename);
    const fbxInput = path.join(sourceDirectory, filename.replace(/\.glb$/i, ".fbx"));
    let input = glbInput;
    try { await fs.access(input); } catch { input = fbxInput; }
    try { await fs.access(input); } catch { console.log(`[missing] ${glbInput} or ${fbxInput}`); continue; }
    let optimizationInput = input;
    if (path.extname(input).toLowerCase() === ".fbx") {
      optimizationInput = path.join(temporary, `${path.parse(filename).name}_raw.glb`);
      await run("assimp", ["export", input, optimizationInput, "-fglb2"]);
    }
    const optimized = path.join(temporary, filename);
    const output = path.join(outputDirectory, filename);
    await run(optimizer, ["optimize", optimizationInput, optimized, "--compress", "false", "--simplify", "true", "--simplify-ratio", String(ratio), "--simplify-error", String(simplifyError), "--texture-compress", "webp", "--texture-size", String(textureSize)]);
    await run(process.execPath, [normalizer, optimized, output, String(x), String(y), String(z)]);
    const megabytes = (await fs.stat(output)).size / 1024 / 1024;
    console.log(`[ready] ${output} (${megabytes.toFixed(2)} MB)`);
  }
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
