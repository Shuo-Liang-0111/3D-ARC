import { build } from "vite";
import { resolve } from "node:path";
import { mkdirSync, cpSync, existsSync } from "node:fs";
const outDir=process.argv[2];
if(!outDir||!outDir.startsWith("./authoring/server-production/rf05-series-"))throw Error("Use an isolated RF05 production output directory");
await build({configFile:false,root:process.cwd(),base:"./",publicDir:false,
 plugins:[{name:"rf05-isolated-release",transform(code,id){
  if(!id.endsWith("/game/app.js"))return null;
  return code.replace(/const runtimeLoaders = \{[\s\S]*?\n\};/, 'const runtimeLoaders = {\n rf05: () => import("/game/levels/rf05/series-entry.js"),\n "rf05-2": () => import("/game/levels/rf05-2/runtime.js"),\n "rf05-3": () => import("/game/levels/rf05-3/runtime.js"),\n};').replace(/const levelId = \[[^\n]+/, 'const levelId = ["rf05", "rf05-2", "rf05-3"].includes(requestedLevel) ? requestedLevel : "rf05";');
 },transformIndexHtml(html){return html.replace(/<a data-level-option="([^"]+)"[^>]*>[\s\S]*?<\/a>/g,(match,id)=>["rf05","rf05-2","rf05-3"].includes(id)?match:"");}}],
 build:{outDir,emptyOutDir:false,target:"esnext",chunkSizeWarningLimit:600,rollupOptions:{input:resolve("index.html")}}});
for(const path of ["local-assets/cardinal/rf05/models/runtime","local-assets/cardinal/rf05/models/series-v02-opt2","local-assets/cardinal/rf05/textures/source","local-assets/unitree/g1","local-assets/unitree/g1-29dof-dex1-official.glb","vendor"]){
 const source=resolve("public",path);if(existsSync(source)){const target=resolve(outDir,path);mkdirSync(resolve(target,".."),{recursive:true});cpSync(source,target,{recursive:true});}
}
console.log("RF05 isolated production build:",outDir);
