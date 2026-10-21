
import {createRequire} from 'node:module';
import {writeFileSync,readFileSync} from 'node:fs';
const base='.';
const req=createRequire(base+'/.tooling/gltf-transform/package.json');
const {NodeIO}=await import(req.resolve('@gltf-transform/core'));
const {ALL_EXTENSIONS}=await import(req.resolve('@gltf-transform/extensions'));
const THREE=await import(base+'/node_modules/three/build/three.module.js');
const draco=req('draco3dgltf');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco.createDecoderModule()});
for(const file of ['twin_bed','desk_chair']){
const doc=await io.read(base+'/public/local-assets/cardinal/rf05/models/series-v02-opt2/'+file+'.glb');
const group=new THREE.Group(),pts=[];
for(const n of doc.getRoot().listNodes())if(n.getMesh())for(const p of n.getMesh().listPrimitives()){
 const pos=p.getAttribute('POSITION'),a=pos.getArray(),g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(a,3));if(p.getIndices())g.setIndex(new THREE.BufferAttribute(p.getIndices().getArray(),1));
 const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 m.applyMatrix4(new THREE.Matrix4().fromArray(n.getWorldMatrix()));group.add(m);
 for(let i=0;i<a.length;i+=3)pts.push(new THREE.Vector3(a[i],a[i+1],a[i+2]).applyMatrix4(m.matrix).toArray());
}
group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(group);
console.log(file,JSON.stringify({min:bounds.min.toArray(),max:bounds.max.toArray()}));
const ray=new THREE.Raycaster();
if(file==='twin_bed'||file==='bedside_table'){
 for(const z of (file==='twin_bed'?[.7,.8,.9,1.0,1.1]:[-.15,0,.15])){
 const samples=[];for(const x of [-.2,0,.2]){ray.set(new THREE.Vector3(x,2,z),new THREE.Vector3(0,-1,0));samples.push([x,ray.intersectObject(group,true).slice(0,2).map(h=>+h.point.y.toFixed(4))]);}
 console.log('surface',z,JSON.stringify(samples));
 }}
if(file==='desk_chair'||file==='toilet'){
 for(const y of [.4,.6,.75,.8,.84,.88]){
 const q=pts.filter(p=>Math.abs(p[1]-y)<.025);
 console.log('slice',y,JSON.stringify(q.length?{x:[Math.min(...q.map(p=>p[0])),Math.max(...q.map(p=>p[0]))],z:[Math.min(...q.map(p=>p[2])),Math.max(...q.map(p=>p[2]))]}:{}));
 }
 if(file==='desk_chair'){group.rotation.y=-Math.PI/2;group.updateMatrixWorld(true);}if(file==='desk_chair')for(const x of [-.19,0,.19])for(const y of [.76,.8,.84]){ray.set(new THREE.Vector3(x,y,-1),new THREE.Vector3(0,0,1));console.log('back',x,y,ray.intersectObject(group,true).slice(0,2).map(h=>+h.point.z.toFixed(4)));}
}
}
