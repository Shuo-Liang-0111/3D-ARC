import fs from "node:fs";
import path from "node:path";

const root = path.resolve("public/local-assets/levels/rf12");
const requestRoot = path.join(root, "requests");
fs.mkdirSync(requestRoot, { recursive: true });

const common = "Photorealistic high-detail game-ready GLB for a normally occupied Chinese urban apartment kitchen. Real-world proportions, physically based materials, restrained daily wear, Y axis up, front facing positive Z, centered bottom-center pivot, one isolated asset only, no robot, person, hands, extra objects, floor slab, wall slab, pedestal, floating parts, readable text, logo, watermark, UI, neon or baked lighting.";
const assets = {
  rf12_environment: {
    targetSizeMeters: [8.4, 2.8, 6.8],
    prompt: `${common} Create the complete roofless interior shell of an open-plan household kitchen: continuous light gray anti-slip porcelain floor tiles, warm-white glazed wall tiles with narrow grout, 2.8 m walls, a 1.9 m clear south entry opening with a sliding glass door frame, a 1.35 m back-wall window opening with frame and sill, L-shaped warm oak base cabinets, upper cabinets, pale quartz worktop, stainless sink cutout and backsplash. Keep the south door and window visibly open and usable. No appliances or loose task props; this is the architectural environment only. Export GLB.`
  },
  range_hood: { targetSizeMeters: [1.8, 0.55, 0.48], prompt: `${common} Create one realistic stainless-steel Chinese household wall-mounted range hood with sloped canopy, grease filter underside, chimney, LED strip, physical buttons, mounting back, seams and subtle fingerprints. Front and intake face +Z, rear mounting plane flat, no wall or cooktop. Export GLB.` },
  gas_knob: { targetSizeMeters: [0.12, 0.12, 0.08], prompt: `${common} Create one small black and brushed-metal gas cooktop control knob with indicator mark, shallow mounting collar and realistic tactile ridges. Front +Z, underside contact plane flat, no stove body. Export GLB.` },
  gas_valve: { targetSizeMeters: [0.28, 0.24, 0.2], prompt: `${common} Create one brass household natural-gas shutoff valve with red quarter-turn handle, threaded pipe connectors and wall-mount plate. Handle face +Z, rear mounting plane flat, no pipe wall or floor. Export GLB.` },
  wet_cloth: { targetSizeMeters: [0.42, 0.04, 0.32], prompt: `${common} Create one folded damp household cleaning cloth, blue-green microfiber with soft wrinkles, stitched edges, slightly darkened wet fibers and realistic cloth thickness. Bottom support surface flat, no hand, basket or countertop. Export GLB.` },
  kitchen_window: { targetSizeMeters: [1.35, 1.25, 0.12], prompt: `${common} Create one realistic Chinese apartment kitchen sliding window module with white aluminum frame, two glass sliding panels, latch, track, handle, rubber seals and shallow sill. Front +Z, rear mounting plane flat, window opening clear, no wall or exterior scene. Export GLB.` },
  safety_terminal: { targetSizeMeters: [0.72, 1.08, 0.45], prompt: `${common} Create one compact freestanding household safety checklist terminal: warm gray pedestal cabinet, angled dark inactive screen, physical confirm button, small status lamp, cable opening and bolted plinth. Screen faces +Z, bottom flat, no readable text or room. Export GLB.` },
  refrigerator: { targetSizeMeters: [0.92, 1.9, 0.68], prompt: `${common} Create one full-height two-door stainless household refrigerator common in a Chinese apartment, with separate freezer and fridge doors, recessed handles, gasket seams, adjustable feet, side panels and subtle brushed metal variation. Front +Z, bottom feet flat, no kitchen or food items. Export GLB.` },
  kitchen_sink: { targetSizeMeters: [0.9, 0.42, 0.68], prompt: `${common} Create one single-bowl stainless kitchen sink with undermount rim, drain, tall curved faucet and two controls, realistic brushed steel and underside mounting lip. Faucet/front +Z, underside contact plane flat, no countertop or wall. Export GLB.` },
};

for (const [id, asset] of Object.entries(assets)) {
  fs.writeFileSync(path.join(requestRoot, `${id}.json`), `${JSON.stringify({ prompt: asset.prompt, taskType: "text_to_model", qualityPreset: "high-highpoly", outputFormat: "glb", geometryQuality: "detailed", enablePbr: true, texture: true, pivotToCenterBottom: true, refineAfterGeneration: false, targetSizeMeters: asset.targetSizeMeters }, null, 2)}\n`);
}
fs.writeFileSync(path.join(requestRoot, "generation-plan.json"), `${JSON.stringify({ schema: "arc-rf12-generation/v1", level: "rf12", provider: "Cardinal", qualityPreset: "high-highpoly", assets: Object.fromEntries(Object.entries(assets).map(([id, asset]) => [id, { request: `requests/${id}.json`, targetSizeMeters: asset.targetSizeMeters, status: "planned" }])) }, null, 2)}\n`);
console.log(JSON.stringify({ level: "rf12", assets: Object.keys(assets), requestRoot }, null, 2));
