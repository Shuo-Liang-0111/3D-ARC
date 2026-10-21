import test from "node:test";import assert from "node:assert/strict";
import {LEVEL,HOME,ITEM_BASE_Y} from "../game/levels/rf06/home-layout.js";
import {isWalkable} from "../game/levels/rf06/series-collision.js";
import {createLeakEngine} from "../game/levels/rf06/series-engine.js";
import {isWet,waterFloor,floorDistance} from "../game/levels/rf06/flood-field.js";
test("water uses the connected kitchen doorway instead of passing through walls",()=>{
 assert.equal(isWet(-.5,0,3),false);assert.equal(isWet(-.5,0,40),true);
 assert.equal(waterFloor(-2.6,.62),false);assert.equal(isWet(-2.6,.62,120),false);
 assert.ok(floorDistance(-2.6,.3)>floorDistance(-1.4,1.75));
 assert.equal(isWet(-1.4,1.75,20),true);
});
test("real time growth reaches living room; stopping supply freezes floor volume",()=>{
 const r=createLeakEngine("rf06-2");let s=r.createInitialState();
 for(let i=0;i<2400;i++)s=r.updateEnvironment(s,.1);
 assert.ok(isWet(-.5,0,s.water));const before=s.water;
 s.carriedItem="wrench";s.player={x:HOME.valve.x,z:2.55,yaw:0};s=r.interact(s,{type:"valve",point:HOME.valve});
 assert.equal(s.valveClosed,true);
 for(let i=0;i<130;i++)s=r.updateEnvironment(s,.1);
 assert.equal(s.water,before);assert.equal(s.residual,0);
});
test("fixed level keeps the original water coverage; cockroach props share supported positions",()=>{
 const r=createLeakEngine("rf06");let s=r.createInitialState();
 for(let i=0;i<1000;i++)s=r.updateEnvironment(s,.1);
 assert.equal(s.water,3);assert.equal(ITEM_BASE_Y("wrench",s.items.wrench),.82);
 assert.ok(isWalkable(s,-3.15,2.55));assert.ok(isWalkable(s,-1.4,1.75));assert.ok(isWalkable(s,3.95,1.1));
 assert.equal(isWalkable(s,4.7,1.72),false);
 assert.ok(HOME.faucet.y>HOME.sink.y&&HOME.sink.y>HOME.valve.y);
});
