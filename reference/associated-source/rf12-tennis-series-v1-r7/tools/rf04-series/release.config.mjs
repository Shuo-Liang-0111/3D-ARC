import {defineConfig} from "vite";
import {resolve,dirname} from "node:path";
import {cpSync,mkdirSync,existsSync,readFileSync,writeFileSync,readdirSync} from "node:fs";
const release=process.env.RF04_RELEASE||"rf04-series-v1-r6";
const out=resolve("public",release),prefix="/"+release;
const assetPrefix=process.env.RF04_ASSETS_BASE||prefix;
const dirs=["embodiedgen/rf04/models/runtime","cardinal/rf04/models/runtime","cardinal/rf04/textures","levels/rf04/series-v1","levels/rf04/architecture-v3","levels/rf04/architecture-v4","unitree/g1","unitree/unitree-r1-official-mujoco.glb"];
if(existsSync(resolve(out,"release.json")))throw Error("Release already exists; use a new RF04_RELEASE");
export default defineConfig({
 root:process.cwd(),base:prefix+"/",publicDir:false,
 build:{outDir:out,emptyOutDir:false,target:"esnext",chunkSizeWarningLimit:900,rollupOptions:{input:resolve("index.html")}},
 plugins:[{name:"rf04-immutable-assets",closeBundle(){
  for(const dir of dirs){const src=resolve("public/local-assets",dir),dest=resolve(out,"local-assets",dir);if(!existsSync(src))throw Error("Missing required asset: "+src);mkdirSync(dirname(dest),{recursive:true});cpSync(src,dest,{recursive:true});}
  cpSync(resolve("public/vendor/draco"),resolve(out,"vendor/draco"),{recursive:true});
  for(const file of readdirSync(resolve(out,"assets")))if(file.endsWith(".js")){
   const path=resolve(out,"assets",file);let s=readFileSync(path,"utf8");
   s=s.replaceAll('"/local-assets/','"'+assetPrefix+'/local-assets/').replaceAll('"/vendor/draco/','"'+assetPrefix+'/vendor/draco/');
   writeFileSync(path,s);
  }
  const htmlPath=resolve(out,"index.html");let html=readFileSync(htmlPath,"utf8");
  html=html.replace(/<a data-level-option="([^"]+)"[^>]*>[\s\S]*?<\/a>/g,(all,id)=>["rf04","rf04-2","rf04-3"].includes(id)?all:"");
  writeFileSync(htmlPath,html);
  writeFileSync(resolve(out,"release.json"),JSON.stringify({release,scene:"rf04-series-v2",assetPrefix,variants:["rf04","rf04-2","rf04-3"],builtAt:new Date().toISOString()},null,2));
 }}],
});
