import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const outputDirectory = path.join(workspaceRoot, "public/local-assets/cardinal/rf02/models/generated");
const manifestPath = path.join(outputDirectory, "generation-manifest.json");
const authPath = path.join(os.homedir(), ".cardinal/cardinal-cloud/auth.json");

const shared = `Photorealistic game-ready asset for a contemporary public library interior, designed for a fixed near-vertical overhead 3D game camera. Correct real-world scale, Y axis up, front facing positive Z, centered at world origin, bottom-center pivot, watertight detailed topology, physically based materials, realistic wood, metal, fabric and paper response, restrained edge wear and dust. Exactly one isolated object, fully visible, no room, no floor, no wall, no pedestal, no person, no robot, no hands, no floating parts, no animation, no interaction outline, no emissive highlight, no arrows, no UI, no readable text, no logo and no trademark. Export as a self-contained GLB for Three.js.`;

export const assets = [
  {
    id: "wooden_bookshelf",
    filename: "rf02_wooden_bookshelf.glb",
    prompt: `A freestanding double-sided modern library bookshelf, approximately 3.60 meters wide, 0.62 meters deep and 2.80 meters high. Warm dark walnut veneer over a strong concealed metal frame, four evenly spaced usable shelves on each side, solid end panels, narrow kick plate, subtle joinery and realistic institutional durability. The shelves must be empty so game-controlled colored books can be inserted. Rectangular silhouette and unobstructed shelf openings. ${shared}`,
  },
  {
    id: "reading_table",
    filename: "rf02_reading_table.glb",
    prompt: `A large contemporary public-library reading table, approximately 4.0 meters long, 1.90 meters wide and 0.90 meters high. Thick warm walnut tabletop with softly chamfered edges, dark powder-coated steel support frame and four stable legs, recessed cable channel with closed covers, realistic scratches and polished touch wear. Completely clear tabletop with no chairs, books, lamps or accessories. ${shared}`,
  },
  ...["red", "black", "white"].map((color) => ({
    id: `${color}_book`,
    filename: `rf02_${color}_book.glb`,
    prompt: `A single closed medium-format hardback library book, approximately 0.54 meters wide, 0.76 meters long and 0.18 meters thick for clear readability from an overhead game camera. A solid ${color} clothbound cover and spine with subtle weave, cream paper block, slightly rounded corners and natural page variation. The cover must be uniformly ${color}, with no title, symbol, label or readable writing. The book lies flat with its front cover upward. ${shared}`,
  })),
  {
    id: "reading_chair",
    filename: "rf02_reading_chair.glb",
    prompt: `A contemporary institutional library reading chair, approximately 0.72 meters wide, 0.72 meters deep and 1.30 meters high. Dark desaturated green wool upholstery, supportive curved back, slim black powder-coated steel frame, four feet and subtle realistic use wear. Upright, symmetrical and stackable-looking, with no desk and no person. ${shared}`,
  },
  {
    id: "catalog_terminal",
    filename: "rf02_catalog_terminal.glb",
    prompt: `A freestanding modern library catalog terminal, approximately 0.75 meters wide, 0.60 meters deep and 1.35 meters high. Dark bronze powder-coated metal pedestal, slightly angled recessed screen, small physical keyboard shelf, card scanner slot, ventilation, service panel and floor mounting plate. Screen is a separate flat dark unlit surface with no baked content. No hologram or floating display. ${shared}`,
  },
  {
    id: "return_cart",
    filename: "rf02_return_cart.glb",
    prompt: `An empty three-tier public library book return cart, approximately 1.30 meters wide, 0.70 meters deep and 1.45 meters high. Dark powder-coated tubular steel frame, three gently sloped walnut shelves with raised lips, large quiet rubber caster wheels, rounded push handle and realistic institutional wear. The cart must be empty with no books or loose objects. ${shared}`,
  },
  {
    id: "pendant_light",
    filename: "rf02_pendant_light.glb",
    prompt: `A single contemporary library pendant light fixture, approximately 0.80 meters wide, 0.80 meters deep and 0.80 meters high excluding cable. Shallow dark bronze metal dome shade, pale frosted lower diffuser as a distinct unlit material, short rigid ceiling stem, small ceiling canopy and precise fasteners. No ceiling, no surrounding light rays and no lit glow. ${shared}`,
  },
];

async function readAuth() {
  const auth = JSON.parse(await fs.readFile(authPath, "utf8"));
  if (!auth.baseUrl || !auth.token) throw new Error("Cardinal login data is incomplete. Run /login first.");
  return auth;
}

async function readManifest() {
  try { return JSON.parse(await fs.readFile(manifestPath, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return { level: "rf02", createdAt: new Date().toISOString(), qualityPreset: "high-highpoly", outputFormat: "glb", assets: {} };
    throw error;
  }
}

async function writeManifest(manifest) {
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function request(auth, pathname, options = {}) {
  const response = await fetch(new URL(pathname, auth.baseUrl), {
    ...options,
    headers: { Authorization: `Bearer ${auth.token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  const body = await response.text();
  let payload;
  try { payload = body ? JSON.parse(body) : {}; } catch { payload = { message: body }; }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${payload.message ?? "Cardinal request failed"}`);
  return payload.data ?? payload;
}

function taskIdFrom(payload) {
  return payload.taskId ?? payload.id ?? payload.task?.taskId ?? payload.task?.id;
}

async function submit() {
  const auth = await readAuth();
  const manifest = await readManifest();
  for (const asset of assets) {
    if (manifest.assets[asset.id]?.taskId) {
      console.log(`[skip] ${asset.id}: ${manifest.assets[asset.id].taskId}`);
      continue;
    }
    const payload = await request(auth, "/api/client/aigc/model3d/tasks", {
      method: "POST",
      body: JSON.stringify({
        prompt: asset.prompt,
        taskType: "text_to_model",
        qualityPreset: "high-highpoly",
        modelVersion: "v3.1-20260211",
        outputFormat: "glb",
        geometryQuality: "detailed",
        enableImageAutofix: false,
        refineAfterGeneration: false,
      }),
    });
    const rawTaskId = taskIdFrom(payload);
    if (!rawTaskId) throw new Error(`Cardinal did not return a task ID for ${asset.id}.`);
    const taskId = String(rawTaskId).startsWith("model3d:") ? String(rawTaskId) : `model3d:${rawTaskId}`;
    manifest.assets[asset.id] = { filename: asset.filename, taskId, status: payload.status ?? "submitted", outputFormat: "glb", submittedAt: new Date().toISOString() };
    await writeManifest(manifest);
    console.log(`[submitted] ${asset.id}: ${taskId}`);
  }
}

async function submitRetry(auth, manifest, asset) {
  const previous = manifest.assets[asset.id];
  const payload = await request(auth, "/api/client/aigc/model3d/tasks", {
    method: "POST",
    body: JSON.stringify({
      prompt: asset.prompt,
      taskType: "text_to_model",
      qualityPreset: "high-highpoly",
      modelVersion: "v3.1-20260211",
      outputFormat: "glb",
      geometryQuality: "detailed",
      enableImageAutofix: false,
      refineAfterGeneration: false,
    }),
  });
  const rawTaskId = taskIdFrom(payload);
  if (!rawTaskId) throw new Error(`Cardinal did not return a retry task ID for ${asset.id}.`);
  const taskId = String(rawTaskId).startsWith("model3d:") ? String(rawTaskId) : `model3d:${rawTaskId}`;
  const attempts = [...(previous?.attempts ?? [])];
  if (previous?.taskId) attempts.push({ taskId: previous.taskId, status: previous.status, error: previous.error, submittedAt: previous.submittedAt });
  manifest.assets[asset.id] = { filename: asset.filename, taskId, status: payload.status ?? "submitted", outputFormat: "glb", submittedAt: new Date().toISOString(), attempts };
  await writeManifest(manifest);
  console.log(`[retry-submitted] ${asset.id}: ${taskId}`);
}

async function refreshAsset(auth, manifest, asset) {
  const entry = manifest.assets[asset.id];
  const response = await request(auth, `/api/client/tasks/${encodeURIComponent(entry.taskId)}`);
  const payload = response.task ?? response;
  entry.status = payload.status ?? entry.status;
  entry.progress = payload.progress ?? entry.progress;
  entry.outputFormat = payload.outputFormat ?? entry.outputFormat;
  entry.downloadUrl = payload.downloadUrl ?? payload.artifactUrl ?? entry.downloadUrl;
  entry.error = payload.error ?? undefined;
  entry.updatedAt = new Date().toISOString();
  await writeManifest(manifest);
  console.log(`[${entry.status}] ${asset.id}: ${entry.progress ?? "?"}%`);
  return entry;
}

async function refresh() {
  const auth = await readAuth();
  const manifest = await readManifest();
  for (const asset of assets) {
    const entry = manifest.assets[asset.id];
    if (!entry?.taskId) continue;
    const response = await request(auth, `/api/client/tasks/${encodeURIComponent(entry.taskId)}`);
    const payload = response.task ?? response;
    entry.status = payload.status ?? entry.status;
    entry.progress = payload.progress ?? entry.progress;
    entry.outputFormat = payload.outputFormat ?? entry.outputFormat;
    entry.downloadUrl = payload.downloadUrl ?? payload.artifactUrl ?? entry.downloadUrl;
    entry.error = payload.error ?? undefined;
    entry.updatedAt = new Date().toISOString();
    console.log(`[${entry.status}] ${asset.id}: ${entry.progress ?? "?"}%`);
  }
  await writeManifest(manifest);
}

async function downloadFile(url, destination, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
}

async function download() {
  const auth = await readAuth();
  const manifest = await readManifest();
  await fs.mkdir(outputDirectory, { recursive: true });
  for (const asset of assets) {
    const entry = manifest.assets[asset.id];
    if (entry?.status !== "completed" || !entry.downloadUrl) continue;
    const destination = path.join(outputDirectory, asset.filename);
    try {
      await fs.access(destination);
      console.log(`[exists] ${destination}`);
    } catch {
      await downloadFile(entry.downloadUrl, destination, auth.token);
      console.log(`[downloaded] ${destination}`);
    }
    entry.localPath = destination;
    entry.downloadedAt ??= new Date().toISOString();
  }
  await writeManifest(manifest);
}

function referencePrompt(asset) {
  return `Create a photorealistic isolated product reference image for single-image 3D reconstruction. ${asset.prompt.replace(shared, "")} Show exactly one complete object in a clean three-quarter front view so the front, right side and top surfaces are visible. Neutral light-gray seamless background, centered and fully inside frame, realistic studio lighting, sharp focus, minimal soft contact shadow. Preserve straight edges, symmetry, real engineering proportions and clearly separated materials. No room, no floor environment, no robot, no person, no hand, no text, no labels, no logo, no UI, no arrows, no glow, no cropped parts and no additional objects.`;
}

async function submitReferences() {
  const auth = await readAuth();
  const manifest = await readManifest();
  for (const asset of assets) {
    if (manifest.assets[asset.id]?.status === "completed") continue;
    const entry = manifest.assets[asset.id] ?? { filename: asset.filename };
    if (entry.reference?.taskId) {
      console.log(`[reference-skip] ${asset.id}: ${entry.reference.taskId}`);
      continue;
    }
    const payload = await request(auth, "/api/client/aigc/image/tasks", {
      method: "POST",
      body: JSON.stringify({ prompt: referencePrompt(asset), size: "1024x1024", quality: "advanced", style: "photorealistic", transparentBackground: false }),
    });
    const taskId = taskIdFrom(payload);
    if (!taskId) throw new Error(`Cardinal did not return an image task ID for ${asset.id}.`);
    entry.reference = { taskId: String(taskId), status: payload.status ?? "submitted", submittedAt: new Date().toISOString() };
    manifest.assets[asset.id] = entry;
    await writeManifest(manifest);
    console.log(`[reference-submitted] ${asset.id}: ${taskId}`);
  }
}

async function refreshReferences(auth, manifest) {
  for (const asset of assets) {
    const reference = manifest.assets[asset.id]?.reference;
    if (!reference?.taskId || reference.status === "completed") continue;
    const response = await request(auth, `/api/client/tasks/${encodeURIComponent(reference.taskId)}`);
    const payload = response.task ?? response;
    reference.status = payload.status ?? reference.status;
    reference.progress = payload.progress ?? reference.progress;
    reference.downloadUrl = payload.downloadUrl ?? payload.artifactUrl ?? payload.imageUrl ?? reference.downloadUrl;
    reference.error = payload.error ?? undefined;
    reference.updatedAt = new Date().toISOString();
    console.log(`[reference-${reference.status}] ${asset.id}: ${reference.progress ?? "?"}%`);
  }
  await writeManifest(manifest);
}

async function downloadReferences(auth, manifest) {
  for (const asset of assets) {
    const reference = manifest.assets[asset.id]?.reference;
    if (reference?.status !== "completed" || !reference.downloadUrl) continue;
    const destination = path.join(outputDirectory, `${asset.id}_reference.png`);
    try { await fs.access(destination); }
    catch {
      await downloadFile(reference.downloadUrl, destination, auth.token);
      console.log(`[reference-downloaded] ${destination}`);
    }
    reference.localPath = destination;
    reference.downloadedAt ??= new Date().toISOString();
  }
  await writeManifest(manifest);
}

async function submitImageModel(auth, manifest, asset, outputFormat = "fbx") {
  const previous = manifest.assets[asset.id];
  const referencePath = previous?.reference?.localPath;
  if (!referencePath) throw new Error(`Reference image is missing for ${asset.id}.`);
  const bytes = await fs.readFile(referencePath);
  const form = new FormData();
  form.set("file", new Blob([bytes], { type: "image/png" }), path.basename(referencePath));
  const uploadResponse = await fetch(new URL("/api/client/aigc/model3d/source-images", auth.baseUrl), {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.token}`, Accept: "application/json" },
    body: form,
  });
  const uploadPayload = await uploadResponse.json();
  if (!uploadResponse.ok) throw new Error(`Reference upload failed for ${asset.id}: ${uploadResponse.status}`);
  const imagePath = (uploadPayload.data ?? uploadPayload).filePath ?? (uploadPayload.data ?? uploadPayload).path;
  if (!imagePath) throw new Error(`Cardinal did not return an upload path for ${asset.id}.`);
  const payload = await request(auth, "/api/client/aigc/model3d/tasks", {
    method: "POST",
    body: JSON.stringify({
      prompt: asset.prompt,
      imagePath,
      taskType: "image_to_model",
      qualityPreset: "high-highpoly",
      modelVersion: "v3.1-20260211",
      outputFormat,
      geometryQuality: "detailed",
      enableImageAutofix: true,
      refineAfterGeneration: false,
    }),
  });
  const rawTaskId = taskIdFrom(payload);
  if (!rawTaskId) throw new Error(`Cardinal did not return an image-model task ID for ${asset.id}.`);
  const attempts = [...(previous.attempts ?? []), { taskId: previous.taskId, status: previous.status, error: previous.error, outputFormat: previous.outputFormat }];
  const taskId = String(rawTaskId).startsWith("model3d:") ? String(rawTaskId) : `model3d:${rawTaskId}`;
  manifest.assets[asset.id] = { ...previous, filename: asset.filename.replace(/\.glb$/i, `.${outputFormat}`), taskId, status: payload.status ?? "submitted", outputFormat, sourceType: "image_to_model", submittedAt: new Date().toISOString(), attempts };
  await writeManifest(manifest);
  console.log(`[image-model-submitted] ${asset.id}: ${taskId} (${outputFormat})`);
}

async function produceFromReferences() {
  const auth = await readAuth();
  const manifest = await readManifest();
  while (assets.some((asset) => {
    const entry = manifest.assets[asset.id];
    return entry?.status !== "completed" && entry?.reference && !["completed", "failed"].includes(entry.reference.status);
  })) {
    await new Promise((resolve) => setTimeout(resolve, 15000));
    await refreshReferences(auth, manifest);
  }
  await downloadReferences(auth, manifest);
  for (const asset of assets) {
    let entry = manifest.assets[asset.id];
    if (entry?.status === "completed") {
      if (!entry.localPath && entry.downloadUrl) {
        const destination = path.join(outputDirectory, entry.filename);
        await downloadFile(entry.downloadUrl, destination, auth.token);
        entry.localPath = destination;
        entry.downloadedAt = new Date().toISOString();
        await writeManifest(manifest);
        console.log(`[downloaded] ${destination}`);
      }
      continue;
    }
    if (entry?.reference?.status !== "completed") {
      console.log(`[reference-not-ready] ${asset.id}: ${entry?.reference?.status ?? "missing"}`);
      continue;
    }
    const activeImageModel = entry.sourceType === "image_to_model" && !["failed", "completed"].includes(entry.status);
    if (!activeImageModel) {
      await submitImageModel(auth, manifest, asset, "fbx");
      entry = manifest.assets[asset.id];
    } else {
      console.log(`[resume] ${asset.id}: ${entry.taskId}`);
    }
    while (!["completed", "failed"].includes(entry.status)) {
      await new Promise((resolve) => setTimeout(resolve, 12000));
      try { entry = await refreshAsset(auth, manifest, asset); }
      catch (error) { console.warn(`[status-retry] ${asset.id}: ${error.message}`); }
    }
    if (entry.status !== "completed" || !entry.downloadUrl) {
      console.log(`[image-model-failed] ${asset.id}`);
      continue;
    }
    const destination = path.join(outputDirectory, entry.filename);
    await downloadFile(entry.downloadUrl, destination, auth.token);
    entry.localPath = destination;
    entry.downloadedAt = new Date().toISOString();
    await writeManifest(manifest);
    console.log(`[downloaded] ${destination}`);
  }
}

async function produceSequentially() {
  const auth = await readAuth();
  const manifest = await readManifest();
  await fs.mkdir(outputDirectory, { recursive: true });
  // Finish an already-running job before retrying any 0% failures; the cloud
  // account currently admits one high-poly 3D generation at a time.
  const productionQueue = [...assets].sort((a, b) => {
    const active = (asset) => !["completed", "failed"].includes(manifest.assets[asset.id]?.status);
    return Number(active(b)) - Number(active(a));
  });
  for (const asset of productionQueue) {
    let entry = manifest.assets[asset.id];
    if (entry?.status === "failed") {
      await submitRetry(auth, manifest, asset);
      entry = manifest.assets[asset.id];
    }
    while (entry && !["completed", "failed"].includes(entry.status)) {
      await new Promise((resolve) => setTimeout(resolve, 12000));
      entry = await refreshAsset(auth, manifest, asset);
    }
    if (entry?.status !== "completed" || !entry.downloadUrl) {
      console.log(`[not-ready] ${asset.id}: ${entry?.status ?? "missing"}`);
      continue;
    }
    const destination = path.join(outputDirectory, asset.filename);
    try { await fs.access(destination); console.log(`[exists] ${destination}`); }
    catch {
      await downloadFile(entry.downloadUrl, destination, auth.token);
      console.log(`[downloaded] ${destination}`);
    }
    entry.localPath = destination;
    entry.downloadedAt ??= new Date().toISOString();
    await writeManifest(manifest);
  }
}

const command = process.argv[2];
if (command === "submit") await submit();
else if (command === "status") await refresh();
else if (command === "download") await download();
else if (command === "produce") await produceSequentially();
else if (command === "reference-submit") await submitReferences();
else if (command === "reference-produce") await produceFromReferences();
else throw new Error("Usage: node tools/cardinal-rf02-assets.mjs <submit|status|download|produce|reference-submit|reference-produce>");
