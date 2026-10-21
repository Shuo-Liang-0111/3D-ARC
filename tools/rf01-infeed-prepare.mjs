import { mkdir, writeFile } from "node:fs/promises";
import { NodeIO } from "../.tooling/gltf-transform/node_modules/@gltf-transform/core/dist/index.js";
import { ALL_EXTENSIONS } from "../.tooling/gltf-transform/node_modules/@gltf-transform/extensions/dist/index.js";
import { getBounds, simplify, prune, dedup, draco as compress } from "../.tooling/gltf-transform/node_modules/@gltf-transform/functions/dist/index.js";
import draco from "../.tooling/gltf-transform/node_modules/draco3dgltf/draco3dgltf.js";
import { MeshoptSimplifier } from "../.tooling/gltf-transform/node_modules/meshoptimizer/index.js";

const source = "./authoring/server-production/rf01-sorting-v4/source/compact-infeed.glb";
const output = "public/local-assets/cardinal/rf01/models/runtime/sorting-v4";
await mkdir(output, { recursive: false });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco.createDecoderModule(), "draco3d.encoder": await draco.createEncoderModule(),
});
const document = await io.read(source);
const scene = document.getRoot().getDefaultScene();
const bounds = getBounds(scene);
const scale = 1.6 / (bounds.max[0] - bounds.min[0]);
const root = document.createNode("compact-parcel-infeed");
for (const node of [...scene.listChildren()]) { scene.removeChild(node); root.addChild(node); }
root.setScale([scale, scale, scale]);
root.setTranslation([-(bounds.min[0] + bounds.max[0]) / 2 * scale, -bounds.min[1] * scale, -(bounds.min[2] + bounds.max[2]) / 2 * scale]);
scene.addChild(root);
await document.transform(simplify({ simplifier: MeshoptSimplifier, ratio: .5, error: .001, lockBorder: true }), dedup(), prune(), compress());
await io.write(output + "/compact-infeed.glb", document);
const report = { source, output, scale, bounds: getBounds(scene), textures: document.getRoot().listTextures().length };
await writeFile("./authoring/server-production/rf01-sorting-v4/infeed-normalization.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
