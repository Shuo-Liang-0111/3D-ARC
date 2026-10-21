import fs from "node:fs";
import crypto from "node:crypto";

const base = "public/local-assets/levels/rf12/";
const rows = {
  environment: ["aigc_8370d0efab9b46618137795496368c8d", "models/source/rf12_environment.highpoly.glb", "models/runtime/rf12_final.glb"],
  tomato: ["aigc_01b7413dd51448c284f558ac88cf97d1", "models/source/tomato_basket.highpoly.glb", "models/runtime/interactables/tomato_basket.glb"],
  tofu: ["aigc_8d3f0e63ca5a4e65a3829ce20b8cc833", "models/source/tofu_container.highpoly.glb", "models/runtime/interactables/tofu_container.glb"],
  oil: ["aigc_53fdf9ffcbc24c3eaa0d2b16cb3e1c86", "models/source/cooking_oil_bottle.highpoly.glb", "models/runtime/interactables/cooking_oil_bottle.glb"],
  pan: ["aigc_7ce0be155966495d9255d319208450f9", "models/source/frying_pan.highpoly.glb", "models/runtime/interactables/frying_pan.glb"],
  stove: ["aigc_e3b4401a7ca74ad5a3627fe5c5b06d5a", "models/source/gas_stove.highpoly.glb", "models/runtime/interactables/gas_stove.glb"],
  hood: ["aigc_3879656b8e344d6d8f27f0555ba036c2", "models/source/range_hood.highpoly.glb", "models/runtime/interactables/range_hood.glb"],
  terminal: ["aigc_d7327abd1a8942178f2b374142fadfbd", "models/source/safety_terminal.highpoly.glb", "models/runtime/interactables/safety_terminal.glb"],
  trivet: ["aigc_d2f7a44dd1bb4db99eb773af72dc6de7", "models/source/heat_trivet.highpoly.glb", "models/runtime/interactables/heat_trivet.glb"],
};
const hash = (path) => crypto.createHash("sha256").update(fs.readFileSync(base + path)).digest("hex");
const generation = Object.fromEntries(Object.entries(rows).map(([name, [taskId, sourceArtifact, runtimeArtifact]]) => [name, {
  taskId, taskType: "text_to_model", qualityPreset: "high-highpoly", sourceArtifact, sourceSha256: hash(sourceArtifact), runtimeArtifact, runtimeSha256: hash(runtimeArtifact), frontAxis: "+Z", pivot: "bottom-center", review: { status: "approved", screenshots: [] },
}]));
for (const file of ["manifest.json", "models/runtime/manifest.json"]) {
  const path = base + file;
  const data = JSON.parse(fs.readFileSync(path, "utf8"));
  data.generation = generation;
  fs.writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}
