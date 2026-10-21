import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

function parseArgs(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const name = key.slice(2);
    const count = name === "target" ? 3 : 1;
    const entries = values.slice(index + 1, index + 1 + count);
    if (entries.length !== count || entries.some((entry) => entry.startsWith("--"))) {
      throw new Error(`Missing value for ${key}`);
    }
    options[name] = count === 1 ? entries[0] : entries;
    index += count;
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
if (!options.input || !options.output || !options["tool-root"] || !options.target) {
  throw new Error("Usage: node tools/rf03-normalize-cardinal-glb.mjs --input <glb> --output <glb> --tool-root <node_modules> --target <x> <y> <z> [--rotate-y <degrees>]");
}

const targetSize = options.target.map(Number);
const rotationDegrees = Number(options["rotate-y"] ?? 0);
if (targetSize.some((value) => !Number.isFinite(value) || value <= 0) || !Number.isFinite(rotationDegrees)) {
  throw new Error("Target dimensions and rotation must be finite numbers.");
}

const toolRoot = path.resolve(options["tool-root"]);
const coreUrl = pathToFileURL(path.join(toolRoot, "@gltf-transform/core/dist/index.js")).href;
const functionsUrl = pathToFileURL(path.join(toolRoot, "@gltf-transform/functions/dist/index.js")).href;
const [{ NodeIO }, { getBounds }] = await Promise.all([import(coreUrl), import(functionsUrl)]);

const io = new NodeIO();
const document = await io.read(path.resolve(options.input));
const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
if (!scene) throw new Error("GLB does not contain a scene.");

const oriented = document.createNode("RF03_CARDINAL_ORIENTED");
for (const child of [...scene.listChildren()]) {
  scene.removeChild(child);
  oriented.addChild(child);
}
scene.addChild(oriented);

const rotationRadians = rotationDegrees * Math.PI / 180;
oriented.setRotation([0, Math.sin(rotationRadians / 2), 0, Math.cos(rotationRadians / 2)]);

let bounds = getBounds(scene);
oriented.setTranslation([
  -(bounds.min[0] + bounds.max[0]) / 2,
  -bounds.min[1],
  -(bounds.min[2] + bounds.max[2]) / 2,
]);

bounds = getBounds(scene);
const sourceSize = bounds.max.map((value, index) => value - bounds.min[index]);
if (sourceSize.some((value) => !Number.isFinite(value) || value <= 1e-8)) {
  throw new Error(`Invalid source dimensions: ${sourceSize.join(", ")}`);
}

const fitted = document.createNode("RF03_CARDINAL_METER_FITTED");
scene.removeChild(oriented);
fitted.addChild(oriented);
scene.addChild(fitted);
fitted.setScale(targetSize.map((value, index) => value / sourceSize[index]));

const finalBounds = getBounds(scene);
const finalSize = finalBounds.max.map((value, index) => value - finalBounds.min[index]);
await io.write(path.resolve(options.output), document);

console.log(JSON.stringify({
  input: path.resolve(options.input),
  output: path.resolve(options.output),
  rotationDegrees,
  sourceSize,
  targetSize,
  finalBounds,
  finalSize,
}, null, 2));
