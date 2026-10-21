import fs from "node:fs";
import { createHash } from "node:crypto";
import { ASSETS } from "../../game/levels/rf02/scene.js";
import { ASSET_ROOT, BOOKS, REVISION, seriesLevel } from "../../game/levels/rf02/series-layout.js";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const releaseRoot = process.argv[2] ?? "dist";
const publicBase = (process.argv[3] ?? "http://127.0.0.1:4173").replace(/\/$/, "");
const previous = JSON.parse(fs.readFileSync("public/local-assets/cardinal/rf02/manifests/vertical-slice.json", "utf8"));
const records = [];
for (const [id, url] of Object.entries({
  ...ASSETS,
  collision: ASSET_ROOT + "/library-collision.glb",
  fixtures: ASSET_ROOT + "/ceiling-fixtures.glb",
  closingFixtures: ASSET_ROOT + "/closing-fixtures.glb",
  impact: ASSET_ROOT + "/book-impact.flac",
})) {
  const publicPath = url.split("?")[0];
  const sourcePath = "public" + publicPath;
  const buildPath = releaseRoot + publicPath;
  const bytes = fs.readFileSync(sourcePath);
  const buildBytes = fs.readFileSync(buildPath);
  const served = await fetch(publicBase + publicPath);
  if (!served.ok) throw new Error("Unserved asset " + id);
  const digest = hash(bytes);
  const servedHash = hash(Buffer.from(await served.arrayBuffer()));
  if ([hash(buildBytes), servedHash].some((value) => value !== digest)) throw new Error("Byte mismatch: " + id);
  const origin = previous.assets.find((entry) => entry.path === publicPath);
  let glb = null;
  if (publicPath.endsWith(".glb")) {
    if (bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error("Invalid GLB " + id);
    const json = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
    if ((json.images ?? []).some((image) => image.uri || !Number.isInteger(image.bufferView))) throw new Error("External texture " + id);
    glb = { meshes: json.meshes?.length ?? 0, materials: json.materials?.length ?? 0, embeddedImages: json.images?.length ?? 0, nodes: json.nodes?.length ?? 0 };
  }
  records.push({
    id, role: id === "collision" ? "collision" : id === "impact" ? "sound-effect" : ["red", "black", "white"].includes(id) ? "interactive" : "static",
    provider: origin?.sourceType ?? (id === "impact" ? "Cardinal" : ["collision", "fixtures", "closingFixtures"].includes(id) ? "Three.js GLTFExporter, precise shared layout" : "retained validated RF-02 asset"),
    taskId: origin?.taskId ?? (id === "impact" ? "aigc_de47994684c44a6d92e4bf0f0af17d06" : null),
    sourcePath, runtimePath: sourcePath, buildPath, deployedUrl: publicBase + publicPath,
    bytes: bytes.length, sha256: digest, sourceBuildServedMatch: true, reused: Boolean(origin || ["black", "white"].includes(id)), glb,
  });
}
const manifest = {
  schema: "arc-shared-library/v1", revision: REVISION,
  levels: ["rf02", "rf02-2", "rf02-3"], units: "meters", upAxis: "Y",
  assets: records, books: BOOKS,
  rules: Object.fromEntries(["rf02-2", "rf02-3"].map((id) => [id, seriesLevel(id).progress])),
  totalRuntimeBytes: records.reduce((sum, asset) => sum + asset.bytes, 0),
  generationTasks: [{ asset: "impact", provider: "Cardinal", taskId: "aigc_de47994684c44a6d92e4bf0f0af17d06", status: "completed", regenerations: 0, actualFormat: "FLAC", request: "tools/rf02-series/book-impact-request.json" }],
  measuredAt: new Date().toISOString(),
};
fs.writeFileSync("docs/levels/rf02-series-assets.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ revision: REVISION, assets: records.length, totalRuntimeBytes: manifest.totalRuntimeBytes, byteCorrespondence: "passed" }));
