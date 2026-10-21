import * as THREE from "three";
import { WETROOM, toolPose } from "./series-leak.js";
const material=(color,roughness=.6,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function mesh(parent,geometry,mat,p,name){const o=new THREE.Mesh(geometry,mat);o.position.set(...p);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function box(p,size,pos,m,name){return mesh(p,new THREE.BoxGeometry(...size),m,pos,name);}
function tube(p,a,b,r,m,name){
 const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),o=mesh(p,new THREE.CylinderGeometry(r,r,v.length(),20),m,new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5).toArray(),name);
 o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;
}
export function setSqueegeePose(root,p){root.position.set(p.x,p.y,p.z);root.rotation.set(0,p.yaw,0);root.rotateX(p.tilt);root.getObjectByName("squeegee-pole").rotation.z=p.roll??0;}
function buildSqueegee(){
 const root=new THREE.Group();root.name="floor-squeegee";
 const alloy=material(0x9aadb2,.3,.78),rubber=material(0x272c2b,.95),blue=material(0x1e5261,.55);
 box(root,[WETROOM.bladeWidth,.018,.012],[0,0,.038],rubber,"continuous-rubber-wiping-edge");
 box(root,[WETROOM.bladeWidth-.018,.045,.07],[0,.033,0],blue,"squeegee-head");
 box(root,[WETROOM.bladeWidth-.06,.012,.018],[0,.06,-.027],alloy,"blade-retaining-strip");
 for(const x of [-.26,-.13,0,.13,.26]){const screw=mesh(root,new THREE.CylinderGeometry(.006,.006,.004,12),alloy,[x,.067,-.027],"blade-fastener");}
 tube(root,[0,.045,0],[0,.135,0],.032,blue,"swivel-socket");
 const pole=new THREE.Group();pole.name="squeegee-pole";root.add(pole);
 tube(pole,[0,.12,0],[0,1.26,0],.0125,alloy,"aluminium-pole");
 for(const y of [.16,.56,.89])tube(pole,[0,y,0],[0,y+.016,0],.016,blue,"pole-collar");
 for(const h of [WETROOM.rightGrip,WETROOM.leftGrip]){
  tube(pole,[0,h-.062,0],[0,h+.062,0],.020,rubber,"rubber-hand-grip");
  for(let i=0;i<6;i++)tube(pole,[0,h-.052+i*.02,0],[0,h-.049+i*.02,0],.0205,blue,"grip-rib");
 }
 tube(pole,[0,1.24,0],[0,1.29,0],.021,rubber,"pole-end-cap");
 return root;
}
function waterTexture(){
 const c=document.createElement("canvas");c.width=c.height=128;const ctx=c.getContext("2d");
 const g=ctx.createRadialGradient(64,64,20,64,64,62);g.addColorStop(0,"white");g.addColorStop(.65,"#dddddd");g.addColorStop(.91,"#888888");g.addColorStop(1,"black");
 ctx.fillStyle="black";ctx.fillRect(0,0,128,128);ctx.fillStyle=g;ctx.beginPath();
 for(let i=0;i<100;i++){const a=i*Math.PI/50,r=58+3*Math.sin(a*5)+2*Math.cos(a*9),x=64+Math.cos(a)*r,y=64+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
 ctx.closePath();ctx.fill();
 const t=new THREE.CanvasTexture(c);return t;
}
export function createLeakScene(world){
 const root=new THREE.Group();root.name="shower-leak-service";world.scene.add(root);
 const chrome=material(0xa4b6bd,.25,.85),red=material(0x9b3827,.6),dark=material(0x23292a,.8);
 const v=WETROOM.valve;
 // A shutoff on the shower supply pipe, with a quarter-turn handle.
 tube(root,[v.x,.35,5.12],[v.x,v.y+.10,5.12],.019,chrome,"shower-supply-pipe");
 tube(root,[v.x,v.y,5.12],[-2.25,v.y,5.12],.019,chrome,"shower-supply-branch");
 const spindle=tube(root,[v.x,v.y,5.12],[v.x,v.y,5.035],.037,chrome,"shower-shutoff-body");
 const lever=new THREE.Group();lever.position.set(v.x,v.y,5.025);root.add(lever);
 box(lever,[.035,.22,.02],[0,.09,0],red,"shower-shutoff-lever");
 for(const y of [.44,.80,1.2])box(root,[.085,.03,.06],[v.x,y,5.13],chrome,"pipe-wall-clamp");
 const d=WETROOM.drain;
 box(root,[.34,.006,.34],[d.x,WETROOM.floorY+.004,d.z],chrome,"drain-frame");
 box(root,[.285,.004,.285],[d.x,WETROOM.floorY+.008,d.z],dark,"drain-open-recess");
 for(let i=0;i<9;i++)box(root,[.277,.008,.013],[d.x,WETROOM.floorY+.013,d.z-.12+i*.03],chrome,"drain-grate-bar");
 const tool=buildSqueegee();world.scene.add(tool);setSqueegeePose(tool,WETROOM.toolHome);
 const t=WETROOM.toolHome;
 box(root,[.12,.045,.075],[-4.015,1.16,t.z],chrome,"squeegee-wall-hook");
 box(root,[.025,.13,.12],[-4.069,1.13,t.z],dark,"squeegee-hook-wall-plate");
 const jet=tube(root,[WETROOM.source.x,WETROOM.source.y,WETROOM.source.z],[WETROOM.impact.x,.055,WETROOM.impact.z],.009,new THREE.MeshBasicMaterial({color:0xb5dce3,transparent:true,opacity:.38}),"leaking-shower-stream");jet.castShadow=false;
 const drops=[];for(let i=0;i<18;i++){const drop=mesh(root,new THREE.SphereGeometry(.013,6,4),new THREE.MeshBasicMaterial({color:0xcce8ee,transparent:true,opacity:.6}),[0,0,0],"falling-shower-droplet");drop.scale.y=2.5;drop.castShadow=false;drops.push(drop);}
 const waterMat=new THREE.MeshStandardMaterial({color:0x769da4,roughness:.15,metalness:.35,transparent:true,opacity:.59,alphaMap:waterTexture(),depthWrite:false,side:THREE.DoubleSide});
 const water=[];for(let i=0;i<10;i++){const puddle=mesh(root,new THREE.PlaneGeometry(1,1),waterMat,[0,WETROOM.floorY+.019+i*.0001,0],"floor-water-"+i);puddle.rotation.x=-Math.PI/2;puddle.castShadow=false;puddle.receiveShadow=false;puddle.renderOrder=3;water.push(puddle);}
 const rings=[];for(let i=0;i<3;i++){const ring=mesh(root,new THREE.RingGeometry(.04,.044,48),new THREE.MeshBasicMaterial({color:0xc6e2e5,transparent:true,opacity:.3,side:THREE.DoubleSide}),[WETROOM.impact.x,WETROOM.floorY+.025,WETROOM.impact.z],"leak-impact-ripple");ring.rotation.x=-Math.PI/2;ring.castShadow=false;rings.push(ring);}
 return {root,tool,lever,jet,drops,water,rings};
}
export function syncLeakScene(world,state){
 const scene=world.leakScene;if(!scene)return;
 const l=state.leak,clock=l.clock;
 scene.lever.rotation.z=l.open?0:Math.PI/2;scene.jet.visible=l.open;
 scene.drops.forEach((drop,i)=>{drop.visible=l.open;const p=(clock*1.5+i/18)%1;
  drop.position.set(THREE.MathUtils.lerp(WETROOM.source.x,WETROOM.impact.x,p)+Math.sin(i*11+clock*2)*.018,THREE.MathUtils.lerp(WETROOM.source.y,.055,p),THREE.MathUtils.lerp(WETROOM.source.z,WETROOM.impact.z,p)+Math.cos(i*7)*.018);
 });
 scene.water.forEach((m,i)=>{const p=l.parcels[i];m.visible=p.amount>.001;m.position.x=p.x;m.position.z=p.z;const r=.25+Math.sqrt(p.amount)*.34;m.scale.set(r*1.32,r,1);});
 scene.rings.forEach((r,i)=>{const phase=(clock*.8+i/3)%1;r.visible=l.open;r.scale.setScalar(1+phase*3);r.material.opacity=(1-phase)*.26;});
 setSqueegeePose(scene.tool,toolPose(state));
}
