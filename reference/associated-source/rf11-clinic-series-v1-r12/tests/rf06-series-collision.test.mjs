import * as pest from "../game/levels/rf06-3/engine.js";
import test from "node:test";
import assert from "node:assert/strict";
import {createLeakEngine} from "../game/levels/rf06/series-engine.js";
test("local wall approach is blocked and kitchen doorway stays open, including carried bucket",()=>{
 const r=createLeakEngine("rf06-2");
 const advance=(s,input,n=80)=>{for(let i=0;i<n;i++)s=r.updateMovement(s,{...input,drain:false},.05);return s;};
 let s=r.createInitialState();s.player={x:4.6,z:0,yaw:Math.PI/2};s.carriedItem="bucket";
 s=advance(s,{move:1});assert.ok(s.player.x<=5.081);
 s=r.createInitialState();s.player={x:-.9,z:1.75,yaw:-Math.PI/2};s.carriedItem="bucket";
 s=advance(s,{move:1},50);assert.ok(s.player.x< -1.75);assert.ok(r.isWalkable(s,s.player.x,s.player.z));
 s=r.createInitialState();s.player={x:-.9,z:1,yaw:-Math.PI/2};
 s=advance(s,{move:1});assert.ok(s.player.x>=-1.031);
});
test("all variants share immutable dimensions and collisions",()=>{
 const a=createLeakEngine("rf06"),b=createLeakEngine("rf06-2"),c=pest;
 assert.equal(a.LEVEL.staticColliders,b.LEVEL.staticColliders);assert.equal(b.LEVEL.staticColliders,c.LEVEL.staticColliders);assert.equal(a.LEVEL.bounds,c.LEVEL.bounds);
});

test("shared shelf blocks robot in every variant while its approach remains reachable",()=>{
 for(const r of [createLeakEngine("rf06"),createLeakEngine("rf06-2"),pest]){
  let s=r.createInitialState();s.player={x:4.1,z:1.43,yaw:Math.PI/2};
  assert.ok(r.isWalkable(s,4.1,1.43));assert.equal(r.isWalkable(s,4.85,1.43),false);
  for(let i=0;i<80;i++)s=r.updateMovement(s,{move:1,drain:false},.05);
  assert.ok(s.player.x<4.71);assert.ok(r.isWalkable(s,s.player.x,s.player.z));
 }
});
