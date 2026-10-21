import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, getInteraction, interact, updateMovement, getColliders, isWalkable } from '../game/levels/rf15-1/engine.js';
import { LEVEL } from '../game/levels/rf15-1/level.js';
import { CART, cartStand, cartDocked, cartClear, angleDelta } from '../game/levels/rf15/cart-layout.js';
import { CartAnimation } from '../game/levels/rf15/cart-animation.js';
const grip = () => { let s=createInitialState();s.player=cartStand(s.cart);return interact(s,{animationComplete:true}); };
const drive = (s,input,n=1) => {for(let i=0;i<n;i++)s=updateMovement(s,{cartDrive:true,...input},.05);return s;};

test('gripping and waiting do not drive, even beyond the former automatic timeout',()=>{
  const s=grip(),after=drive(s,{},2500);assert.deepEqual(after.cart,s.cart);assert.deepEqual(after.player,s.player);assert.equal(after.complete,false);
  assert.deepEqual(updateMovement(s,{move:1},.05).cart,s.cart);
});
test('forward, reverse, steering, sideways input and release are player controlled',()=>{
  const s=grip(),f=drive(s,{move:1},10);assert.ok(f.cart.z<s.cart.z);
  const b=drive(f,{move:-1},10);assert.ok(Math.abs(b.cart.z-s.cart.z)<1e-6);
  const t=drive(s,{turn:1},10);assert.ok(t.cart.yaw>s.cart.yaw);assert.deepEqual(t.player,cartStand(t.cart));
  const sideways=drive(s,{strafe:1},10);assert.ok(sideways.cart.x<s.cart.x);
  const released=interact(f,{animationComplete:true});assert.equal(released.cart.gripped,false);assert.equal(released.complete,false);assert.equal(released.lastEvent,'cart_released');
  assert.equal(interact(released,{animationComplete:true}).cart.gripped,true);
});
test('only whole-cart containment with correct heading accepts parking; no snapping',()=>{
  assert.equal(cartDocked({...CART.parking}),true);
  assert.equal(cartDocked({...CART.parking,x:CART.parking.x+.5}),false);
  assert.equal(cartDocked({...CART.parking,yaw:0}),false);
  let s=grip();s.cart={...s.cart,...CART.parking,x:CART.parking.x+.08};s.player=cartStand(s.cart);
  assert.equal(drive(s,{},30).complete,false);
  assert.equal(interact(s).cart.parked,false);
  const done=interact(s,{animationComplete:true});assert.equal(done.complete,true);assert.equal(done.cart.x,s.cart.x);assert.equal(done.lastEvent,'cart_parked');
  assert.deepEqual(interact(done),done);
});
test('manual route reaches the painted bay through actual movement and collision checks',()=>{
  let s=grip();
  // Test-only operator steering. Production has no route or autopilot.
  for(const target of [{x:1.5,z:3.4},{x:-5.65,z:3.4},{x:-5.65,z:-1.3}]){
    for(let i=0;i<1800 && Math.hypot(s.cart.x-target.x,s.cart.z-target.z)>.035;i++){
      const heading=Math.atan2(target.x-s.cart.x,target.z-s.cart.z),error=angleDelta(heading,s.cart.yaw);
      s=drive(s,{turn:Math.max(-1,Math.min(1,error*4)),move:Math.abs(error)<.12?Math.min(1,Math.hypot(s.cart.x-target.x,s.cart.z-target.z)*4):0});
      assert.notEqual(s.lastEvent,'cart_path_blocked');assert.equal(s.failed,false);
      assert.equal(cartClear(s.cart,getColliders(s),LEVEL.bounds),true);assert.equal(isWalkable(s,s.player.x,s.player.z),true);
    }
    assert.ok(Math.hypot(s.cart.x-target.x,s.cart.z-target.z)<.04);
  }
  assert.equal(cartDocked(s.cart),true);assert.equal(s.complete,false);
  s=interact(s,{animationComplete:true});assert.equal(s.complete,true);
});
test('obstructions stop chassis and robot without releasing the handle; backing away works',()=>{
  let s=grip();for(let i=0;i<800 && s.lastEvent!=='cart_path_blocked';i++)s=drive(s,{move:1});
  assert.equal(s.lastEvent,'cart_path_blocked');assert.equal(s.cart.gripped,true);assert.equal(cartClear(s.cart,getColliders(s),LEVEL.bounds),true);
  const b=drive(s,{move:-1},10);assert.ok(b.cart.z>s.cart.z);assert.equal(b.lastEvent,'cart_gripped');
});
test('animation forwards input only during push, stays held while idle, and releases on explicit F',()=>{
  const owner={action:{kind:'cart',phase:'push'},options:{stop(){}},phase(p){this.action.phase=p;}};
  const animation=new CartAnimation(owner);
  assert.deepEqual(animation.motionInput({move:-1,turn:.4}),{move:-1,turn:.4,cartDrive:true});
  animation.release();assert.equal(owner.action.phase,'brake');assert.deepEqual(animation.motionInput({move:1}),{move:0,strafe:0,turn:0});
});

test('reset restores original pose and all variants keep the same shared scene', async()=>{
  const s=createInitialState();assert.deepEqual(s.cart,{...CART.start,travel:0,gripped:false,parked:false});
  for(const id of ['rf15-2','rf15-3']) {
    const engine=await import(`../game/levels/${id}/engine.js`);
    let other=engine.createInitialState();other.cart={...other.cart,...CART.parking,gripped:true};other.player=cartStand(other.cart);
    other=engine.interact(other,{animationComplete:true});assert.equal(other.cart.parked,true);assert.equal(other.complete,false);
  }
});
