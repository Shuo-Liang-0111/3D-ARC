import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "public/local-assets/cardinal/rf06/requests");

const COMMON = `Photorealistic game-ready household asset for a contemporary owner-occupied urban Chinese apartment. Correct real-world scale, Y axis up, front facing positive Z, centered at world origin, bottom-center pivot. Clean watertight topology, physically based materials, plausible fasteners and construction, restrained realistic daily wear. One isolated object only. No environment, floor, wall, room, pedestal, character, robot, hands, floating or detached parts, animation, neon glow, outline, arrows, UI, readable text, logo, trademark or baked lighting. Export as GLB for Three.js.`;

const models = [
  {
    id: "sofa",
    targetSizeMeters: [2.35, 0.94, 0.9],
    prompt: `A contemporary three-seat apartment sofa approximately 2.35 meters wide, 0.94 meters high and 0.90 meters deep. Warm off-white woven upholstery with realistic fabric weave, three seat cushions, three loose back cushions, softly rounded padded arms, subtle seams and compression, a rigid internal frame and four short dark wood feet that all share one ground plane. The rear must be complete and the front must face positive Z. ${COMMON}`,
  },
  {
    id: "dining_set",
    targetSizeMeters: [1.9, 0.88, 1.81],
    prompt: `A compact complete dining set for four people within an overall footprint of approximately 1.90 meters wide, 0.88 meters high and 1.81 meters deep. One 1.40 by 0.80 meter rectangular light-oak dining table with slim black powder-coated steel legs, plus four matching upholstered dining chairs arranged naturally around all sides with practical pull-out clearance. Every table and chair leg must end on the exact same ground plane. Keep clear gaps between chairs and table. Front faces positive Z. ${COMMON}`,
  },
  {
    id: "coffee_table",
    targetSizeMeters: [1.16, 0.45, 0.62],
    prompt: `A low contemporary rectangular coffee table approximately 1.16 meters wide, 0.45 meters high and 0.62 meters deep. Thin warm-oak veneer top with a slightly rounded edge, rigid matte charcoal steel frame and four straight legs, mechanically plausible joints and restrained household wear. All four feet must touch one ground plane. Front faces positive Z. ${COMMON}`,
  },
  {
    id: "tv_console",
    targetSizeMeters: [1.85, 0.56, 0.42],
    prompt: `A contemporary low television media console approximately 1.85 meters wide, 0.56 meters high and 0.42 meters deep. Warm medium-oak veneer cabinet, two closed doors, two open equipment bays, discreet dark handles, rear cable openings, slightly recessed plinth and a flat finished back suitable for wall placement. No television, electronics, cables or decor. Front faces positive Z. ${COMMON}`,
  },
  {
    id: "refrigerator",
    targetSizeMeters: [0.82, 1.85, 0.75],
    prompt: `A realistic freestanding apartment refrigerator approximately 0.82 meters wide, 1.85 meters high and 0.75 meters deep. Brushed graphite stainless-steel body, separate upper refrigerator and lower freezer doors, recessed vertical grips, black magnetic gaskets, ventilation gaps, adjustable feet and a finished rear service panel. Doors are closed and the front faces positive Z. No food, branding, labels, display text or magnets. ${COMMON}`,
  },
  {
    id: "washing_machine",
    targetSizeMeters: [0.64, 0.85, 0.66],
    prompt: `A modern ten-kilogram front-loading washing machine approximately 0.64 meters wide, 0.85 meters high and 0.66 meters deep. Matte warm-white enamel body, large circular smoked-glass front door with realistic rubber gasket and metal rim, detergent drawer, tactile control knob, small unlit dark display, rear hose connections and four adjustable feet. Door stays closed, front faces positive Z, and no readable labels or branding. ${COMMON}`,
  },
  {
    id: "shoe_cabinet",
    targetSizeMeters: [1.32, 1.05, 0.35],
    prompt: `A slim apartment entry shoe cabinet approximately 1.32 meters wide, 1.05 meters high and 0.35 meters deep. Warm matte oak veneer, two clean tilt-out front compartments, narrow shadow gaps, discreet dark pulls, low recessed plinth, finished top and flat back for placement against a wall. Doors closed, no shoes or decor, front faces positive Z. ${COMMON}`,
  },
  {
    id: "entry_bench",
    targetSizeMeters: [0.78, 0.46, 0.38],
    prompt: `A compact apartment entry bench approximately 0.78 meters wide, 0.46 meters high and 0.38 meters deep. Solid warm-oak frame with believable joinery, four straight legs and a tailored muted gray removable seat cushion with fabric weave and seams. All feet touch one ground plane. No storage basket, shoes or loose objects. Front faces positive Z. ${COMMON}`,
  },
  {
    id: "utility_cabinet",
    targetSizeMeters: [0.72, 2.1, 0.72],
    prompt: `A tall household utility cabinet approximately 0.72 meters wide, 2.10 meters high and 0.72 meters deep. Moisture-resistant matte warm-gray panels, one full-height closed door, narrow dark handle, concealed hinges, recessed toe kick, subtle edge wear and a flat back for wall placement. No shelves visible, no cleaning products and no readable labels. Front faces positive Z. ${COMMON}`,
  },
  {
    id: "wall_air_conditioner",
    targetSizeMeters: [0.9, 0.29, 0.21],
    mount: "rear-plane",
    prompt: `A realistic indoor wall-mounted split air-conditioner unit approximately 0.90 meters wide, 0.29 meters high and 0.21 meters deep. Warm-white molded polymer shell, gently curved front cover, dark outlet slot with horizontal louvers, small unlit indicator lens, subtle panel seams and a perfectly flat rear mounting plane. Front and air outlet face positive Z. No wall, pipes, cable, bracket, remote control, branding or readable text. ${COMMON}`,
  },
  {
    id: "tool_rack",
    targetSizeMeters: [0.72, 1.5, 0.22],
    prompt: `A narrow freestanding household cleaning-tool rack approximately 0.72 meters wide, 1.50 meters high and 0.22 meters deep. Matte charcoal powder-coated steel frame, stable floor base, flat rear plane, separate empty wrench hook and mop clamp, lower drip tray, realistic screws and rubber feet. It must be empty with all holders clearly open. Front faces positive Z. No tools, bucket, wall, labels, lights or text. ${COMMON}`,
  },
  {
    id: "wrench",
    targetSizeMeters: [0.32, 0.046, 0.119],
    prompt: `One realistic 320 millimeter chrome-vanadium adjustable wrench. Forged steel body, open fixed jaw, movable jaw, knurled adjustment worm, subtle machining marks, slightly satin worn metal and a rounded handle with a clean hanging hole. The wrench lies horizontally with its broad side facing upward, handle extending toward negative Z and jaws toward positive Z. Its lowest metal points share the bottom pivot plane. No case, tool rack or extra tools. ${COMMON}`,
  },
  {
    id: "bucket",
    targetSizeMeters: [0.36, 0.275, 0.334],
    prompt: `One realistic household cleaning bucket approximately 0.36 meters wide, 0.275 meters high and 0.334 meters deep. Desaturated blue injection-molded polypropylene body, oval upper rim, reinforced lower foot ring, thick pivoting dark handle resting naturally against the side, molded grip details, subtle water spots and scuffs. Empty interior with visible wall thickness. The entire base ring touches one ground plane; front faces positive Z. No water, mop, logo or text. ${COMMON}`,
  },
  {
    id: "mop",
    targetSizeMeters: [0.58, 1.35, 0.18],
    prompt: `One upright realistic flat household floor mop approximately 0.58 meters wide across the head, 1.35 meters high and 0.18 meters deep. Slim brushed aluminum handle, dark polymer grip, articulated swivel joint and a broad rectangular microfiber pad with damp fabric fibers. Mop head lies completely flat on the ground plane, centered under the vertical handle; front faces positive Z. No bucket, rack, hand or extra cleaning products. ${COMMON}`,
  },
  {
    id: "shutoff_valve",
    targetSizeMeters: [0.28, 0.225, 0.197],
    mount: "rear-plane",
    prompt: `One compact under-sink household water shutoff valve assembly approximately 0.28 meters wide, 0.225 meters high and 0.197 meters deep. Nickel-plated brass valve body, short inlet and outlet pipe stubs, compression fittings, visible hex nuts, a red quarter-turn butterfly handle and a small flat rear mounting bracket. Pipe connections are clean and self-contained. The operating handle and service side face positive Z. No sink, cabinet, wall, water jet, hose, text or extra plumbing. ${COMMON}`,
  },
];

const textures = [
  {
    id: "living_oak_floor",
    prompt: "A seamless tileable photorealistic engineered oak apartment floor base-color texture, viewed perfectly straight from above with orthographic projection. Warm medium natural oak, narrow 160 millimeter planks, staggered end joints, realistic pores and restrained grain variation, subtle daily foot traffic but clean and maintained, even neutral illumination, no directional shadows, no specular highlights, no perspective, no borders, no furniture, no objects, no text, no logo. Opposite edges must match perfectly for repeated game-material tiling.",
  },
  {
    id: "anti_slip_porcelain_tile",
    prompt: "A seamless tileable photorealistic residential anti-slip porcelain floor tile base-color texture, viewed perfectly straight from above with orthographic projection. Light warm-gray 600 millimeter square tiles, fine mineral speckle, narrow 3 millimeter medium-gray grout, subtle clean household wear, even neutral illumination, no directional shadows, no reflections, no perspective, no borders, no fixtures, no objects, no text, no logo. Opposite edges and grout rhythm must match perfectly for repeated game-material tiling.",
  },
  {
    id: "warm_white_painted_plaster",
    prompt: "A seamless tileable photorealistic warm-white interior painted plaster wall base-color texture, viewed perfectly straight on with orthographic projection. Fine eggshell roller stipple, very subtle low-frequency tonal variation, clean occupied-apartment condition with sparse faint scuffs near the lower area, even neutral illumination, no directional shadows, no corners, no trim, no cracks, no objects, no text, no logo. Opposite edges must match perfectly for repeated game-material tiling.",
  },
];

const modelPayload = (asset) => ({
  prompt: asset.prompt,
  taskType: "text_to_model",
  qualityPreset: "high-highpoly",
  outputFormat: "glb",
  geometryQuality: "detailed",
  enablePbr: true,
  texture: true,
  pivotToCenterBottom: true,
  refineAfterGeneration: false,
});

const texturePayload = (asset) => ({
  prompt: asset.prompt,
  resolution: "2k",
  aspectRatio: "1:1",
  quality: "advanced",
  transparentBackground: false,
});

await fs.mkdir(path.join(OUTPUT, "models"), { recursive: true });
await fs.mkdir(path.join(OUTPUT, "textures"), { recursive: true });
await Promise.all(models.map((asset) => fs.writeFile(
  path.join(OUTPUT, "models", `${asset.id}.json`),
  `${JSON.stringify(modelPayload(asset), null, 2)}\n`,
)));
await Promise.all(textures.map((asset) => fs.writeFile(
  path.join(OUTPUT, "textures", `${asset.id}.json`),
  `${JSON.stringify(texturePayload(asset), null, 2)}\n`,
)));

const index = {
  schemaVersion: 1,
  rfId: "RF-06",
  units: "meters",
  upAxis: "Y",
  frontAxis: "+Z",
  pivot: "bottom-center",
  models: models.map(({ id, targetSizeMeters, mount = "floor" }) => ({
    id,
    requestFile: `models/${id}.json`,
    targetSizeMeters,
    mount,
  })),
  textures: textures.map(({ id }) => ({ id, requestFile: `textures/${id}.json` })),
};
await fs.writeFile(path.join(OUTPUT, "request-index.json"), `${JSON.stringify(index, null, 2)}\n`);
console.log(`Wrote ${models.length} model requests and ${textures.length} texture requests to ${OUTPUT}`);
