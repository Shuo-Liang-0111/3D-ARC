import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOfficeEngine} from '../game/levels/rf09/office-engine.js';
import {IDS,chairStand} from '../game/levels/rf09/office-layout.js';
import {LEVEL as priorLevel} from '../game/levels/rf09/level.js';
import {createInitialState as priorInitial,updateMovement as priorMovement} from '../game/levels/rf09/engine.js';
import {scaleMujocoVelocityForFrontend,projectMujocoDeltaToFrontendInput} from '../game/mujoco-client.js';
import {OfficeAnimation} from '../game/levels/rf09/office-animation.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const station=s=>({...s,player:{x:0,z:3.7,yaw:0}});
function pickup(e,s,id='folder'){
 const p=s.items[id];
 for(let i=0;i<64;i++){
  const yaw=i*Math.PI/32,player={x:p.x-Math.sin(yaw)*.85,z:p.z-Math.cos(yaw)*.85,yaw},n={...s,player};
  if(e.isWalkable(n,player.x,player.z)&&e.getInteraction(n,{type:'pickup',target:id,item:id}))return e.interact(n,{type:'pickup',target:id,item:id});
 }
 throw Error('No reachable pickup station');
}
test('office routes use the same G1 MuJoCo eligibility as preceding levels',()=>{
 const app=readFileSync(new URL('../game/app.js',import.meta.url),'utf8');
 const expr=app.match(/const mujocoEnabled = (.*);/)[1];
 const enabled=new Function('robotId','isCooperativeLevel','isOfficeSeries',`return ${expr}`);
 assert.equal(enabled('g1',false,false),true);
 assert.equal(enabled('g1',false,true),true);
 assert.equal(enabled('g1',true,false),false);
});
test('three office engines preserve preceding movement and reserve behavior',()=>{
 for(const id of IDS){
  const e=createOfficeEngine(id);
  for(const raw of [{move:1},{move:-1},{strafe:1},{turn:1},{move:1,turn:1}]){
   let actual=station(e.createInitialState()),expected=station(priorInitial());
   const input=scaleMujocoVelocityForFrontend({...raw,drain:Boolean(raw.move||raw.strafe)},priorLevel);
   for(let i=0;i<20;i++){actual=e.updateMovement(actual,input,.05);expected=priorMovement(expected,input,.05);}
   near(actual.player.x,expected.player.x);near(actual.player.z,expected.player.z);near(actual.player.yaw,expected.player.yaw);near(actual.progress,expected.progress);
  }
 }
});
test('idle, rotation, non-draining animation frames and passive drift are free; blocked movement still drains',()=>{
 for(const id of IDS){const e=createOfficeEngine(id),s=station(e.createInitialState());
  for(const input of [{},{turn:1},{move:1,drain:false},{move:.01,drain:false,passiveMotion:true}])near(e.updateMovement(s,input,.05).progress,100);
  const wall={...s,player:{x:12.59,z:7.3,yaw:Math.PI/2}};
  const n=e.updateMovement(wall,{move:1},.05);near(n.player.x,wall.player.x);near(n.progress,99.94);
  let wait=s;for(let i=0;i<200;i++)wait=e.updateEnvironment(wait,.1);near(wait.progress,100);
 }
});
test('scripted player push uses shared forward/backward/strafe/yaw limits and drains',()=>{
 const e=createOfficeEngine('rf09-2');let s=e.createInitialState();s.player=chairStand(s.chairs['chair-a']);s=e.interact(s,{type:'grip',chair:'chair-a'});
 const c={options:{runtime:e}};
 for(const input of [{move:1},{move:-1},{strafe:1},{turn:1,drain:false}]){
  const actual=OfficeAnimation.prototype.motionInput.call(c,s,input);
  assert.deepEqual(actual,scaleMujocoVelocityForFrontend(input,e.LEVEL));
 }
 const before=s.progress;s=e.updateMovement(s,OfficeAnimation.prototype.motionInput.call(c,s,{strafe:1}),.05);near(s.progress,before-.06);
});
test('F costs reserve, first task pickup rewards once, and replay cannot farm reward',()=>{
 const e=createOfficeEngine('rf09');let s=station(e.createInitialState());s.progress=60;
 const empty=e.interact(s);near(empty.progress,56);assert.equal(empty.lastEvent,'no_target');
 s=pickup(e,s);near(s.progress,66);assert.equal(s.rewarded['pickup:folder'],true);
 s=e.interact(station(s),{type:'drop',item:'folder'});near(s.progress,62);
 s=pickup(e,s);near(s.progress,58);assert.equal(s.carriedItem,'folder');
 const clone=e.cloneState(s);clone.rewarded.changed=true;assert.equal(s.rewarded.changed,undefined);
 assert.deepEqual(e.createInitialState().rewarded,{});
});
test('depletion fails and freezes movement/interactions; reset restores 100',()=>{
 for(const id of IDS){const e=createOfficeEngine(id);let s=station(e.createInitialState());s.progress=.01;
  const n=e.updateMovement(s,{move:1},.05);assert.equal(n.progress,0);assert.equal(n.failed,true);assert.equal(n.lastEvent,'progress_depleted');
  assert.deepEqual(e.updateMovement(n,{move:1},.05).player,n.player);assert.deepEqual(e.interact(n),n);
  s.progress=2;const f=e.interact(s);assert.equal(f.failed,true);assert.equal(f.progress,0);
  assert.equal(e.createInitialState().progress,100);
 }
});
test('MuJoCo projection charges translation and exempts rotation-only input',()=>{
 const e=createOfficeEngine('rf09'),s=station(e.createInitialState());
 const prev={position:[0,0,0],yaw:0},next={position:[.001,0,.03],yaw:.02};
 const walking=projectMujocoDeltaToFrontendInput(prev,next,e.LEVEL,.05,{move:1});
 const turning=projectMujocoDeltaToFrontendInput(prev,next,e.LEVEL,.05,{turn:1});
 near(e.updateMovement(s,walking,.05).progress,99.94);near(e.updateMovement(s,turning,.05).progress,100);
});
