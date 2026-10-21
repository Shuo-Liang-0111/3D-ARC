import * as THREE from "three";
import {HOME} from "./home-layout.js";
import {FLOOD,floodReach} from "./flood-field.js";
export function addHomeWater(w){
 const time={value:0},reach={value:0},mat=new THREE.MeshPhysicalMaterial({color:0x426465,transparent:true,opacity:.42,roughness:.09,metalness:0,envMapIntensity:.3,clearcoat:1,depthWrite:false,side:THREE.DoubleSide});
 const {NX,NZ,STEP,MINX,MINZ,distance}=FLOOD;
 const positions=[],travels=[],indices=[];
 for(let z=0;z<NZ;z++)for(let x=0;x<NX;x++){positions.push(MINX+x*STEP,.034,MINZ+z*STEP);travels.push(distance[z*NX+x]);}
 for(let z=0;z<NZ-1;z++)for(let x=0;x<NX-1;x++){const i=z*NX+x;indices.push(i,i+NX,i+1,i+1,i+NX,i+NX+1);}
 const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));g.setAttribute("waterTravel",new THREE.Float32BufferAttribute(travels,1));g.setIndex(indices);g.computeVertexNormals();
 mat.onBeforeCompile=shader=>{
  shader.uniforms.floodReach=reach;shader.uniforms.waterTime=time;
  shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nattribute float waterTravel;varying float travel;varying vec2 waterXY;").replace("#include <begin_vertex>","#include <begin_vertex>\ntravel=waterTravel;waterXY=position.xz;");
  shader.fragmentShader=shader.fragmentShader.replace("#include <common>","#include <common>\nuniform float floodReach;uniform float waterTime;varying float travel;varying vec2 waterXY;").replace("#include <clipping_planes_fragment>","#include <clipping_planes_fragment>\nfloat edge=floodReach-travel+.025*sin(waterXY.x*27.0+waterXY.y*11.0);if(edge<0.0)discard;").replace("#include <normal_fragment_maps>","#include <normal_fragment_maps>\nnormal=normalize(normal+vec3(sin(waterXY.x*22.0+waterTime*2.0),cos(waterXY.y*19.0-waterTime*1.7),0.0)*.018);").replace("#include <opaque_fragment>","diffuseColor.a*=smoothstep(0.0,.10,edge);\n#include <opaque_fragment>");
 };
 w.wet=new THREE.Mesh(g,mat);w.wet.name="Connected floor water";w.scene.add(w.wet);w.wetUniform=reach;
 const liquid=new THREE.MeshPhysicalMaterial({color:0xb6d4d9,transparent:true,opacity:.55,roughness:.08,metalness:.12,clearcoat:1,depthWrite:false,side:THREE.DoubleSide});
 w.sinkWater=new THREE.Mesh(new THREE.PlaneGeometry(.625,.385),liquid);w.sinkWater.rotation.x=-Math.PI/2;w.sinkWater.position.set(HOME.sink.x,.934,HOME.sink.z);w.scene.add(w.sinkWater);
 w.stream=new THREE.Group();w.scene.add(w.stream);
 const jet=new THREE.Mesh(new THREE.CylinderGeometry(.007,.010,.238,12,6,true),liquid);jet.position.set(HOME.faucet.x,1.052,HOME.faucet.z);w.stream.add(jet);
 const glint=new THREE.Mesh(new THREE.CylinderGeometry(.002,.003,.237,8,1,true),new THREE.MeshBasicMaterial({color:0xeaf6f8,transparent:true,opacity:.55,depthWrite:false}));
 glint.position.copy(jet.position);glint.position.x+=.003;w.stream.add(glint);
 const falling=[];for(let i=0;i<10;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.0035,6,4),glint.material);w.stream.add(m);falling.push(m);}
 const beads=[];for(let i=0;i<22;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.007,6,4),liquid);w.stream.add(m);beads.push(m);}
 const overflow=new THREE.Group();w.scene.add(overflow);
 const curtain=liquid.clone();curtain.onBeforeCompile=shader=>{
 shader.uniforms.waterTime=time;shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nuniform float waterTime;").replace("#include <begin_vertex>","#include <begin_vertex>\ntransformed.x+=sin(position.y*80.0+waterTime*22.0)*.002;transformed.z+=sin(position.y*65.0-waterTime*18.0)*.004;");
 };
 const curtainGeometry=new THREE.PlaneGeometry(.13,.91,10,24);const pos=curtainGeometry.attributes.position;
 for(let i=0;i<pos.count;i++){const q=(.455-pos.getY(i))/.91;pos.setX(i,pos.getX(i)*(1-.58*q));pos.setZ(i,-.08*q);}curtainGeometry.computeVertexNormals();
 const mesh=new THREE.Mesh(curtainGeometry,curtain);mesh.position.set(HOME.overflow.x,.481,3.005);overflow.add(mesh);const ribbons=[mesh];
 const lip=new THREE.Mesh(new THREE.PlaneGeometry(.14,.15),liquid);lip.rotation.x=-Math.PI/2;lip.position.set(HOME.overflow.x,.935,3.075);overflow.add(lip);
 const rings=[];for(let i=0;i<4;i++){const m=new THREE.Mesh(new THREE.RingGeometry(.014,.017,32),new THREE.MeshBasicMaterial({color:0xe4f0ed,transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;w.scene.add(m);rings.push(m);}
 w.waterEffects={time,jet,beads,falling,overflow,ribbons,rings};
}
export function syncHomeWater(w,s,dt=0){
 const fx=w.waterEffects;fx.time.value+=Math.min(.1,dt||1/60);const t=fx.time.value,active=!s.valveClosed&&s.water>0,residual=s.residual??0;
 w.wet.visible=s.water>.001;w.wetUniform.value=floodReach(s.water);
 w.stream.visible=active;w.sinkWater.visible=s.water>0||residual>0;
 w.sinkWater.position.y=.934-(active?0:Math.min(.045,(12-residual)*.003));
 fx.overflow.visible=active||residual>0;
 fx.jet.scale.x=1+Math.sin(t*19)*.10;fx.jet.scale.z=1+Math.cos(t*23)*.10;
 fx.falling.forEach((m,i)=>{m.position.set(HOME.faucet.x+.002*Math.sin(i+t*11),1.172-((t*2.5+i*.1)%1)*.237,HOME.faucet.z);m.scale.y=2.5;});
 fx.beads.forEach((m,i)=>{const q=(t*1.8+i*.113)%1,a=i*2.4;m.position.set(HOME.faucet.x+Math.cos(a)*q*.095,.937+Math.sin(q*Math.PI)*.04,HOME.faucet.z+Math.sin(a)*q*.075);m.scale.setScalar((1-q)*.55);});
 const bottom=s.bucketPlaced?.33:.037; // water falls into the basin, below its carrying handle.
 fx.ribbons.forEach((m,i)=>{const length=.934-bottom;m.scale.y=length/.91;m.position.y=(.934+bottom)/2;m.scale.x=(active?1:Math.max(.15,residual/12))*(.72+.22*Math.sin(t*16+i));});
 fx.rings.forEach((m,i)=>{const q=(t*1.7+i*.25)%1;m.visible=active||residual>0;m.position.set(HOME.overflow.x,bottom+.003,2.925);m.scale.setScalar(1+q*10);m.material.opacity=(1-q)*.18;});
}
