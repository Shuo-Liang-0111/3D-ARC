import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const root = "public/local-assets/cardinal/rf12-v2";
const path = `${root}/manifests/runtime.json`;
const manifest = JSON.parse(await readFile(path, "utf8"));
const metadata = async (name) => {
  const bytes = await readFile(`${root}/models/runtime/${name}.glb`);
  return { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
};
const visual = await metadata("kitchen_environment");
const collision = await metadata("kitchen_collision");
Object.assign(manifest.environment, { visualBytes: visual.bytes, visualSha256: visual.sha256, collisionBytes: collision.bytes, collisionSha256: collision.sha256 });
const window = manifest.assets.find((entry) => entry.id === "kitchen_window");
if (!window) throw new Error("Missing kitchen_window manifest entry");
Object.assign(window, await metadata("kitchen_window_fitted"), {
  path: "/local-assets/cardinal/rf12-v2/models/runtime/kitchen_window_fitted.glb",
  provider: "deterministic-metric-modeling",
  source: "tools/rf12-v2-build-environment.mjs",
  dimensions: [1.35, 1.25, 0.14],
  placement: [-0.75, 1.15, -3.32],
  review: "geometry-tests-passed-visual-review-pending",
});
delete window.sourceBytes;
delete window.sourceSha256;
manifest.layoutRevision = "2026-09-07-door-window-dedup";
manifest.visualReview = "pending-browser-permission-timeout";
await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
console.log("RF-12 layout asset hashes and window provenance updated");
