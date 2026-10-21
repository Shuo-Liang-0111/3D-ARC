import * as THREE from "/node_modules/three/build/three.module.js";
const release = new URLSearchParams(location.search).get("release");
const manifest = release ? await (await fetch("/"+release+"/.vite/manifest.json")).json() : null;
const runtime = await import(release ? "/"+release+"/"+manifest["game/levels/rf01-3/runtime.js"].file : "/game/levels/rf01-3/runtime.js");
import {createRobot,updateRobotAnimation} from "/game/robot.js";
import {createRobotActionState,getRobotActionPose} from "/game/robot-action.js";
import {SORTING} from "/game/rf01-sorting-layout.js";
const canvas=document.createElement("canvas");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(700,600);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
const world=runtime.createScene(),robot=createRobot(runtime.createCargoModel());
world.scene.add(robot);
await Promise.all([world.assetReady,robot.userData.assetReady,robot.userData.rackPayload.userData.assetReady]);
let state=runtime.createInitialState();
const controller=runtime.createInteractionAnimation(world,robot,{runtime,getState:()=>state,setState:s=>state=s,stop(){},message:m=>document.querySelector("#status").textContent=m});
const camera=new THREE.PerspectiveCamera(45,700/600,.02,80);
let kind=new URLSearchParams(location.search).get("kind")??"battery";
state.player=kind==="battery"?{x:-6.8,z:.75,yaw:Math.PI}:{x:.7,z:-4.35,yaw:Math.PI};
if(kind!=="battery"){state.powered=true;state.battery={location:"slotted",...runtime.LEVEL.powerSlot};state.enteredWorkshop=true;state.lightsOn=true;}
function step(){
 state=runtime.updateMovement(state,controller.busy?controller.motionInput(state):{},.05);state=runtime.updateEnvironment(state,.05);
 robot.position.set(state.player.x,0,state.player.z);robot.rotation.set(0,state.player.yaw,0);
 updateRobotAnimation(robot,.05,state.elapsed,"idle",getRobotActionPose(createRobotActionState(),runtime.isCarrying(state)));
 runtime.syncRobotCargo(robot,state);runtime.syncVisuals(world,state,.05);controller.frame(.05,true);
}
function capture(label){
 const p=state.player;
 camera.position.set(p.x+1.65,1.75,p.z+1.6);
 camera.lookAt(p.x,.85,p.z-.4);renderer.render(world.scene,camera);
 const figure=document.createElement("figure"),img=document.createElement("img"),caption=document.createElement("figcaption");
 img.src=canvas.toDataURL("image/jpeg",.9);caption.textContent=label;figure.append(img,caption);document.querySelector("main").append(figure);
}
step();capture("开始：物体仍在支撑面");controller.interact();
const captured=new Set();
for(let frame=0;frame<620;frame++){
 step();
 const a=controller.action,phase=a?.phase??"idle";
 if((phase==="reach"&&a.time>.8)||(phase==="grip"&&a.time>.1)||(phase==="lift"&&a.time>.8)||phase==="idle"){
  if(!captured.has(phase)){capture(phase);captured.add(phase);}
 }
 if(!controller.busy)break;
 if(frame%10===0)await new Promise(resolve=>setTimeout(resolve,0));
}
document.querySelector("#status").textContent=JSON.stringify(controller.snapshot());
