import * as THREE from 'three';
import { CART, CART_REVISION, cartStand } from './cart-layout.js';
const smooth = t => THREE.MathUtils.smoothstep(t, 0, 1);
const up = new THREE.Vector3(0, 1, 0);

export class CartAnimation {
  constructor(owner) { this.owner = owner; this.step = 0; this.walkBlend = 0; this.previousTravel = 0; }
  start(selected) {
    const a = this.owner, state = a.options.getState();
    if (Object.values(a.hands).some(h => h.held)) { a.options.message('请先放回手中物品'); return true; }
    const stand = cartStand(state.cart);
    if (!a.options.runtime.isWalkable(state, stand.x, stand.z)) { a.options.message('车把后方没有足够空间'); return true; }
    if (!a.walk.begin(stand, stand.yaw)) return true;
    a.action = {id: 'pallet-jack', kind: 'cart', selected, stand: new THREE.Vector3(stand.x, 0, stand.z), yaw: stand.yaw, phase: 'align', phaseTime: 0, elapsed: 0};
    a.lastResult = null; a.options.stop(); this.previousTravel = state.cart.travel;
    return true;
  }
  targets() {
    const cart = this.owner.options.getState().cart;
    const rotation = new THREE.Quaternion().setFromAxisAngle(up, cart.yaw);
    return Object.fromEntries(['left', 'right'].map(side => [side, new THREE.Vector3(side === 'left' ? CART.handle.halfWidth : -CART.handle.halfWidth, CART.handle.y, CART.handle.z).applyQuaternion(rotation).add(new THREE.Vector3(cart.x,0,cart.z))]));
  }
  motionInput(input = {}) {
    return this.owner.action.phase === 'push' ? { ...input, cartDrive: true } : {move:0, strafe:0, turn:0};
  }
  release() {
    if (this.owner.action?.phase === 'push') { this.owner.options.stop(); this.owner.phase('brake'); }
    return true;
  }
  animate(dt) {
    const a=this.owner, action=a.action, state=a.options.getState();
    action.elapsed+=dt; action.phaseTime+=dt;
    if (action.phase !== 'push' && action.phaseTime > (action.phase === 'align' ? 30 : 15)) { a.options.message('扶把动作受阻，请调整位置后重试'); a.cancel(); return; }
    if (action.phase === 'push' && state.lastEvent === 'cart_path_blocked' && !action.blocked) a.options.message('前方受阻，请后退或转向调整');
    action.blocked = state.lastEvent === 'cart_path_blocked';
    const targets=this.targets();
    if (action.phase==='align') {
      if (!a.walk.ready) return;
      action.starts={};
      for(const side of ['left','right']) { a.arms[side].capture(); action.starts[side]=a.arms[side].graspPose().position; a.hands[side].setGrip(false); a.arms[side].plan(targets[side],null); }
      a.phase('reach-cart');
    } else if(action.phase==='reach-cart') {
      for(const side of ['left','right']) a.arms[side].solve(action.starts[side].clone().lerp(targets[side],smooth(action.phaseTime/1.4)),null,12);
      if(action.phaseTime>1.4 && ['left','right'].every(side=>a.arms[side].graspPose().position.distanceTo(targets[side])<.045)) {
        for(const hand of Object.values(a.hands)) hand.setGrip(true);
        a.phase('grip-cart');
      }
    } else if(action.phase==='grip-cart') {
      if(action.phaseTime<.5) return;
      if(!state.cart.gripped) {
        const next=a.options.runtime.interact(state,{animationComplete:true}); a.options.setState(next);
        if(next.errors>state.errors||next.failed) { a.cancel(); return; }
      }
      a.phase('push');
      a.options.message('W/S 前后推行 · A/D 横移 · Q/E 转向 · F 松手');
    } else if(action.phase==='push') {
      for(const side of ['left','right']) a.arms[side].solve(targets[side],null,10);

    } else if(action.phase==='brake') {
      for(const side of ['left','right']) a.arms[side].solve(targets[side],null,10);
      if(action.phaseTime>.7) { for(const hand of Object.values(a.hands)) hand.setGrip(false); a.phase('release-cart'); }
    } else if(action.phase==='release-cart') {
      if(action.phaseTime<.5) return;
      const next=a.options.runtime.interact(state,{animationComplete:true});
      if(next.errors>state.errors||next.failed) { a.options.setState(next); a.cancel(); return; }
      if(next.complete) {a.pendingCompletion=true;next.complete=false;}
      a.options.setState(next);
      action.starts=targets;
      for(const side of ['left','right']) {
        const lateral=side==='left'?.24:-.24;
        const target=new THREE.Vector3(lateral,.72,.04).applyAxisAngle(up,state.player.yaw).add(new THREE.Vector3(state.player.x,0,state.player.z));
        a.arms[side].plan(target,null);
      }
      a.phase('recover-cart');
    } else if(action.phase==='recover-cart' && action.phaseTime>1.2 && Object.values(a.arms).every(arm=>Math.max(...arm.angles.map((v,i)=>Math.abs(v-arm.targetAngles[i])))<.05)) {
      a.lastResult={id:'pallet-jack',result:state.cart.parked?'parked':'released'};a.action=null;
      if(a.pendingCompletion) {a.options.setState({...a.options.getState(),complete:true});a.pendingCompletion=false;}
    }
  }
  gait(dt) {
    const a=this.owner, state=a.options.getState(), travel=state.cart.travel;
    const moved=Math.max(0,travel-this.previousTravel);this.previousTravel=travel;
    this.step+=moved*2*Math.PI/.55;
    const walking=a.action?.phase==='push'&&moved>1e-6;
    this.walkBlend+=THREE.MathUtils.clamp((walking?1:0)-this.walkBlend,-dt*3,dt*3);
    if(!a.action || a.action.kind!=='cart' || a.action.phase==='align') return;
    const model=a.robot.userData.officialModel, set=a.robot.userData.robotProfile.setJointAngle;
    for(const [side,offset] of [['left',0],['right',Math.PI]]) {
      const wave=Math.sin(this.step+offset), swing=Math.max(0,wave);
      set(model,`${side}_hip_pitch_link`,-.12 + wave*.20*this.walkBlend);
      set(model,`${side}_knee_link`,.24+swing*.30*this.walkBlend);
      set(model,`${side}_ankle_pitch_link`,-.12-wave*.12*this.walkBlend-swing*.15*this.walkBlend);
    }
    a.robot.updateMatrixWorld(true);
  }
  cancel() {
    const a=this.owner,state=a.options.getState();
    if(state.cart.gripped) a.options.setState({...state,cart:{...state.cart,gripped:false},lastEvent:'cart_released'});
    for(const hand of Object.values(a.hands)) if(!hand.held)hand.setGrip(false);
  }
  snapshot() { return {revision:CART_REVISION,...this.owner.options.getState().cart,targets:this.targets()}; }
}
