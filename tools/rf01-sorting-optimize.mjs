import { mkdir, writeFile } from "node:fs/promises";
import { NodeIO } from "../.tooling/gltf-transform/node_modules/@gltf-transform/core/dist/index.js";
import { ALL_EXTENSIONS } from "../.tooling/gltf-transform/node_modules/@gltf-transform/extensions/dist/index.js";
import { simplify, prune, dedup, draco as compress } from "../.tooling/gltf-transform/node_modules/@gltf-transform/functions/dist/index.js";
import draco from "../.tooling/gltf-transform/node_modules/draco3dgltf/draco3dgltf.js";
import { MeshoptSimplifier } from "../.tooling/gltf-transform/node_modules/meshoptimizer/index.js";

const root = "public/local-assets/cardinal/rf03/models/runtime";
const output = root + "/rf01-sorting-v1";
await mkdir(output, { recursive: false });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco.createDecoderModule(), "draco3d.encoder": await draco.createEncoderModule(),
});
function triangles(doc) {
  return doc.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().reduce((count, primitive) =>
    count + (primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION").getCount()) / 3, 0), 0);
}
const assets = [];
for (const name of ["automatic_infeed_machine", "belt_conveyor_module", "dws_scanner_gantry", "route_roll_cage", "corrugated_parcel"]) {
  const document = await io.read(root + "/" + name + ".glb");
  const before = triangles(document);
  const ratio = name === "route_roll_cage" ? .4 : name === "corrugated_parcel" ? .08 : .25;
  await document.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: .001, lockBorder: true }),
    dedup(), prune(), compress());
  await io.write(output + "/" + name + ".glb", document);
  const entry = { name, source: root + "/" + name + ".glb", runtime: output + "/" + name + ".glb",
    ratio, error: .001, lockBorder: true, before, after: triangles(document), textures: "preserved" };
  assets.push(entry);
  console.log(JSON.stringify(entry));
}
await writeFile("./authoring/server-production/rf01-sorting-v1/optimization.json", JSON.stringify(assets, null, 2));
