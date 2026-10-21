import * as THREE from "/node_modules/three/build/three.module.js";
import * as runtime from "/game/levels/rf01-3/runtime.js";
import {createRobot,updateRobotAnimation} from "/game/robot.js";
import {createRobotActionState,beginRobotAction,advanceRobotAction,getRobotActionPose,getRobotPresentationState} from "/game/robot-action.js";
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(580,560);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
const world=runtime.createScene(),robot=createRobot(runtime.createCargoModel());world.scene.add(robot);
await Promise.all([world.assetReady,robot.userData.assetReady,robot.userData.rackPayload.userData.assetReady]);
let state=runtime.createInitialState(),action=createRobotActionState();
const camera=new THREE.PerspectiveCamera(45,580/560,.02,80);
const kind=new URLSearchParams(location.search).get("kind")??"battery";
state.player=kind==="battery"?{x:-6.8,z:.1,yaw:Math.PI}:{x:.7,z:-4.4,yaw:Math.PI};
if(kind!=="battery"){state.powered=true;state.battery={location:"slotted",...runtime.LEVEL.powerSlot};state.enteredWorkshop=true;state.lightsOn=true;state.parcels.red.x=.7;}
function step(dt=0,motion="idle",travel=0){
 action=advanceRobotAction(action,dt);
 const pose=getRobotActionPose(action,runtime.isCarrying(state)),visual=getRobotPresentationState(action,state);
 robot.position.set(state.player.x,0,state.player.z);robot.rotation.set(0,state.player.yaw,0);
 updateRobotAnimation(robot,.05,state.elapsed,motion,pose,travel);
 runtime.syncRobotCargo(robot,visual);runtime.syncRobotPose(robot,pose,state,action);runtime.syncVisuals(world,visual,0);
}
function capture(label){
 const p=state.player;camera.position.set(p.x+1.8,1.6,p.z+.55);camera.lookAt(p.x,.75,p.z-.18);renderer.render(world.scene,camera);
 const figure=document.createElement("figure"),img=document.createElement("img"),caption=document.createElement("figcaption");
 img.src=renderer.domElement.toDataURL("image/jpeg",.9);caption.textContent=label;figure.append(img,caption);document.querySelector("main").append(figure);
}
step();capture("开始");
const before=structuredClone(state);state=runtime.interact(state);
action=beginRobotAction(action,state.lastEvent,before,state);
for(const [amount,label] of [[.35,"伸手"],[.35,"接触"],[.35,"抬起"],[.65,"抱持"]]){step(amount);capture(label);}
for(let i=0;i<4;i++){step(0,"moving",i*.18);capture("步态 "+i);}
document.querySelector("#status").textContent=JSON.stringify({event:state.lastEvent,carried:state.carriedItem,battery:state.battery,action});

