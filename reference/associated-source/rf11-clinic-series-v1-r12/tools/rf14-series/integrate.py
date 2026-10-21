from pathlib import Path
import json
release="rf12-tennis-series-v1-r7"
def transform(name,s):
 if name=="game/app.js":
  if '"rf14-2": ()' not in s:
   s=s.replace('"rf14",','"rf14", "rf14-2", "rf14-3",',1)
   s=s.replace('  rf14: () => import("/game/levels/rf14/runtime.js"),','  rf14: () => import("/game/levels/rf14/runtime.js"),\n  "rf14-2": () => import("/game/levels/rf14-2/runtime.js"),\n  "rf14-3": () => import("/game/levels/rf14-3/runtime.js"),')
   s=s.replace('  rf14: "收集网球并全部归筐",','  rf14: "收集网球并全部归筐",\n  "rf14-2": "将黄色标准球与橙色训练球分别归筐",\n  "rf14-3": "分类收齐网球，并在下雨时进棚避雨",')
 elif name=="index.html":
  if 'data-level-option="rf14-2"' not in s:
   anchor='<a data-level-option="rf14" href="/?mode=play&amp;level=rf14"><span>RF-12</span><strong>网球场捡球归筐</strong></a>'
   assert anchor in s
   s=s.replace(anchor,anchor+'\n            <a data-level-option="rf14-2" href="/?mode=play&amp;level=rf14-2"><span>RF-12-2</span><strong>网球分类归筐</strong></a>\n            <a data-level-option="rf14-3" href="/?mode=play&amp;level=rf14-3"><span>RF-12-3</span><strong>雨中分类与避雨</strong></a>')
 elif name=="vite.config.js":
  if '"levels/rf14/series-v1"' not in s:s=s.replace('  "levels/rf14/realism-v0.4.8",','  "levels/rf14/realism-v0.4.8",\n  "levels/rf14/series-v1",')
  if 'const stableTennis' not in s:
   anchor='          const requestUrl = new URL(req.url, "http://localhost");'
   assert anchor in s
   s=s.replace(anchor,anchor+'''
          const stableTennis = ["rf14", "rf14-2", "rf14-3"].includes(requestUrl.searchParams.get("level")) && requestUrl.searchParams.get("mode") === "play" && ["/", "/index.html"].includes(requestUrl.pathname);
          if (stableTennis) {
            const release = "rf12-tennis-series-v1-r7", entry = resolve("public", release, "index.htm");
            if (!existsSync(entry)) { res.statusCode = 503; res.end("Tennis release unavailable"); return; }
            res.setHeader("content-type", "text/html; charset=utf-8");
            res.setHeader("cache-control", "no-store");
            res.setHeader("x-arc-release", release);
            res.end(readFileSync(entry, "utf8")); return;
          }''')
  if 'let runtimeAssetOutputDirectory' not in s:
   s=s.replace('export default defineConfig', 'let runtimeAssetOutputDirectory = resolve("dist");\n\nexport default defineConfig',1)
   s=s.replace('      name: "copy-runtime-assets",','      name: "copy-runtime-assets",\n      configResolved(config) {\n        runtimeAssetOutputDirectory = resolve(config.root, config.build.outDir);\n      },',1)
   s=s.replace("resolve('dist/office-scan')", 'resolve(runtimeAssetOutputDirectory, "office-scan")')
   s=s.replace('resolve("dist/local-assets", relativePath)', 'resolve(runtimeAssetOutputDirectory, "local-assets", relativePath)')
   s=s.replace('resolve("dist/vendor/draco")', 'resolve(runtimeAssetOutputDirectory, "vendor/draco")')
   s=s.replace('resolve("dist/agent-kit")', 'resolve(runtimeAssetOutputDirectory, "agent-kit")')
 elif name=="game/levels/rf14/runtime.js":
  s='export * from "./series-base-runtime.js";\n'
 return s
if __name__=="__main__":
 profile=Path("./authoring/server-production/rf12-tennis-series-v1")
 files=["game/app.js","index.html","vite.config.js","game/levels/rf14/runtime.js"]
 before={}
 for name in files:
  p=Path(name);before[name]=p.read_text()
  p.write_text(transform(name,before[name]))
 (profile/"integration-before.json").write_text(json.dumps(before))
 print("Integrated tennis routes and versioned release")
