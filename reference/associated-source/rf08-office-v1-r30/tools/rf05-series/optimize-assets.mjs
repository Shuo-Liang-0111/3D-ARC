import { createRequire } from "node:module";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const req=createRequire(resolve(".tooling/gltf-transform/package.json"));
const {NodeIO}=await import(req.resolve("@gltf-transform/core"));
const {ALL_EXTENSIONS}=await import(req.resolve("@gltf-transform/extensions"));
const {weld,simplify,draco,getBounds}=await import(req.resolve("@gltf-transform/functions"));
const {MeshoptSimplifier}=await import(req.resolve("meshoptimizer"));
const draco3d=req("draco3dgltf");
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
 "draco3d.decoder":await draco3d.createDecoderModule(),
 "draco3d.encoder":await draco3d.createEncoderModule()
});
await MeshoptSimplifier.ready;
const source=resolve("public/local-assets/cardinal/rf05/models/runtime");
const output=resolve(process.argv[2]);
if(!output.startsWith("./authoring/server-production/rf05-series-"))throw Error("Versioned output required");
await mkdir(output,{recursive:true});
const names=process.argv.slice(3);
const records=[];
const triangles=doc=>doc.getRoot().listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute("POSITION").getCount())/3,0),0);
for(const file of names.length?names:(await readdir(source)).filter(x=>x.endsWith(".glb"))){
 const doc=await io.read(resolve(source,file)),before=triangles(doc),boundsBefore=getBounds(doc.getRoot().listScenes()[0]);
 const target=/drinking_cup|towel|paper_trash/.test(file)?8000:20000;
 await doc.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:target/before,error:.005,lockBorder:false}),draco());
 const after=triangles(doc),boundsAfter=getBounds(doc.getRoot().listScenes()[0]);
 await io.write(resolve(output,file),doc);
 const record={file,before,after,boundsBefore,boundsAfter,textures:doc.getRoot().listTextures().length};
 records.push(record);console.log(JSON.stringify(record));
}
await writeFile(resolve(output,"optimization.json"),JSON.stringify(records,null,2));
