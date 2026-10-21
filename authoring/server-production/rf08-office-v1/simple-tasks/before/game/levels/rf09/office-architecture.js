import * as THREE from 'three';
import {createCarpetMaterial,createPaintedWallMaterial} from './surfaces.js';
const material=(color,roughness=.65,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function cube(root,size,p,m,name=''){const o=new THREE.Mesh(new THREE.BoxGeometry(...size),m);o.position.set(...p);o.name=name;o.castShadow=true;o.receiveShadow=true;root.add(o);return o;}
function repeatedNoise(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),im=ctx.createImageData(128,128);let seed=91;for(let i=0;i<im.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=225+(seed%25);im.data.set([v,v,v,255],i);}ctx.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(43,30);return t;}
export function detailArchitecture(world){
 const root=new THREE.Group();root.name='office-architecture-v1';world.scene.add(root);
 const plaster=createPaintedWallMaterial(18),trim=material(0x354347,.33,.65),lightTrim=material(0xc8cbc5,.55,.15),oak=material(0x947459,.74),glass=new THREE.MeshPhysicalMaterial({color:0xbcd9df,roughness:.12,metalness:.12,transparent:true,opacity:.20,depthWrite:false});
 for(const m of world.fallbackRoot.children){const p=m.geometry?.parameters;if(!p)continue;if(p.width===.3&&p.height===3.3&&p.depth===18)m.visible=false;if(p.width===1.7&&p.height===.12&&p.depth===.72)m.visible=false;if(Math.abs(m.position.z+8.82)<.01)m.visible=false;}
 // Real openings in the side walls, with continuous lower and upper structure.
 for(const side of [-1,1]){
  const x=side*13.1;
  cube(root,[.30,.90,18],[x,.45,0],plaster);
  cube(root,[.30,.55,18],[x,3.025,0],plaster);
  for(const z of [-9,-6,-3,0,3,6,9])cube(root,[.30,1.85,.20],[x,1.825,z],plaster);
  for(const z of [-7.5,-4.5,-1.5,1.5,4.5,7.5]){
   for(const y of [.94,2.71])cube(root,[.16,.07,2.80],[side*12.99,y,z],trim);
   for(const dz of [-1.36,0,1.36])cube(root,[.13,1.78,.05],[side*12.99,1.825,z+dz],trim);
   cube(root,[.04,1.70,2.70],[side*13.03,1.825,z],glass).castShadow=false;
   cube(root,[.42,.055,2.91],[side*12.98,.89,z],lightTrim);
   // Slatted blinds sit above eye height; open views remain transparent.
   for(let j=0;j<5;j++)cube(root,[.18,.018,2.65],[side*12.83,2.59-j*.075,z],lightTrim).castShadow=false;
  }
  cube(root,[.05,.12,17.9],[side*12.925,.06,0],trim);
  // Exterior geometry only, beyond the existing authoritative room bounds.
  for(let j=0;j<5;j++){
   const z=-9+j*4.2,h=3.2+(j%3)*1.2,wall=material(j%2?0x9faeb3:0xbac4c3,.83);
   cube(root,[2.1,h,2.7],[side*(18+(j%2)*2),h/2-.7,z],wall).castShadow=false;
   for(let y=.4;y<h-.5;y+=.7)for(const dz of [-.8,0,.8])cube(root,[.012,.38,.50],[side*(16.94+(j%2)*2),y,z+dz],glass).castShadow=false;
  }
 }
 cube(root,[25.8,.12,.045],[0,.06,-8.93],trim);
 // Glazing joints, rails and frosted safety stripes follow the existing partition.
 for(const sign of [-1,1])for(const x of [2.34,5,8,11,12.93])cube(root,[.035,2.78,.075],[sign*x,1.39,-2.1],trim);
 for(const sign of [-1,1]){
  cube(root,[10.65,.045,.085],[sign*7.65,.025,-2.1],trim);
  cube(root,[10.65,.045,.085],[sign*7.65,2.80,-2.1],trim);
  cube(root,[10.6,.10,.063],[sign*7.65,1.18,-2.1],new THREE.MeshStandardMaterial({color:0xd7e0db,transparent:true,opacity:.4,roughness:.65})).castShadow=false;
 }
 const carpet=createCarpetMaterial();carpet.color.setHex(0x839491);cube(root,[25.85,.008,6.69],[0,.002,-5.57],carpet).castShadow=false;
 cube(root,[4.55,.006,.055],[0,.009,-2.12],trim);
 // Conference feature wall: individually spaced oak battens and acoustic panels.
 cube(root,[11.2,2.68,.08],[0,1.50,-8.86],material(0x303b3c,.95));
 for(let i=0;i<58;i++)cube(root,[.095,2.60,.05],[-5.42+i*.19,1.50,-8.79],oak);
 const screen=cube(root,[3.72,1.38,.07],[0,1.72,-8.69],material(0x18252d,.25,.15));
 const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=576;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#172f38';ctx.fillRect(0,0,1536,576);ctx.fillStyle='#b7c8b3';ctx.fillRect(75,85,8,90);ctx.fillStyle='#eef2e9';ctx.font='600 78px sans-serif';ctx.fillText('季度业务会议',125,150);ctx.fillStyle='#a8bfbc';ctx.font='30px sans-serif';ctx.fillText('QUARTERLY BUSINESS REVIEW',128,211);
 for(let i=0;i<8;i++){ctx.fillStyle=i<5?'#7eaaa4':'#c2b58c';ctx.fillRect(130+i*155,480-(i%4+1)*42,85,(i%4+1)*42);}ctx.strokeStyle='#486168';ctx.beginPath();ctx.moveTo(110,488);ctx.lineTo(1390,488);ctx.stroke();
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const panel=new THREE.Mesh(new THREE.PlaneGeometry(3.56,1.22),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));panel.position.set(0,1.72,-8.65);root.add(panel);
 world.ceiling.clear();
 const tile=material(0xeeefe7,.96);tile.bumpMap=repeatedNoise();tile.bumpScale=.003;
 cube(world.ceiling,[26,.12,18],[0,3.4,0],tile).castShadow=false;
 const lampShell=material(0xd5d8d1,.42,.30),lampFace=new THREE.MeshStandardMaterial({color:0xfffbed,emissive:0xfff7d6,emissiveIntensity:2.5,roughness:.36,toneMapped:false});
 for(const x of [-10,-6,-2,2,6,10])for(const z of [-6.4,0,6.4]){cube(world.ceiling,[1.2,.06,.3],[x,3.26,z],lampShell).castShadow=false;cube(world.ceiling,[1.11,.008,.22],[x,3.225,z],lampFace).castShadow=false;}
 const grid=material(0xc4c8c2,.58,.15),matrix=new THREE.Matrix4();
 const a=new THREE.InstancedMesh(new THREE.BoxGeometry(.012,.008,18),grid,44);for(let i=0;i<44;i++){matrix.makeTranslation(-12.9+i*.6,3.336,0);a.setMatrixAt(i,matrix);}world.ceiling.add(a);
 const b=new THREE.InstancedMesh(new THREE.BoxGeometry(26,.008,.012),grid,31);for(let i=0;i<31;i++){matrix.makeTranslation(0,3.336,-9+i*.6);b.setMatrixAt(i,matrix);}world.ceiling.add(b);
 for(const x of [-7,7])for(const z of [-5.4,3.6]){
  cube(world.ceiling,[.6,.025,.6],[x,3.317,z],lightTrim).castShadow=false;
  for(let j=0;j<8;j++)cube(world.ceiling,[.48,.008,.018],[x,3.300,z-.21+j*.06],trim).castShadow=false;
 }
 world.scene.traverse(o=>{if(o.isHemisphereLight)o.intensity=1.55;if(o.isDirectionalLight){o.position.set(-10,16,-3);o.intensity=2.25;o.shadow.bias=-.00025;o.shadow.normalBias=.025;}});
 const fill=new THREE.HemisphereLight(0xe9f2f6,0x767969,.45);root.add(fill);
 // Power outlets remain flush to the wall, outside walking clearance.
 for(const x of [-8,-3,3,8]){cube(root,[.16,.09,.02],[x,.35,-8.925],lightTrim);for(const dx of [-.035,.035])cube(root,[.013,.025,.006],[x+dx,.35,-8.91],trim);}
 return root;
}
