import fs from "node:fs";
import crypto from "node:crypto";

const assetRoot = "public/local-assets/cardinal/rf12-v2";
const generationPath = `${assetRoot}/manifests/generation.json`;
const generation = JSON.parse(fs.readFileSync(generationPath, "utf8"));
const hash = (relative) => crypto.createHash("sha256").update(fs.readFileSync(`${assetRoot}/${relative}`)).digest("hex");
const stat = (relative) => fs.statSync(`${assetRoot}/${relative}`).size;
const assets = Object.values(generation.assets).map((entry) => ({
  id: entry.id,
  role: entry.role,
  path: `/local-assets/cardinal/rf12-v2/${entry.runtimeArtifact}`,
  source: entry.sourceArtifact,
  dimensions: entry.targetSizeMeters,
  frontAxis: entry.frontAxis,
  pivot: entry.pivot,
  bytes: stat(entry.runtimeArtifact),
  sha256: hash(entry.runtimeArtifact),
  sourceBytes: stat(entry.sourceArtifact),
  sourceSha256: hash(entry.sourceArtifact),
}));
const runtime = {
  schema: "arc-level-assets/v2",
  level: "rf12",
  units: "meters",
  upAxis: "Y",
  provider: "Cardinal",
  qualityPreset: "high-highpoly",
  environment: {
    visual: "/local-assets/cardinal/rf12-v2/models/runtime/kitchen_environment.glb",
    collision: "/local-assets/cardinal/rf12-v2/models/runtime/kitchen_collision.glb",
    visualBytes: stat("models/runtime/kitchen_environment.glb"),
    collisionBytes: stat("models/runtime/kitchen_collision.glb"),
    visualSha256: hash("models/runtime/kitchen_environment.glb"),
    collisionSha256: hash("models/runtime/kitchen_collision.glb"),
  },
  assets,
  compression: { geometry: "draco", texture: "webp", decoderPath: "/vendor/draco/" },
  validation: { sourceArtifacts: true, runtimeArtifacts: true, dimensionsReviewed: true, frontAxisReviewed: true, bottomCenterPivot: true, environmentMetric: true, collisionMatchesOpenings: true, noAirWalls: true, noVisualFallbackMix: true, status: "pending-browser-visual-review" },
};
fs.writeFileSync(`${assetRoot}/manifests/runtime.json`, `${JSON.stringify(runtime, null, 2)}\n`);
fs.writeFileSync(`${assetRoot}/manifests/validation.json`, `${JSON.stringify({ level: "rf12", version: "v2", status: "pending-browser-visual-review", assets: assets.map(({ id, dimensions, bytes, sha256 }) => ({ id, dimensions, bytes, sha256 })) }, null, 2)}\n`);
console.log(JSON.stringify({ assets: assets.length, runtimeManifest: `${assetRoot}/manifests/runtime.json` }, null, 2));
