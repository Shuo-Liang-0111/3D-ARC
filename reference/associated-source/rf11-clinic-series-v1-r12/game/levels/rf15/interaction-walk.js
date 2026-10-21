import * as THREE from 'three';

const angleDelta = (target, current) => Math.atan2(Math.sin(target - current), Math.cos(target - current));
const distance = (left, right) => Math.hypot(left.x - right.x, left.z - right.z);
const idle = () => ({ move: 0, strafe: 0, turn: 0, drain: false });
const up = new THREE.Vector3(0, 1, 0);

export function approachPath(state, goal, runtime) {
  const start = state.player;
  const clear = (from, to) => {
    const count = Math.max(1, Math.ceil(distance(from, to) / .035));
    for (let index = 1; index <= count; index++) {
      const blend = index / count;
      if (!runtime.isWalkable(state, from.x + (to.x - from.x) * blend, from.z + (to.z - from.z) * blend)) return false;
    }
    return true;
  };
  if (!runtime.isWalkable(state, goal.x, goal.z) || distance(start, goal) > 3) return null;
  if (clear(start, goal)) return [{x:goal.x,z:goal.z}];
  const pitch = .18, limit = 17;
  const queue = [{x:start.x,z:start.z,gridX:0,gridZ:0,parent:null}], seen = new Set(['0,0']);
  let found = null;
  for (let cursor = 0; cursor < queue.length && cursor < 1250; cursor++) {
    const current = queue[cursor];
    if (clear(current, goal)) { found = current; break; }
    for (const [deltaX,deltaZ] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const gridX=current.gridX+deltaX,gridZ=current.gridZ+deltaZ,key=gridX+','+gridZ;
      if (seen.has(key) || Math.abs(gridX)>limit || Math.abs(gridZ)>limit) continue;
      seen.add(key);
      const next={x:start.x+gridX*pitch,z:start.z+gridZ*pitch,gridX,gridZ,parent:current};
      if (clear(current,next)) queue.push(next);
    }
  }
  if (!found) return null;
  const route=[{x:goal.x,z:goal.z}];
  for(let point=found;point.parent;point=point.parent) route.unshift({x:point.x,z:point.z});
  const smooth=[];
  let previous=start,index=0;
  while(index<route.length) {
    let end=route.length-1;
    while(end>index&&!clear(previous,route[end])) end--;
    smooth.push(route[end]);previous=route[end];index=end+1;
  }
  const length=smooth.reduce((sum,point,index)=>sum+distance(index?smooth[index-1]:start,point),0);
  return length <= 5 ? smooth : null;
}

export class InteractionWalk {
  constructor(owner) { this.owner=owner;this.reset(); }
  reset() { this.route=null;this.stage='idle';this.settleTime=0;this.poseTime=0;this.stuck=0;this.feet=null;this.swingStart=null;this.travel=0;this.ready=false; }
  begin(stand,yaw) {
    this.reset();
    const state=this.owner.options.getState();
    this.route=approachPath(state,stand,this.owner.options.runtime);
    if(!this.route) {this.owner.options.message('通往操作位置的路被挡住，请绕到可通行的一侧');return false;}
    this.yaw=yaw;this.stage='turn';this.previous={...state.player};this.visualPrevious={...state.player};
    this.index=0;this.swingIndex=0;this.swingProgress=0;return true;
  }
  input(state) {
    if(!this.route||this.ready)return idle();
    while(this.index<this.route.length&&distance(state.player,this.route[this.index])<.022)this.index++;
    if(this.index<this.route.length) {
      const point=this.route[this.index],error=angleDelta(Math.atan2(point.x-state.player.x,point.z-state.player.z),state.player.yaw);
      if(Math.abs(error)>.07) {this.stage='turn';return {...idle(),turn:THREE.MathUtils.clamp(error*3,-.55,.55)};}
      this.stage='walk';
      return {...idle(),move:Math.min(.43,distance(state.player,point)*3)/this.owner.options.runtime.LEVEL.moveSpeed,drain:true};
    }
    const error=angleDelta(this.yaw,state.player.yaw);
    if(Math.abs(error)>.018) {this.stage='face';return {...idle(),turn:THREE.MathUtils.clamp(error*3,-.55,.55)};}
    this.stage='settle';return idle();
  }
  update(dt) {
    if(!this.route||dt<=0)return;
    const player=this.owner.options.getState().player;
    const moved=distance(player,this.previous),turned=Math.abs(angleDelta(player.yaw,this.previous.yaw));
    this.travel+=moved;
    if(this.stage==='settle') {this.settleTime+=dt;this.ready=this.settleTime>=.45;}
    else this.stuck=moved+turned>.0002?0:this.stuck+dt;
    this.previous={...player};
    if(this.stuck>2.5) {this.owner.options.message('靠近路线受阻，请换一侧再按 F');this.owner.cancel();}
  }
  applyLeg(side,angles) {
    const model=this.owner.robot.userData.officialModel,set=this.owner.robot.userData.robotProfile.setJointAngle;
    set(model,side+'_hip_pitch_link',angles[0]);
    set(model,side+'_hip_roll_link',angles[1],new THREE.Vector3(0,0,-1));
    set(model,side+'_knee_link',angles[2]);
    set(model,side+'_ankle_pitch_link',-angles[0]-angles[2]);
    set(model,side+'_ankle_roll_link',-angles[1],new THREE.Vector3(0,0,-1));
    this.owner.robot.updateMatrixWorld(true);
  }
  solveFoot(foot,target) {
    const limits=[[-1.3,.8],[-.5,.5],[.04,1.7]];
    const position=angles=>{this.applyLeg(foot.side,angles);return foot.node.getWorldPosition(new THREE.Vector3());};
    const angles=[...foot.angles];
    for(let iteration=0;iteration<9;iteration++){
      const current=position(angles),error=target.clone().sub(current);
      if(error.length()<.002)break;
      const columns=angles.map((value,index)=>{
        const sample=[...angles];sample[index]+=.001;
        return position(sample).sub(current).multiplyScalar(1000);
      });
      const jacobian=new THREE.Matrix3().set(columns[0].x,columns[1].x,columns[2].x,columns[0].y,columns[1].y,columns[2].y,columns[0].z,columns[1].z,columns[2].z);
      const transpose=jacobian.clone().transpose(),system=jacobian.clone().multiply(transpose);
      system.elements[0]+=.0005;system.elements[4]+=.0005;system.elements[8]+=.0005;
      const direction=error.applyMatrix3(system.invert()).applyMatrix3(transpose).toArray();
      for(let index=0;index<3;index++)angles[index]=THREE.MathUtils.clamp(angles[index]+THREE.MathUtils.clamp(direction[index],-.12,.12),...limits[index]);
    }
    foot.angles=angles;this.applyLeg(foot.side,angles);
    foot.error=foot.node.getWorldPosition(new THREE.Vector3()).distanceTo(target);
  }
  draw(dt) {
    if(!this.route)return;
    const robot=this.owner.robot,player=this.owner.options.getState().player;
    const basePosition=robot.position.clone();
    if(!this.feet){
      robot.updateMatrixWorld(true);
      this.feet=['left','right'].map(side=>{
        const node=robot.userData.officialModel.getObjectByName(side+'_ankle_roll_link');
        const position=node.getWorldPosition(new THREE.Vector3());
        return {side,node,position,local:position.clone().sub(robot.position).applyAxisAngle(up,-player.yaw),angles:[-.1,0,.3],error:0};
      });
    }
    const moved=distance(player,this.visualPrevious),yawChange=angleDelta(player.yaw,this.visualPrevious.yaw);
    const motion=moved+Math.abs(yawChange)*.20;
    if(dt>0)this.swingProgress+=motion/.19;
    const nominal=foot=>foot.local.clone().applyAxisAngle(up,player.yaw).add(basePosition);
    this.poseTime+=dt;
    const flex=this.stage==='settle'?1-THREE.MathUtils.smoothstep(this.settleTime/.45,0,1):THREE.MathUtils.smoothstep(this.poseTime/.25,0,1);
    robot.position.y-=.045*flex;
    if(this.stage==='settle'){
      for(const foot of this.feet){
        if(!foot.settleStart)foot.settleStart=foot.position.clone();
        const blend=THREE.MathUtils.smoothstep(this.settleTime/.45,0,1);
        foot.position.copy(foot.settleStart).lerp(nominal(foot),blend);
        foot.position.y+=Math.sin(blend*Math.PI)*.025;
      }
    }else if(motion>1e-7){
      while(this.swingProgress>=1){this.swingProgress-=1;this.swingIndex=1-this.swingIndex;this.swingStart=null;}
      const foot=this.feet[this.swingIndex];
      if(!this.swingStart)this.swingStart=foot.position.clone();
      const target=nominal(foot);
      if(this.stage==='walk')target.add(new THREE.Vector3(Math.sin(player.yaw),0,Math.cos(player.yaw)).multiplyScalar(.10));
      const blend=THREE.MathUtils.smoothstep(this.swingProgress,0,1);
      foot.position.copy(this.swingStart).lerp(target,blend);
      foot.position.y+=Math.sin(this.swingProgress*Math.PI)*.065;
    }
    for(const foot of this.feet)this.solveFoot(foot,foot.position);
    this.visualPrevious={...player};
  }
  snapshot() { return {stage:this.stage,ready:this.ready,travel:this.travel,waypoints:this.route?.length||0,feet:this.feet?.map(foot=>({side:foot.side,error:foot.error,position:foot.position.toArray()}))}; }
}
