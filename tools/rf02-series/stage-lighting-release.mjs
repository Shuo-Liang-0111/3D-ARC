// Apply this lighting-only change to the verified release without publishing
// unrelated edits currently present in the shared source workspace.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { LIBRARY_LAMP_ASSET, LIBRARY_LAMP_PLACEMENTS, activateLibraryFixtureLights } from "../../game/levels/rf02/lighting.js";

const [base, output] = process.argv.slice(2);
if (!base || !output || fs.existsSync(output)) throw new Error("Pass existing base and a new output directory");
fs.cpSync(base, output, { recursive: true });
const directory = path.join(output, "assets");
const scripts = new Map(fs.readdirSync(directory).filter(name => name.endsWith(".js")).map(name => [name, fs.readFileSync(path.join(directory, name), "utf8")]));
const previous = JSON.parse(fs.readFileSync(path.join(base, "surface-release.json"), "utf8"));
const target = previous.renamedBundles["furniture-controller-BEJJxVjM.js"];
let changed = scripts.get(target);
if (!changed) throw new Error("Verified v7 library bundle missing");
function replaceOnce(before, after) {
  if (changed.split(before).length !== 2) throw new Error("Unexpected compiled lighting contract: " + before);
  changed = changed.replace(before, after);
}
replaceOnce('suspendedLinearLight:b("/local-assets/cardinal/rf02/models/runtime/suspended-linear-light.glb")', 'suspendedLinearLight:' + JSON.stringify(LIBRARY_LAMP_ASSET));
replaceOnce('for(const[c,f]of[[-7,-3],[0,-3],[7,-3],[-7,3],[0,3],[7,3]]){const g=new ht(16773845,.65,8,1.8);g.position.set(c,3.2,f),e.add(g)}', '');
replaceOnce('l>0&&t.add(r),r.updateMatrixWorld(!0)', 'l>0&&t.add(r),activateLibraryFixtureLights(r),r.updateMatrixWorld(!0)');
replaceOnce('const i=[-9,-3,3,9].flatMap(o=>[-4.8,.2,5.2].map(a=>[o,3.24,a,0]));z(t,s,i)', 'z(t,s,' + JSON.stringify(LIBRARY_LAMP_PLACEMENTS) + ')');
changed += "\n" + activateLibraryFixtureLights.toString() + "\n";
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
    const next = name.replace(/-[^-]+\.js$/, "-rf02v8-" + hash + ".js");
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
for (const url of [LIBRARY_LAMP_ASSET]) {
  const destination = path.join(output, url);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync("public" + url, destination);
}
fs.writeFileSync(path.join(output, "lighting-release.json"), JSON.stringify({ revision: "library-lighting-v8", base, lamp: LIBRARY_LAMP_ASSET, placements: LIBRARY_LAMP_PLACEMENTS, renamedBundles: Object.fromEntries(renames), changes: "Emissive fixture diffuser and downward GLTF lights replace six floating point lights; all other live code preserved" }, null, 2));
console.log(JSON.stringify({ output, changedBundles: renames.size, revision: "library-lighting-v8" }));
