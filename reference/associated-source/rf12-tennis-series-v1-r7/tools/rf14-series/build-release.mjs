import { readFileSync,writeFileSync,mkdirSync,existsSync,symlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
const revision=process.argv[2]??"rf12-tennis-series-v1-r7";
if(!/^rf12-tennis-series-v1-r\d+$/.test(revision))throw new Error("Invalid release revision");
const out=resolve("./authoring/server-production/rf12-tennis-series-v1",revision);
if(existsSync(out))throw new Error("Release is immutable: "+out);
let app=readFileSync("game/app.js","utf8").split("//# sourceMappingURL=")[0];
if(!app.includes('"rf14-2": ()'))app=app.replace('"rf14",','"rf14", "rf14-2", "rf14-3",').replace('  rf14: () => import("/game/levels/rf14/runtime.js"),','  rf14: () => import("/game/levels/rf14/runtime.js"),\n  "rf14-2": () => import("/game/levels/rf14-2/runtime.js"),\n  "rf14-3": () => import("/game/levels/rf14-3/runtime.js"),').replace('  rf14: "收集网球并全部归筐",','  rf14: "收集网球并全部归筐",\n  "rf14-2": "将黄色标准球与橙色训练球分别归筐",\n  "rf14-3": "分类收齐网球，并在下雨时进棚避雨",');
app=app.replace('import("/game/levels/rf14/runtime.js")','import("/game/levels/rf14/series-base-runtime.js")');
app=app.replace('["physics", "qa"]','["physics", "qa", "tennisqa", "review"]');
app=app.replaceAll('nextUrl.searchParams.set("level", link.dataset.levelOption);','nextUrl.searchParams.set("level", link.dataset.levelOption);\n    if (!["rf14","rf14-2","rf14-3"].includes(link.dataset.levelOption)) nextUrl.pathname="/";');
writeFileSync("game/tennis-series-entry.js",app);
let html=readFileSync("index.html","utf8").replace("/game/app.js","/game/tennis-series-entry.js");
if(!html.includes('data-level-option="rf14-2"')){
 const anchor='<a data-level-option="rf14" href="/?mode=play&amp;level=rf14"><span>RF-12</span><strong>网球场捡球归筐</strong></a>';
 if(!html.includes(anchor))throw new Error("Missing tennis menu anchor");
 html=html.replace(anchor,anchor+'\n            <a data-level-option="rf14-2" href="/?mode=play&amp;level=rf14-2"><span>RF-12-2</span><strong>网球分类归筐</strong></a>\n            <a data-level-option="rf14-3" href="/?mode=play&amp;level=rf14-3"><span>RF-12-3</span><strong>雨中分类与避雨</strong></a>');
}
writeFileSync("rf12-tennis-candidate.html",html);
const result=spawnSync(process.execPath,["node_modules/vite/bin/vite.js","build","--config","tools/rf14-series/vite.config.mjs"],{stdio:"inherit",env:{...process.env,ARC_TENNIS_RELEASE:revision,ARC_TENNIS_OUTPUT:out}});
if(result.status!==0)process.exit(result.status??1);
writeFileSync(resolve(out,"index.htm"),readFileSync(resolve(out,"rf12-tennis-candidate.html")));
writeFileSync(resolve(out,"release.json"),JSON.stringify({revision,createdAt:new Date().toISOString(),scene:"tennis-series-v1",routes:["rf14","rf14-2","rf14-3"]},null,2));
symlinkSync(out,resolve("public",revision),"dir");
console.log("RELEASE_READY "+out);
