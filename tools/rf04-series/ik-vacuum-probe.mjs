import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/opt/arc-runtime/browser/chrome/linux-153.0.8010.36/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
try{
const p=await b.newPage();await p.goto('http://127.0.0.1:4173/rf04-ik.html');
console.log(await p.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js');
 const {createRobot,updateRobotAnimation}=await import('/game/robot.js');
 const {createRobotActionState,getRobotActionPose}=await import('/game/robot-action.js');
 const {createLaundryAnimation}=await import('/game/levels/rf04/series-animation.js');
 const {createLaundryEngine}=await import('/game/levels/rf04/series-engine.js');
 const e=createLaundryEngine('rf04-2');let state=e.createInitialState();state.player={x:0,z:0,yaw:0};
 const robot=createRobot(new T.Group(),{robotId:'g1'});await robot.userData.assetReady;
 const world={scene:new T.Scene(),carryTemplates:{}};world.scene.add(robot);
 const c=createLaundryAnimation(world,robot,{runtime:e,getState:()=>state,setState:n=>{state=n;},stop:()=>{},message:()=>{}});
 const out=[];
 for(const y of [.055,.42,.77])for(const crouch of [1]){
  c.reset();robot.position.set(0,0,0);robot.rotation.set(0,0,0);
  updateRobotAnimation(robot,.016,0,'idle',getRobotActionPose(createRobotActionState(),false),0,0);
  const point=new T.Vector3(0,y,y<.16?.48:.60);
  c.action={point,stand:{x:0,z:0,yaw:0},two:false,selected:{type:'clothing'}};
  c.crouch=c.requestedCrouch=crouch;c.bend=c.requestedBend=1;c.posture(0);
  for(const a of Object.values(c.arms))a.capture();c.plan(point,true,true);const error=Math.max(...Object.values(c.arms).map(a=>a.error));
  out.push({y,crouch,error,robotY:robot.position.y});
 }
 return out;
}));
}finally{await b.close();}

