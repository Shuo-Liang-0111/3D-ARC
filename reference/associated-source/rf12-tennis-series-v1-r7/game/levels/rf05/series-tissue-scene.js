import * as THREE from "three";
export function makeTissue(){
 const canvas=document.createElement("canvas");canvas.width=canvas.height=256;const ctx=canvas.getContext("2d");
 ctx.fillStyle="#f3f0e6";ctx.fillRect(0,0,256,256);
 // Fine embossed fibres and a soft perimeter, not a rigid white card.
 let seed=47;for(let i=0;i<12000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%256;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%256;ctx.fillStyle=i%2?"#eeeadd":"#faf8f0";ctx.fillRect(x,y,1,2);}
 ctx.strokeStyle="#e7e3d8";for(const margin of [6,9])ctx.strokeRect(margin,margin,256-margin*2,256-margin*2);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 const geometry=new THREE.PlaneGeometry(.24,.24,20,20),position=geometry.attributes.position;
 const base=position.array.slice();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map,color:0xffffff,roughness:1,side:THREE.DoubleSide}));
 mesh.name="FlexibleTissue";mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.base=base;
 return mesh;
}
export function deformTissue(mesh,t){
 const p=mesh.geometry.attributes.position,base=mesh.userData.base,air=["air","falling"].includes(t.location);
 const amplitude=air?.020:t.location==="carried"?.012:.003,time=t.clock??0;
 for(let i=0;i<p.count;i++){const x=base[3*i],z=base[3*i+1],u=x/.12,v=z/.12;
  const fold=.004*Math.sin(u*7)+.002*Math.cos(v*8);
  p.setXYZ(i,x,fold+amplitude*(.6*Math.sin(u*3+time*8)+.4*Math.sin(v*4-time*6))*Math.max(Math.abs(u),Math.abs(v)),z);
 }
 p.needsUpdate=true;mesh.geometry.computeVertexNormals();
}
