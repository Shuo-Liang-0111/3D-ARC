import { defineConfig } from "vite";
import { resolve } from "node:path";
const revision=process.env.ARC_TENNIS_RELEASE;
if(!revision||!process.env.ARC_TENNIS_OUTPUT)throw new Error("Use build-release.mjs with a new version");
export default defineConfig({base:"/"+revision+"/",publicDir:false,build:{target:"esnext",outDir:process.env.ARC_TENNIS_OUTPUT,emptyOutDir:false,rollupOptions:{input:resolve("rf12-tennis-candidate.html")}}});
