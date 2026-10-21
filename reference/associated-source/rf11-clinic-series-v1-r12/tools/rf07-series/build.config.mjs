import {defineConfig} from 'vite';import {resolve} from 'node:path';
export default defineConfig({base:'./',publicDir:false,build:{outDir:process.env.ARC_RF07_BUILD_DIR??'./authoring/server-production/rf07-series-v1/release-r2',emptyOutDir:false,target:'esnext',chunkSizeWarningLimit:600,rollupOptions:{input:{game:resolve('index.html')}}}});
