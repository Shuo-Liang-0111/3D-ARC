import * as THREE from 'three';
import {PHONE_PLACEMENT} from './office-layout.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const mat=(color,roughness=.55,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
export function createOfficePhone(parent){
 const root=new THREE.Group();root.name='office-speakerphone';root.position.set(PHONE_PLACEMENT.x,PHONE_PLACEMENT.y,PHONE_PLACEMENT.z);parent.add(root);
 const shell=mat(0x333a40,.46),rubber=mat(0x20262a,.88),button=mat(0x727b7d,.7);
 const block=(size,p,m,r=.004)=>{const o=new THREE.Mesh(new RoundedBoxGeometry(...size,3,r),m);o.position.set(...p);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;};
 block([.32,.065,.24],[0,.033,0],shell,.009);block([.305,.015,.225],[0,.071,0],rubber,.004);
 for(const x of [-.11,.11])for(const z of [-.075,.075])block([.025,.006,.025],[x,0,z],rubber);
 // Separate handset, earpieces and cradle leave a visible gap over the base.
 block([.05,.04,.18],[-.108,.109,0],shell,.014);
 for(const z of [-.085,.085]){block([.078,.054,.055],[-.108,.108,z],shell,.013);block([.058,.012,.04],[-.108,.077,z],rubber,.006);}
 for(const z of [-.075,.075])block([.045,.012,.025],[-.108,.081,z],button,.003);
 const canvas=document.createElement('canvas');canvas.width=384;canvas.height=192;
 const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const display=new THREE.Mesh(new THREE.PlaneGeometry(.14,.059),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));display.rotation.x=-Math.PI/2;display.position.set(.053,.083,-.069);root.add(display);
 for(let row=0;row<4;row++)for(let col=0;col<3;col++){
  const x=.011+col*.036,z=-.016+row*.028;block([.029,.012,.021],[x,.087,z],button,.004);
  for(let j=0;j<row%3+1;j++)block([.003,.001,.008],[x-.004+j*.004,.0935,z],rubber,.0004);
 }
 const answer=block([.031,.013,.023],[.081,.091,.157],mat(0x447465),.004);
 answer.position.z=.105; // World button at PHONE_POINT, used by the hand animation.
 for(let i=0;i<6;i++)block([.018,.001,.002],[.122,.080,-.024+i*.016],rubber,.0003);
 const wire=[];for(let i=0;i<=300;i++){const t=i/300;wire.push(new THREE.Vector3(-.17+Math.cos(t*Math.PI*36)*.008,.055+Math.sin(t*Math.PI*36)*.008,.09-t*.21));}
 root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wire),300,.002,5,false),rubber));
 const indicator=block([.012,.004,.012],[.130,.084,-.095],new THREE.MeshStandardMaterial({color:0x69a880,emissive:0x2b8e4c,emissiveIntensity:.3}),.003);
 let key='';
 root.userData.sync=(phone,clock)=>{
  const seconds=Math.ceil(phone.remaining),next=phone.status+':'+seconds;
  const ring=phone.status==='ringing';indicator.material.emissiveIntensity=ring?(Math.sin(clock*9)>0?3:.15):.3;
  if(next===key)return;key=next;
  ctx.fillStyle=ring?'#cbe0b1':'#92aca3';ctx.fillRect(0,0,384,192);texture.needsUpdate=true;

 };
 return root;
}
export function createPhoneRinger(){
 let context=null,gain=null,active=false;
 const unlock=()=>{if(context)return;const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;context=new Audio();gain=context.createGain();gain.gain.value=0;gain.connect(context.destination);for(const frequency of [440,480]){const o=context.createOscillator();o.type='sine';o.frequency.value=frequency;o.connect(gain);o.start();}context.resume().catch(()=>{});};
 window.addEventListener('pointerdown',unlock,{once:true});window.addEventListener('keydown',unlock,{once:true});
 window.addEventListener('pagehide',()=>{context?.close();},{once:true});
 return {update(ringing,clock){const on=Boolean(ringing)&&clock%3.4<1.2;if(on===active)return;active=on;if(gain)gain.gain.setTargetAtTime(on?.035:0,context.currentTime,.025);}};
}
