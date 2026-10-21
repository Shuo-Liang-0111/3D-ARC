import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(workspaceRoot, "public/local-assets/polyhaven/rf01");
const resolution = "4k";

const selection = Object.freeze({
  hdri: Object.freeze({
    asset: "factory_yard",
    files: Object.freeze([
      { source: ["hdri", "8k", "hdr", "url"], target: "environment/factory_yard_8k.hdr" },
    ]),
  }),
  textures: Object.freeze([
    {
      asset: "aerial_asphalt_01",
      channels: Object.freeze({
        diffuse: "aerial_asphalt_01_diff_4k.jpg",
        normal: "aerial_asphalt_01_nor_gl_4k.jpg",
        roughness: "aerial_asphalt_01_rough_4k.jpg",
        ao: "aerial_asphalt_01_ao_4k.jpg",
        displacement: "aerial_asphalt_01_disp_4k.jpg",
      }),
    },
    {
      asset: "hangar_concrete_floor",
      channels: Object.freeze({
        diffuse: "hangar_concrete_floor_diff_4k.jpg",
        normal: "hangar_concrete_floor_nor_gl_4k.jpg",
        roughness: "hangar_concrete_floor_rough_4k.jpg",
        ao: "hangar_concrete_floor_ao_4k.jpg",
        displacement: "hangar_concrete_floor_disp_4k.jpg",
      }),
    },
    {
      asset: "box_profile_metal_sheet",
      channels: Object.freeze({
        diffuse: "box_profile_metal_sheet_diff_4k.jpg",
        normal: "box_profile_metal_sheet_nor_gl_4k.jpg",
        roughness: "box_profile_metal_sheet_rough_4k.jpg",
        ao: "box_profile_metal_sheet_ao_4k.jpg",
        displacement: "box_profile_metal_sheet_disp_4k.jpg",
      }),
    },
  ]),
  models: Object.freeze([
    "modular_factory_facade",
    "power_box_01",
    "hand_truck",
    "industrial_storage_cart",
    "modular_industrial_pipes_01",
    "plastic_crate_01",
  ]),
});

function getPath(value, segments) {
  return segments.reduce((current, segment) => current?.[segment], value);
}

function collectUrls(value, currentPath = [], files = []) {
  if (!value || typeof value !== "object") return files;
  for (const [key, entry] of Object.entries(value)) {
    const nextPath = [...currentPath, key];
    if (key === "url" && typeof entry === "string" && entry.startsWith("https://")) {
      files.push({ path: nextPath, url: entry });
    } else {
      collectUrls(entry, nextPath, files);
    }
  }
  return files;
}

async function assetFiles(asset) {
  const response = await fetch(`https://api.polyhaven.com/files/${asset}`);
  if (!response.ok) throw new Error(`Poly Haven file API failed for ${asset}: ${response.status}`);
  return response.json();
}

async function sha256(filename) {
  const hash = createHash("sha256");
  hash.update(await readFile(filename));
  return hash.digest("hex");
}

async function download(url, target) {
  const output = path.join(outputRoot, target);
  await mkdir(path.dirname(output), { recursive: true });
  try {
    const existing = await stat(output);
    if (existing.size > 0) return { target, bytes: existing.size, sha256: await sha256(output), reused: true };
  } catch {
    // Download missing files below.
  }
  const temporary = `${output}.partial`;
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status} ${url}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
  await rename(temporary, output);
  const metadata = await stat(output);
  return { target, bytes: metadata.size, sha256: await sha256(output), reused: false };
}

function textureDownloads(asset, files, channels) {
  const allFiles = collectUrls(files);
  return Object.entries(channels).map(([channel, filename]) => {
    const match = allFiles.find((entry) => entry.url.endsWith(`/${filename}`));
    if (!match) throw new Error(`Missing ${asset} ${channel}: ${filename}`);
    return { url: match.url, target: `textures/${asset}/${filename}`, channel };
  });
}

function modelDownloads(asset, files) {
  const branch = getPath(files, ["gltf", resolution, "gltf"]);
  if (!branch) throw new Error(`Missing ${resolution} glTF package for ${asset}`);
  const urls = collectUrls(branch);
  return urls.map((entry) => {
    const relativePath = entry.path.slice(entry.path.indexOf("include") + 1, -1);
    const target = entry.path.includes("include")
      ? `models/${asset}/${relativePath.join("/")}`
      : `models/${asset}/${asset}_${resolution}.gltf`;
    return { url: entry.url, target };
  });
}

async function main() {
  const jobs = [];
  const sources = [];

  const hdriFiles = await assetFiles(selection.hdri.asset);
  for (const file of selection.hdri.files) {
    const url = getPath(hdriFiles, file.source);
    if (!url) throw new Error(`Missing HDRI path ${file.source.join("/")}`);
    jobs.push({ url, target: file.target });
  }
  sources.push({ asset: selection.hdri.asset, type: "HDRI", resolution: "8k", license: "CC0 1.0" });

  for (const texture of selection.textures) {
    const files = await assetFiles(texture.asset);
    jobs.push(...textureDownloads(texture.asset, files, texture.channels));
    sources.push({ asset: texture.asset, type: "texture", resolution, license: "CC0 1.0", channels: Object.keys(texture.channels) });
  }

  for (const asset of selection.models) {
    const files = await assetFiles(asset);
    jobs.push(...modelDownloads(asset, files));
    sources.push({ asset, type: "model", resolution, license: "CC0 1.0" });
  }

  const uniqueJobs = [...new Map(jobs.map((job) => [job.target, job])).values()];
  const downloaded = [];
  for (const [index, job] of uniqueJobs.entries()) {
    process.stdout.write(`[${index + 1}/${uniqueJobs.length}] ${job.target}\n`);
    downloaded.push({ ...job, ...(await download(job.url, job.target)) });
  }

  const manifest = {
    level: "RF-01",
    purpose: "realism-first vertical slice",
    generatedAt: new Date().toISOString(),
    provider: "Poly Haven",
    providerUrl: "https://polyhaven.com/",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sources,
    files: downloaded.map(({ url, target, bytes, sha256: hash }) => ({ target, url, bytes, sha256: hash })),
    totalBytes: downloaded.reduce((total, entry) => total + entry.bytes, 0),
  };
  await writeFile(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Downloaded ${downloaded.length} files (${(manifest.totalBytes / 1024 / 1024).toFixed(1)} MiB)\n`);
}

await main();
