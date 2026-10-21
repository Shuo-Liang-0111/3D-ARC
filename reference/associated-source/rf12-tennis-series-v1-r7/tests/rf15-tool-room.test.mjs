import test from "node:test";
import assert from "node:assert/strict";
import { TOOL_ROOM, TOOL_ROOM_WALLS } from "../game/levels/rf15/tool-room-layout.js";
const at=(state,x,z)=>({...state,player:{...state.player,x,z}});
for (const variant of ["rf15-1","rf15-2","rf15-3"]) {
  const engine=await import(`../game/levels/${variant}/engine.js`);
  const {LEVEL}=await import(`../game/levels/${variant}/level.js`);
  const {createInitialState,getInteraction,interact,updateMovement,isWalkable,updateEnvironment}=engine;
  function walk(state,x,z) {
    for(let frame=0;frame<1500;frame++) {
      const dx=x-state.player.x,dz=z-state.player.z;
      if(Math.hypot(dx,dz)<.035) return state;
      const step=Math.min(1,Math.hypot(dx,dz)/(LEVEL.moveSpeed*.05));
      const yaw=state.player.yaw;
      state=updateMovement(state,{move:step*(Math.sin(yaw)*dx+Math.cos(yaw)*dz)/Math.hypot(dx,dz),strafe:step*(Math.cos(yaw)*dx-Math.sin(yaw)*dz)/Math.hypot(dx,dz)},.05);
      assert.equal(state.failed,false);
    }
    assert.fail(`Blocked route to ${x},${z}: ${JSON.stringify(state.player)}`);
  }
  test(`${variant}: walk to real building, open door, enter, take and return both tools`,()=>{
    let state=createInitialState();
    for(const point of [[2.8,2.5],[2.8,-8.7],[-2.6,-8.7],[-2.6,-9.2]]) state=walk(state,...point);
    assert.equal(isWalkable(state,-4,-10),false);
    assert.equal(getInteraction(state)?.type,"open-tool-room");
    state=interact(state);
    for(let frame=0;frame<20;frame++) state=updateEnvironment(state,.05);
    assert.equal(isWalkable(state,-4,-10),true);
    for(const point of [[-4,-9.2],[-4,-11.65],[-5.9,-11.95]]) state=walk(state,...point);
    assert.equal(getInteraction(state)?.tool,"harvest-knife");
    state=interact(state);assert.equal(state.heldTool,"harvest-knife");
    state=interact(state);assert.equal(state.heldTool,null);
    state=walk(state,-4.7,-11.95);
    assert.equal(getInteraction(state)?.tool,"hand-trowel");
    state=interact(state);assert.equal(state.heldTool,"hand-trowel");
    state=interact(state);assert.equal(state.heldTool,null);
    state=walk(state,-2.1,-11.95);assert.equal(getInteraction(state)?.type,"take-sprayer");
    state=interact(state);assert.equal(state.sprayer,true);
    assert.equal(state.errors,0);assert.equal(state.complete,false);
    for(const point of [[-4,-11.65],[-4,-9.2],[-2.6,-9.2]]) state=walk(state,...point);
    assert.equal(getInteraction(state)?.type,"close-tool-room");
    state=interact(state);
    for(let frame=0;frame<20;frame++) state=updateEnvironment(state,.05);
    assert.equal(isWalkable(state,-4,-10),false);
    assert.equal(createInitialState().heldTool,null);
  });
  test(`${variant}: wall pickup denied and doorway closure blocked`,()=>{
    let state=createInitialState();
    state=at(state,TOOL_ROOM.harvest.x,-14.6);
    assert.equal(getInteraction(state)?.type==="take-tool",false);
    for(const wall of TOOL_ROOM_WALLS) assert.equal(isWalkable(state,(wall.minX+wall.maxX)/2,(wall.minZ+wall.maxZ)/2),false);
    state=at({...state,toolRoomOpen:true,toolDoorAngle:-Math.PI/2},-4,-9.8);
    const before=state.progress;
    state=interact(state);
    assert.equal(state.toolRoomOpen,true);
    assert.equal(state.lastEvent,"tool_door_blocked");
    assert.ok(state.progress<before);
  });
}
