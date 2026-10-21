// Apply this material-only change to the verified release without publishing
// unrelated edits currently present in the shared source workspace.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { LIBRARY_SURFACES } from "../../game/levels/rf02/surface-assets.js";

const [base, output] = process.argv.slice(2);
if (!base || !output || fs.existsSync(output)) throw new Error("Pass existing base and a new output directory");
fs.cpSync(base, output, { recursive: true });
const directory = path.join(output, "assets");
const scripts = new Map(fs.readdirSync(directory).filter(name => name.endsWith(".js")).map(name => [name, fs.readFileSync(path.join(directory, name), "utf8")]));
const targets = [...scripts].filter(([, source]) => source.includes("rf02-static-shell.glb"));
if (targets.length !== 1) throw new Error("Ambiguous library bundle");
const [target, original] = targets[0];
let changed = original.replace("/local-assets/cardinal/rf02/models/runtime/rf02-static-shell.glb", LIBRARY_SURFACES.environment);
const ceilingReferences = [...changed.matchAll(/[A-Za-z_$][\w$]*\+"\/ceiling-fixtures\.glb"/g)];
if (ceilingReferences.length !== 2) throw new Error("Ceiling loader contract changed");
changed = changed.replace(/[A-Za-z_$][\w$]*\+"\/ceiling-fixtures\.glb"/g, JSON.stringify(LIBRARY_SURFACES.ceiling));
scripts.set(target, changed);
const affected = new Set([target]);
for (let expanded = true; expanded;) {
  expanded = false;
  for (const [name, text] of scripts) if (!affected.has(name) && [...affected].some(child => text.includes(child))) {
    affected.add(name); expanded = true;
  }
}
const renames = new Map();
const pending = new Set(affected);
while (pending.size) {
  let progressed = false;
  for (const name of pending) {
    const originalText = scripts.get(name);
    const children = [...affected].filter(child => child !== name && originalText.includes(child));
    if (children.some(child => !renames.has(child))) continue;
    let text = originalText;
    for (const child of children) text = text.replaceAll(child, renames.get(child));
    const hash = createHash("sha256").update(text).digest("hex").slice(0, 12);
    const next = name.replace(/-[^-]+\.js$/, "-rf02v7-" + hash + ".js");
    fs.writeFileSync(path.join(directory, next), text);
    renames.set(name, next); pending.delete(name); progressed = true;
  }
  if (!progressed) throw new Error("Unexpected circular bundle dependency");
}
for (const name of fs.readdirSync(output).filter(name => name.endsWith(".html"))) {
  const file = path.join(output, name);
  let text = fs.readFileSync(file, "utf8");
  for (const [before, after] of renames) text = text.replaceAll(before, after);
  fs.writeFileSync(file, text);
}
for (const url of [LIBRARY_SURFACES.environment, LIBRARY_SURFACES.ceiling]) {
  const destination = path.join(output, url);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync("public" + url, destination);
}
fs.writeFileSync(path.join(output, "surface-release.json"), JSON.stringify({ revision: LIBRARY_SURFACES.revision, base, assets: LIBRARY_SURFACES, renamedBundles: Object.fromEntries(renames), changes: "Only two surface asset URLs; existing gameplay and shared runtime preserved" }, null, 2));
console.log(JSON.stringify({ output, changedBundles: renames.size, revision: LIBRARY_SURFACES.revision }));
