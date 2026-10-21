import {build} from "vite";
import {cpSync,mkdirSync,existsSync,writeFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
const revision=process.argv[2]??"rf06-series-v1-r1";
const out="./authoring/server-production/rf06-series-v1/"+revision;
await build({configFile:false,root:process.cwd(),base:"./",publicDir:false,build:{outDir:out,emptyOutDir:false,target:"esnext",chunkSizeWarningLimit:1600,rollupOptions:{input:resolve("index.html")}}});
const paths=["vendor/draco","local-assets/unitree/g1","local-assets/unitree/g1-29dof-dex1-official.glb","local-assets/unitree/unitree-r1-official-mujoco.glb","local-assets/embodiedgen/rf06/models/runtime","local-assets/cardinal/rf06/runtime","local-assets/cardinal/rf04/textures","local-assets/cardinal/rf05/textures/source","local-assets/levels/rf06/series-v1","local-assets/levels/rf06/pest-v2","local-assets/levels/rf06/home-v7","local-assets/levels/rf06/tools-v1"];
for(const p of paths){if(!existsSync(resolve("public",p)))throw Error("Missing "+p);mkdirSync(dirname(resolve(out,p)),{recursive:true});cpSync(resolve("public",p),resolve(out,p),{recursive:true});}
writeFileSync(resolve(out,"revision.json"),JSON.stringify({revision,levels:["rf06","rf06-2","rf06-3"],builtAt:new Date().toISOString()}));
console.log("RELEASE",out);
