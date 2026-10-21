import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { InteractionAnimation } from '../game/levels/rf15/interaction-animation.js';
import { InteractionWalk, approachPath } from '../game/levels/rf15/interaction-walk.js';
import { CartAnimation } from '../game/levels/rf15/cart-animation.js';
import { cartStand } from '../game/levels/rf15/cart-layout.js';
import { createVariantEngine } from '../game/levels/rf15/variant-engine.js';
import { LEVEL as harvestLevel } from '../game/levels/rf15-2/level.js';
import { LEVEL as cartLevel } from '../game/levels/rf15-1/level.js';
import { FIELD } from '../game/levels/rf15/field-layout.js';

for(const level of [harvestLevel,cartLevel]){
  const runtime={...createVariantEngine(level),LEVEL:level};
  function controller(state){
    const animation=Object.create(InteractionAnimation.prototype),messages=[];
    animation.action=null;
    animation.hands={left:{held:state.carriedCrop},right:{held:state.heldTool}};
    animation.objects=new Map(Object.values(state.crops).map(crop=>[crop.id,{position:new THREE.Vector3(crop.x,crop.y,crop.z),rotation:new THREE.Quaternion(),grasp:new THREE.Vector3(0,.16,0)}]));
    animation.options={getState:()=>state,setState:next=>Object.assign(state,next),runtime,message:value=>messages.push(value),stop(){}};
    animation.walk=new InteractionWalk(animation);animation.cartAnimation=new CartAnimation(animation);
    return {animation,messages};
  }
  function align(animation,state){
    let moved=0,turned=0;
    for(let frame=0;frame<1600&&!animation.walk.ready;frame++){
      const before={...state.player},input=animation.motionInput(state,{move:1,strafe:1,turn:1});
      assert.equal(input.strafe,0);
      assert.ok(!(input.move&&input.turn));
      Object.assign(state,runtime.updateMovement(state,input,.025));
      assert.equal(runtime.isWalkable(state,state.player.x,state.player.z),true);
      moved+=Math.hypot(state.player.x-before.x,state.player.z-before.z);
      turned+=Math.abs(state.player.yaw-before.yaw);
      assert.ok(Math.hypot(state.player.x-before.x,state.player.z-before.z)<=.011);
      animation.walk.update(.025);
    }
    assert.equal(animation.walk.ready,true);return {moved,turned};
  }
  test(level.id+' accepts nearby harvest with wrong heading, walks without strafing and settles before reaching',()=>{
    const state=runtime.createInitialState(),crop=Object.values(state.crops)[0];
    state.heldTool='harvest-knife';state.player={x:crop.x-1.1,z:crop.z+.25,yaw:-Math.PI/2};
    const {animation,messages}=controller(state),initial={...state.player};
    animation.interact();assert.equal(animation.action.kind,'harvest');assert.deepEqual(state.player,initial);assert.equal(messages.length,0);
    const movement=align(animation,state);
    assert.ok(movement.moved>.4);assert.ok(movement.turned>2);
    assert.ok(Math.hypot(state.player.x-animation.action.stand.x,state.player.z-animation.action.stand.z)<.025);
    const settled={...state.player};
    for(const phase of ['prepare','approach','reach','cut','lift','stand','settle']){
      animation.action.phase=phase;
      Object.assign(state,runtime.updateMovement(state,animation.motionInput(state,{move:1,turn:1}),.05));
      assert.deepEqual(state.player,settled);
    }
  });
  test(level.id+' cart accepts offset approach but never begins automatic cart travel',()=>{
    const state=runtime.createInitialState(),stand=cartStand(state.cart);
    state.player={...stand,x:stand.x-.7,z:stand.z+.4,yaw:0};
    const {animation}=controller(state);animation.interact();
    assert.equal(animation.action.kind,'cart');align(animation,state);
    const next=runtime.interact(state,{animationComplete:true});
    assert.equal(next.cart.gripped,true);assert.equal(next.cart.travel,0);
    for(let frame=0;frame<250;frame++)Object.assign(next,runtime.updateMovement(next,{cartDrive:true},.05));
    assert.equal(next.cart.travel,0);
    const pushed=runtime.updateMovement(next,{cartDrive:true,move:1},.05);assert.ok(pushed.cart.travel>0);
  });
  test(level.id+' deposits remain approachable from normal basket range',()=>{
    const state=runtime.createInitialState(),crop=Object.values(state.crops)[0];
    state.carriedCrop=crop.id;state.crops[crop.id].location='carried';state.heldTool='harvest-knife';
    state.player={x:FIELD.basket.x-1.15,z:FIELD.basket.z+.3,yaw:0};
    const {animation}=controller(state);animation.interact();
    assert.equal(animation.action.kind,'place');align(animation,state);
  });
}
test('local approach detours around obstacles but does not cross a sealed wall',()=>{
  const runtime={isWalkable:(_state,x,z)=>!(x>.3&&x<.7&&Math.abs(z)<.35)};
  const state={player:{x:0,z:0,yaw:0}},goal={x:1,z:0};
  const path=approachPath(state,goal,runtime);assert.ok(path.length>1);
  const sealed={isWalkable:(_state,x)=>!(x>.3&&x<.7)};
  assert.equal(approachPath(state,goal,sealed),null);
  assert.equal(approachPath(state,{x:10,z:0},runtime),null);
});
test('pause does not advance settling and reset clears navigation',()=>{
  const state={player:{x:0,z:0,yaw:0}};
  const owner={options:{getState:()=>state,runtime:{isWalkable:()=>true,LEVEL:{moveSpeed:1.4}},message(){}},cancel(){}};
  const walk=new InteractionWalk(owner);assert.equal(walk.begin({x:0,z:0},0),true);
  walk.input(state);walk.update(0);assert.equal(walk.ready,false);
  walk.update(.46);assert.equal(walk.ready,true);
  walk.swingStart=new THREE.Vector3(-10,0,-10);
  walk.reset();assert.equal(walk.route,null);assert.equal(walk.ready,false);assert.equal(walk.swingStart,null);
  state.player={x:12,z:3,yaw:Math.PI};
  walk.begin({x:12,z:4},0);assert.equal(walk.swingStart,null);assert.deepEqual(walk.visualPrevious,state.player);
});
