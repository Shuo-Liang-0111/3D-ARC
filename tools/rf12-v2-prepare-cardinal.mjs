import fs from "node:fs";
import path from "node:path";

const root = path.resolve("public/local-assets/cardinal/rf12-v2");
const requestRoot = path.join(root, "requests");
const sourceRoot = path.join(root, "models/source");
const runtimeRoot = path.join(root, "models/runtime");
const manifestRoot = path.join(root, "manifests");
for (const directory of [requestRoot, sourceRoot, runtimeRoot, manifestRoot]) fs.mkdirSync(directory, { recursive: true });

const common = "Photorealistic high-detail game-ready GLB for a normally occupied contemporary Chinese urban apartment kitchen. Real-world metric proportions, physically based materials, restrained daily wear such as fingerprints, slight water spots and tiny edge scuffs, never stylized or abandoned. Y axis up, front facing positive Z, centered bottom-center pivot, one isolated asset only, clean watertight topology, no environment, no floor slab, no wall slab, no ceiling, no pedestal unless explicitly part of the object, no person, robot, hands, floating parts, extra props, readable text, fake logo, watermark, UI, neon, outline or baked lighting."
const assets = {
  range_hood: { role: "static", targetSizeMeters: [1.8, 0.55, 0.48], prompt: `${common} One stainless-steel Chinese household wall-mounted range hood with a gently sloped canopy, visible grease-filter underside, short chimney, physical push buttons, narrow unlit LED strip, rear mounting plane and realistic seams. Complete object only, front/intake +Z.` },
  gas_knob: { role: "interactive", targetSizeMeters: [0.12, 0.12, 0.08], prompt: `${common} One small black and brushed-metal gas cooktop control knob with tactile ridges, indicator mark and shallow mounting collar. Underside flat for a countertop, front +Z, no stove body.` },
  gas_valve: { role: "interactive", targetSizeMeters: [0.28, 0.24, 0.20], prompt: `${common} One brass household natural-gas shutoff valve with a red quarter-turn handle, threaded pipe connectors and a compact wall mounting plate. Rear mounting plane flat, handle face +Z, no wall or pipe run.` },
  wet_cloth: { role: "interactive", targetSizeMeters: [0.42, 0.04, 0.32], prompt: `${common} One folded damp household cleaning cloth, blue-green microfiber with soft natural wrinkles, stitched edges, slightly darkened wet fibers and realistic thin cloth thickness. Bottom support face flat, no hand, basket or countertop.` },
  kitchen_window: { role: "interactive", targetSizeMeters: [1.35, 1.25, 0.12], prompt: `${common} One realistic Chinese apartment kitchen sliding window module with white powder-coated aluminum frame, two glass sliding panels, track, latch, handle, rubber seals and shallow sill. Front +Z, rear mounting plane flat, opening clear, no wall or exterior scenery.` },
  safety_terminal: { role: "interactive", targetSizeMeters: [0.72, 1.08, 0.45], prompt: `${common} One compact freestanding household safety checklist terminal: warm-gray pedestal cabinet, angled dark inactive screen, physical confirm button, small unlit status lamp, cable opening and bolted plinth. Screen faces +Z, bottom flat, no readable text.` },
  refrigerator: { role: "static", targetSizeMeters: [0.92, 1.90, 0.68], prompt: `${common} One full-height two-door stainless household refrigerator typical of a Chinese apartment, separate freezer and fridge doors, recessed vertical handles, gasket seams, adjustable feet, side panels and subtle brushed-metal variation. Front +Z, bottom feet flat, no food or kitchen.` },
  kitchen_sink: { role: "static", targetSizeMeters: [0.90, 0.42, 0.68], prompt: `${common} One single-bowl stainless kitchen sink with undermount rim, drain, tall curved faucet and two controls, realistic brushed steel and underside mounting lip. Faucet/front +Z, underside contact plane flat, no countertop or wall.` },
  stove_module: { role: "static", targetSizeMeters: [0.90, 0.12, 0.65], prompt: `${common} One built-in two-burner gas cooktop surface module, black tempered glass, two realistic burner caps and grates, four tactile control knobs, subtle reflections and a thin countertop mounting lip. Bottom flat, front +Z, no cabinet, hood or room.` },
  kitchen_door_handle: { role: "static", targetSizeMeters: [0.08, 0.60, 0.06], prompt: `${common} One brushed stainless vertical sliding kitchen-door pull handle with two realistic mounting rosettes and short standoffs. Long axis vertical, front +Z, complete isolated hardware only, no door slab or wall.` },
};

const manifest = {
  schema: "arc-rf12-cardinal/v2",
  level: "rf12",
  provider: "Cardinal",
  qualityPreset: "high-highpoly",
  operation: "cardinal_model3d_text",
  environment: { visual: "/local-assets/cardinal/rf12-v2/models/runtime/kitchen_environment.glb", collision: "/local-assets/cardinal/rf12-v2/models/runtime/kitchen_collision.glb", source: "procedural-metric-environment-with-cardinal-materials" },
  assets: {},
};
for (const [id, asset] of Object.entries(assets)) {
  const request = { prompt: asset.prompt, taskType: "text_to_model", qualityPreset: "high-highpoly", outputFormat: "glb", geometryQuality: "detailed", enablePbr: true, texture: true, pivotToCenterBottom: true, refineAfterGeneration: false, targetSizeMeters: asset.targetSizeMeters };
  fs.writeFileSync(path.join(requestRoot, `${id}.json`), `${JSON.stringify(request, null, 2)}\n`);
  manifest.assets[id] = { id, role: asset.role, requestFile: `requests/${id}.json`, targetSizeMeters: asset.targetSizeMeters, frontAxis: "+Z", pivot: "bottom-center", sourceArtifact: `models/source/${id}.highpoly.glb`, runtimeArtifact: `models/runtime/${id}.glb`, status: "planned" };
}
fs.writeFileSync(path.join(requestRoot, "generation-plan.json"), `${JSON.stringify({ ...manifest, requestRoot: "requests" }, null, 2)}\n`);
fs.writeFileSync(path.join(manifestRoot, "generation.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ level: "rf12", version: "v2", assets: Object.keys(assets), requestRoot, manifest: path.join(manifestRoot, "generation.json") }, null, 2));
