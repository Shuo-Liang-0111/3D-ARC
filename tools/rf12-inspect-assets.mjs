import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });
for (const id of ["refrigerator", "kitchen_sink", "range_hood", "stove_module", "safety_terminal"]) {
  const document = await io.read(`public/local-assets/cardinal/rf12-v2/models/runtime/${id}.glb`);
  const scene = document.getRoot().listScenes()[0];
  console.log(JSON.stringify({ id, bounds: getBounds(scene), nodes: document.getRoot().listNodes().map((node) => ({ name: node.getName(), scale: node.getScale(), rotation: node.getRotation() })) }));
}
