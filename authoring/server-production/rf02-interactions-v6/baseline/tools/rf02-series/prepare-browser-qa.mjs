import fs from "node:fs";
import path from "node:path";

const copies = [
  ["public/rf02-series-qa.html", "dist/rf02-series-qa.html"],
  ["public/rf02-performance-qa.html", "dist/rf02-performance-qa.html"],
  ["tools/rf02-series/browser-qa.js", "dist/tools/rf02-series/browser-qa.js"],
  ["tools/rf02-series/route.mjs", "dist/tools/rf02-series/route.js"],
  ...["series-engine.js", "series-layout.js", "furnishings-layout.js", "level.js"].map((name) => ["game/levels/rf02/" + name, "dist/game/levels/rf02/" + name]),
  ...["movement.js", "g1-locomotion.js"].map((name) => ["game/" + name, "dist/game/" + name]),
];
for (const [source, relative] of copies) {
  const target = process.argv[2] ? path.join(process.argv[2], relative.slice(5)) : relative;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const text = fs.readFileSync(source, "utf8").replace('from "./route.mjs"', 'from "./route.js"');
  fs.writeFileSync(target, text);
}
console.log("Browser QA copied into the production build; no hot reload.");
