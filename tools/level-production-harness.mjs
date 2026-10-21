#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.log(`Usage:
  node tools/level-production-harness.mjs init --level rfXX
  node tools/level-production-harness.mjs validate --manifest <path>
  node tools/level-production-harness.mjs layout --file <path>
  node tools/level-production-harness.mjs preview --level rfXX [--entry <module>]
  node tools/level-production-harness.mjs gate --file <review.json>`);
}

function argMap(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    values[key] = next && !next.startsWith("--") ? next : true;
    if (values[key] !== true) index += 1;
  }
  return values;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(repoRoot, file), "utf8"));
}

function writeJson(file, value) {
  const target = path.resolve(repoRoot, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function publicPathToFile(url) {
  return path.resolve(repoRoot, "public", String(url).split("?", 1)[0].replace(/^\//, ""));
}

function parseGlb(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.length < 20 || buffer.subarray(0, 4).toString("ascii") !== "glTF") throw new Error(`${file}: invalid GLB magic`);
  if (buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) throw new Error(`${file}: invalid GLB version or declared length`);
  const jsonLength = buffer.readUInt32LE(12);
  if (buffer.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`${file}: first chunk is not JSON`);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8").replace(/\u0000+$/g, "").trim());
}

function inspectAsset(url, label) {
  const file = publicPathToFile(url);
  if (!fs.existsSync(file)) throw new Error(`${label}: missing ${url}`);
  const json = parseGlb(file);
  const images = json.images ?? [];
  const meshes = json.meshes ?? [];
  if (!meshes.length) throw new Error(`${label}: no meshes`);
  if (!images.length && label !== "collision") throw new Error(`${label}: no embedded images`);
  if (images.some((image) => !Number.isInteger(image.bufferView) || image.uri)) throw new Error(`${label}: every image must be embedded in a bufferView`);
  const bounds = (json.accessors ?? []).filter((accessor) => Array.isArray(accessor.min) && Array.isArray(accessor.max)).flatMap((accessor) => [accessor.min, accessor.max]).flat();
  if (bounds.some((value) => !Number.isFinite(value))) throw new Error(`${label}: non-finite accessor bounds`);
  return {
    path: url,
    bytes: fs.statSync(file).size,
    meshes: meshes.length,
    primitives: meshes.reduce((sum, mesh) => sum + (mesh.primitives?.length ?? 0), 0),
    images: images.length,
    draco: Boolean(json.extensionsRequired?.includes("KHR_draco_mesh_compression")),
    webp: Boolean(json.extensionsRequired?.includes("EXT_texture_webp")),
  };
}

function assetRecords(manifest) {
  const records = [];
  if (manifest.environment?.visual) records.push({ id: "environment", path: manifest.environment.visual, role: "environment" });
  if (manifest.environment?.collision) records.push({ id: "collision", path: manifest.environment.collision, role: "collision", collision: true });
  for (const item of manifest.interactables ?? []) records.push({ ...item, role: item.role ?? "interactive" });
  for (const item of manifest.optional ?? []) records.push({ ...item, role: item.role ?? "optional" });
  return records;
}

function validateManifest(file) {
  const manifest = readJson(file);
  const errors = [];
  if (manifest.schema !== "arc-level-assets/v1") errors.push("schema must be arc-level-assets/v1");
  if (!/^rf\d{2}$/.test(manifest.level ?? "")) errors.push("level must be rfXX");
  if (manifest.units !== "meters") errors.push("units must be meters");
  if (manifest.upAxis !== "Y") errors.push("upAxis must be Y");
  if (!manifest.environment?.visual || !manifest.environment?.collision) errors.push("environment.visual and environment.collision are required");
  const records = assetRecords(manifest);
  const seen = new Set();
  let totalBytes = 0;
  for (const record of records) {
    if (!record.path) { errors.push(`${record.id}: missing path`); continue; }
    if (seen.has(record.path)) errors.push(`duplicate asset path ${record.path}`);
    seen.add(record.path);
    try {
      const inspected = inspectAsset(record.path, record.id);
      record.inspected = inspected;
      totalBytes += inspected.bytes;
      if (!record.collision && inspected.draco !== Boolean(manifest.compression?.geometry === "draco")) errors.push(`${record.id}: Draco flag does not match manifest compression`);
      if (record.dimensions && (!Array.isArray(record.dimensions) || record.dimensions.length !== 3 || record.dimensions.some((value) => !Number.isFinite(value) || value <= 0))) errors.push(`${record.id}: dimensions must be three positive finite meters`);
    } catch (error) { errors.push(error.message); }
  }
  const limit = Number(manifest.budgetMiB ?? 60) * 1024 * 1024;
  if (totalBytes > limit) errors.push(`runtime payload ${(totalBytes / 1024 / 1024).toFixed(2)} MiB exceeds ${manifest.budgetMiB ?? 60} MiB`);
  const result = { level: manifest.level, status: errors.length ? "fail" : "pass", checkedAt: new Date().toISOString(), totalBytes, totalMiB: Number((totalBytes / 1024 / 1024).toFixed(3)), assets: records, errors };
  writeJson(manifest.validationReport ?? path.join(path.dirname(file), "validation.json"), result);
  console.log(JSON.stringify(result, null, 2));
  if (errors.length) process.exitCode = 1;
}

function validateLayout(file) {
  const layout = readJson(file);
  const errors = [];
  if (layout.units !== "meters") errors.push("layout.units must be meters");
  if (!layout.bounds || !["minX", "maxX", "minZ", "maxZ"].every((key) => Number.isFinite(layout.bounds[key]))) errors.push("layout.bounds must contain finite minX/maxX/minZ/maxZ");
  if (layout.bounds && !(layout.bounds.minX < layout.bounds.maxX && layout.bounds.minZ < layout.bounds.maxZ)) errors.push("bounds must have positive area");
  const colliders = layout.staticColliders ?? [];
  const ids = new Set();
  for (const collider of colliders) {
    if (!collider.id || ids.has(collider.id)) errors.push(`duplicate or missing collider id ${collider.id ?? "<empty>"}`);
    ids.add(collider.id);
    if (![collider.minX, collider.maxX, collider.minZ, collider.maxZ].every(Number.isFinite)) errors.push(`${collider.id}: invalid collider bounds`);
    if (!(collider.minX < collider.maxX && collider.minZ < collider.maxZ)) errors.push(`${collider.id}: collider must have positive area`);
  }
  for (const target of layout.interactionPoints ?? []) if (!target.id || ![target.x, target.z].every(Number.isFinite)) errors.push(`invalid interaction point ${target.id ?? "<empty>"}`);
  const result = { status: errors.length ? "fail" : "pass", checkedAt: new Date().toISOString(), colliderCount: colliders.length, targetCount: (layout.interactionPoints ?? []).length, errors };
  console.log(JSON.stringify(result, null, 2));
  if (errors.length) process.exitCode = 1;
}

function init(level) {
  if (!/^rf\d{2}$/.test(level)) throw new Error("level must be rfXX");
  const root = `public/local-assets/levels/${level}`;
  for (const directory of ["models/runtime/interactables", "source", "review", "requests"]) fs.mkdirSync(path.resolve(repoRoot, root, directory), { recursive: true });
  const manifestPath = `${root}/models/runtime/manifest.json`;
  if (!fs.existsSync(path.resolve(repoRoot, manifestPath))) writeJson(manifestPath, { schema: "arc-level-assets/v1", level, units: "meters", upAxis: "Y", budgetMiB: 60, environment: { visual: `/local-assets/levels/${level}/models/runtime/${level}_final.glb`, collision: `/local-assets/levels/${level}/models/runtime/${level}_collision.glb` }, interactables: [], optional: [], compression: { geometry: "draco", decoderPath: "/vendor/draco/" }, validation: { embeddedTextures: true, stableNodeNames: true, collisionReviewed: false }, validationReport: `${root}/models/runtime/validation.json` });
  const layoutPath = `docs/levels/${level}-layout.json`;
  if (!fs.existsSync(path.resolve(repoRoot, layoutPath))) writeJson(layoutPath, { level, units: "meters", bounds: { minX: 0, maxX: 1, minZ: 0, maxZ: 1 }, staticColliders: [], interactionPoints: [] });
  console.log(JSON.stringify({ level, assetRoot: root, manifest: manifestPath, layout: layoutPath }, null, 2));
}

function preview(level, entry = `/game/levels/${level}/preview.js`) {
  if (!/^rf\d{2}$/.test(level)) throw new Error("level must be rfXX");
  const target = path.resolve(repoRoot, `public/level-preview/${level}.html`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${level} clean preview</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#101414}canvas{display:block;width:100%;height:100%}#preview-status{position:fixed;left:16px;top:16px;padding:8px 12px;border-radius:5px;background:#17201fe8;color:#e7eee9;font:13px system-ui,sans-serif}#preview-status[data-ready="true"]{opacity:0;pointer-events:none}</style><div id="preview-status" data-ready="false">Loading final assets…</div><script>window.__ARC_PREVIEW__={level:"${level}",requiredAssetsReady:false};</script><script type="module" src="${entry}"></script>`);
  console.log(target);
}

function gate(file) {
  const review = readJson(file);
  const required = ["humanVisualReview", "referenceMatch", "firstViewReview", "thirdViewReview", "dualViewReview", "browserConsole", "tests", "build"];
  const errors = required.filter((key) => review[key] !== "pass").map((key) => `${key} must be pass`);
  if (review.generatorSuccess !== true) errors.push("generatorSuccess must be true");
  if (review.assetsValidated !== true) errors.push("assetsValidated must be true");
  const result = { status: errors.length ? "blocked" : "approved", checkedAt: new Date().toISOString(), errors };
  console.log(JSON.stringify(result, null, 2));
  if (errors.length) process.exitCode = 1;
}

const [command, ...rest] = process.argv.slice(2);
const args = argMap(rest);
try {
  if (!command) { usage(); process.exitCode = 1; }
  else if (command === "init") init(args.level);
  else if (command === "validate") validateManifest(args.manifest);
  else if (command === "layout") validateLayout(args.file);
  else if (command === "preview") preview(args.level, args.entry);
  else if (command === "gate") gate(args.file);
  else { usage(); process.exitCode = 1; }
} catch (error) {
  console.error(`[harness] FAIL: ${error.stack || error.message}`);
  process.exitCode = 1;
}
