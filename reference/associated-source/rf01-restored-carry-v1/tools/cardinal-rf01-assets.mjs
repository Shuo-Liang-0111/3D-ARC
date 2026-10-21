import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const outputDirectory = path.join(workspaceRoot, "public/local-assets/cardinal/rf01/models/generated");
const textureDirectory = path.join(workspaceRoot, "public/local-assets/cardinal/rf01/textures/generated");
const manifestPath = path.join(outputDirectory, "generation-manifest.json");
const authPath = path.join(os.homedir(), ".cardinal/cardinal-cloud/auth.json");

const shared = `Photorealistic game-ready industrial asset for a realistic robotics research laboratory. Correct real-world scale, Y axis up, front facing positive Z, centered at world origin, bottom-center pivot, clean watertight topology, physically based materials, realistic metal, rubber and polymer surface response, subtle dust, scratches and edge wear. Single isolated object with no environment, no floor, no pedestal, no character, no robot, no hands, no floating parts, no animation, no neon glow, no interaction outline, no arrows, no UI, no readable text, no logo and no trademark. Export as GLB for Three.js.`;

const assets = [
  {
    id: "battery",
    filename: "rf01_battery.glb",
    prompt: `A rugged removable industrial energy module designed to be carried on the rear cargo rack of a medium quadruped robot. Approximately 0.70 meters wide, 0.42 meters deep and 0.28 meters high. Dark graphite composite shell, painted steel corner guards, two integrated mechanical carrying handles, recessed high-current connector on one short side, rubber feet, ventilation grooves, exposed fasteners and muted amber identification bands painted into the housing. It must look heavy, replaceable and manufactured for real industrial use. ${shared}`,
  },
  {
    id: "power_slot",
    filename: "rf01_power_slot.glb",
    prompt: `A low floor-mounted industrial docking station for inserting a removable rectangular energy module. Approximately 1.45 meters wide, 1.10 meters deep and 0.38 meters high. Heavy dark painted-steel base, clearly recessed battery cavity sized for a 0.70 by 0.42 meter module, mechanical alignment rails, rugged high-current connector, locking clamps, rubber buffers, rear cable conduit, removable service panels, bolts and ventilation slots. Include two small recessed unlit indicator lenses as separate material regions. The receiving cavity must be empty; do not include a battery. ${shared}`,
  },
  {
    id: "door_frame",
    filename: "rf01_door_frame.glb",
    prompt: `A static heavy industrial frame for a vertical sliding security door. Clear central opening approximately 3.0 meters wide and 2.8 meters high; total outer dimensions approximately 3.65 meters wide, 3.45 meters high and 0.55 meters deep. Thick dark structural-steel side columns, reinforced overhead lifting housing, recessed vertical guide rails, concealed lifting mechanism, service panels, large bolts, cable conduits, rubber seals and mechanical stops. Include one small unlit status-light lens on the front-right column. The doorway must remain completely empty. Do not include a moving door panel or surrounding wall. ${shared}`,
  },
  {
    id: "door_panel",
    filename: "rf01_door_panel.glb",
    prompt: `A single rigid moving panel for a heavy industrial vertical sliding security door, approximately 3.0 meters wide, 2.75 meters high and 0.22 meters thick. Reinforced painted-steel construction, dark graphite and desaturated gray finish, large recessed structural panels, vertical reinforcement ribs, upper lifting attachment points, side guide surfaces, bottom rubber seal, inset bolts, welded seams and realistic industrial wear. Rectangular silhouette suitable for straight vertical upward movement. Generate only the movable door panel with no frame and no wall. ${shared}`,
  },
  {
    id: "terminal",
    filename: "rf01_terminal.glb",
    prompt: `A freestanding industrial maintenance terminal approximately 0.72 meters wide, 0.58 meters deep and 1.35 meters high. Heavy floor-mounted pedestal, dark painted steel and aged polymer construction, slightly tilted rectangular display, rugged protective bezel, physical emergency stop button, tactile industrial keys, covered service port, ventilation slots, rear cable conduit and exposed fasteners. The display must be a distinct flat dark unlit material region with no baked text or graphics so the game can control it dynamically. Small status-light lenses may be present but unlit. No hologram and no floating screen. ${shared}`,
  },
  {
    id: "control_cabinet",
    filename: "rf01_control_cabinet.glb",
    prompt: `A floor-standing industrial electrical control cabinet approximately 1.25 meters wide, 0.55 meters deep and 2.10 meters high. Dark desaturated gray-green painted steel enclosure, three separate service doors, recessed handles, ventilation grilles, analog gauges, rugged switches, cable glands, exposed fasteners, subtle rust around lower edges, oil fingerprints and realistic workshop wear. Indicator lenses must be small and unlit. The cabinet must be a single rigid static prop with a flat back suitable for placement against a wall. ${shared}`,
  },
  {
    id: "cargo_crate",
    filename: "rf01_cargo_crate.glb",
    prompt: `A rugged stackable industrial transport crate approximately 1.30 meters wide, 0.85 meters deep and 0.90 meters high. Reinforced dark graphite polymer and painted metal construction, recessed side handles, structural ribs, steel corner protectors, locking latches, rubber feet, subtle grime, impact scratches and worn edges. Closed lid, simple rectangular footprint, mechanically plausible and suitable for repeated placement in a robotics laboratory storage area. ${shared}`,
  },
  {
    id: "pipe_manifold",
    filename: "rf01_pipe_manifold.glb",
    prompt: `A modular wall-mounted industrial pipe manifold approximately 2.6 meters wide, 1.7 meters high and 0.42 meters deep. Several dark galvanized steel pipes of different diameters, realistic elbow joints, flanges, brackets, two compact valve bodies, cable conduit and mounting rails. All pipes form one self-contained rigid assembly with a flat rear plane for wall installation. No wall surface, no floor and no loose disconnected pipes. ${shared}`,
  },
  {
    id: "battery_storage_rack",
    filename: "rf01_battery_storage_rack.glb",
    prompt: `An empty heavy-duty industrial storage rack designed to hold one removable energy module carried by a medium quadruped robot. Approximately 1.55 meters wide, 0.85 meters deep and 1.15 meters high. Welded dark galvanized steel tube frame, four sturdy legs, reinforced lower shelf, mechanical guide rails sized for a 0.70 by 0.42 meter battery, rubber isolation pads, tie-down brackets, cable clips, exposed bolts, subtle grime and edge wear. The rack must be empty with a clearly open loading surface; do not include a battery, crate, wall or floor. ${shared}`,
  },
  {
    id: "industrial_pump_unit",
    filename: "rf01_industrial_pump_unit.glb",
    prompt: `A compact floor-mounted industrial coolant pump and motor unit approximately 1.75 meters long, 0.85 meters wide and 1.05 meters high. Heavy rectangular steel skid, cylindrical electric motor, centrifugal pump housing, intake and outlet flanges, short connected pipe stubs, protective coupling guard, small pressure gauge, cable junction box, mounting bolts, dark desaturated gray-green paint, realistic grease, rust spots and service wear. One rigid self-contained machine with no external wall, floor or loose hoses. ${shared}`,
  },
  {
    id: "fluorescent_light_fixture",
    filename: "rf01_fluorescent_light_fixture.glb",
    prompt: `A rugged sealed industrial fluorescent ceiling light fixture approximately 1.80 meters long, 0.28 meters wide and 0.16 meters high. Dark powder-coated steel housing, protective metal end caps, frosted rectangular diffuser, mounting brackets, exposed fasteners, small cable gland and realistic workshop wear. The diffuser must be a separate pale unlit material surface so the game can add emissive lighting. One straight rigid fixture only, no ceiling, no wall, no hanging cable and no surrounding environment. ${shared}`,
  },
];

const textures = [
  {
    id: "concrete_floor",
    filename: "rf01_concrete_floor.png",
    prompt: "A seamless tileable photorealistic industrial laboratory concrete floor base-color texture, viewed perfectly straight from above with orthographic projection. Cool medium-gray concrete, fine aggregate, subtle mottling, restrained oil smudges, faint abrasion and small scratches, even neutral illumination, no directional shadows, no perspective, no borders, no seams, no cracks wider than a few centimeters, no objects, no text, no markings, no logos. The left and right edges and the top and bottom edges must match perfectly for repeated PBR game material tiling.",
  },
  {
    id: "painted_steel",
    filename: "rf01_painted_steel.png",
    prompt: "A seamless tileable photorealistic dark graphite painted industrial steel base-color texture, viewed perfectly straight on with orthographic projection. Fine powder-coated grain, subtle roller variation, sparse edge-independent scuffs, tiny paint chips revealing muted steel, very restrained grime, even neutral illumination, no directional highlights, no shadows, no panel borders, no bolts, no seams, no objects, no text, no markings, no logos. All opposite edges must match perfectly for repeated PBR game material tiling.",
  },
];

async function readAuth() {
  const auth = JSON.parse(await fs.readFile(authPath, "utf8"));
  if (!auth.baseUrl || !auth.token) throw new Error("Cardinal login data is incomplete. Run /login first.");
  return auth;
}

async function readManifest() {
  try {
    return JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { createdAt: new Date().toISOString(), assets: {} };
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
    headers: {
      Authorization: `Bearer ${auth.token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { message: text }; }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${payload.message ?? "Cardinal request failed"}`);
  return payload.data ?? payload;
}

async function downloadWithResume(url, destination, token) {
  const partial = `${destination}.part`;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    let existing = 0;
    try { existing = (await fs.stat(partial)).size; } catch {}
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(existing ? { Range: `bytes=${existing}-` } : {}),
        },
      });
      if (!response.ok && response.status !== 206) throw new Error(`${response.status} ${response.statusText}`);
      const resumed = existing > 0 && response.status === 206;
      if (existing > 0 && !resumed) {
        await fs.truncate(partial, 0);
        existing = 0;
      }
      if (!response.body) throw new Error("Download response has no body.");
      await pipeline(Readable.fromWeb(response.body), createWriteStream(partial, { flags: existing ? "a" : "w" }));
      await fs.rename(partial, destination);
      return;
    } catch (error) {
      if (attempt === 6) throw error;
      console.warn(`[download-retry] ${path.basename(destination)} attempt ${attempt}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
}

function taskIdFrom(payload) {
  return payload.taskId ?? payload.id ?? payload.task?.taskId ?? payload.task?.id;
}

function statusData(payload) {
  return payload.task ?? payload;
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
    const taskId = taskIdFrom(payload);
    if (!taskId) throw new Error(`Cardinal did not return a task ID for ${asset.id}. Keys: ${Object.keys(payload).join(", ")}`);
    manifest.assets[asset.id] = {
      filename: asset.filename,
      taskId: String(taskId).startsWith("model3d:") ? String(taskId) : `model3d:${taskId}`,
      status: "submitted",
      submittedAt: new Date().toISOString(),
    };
    await writeManifest(manifest);
    console.log(`[submitted] ${asset.id}: ${manifest.assets[asset.id].taskId}`);
  }
}

async function refresh() {
  const auth = await readAuth();
  const manifest = await readManifest();
  for (const asset of assets) {
    const entry = manifest.assets[asset.id];
    if (!entry?.taskId) continue;
    const payload = statusData(await request(auth, `/api/client/tasks/${encodeURIComponent(entry.taskId)}`));
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

async function download() {
  const auth = await readAuth();
  const manifest = await readManifest();
  for (const asset of assets) {
    const entry = manifest.assets[asset.id];
    if (!entry || entry.status !== "completed" || !entry.downloadUrl) continue;
    const destination = path.join(outputDirectory, entry.filename ?? asset.filename);
    try {
      await fs.access(destination);
      console.log(`[exists] ${destination}`);
      continue;
    } catch {}
    await downloadWithResume(entry.downloadUrl, destination, auth.token);
    entry.localPath = destination;
    entry.downloadedAt = new Date().toISOString();
    console.log(`[downloaded] ${destination}`);
  }
  await writeManifest(manifest);
}

async function retry(assetId, outputFormat = "glb") {
  if (!['fbx', 'glb'].includes(outputFormat)) throw new Error("Retry output format must be fbx or glb.");
  const asset = assets.find((item) => item.id === assetId);
  if (!asset) throw new Error(`Unknown asset: ${assetId}`);
  const auth = await readAuth();
  const manifest = await readManifest();
  const previous = manifest.assets[asset.id];
  const payload = await request(auth, "/api/client/aigc/model3d/tasks", {
    method: "POST",
    body: JSON.stringify({
      prompt: asset.prompt,
      taskType: "text_to_model",
      qualityPreset: "high-highpoly",
      modelVersion: "v3.1-20260211",
      outputFormat,
      geometryQuality: "detailed",
      enableImageAutofix: false,
      refineAfterGeneration: false,
    }),
  });
  const taskId = taskIdFrom(payload);
  if (!taskId) throw new Error(`Cardinal did not return a task ID for ${asset.id}.`);
  const attempts = [...(previous?.attempts ?? [])];
  if (previous?.taskId) attempts.push({
    taskId: previous.taskId,
    status: previous.status,
    error: previous.error,
    outputFormat: previous.outputFormat,
  });
  manifest.assets[asset.id] = {
    filename: asset.filename.replace(/\.glb$/i, `.${outputFormat}`),
    taskId: String(taskId).startsWith("model3d:") ? String(taskId) : `model3d:${taskId}`,
    status: "submitted",
    outputFormat,
    submittedAt: new Date().toISOString(),
    attempts,
  };
  await writeManifest(manifest);
  console.log(`[submitted] ${asset.id}: ${manifest.assets[asset.id].taskId} (${outputFormat})`);
}

async function credits() {
  const auth = await readAuth();
  const payload = await request(auth, "/api/user/me");
  console.log(JSON.stringify({ user: payload.nickname ?? payload.username, credits: payload.credits ?? payload.tokens }, null, 2));
}

function referencePromptFor(asset) {
  return `Create a photorealistic isolated product reference image for single-image 3D reconstruction. ${asset.prompt.replace(shared, "")} Show exactly one complete object in a clean three-quarter front view so the front, right side and top surfaces are all visible. Neutral light-gray seamless background, object centered, fully inside the frame, realistic studio lighting, sharp focus, minimal soft contact shadow. Preserve straight edges, symmetry, real engineering proportions and clearly separated materials. No environment, no room, no robot, no person, no hand, no text, no labels, no logo, no UI, no arrows, no glow, no dramatic perspective, no cropped parts and no additional objects.`;
}

async function submitReference(assetId) {
  const asset = assets.find((item) => item.id === assetId);
  if (!asset) throw new Error(`Unknown asset: ${assetId}`);
  const auth = await readAuth();
  const manifest = await readManifest();
  const payload = await request(auth, "/api/client/aigc/image/tasks", {
    method: "POST",
    body: JSON.stringify({
      prompt: referencePromptFor(asset),
      size: "1024x1024",
      quality: "advanced",
      style: "photorealistic",
      transparentBackground: false,
    }),
  });
  const taskId = taskIdFrom(payload);
  if (!taskId) throw new Error(`Cardinal did not return an image task ID for ${asset.id}.`);
  const entry = manifest.assets[asset.id] ?? { filename: asset.filename, attempts: [] };
  entry.reference = {
    taskId: String(taskId),
    status: payload.status ?? "submitted",
    submittedAt: new Date().toISOString(),
  };
  manifest.assets[asset.id] = entry;
  await writeManifest(manifest);
  console.log(`[reference-submitted] ${asset.id}: ${entry.reference.taskId}`);
}

async function refreshReferences() {
  const auth = await readAuth();
  const manifest = await readManifest();
  for (const asset of assets) {
    const reference = manifest.assets[asset.id]?.reference;
    if (!reference?.taskId) continue;
    if (reference.status === "completed" && reference.downloadUrl) {
      console.log(`[completed] ${asset.id} reference: ${reference.progress ?? 100}%`);
      continue;
    }
    const payload = statusData(await request(auth, `/api/client/tasks/${encodeURIComponent(reference.taskId)}`));
    reference.status = payload.status ?? reference.status;
    reference.progress = payload.progress ?? reference.progress;
    reference.downloadUrl = payload.downloadUrl ?? payload.artifactUrl ?? payload.imageUrl ?? reference.downloadUrl;
    reference.error = payload.error ?? undefined;
    reference.updatedAt = new Date().toISOString();
    console.log(`[${reference.status}] ${asset.id} reference: ${reference.progress ?? "?"}%`);
  }
  await writeManifest(manifest);
}

async function downloadReferences() {
  const auth = await readAuth();
  const manifest = await readManifest();
  for (const asset of assets) {
    const reference = manifest.assets[asset.id]?.reference;
    if (!reference || reference.status !== "completed" || !reference.downloadUrl) continue;
    const destination = path.join(outputDirectory, `${asset.id}_reference.png`);
    try {
      await fs.access(destination);
      reference.localPath = destination;
      console.log(`[exists] ${destination}`);
      continue;
    } catch {}
    await downloadWithResume(reference.downloadUrl, destination, auth.token);
    reference.localPath = destination;
    reference.downloadedAt = new Date().toISOString();
    console.log(`[reference-downloaded] ${destination}`);
  }
  await writeManifest(manifest);
}

async function submitImageModel(assetId, outputFormat = "glb") {
  if (!['fbx', 'glb'].includes(outputFormat)) throw new Error("Output format must be fbx or glb.");
  const asset = assets.find((item) => item.id === assetId);
  if (!asset) throw new Error(`Unknown asset: ${assetId}`);
  const auth = await readAuth();
  const manifest = await readManifest();
  const previous = manifest.assets[asset.id];
  const referencePath = previous?.reference?.localPath;
  if (!referencePath) throw new Error(`Download the ${asset.id} reference image first.`);

  const bytes = await fs.readFile(referencePath);
  const form = new FormData();
  form.set("file", new Blob([bytes], { type: "image/png" }), path.basename(referencePath));
  const uploadResponse = await fetch(new URL("/api/client/aigc/model3d/source-images", auth.baseUrl), {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.token}`, Accept: "application/json" },
    body: form,
  });
  const uploadPayload = await uploadResponse.json();
  if (!uploadResponse.ok) throw new Error(`Reference upload failed: ${uploadResponse.status}`);
  const uploadData = uploadPayload.data ?? uploadPayload;
  const imagePath = uploadData.filePath ?? uploadData.path;
  if (!imagePath) throw new Error("Cardinal did not return an uploaded image path.");

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
  const taskId = taskIdFrom(payload);
  if (!taskId) throw new Error(`Cardinal did not return a model task ID for ${asset.id}.`);
  const attempts = [...(previous?.attempts ?? [])];
  if (previous?.taskId) attempts.push({ taskId: previous.taskId, status: previous.status, error: previous.error, outputFormat: previous.outputFormat });
  manifest.assets[asset.id] = {
    ...previous,
    filename: asset.filename.replace(/\.glb$/i, `.${outputFormat}`),
    taskId: String(taskId).startsWith("model3d:") ? String(taskId) : `model3d:${taskId}`,
    status: "submitted",
    outputFormat,
    sourceType: "image_to_model",
    submittedAt: new Date().toISOString(),
    attempts,
  };
  await writeManifest(manifest);
  console.log(`[image-model-submitted] ${asset.id}: ${manifest.assets[asset.id].taskId} (${outputFormat})`);
}

async function submitTexture(textureId) {
  const texture = textures.find((item) => item.id === textureId);
  if (!texture) throw new Error(`Unknown texture: ${textureId}`);
  const auth = await readAuth();
  const manifest = await readManifest();
  manifest.textures ??= {};
  if (manifest.textures[texture.id]?.taskId) {
    console.log(`[skip] ${texture.id}: ${manifest.textures[texture.id].taskId}`);
    return;
  }
  const payload = await request(auth, "/api/client/aigc/image/tasks", {
    method: "POST",
    body: JSON.stringify({
      prompt: texture.prompt,
      size: "1024x1024",
      quality: "advanced",
      style: "photorealistic",
      transparentBackground: false,
    }),
  });
  const taskId = taskIdFrom(payload);
  if (!taskId) throw new Error(`Cardinal did not return an image task ID for ${texture.id}.`);
  manifest.textures[texture.id] = {
    filename: texture.filename,
    taskId: String(taskId),
    status: payload.status ?? "submitted",
    submittedAt: new Date().toISOString(),
  };
  await writeManifest(manifest);
  console.log(`[texture-submitted] ${texture.id}: ${taskId}`);
}

async function refreshTextures() {
  const auth = await readAuth();
  const manifest = await readManifest();
  for (const texture of textures) {
    const entry = manifest.textures?.[texture.id];
    if (!entry?.taskId) continue;
    const payload = statusData(await request(auth, `/api/client/tasks/${encodeURIComponent(entry.taskId)}`));
    entry.status = payload.status ?? entry.status;
    entry.progress = payload.progress ?? entry.progress;
    entry.downloadUrl = payload.downloadUrl ?? payload.artifactUrl ?? payload.imageUrl ?? entry.downloadUrl;
    entry.error = payload.error ?? undefined;
    entry.updatedAt = new Date().toISOString();
    console.log(`[${entry.status}] ${texture.id}: ${entry.progress ?? "?"}%`);
  }
  await writeManifest(manifest);
}

async function downloadTextures() {
  const auth = await readAuth();
  const manifest = await readManifest();
  await fs.mkdir(textureDirectory, { recursive: true });
  for (const texture of textures) {
    const entry = manifest.textures?.[texture.id];
    if (!entry || entry.status !== "completed" || !entry.downloadUrl) continue;
    const destination = path.join(textureDirectory, texture.filename);
    try {
      await fs.access(destination);
      entry.localPath = destination;
      console.log(`[exists] ${destination}`);
      continue;
    } catch {}
    await downloadWithResume(entry.downloadUrl, destination, auth.token);
    entry.localPath = destination;
    entry.downloadedAt = new Date().toISOString();
    console.log(`[texture-downloaded] ${destination}`);
  }
  await writeManifest(manifest);
}

async function capabilities() {
  const auth = await readAuth();
  const payload = await request(auth, "/api/client/capabilities");
  const list = Array.isArray(payload) ? payload : payload.capabilities ?? [];
  const model3d = Array.isArray(list)
    ? list.find((item) => item.id === "model3d" || item.name === "model3d" || item.capability === "model3d")
    : list.model3d;
  console.log(JSON.stringify(model3d ?? payload.model3d ?? list, null, 2));
}

const command = process.argv[2];
if (command === "submit") await submit();
else if (command === "status") await refresh();
else if (command === "download") await download();
else if (command === "capabilities") await capabilities();
else if (command === "retry") await retry(process.argv[3], process.argv[4]);
else if (command === "credits") await credits();
else if (command === "reference-submit") await submitReference(process.argv[3]);
else if (command === "reference-status") await refreshReferences();
else if (command === "reference-download") await downloadReferences();
else if (command === "image-model-submit") await submitImageModel(process.argv[3], process.argv[4]);
else if (command === "texture-submit") await submitTexture(process.argv[3]);
else if (command === "texture-status") await refreshTextures();
else if (command === "texture-download") await downloadTextures();
else throw new Error("Usage: node tools/cardinal-rf01-assets.mjs <submit|status|download|capabilities|retry|credits|reference-submit|reference-status|reference-download|image-model-submit|texture-submit|texture-status|texture-download>");
