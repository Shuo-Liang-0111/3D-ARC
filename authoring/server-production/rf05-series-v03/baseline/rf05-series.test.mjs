import test from "node:test";
import assert from "node:assert/strict";
import { createHotelEngine } from "../game/levels/rf05/series-engine.js";
import { DIRTY, STOCK, SLOTS, TARGETS, BASIN, itemPose, FURNITURE, FIXED, ROOM_FIXTURES, standForFurniture } from "../game/levels/rf05/series-layout.js";
function invoke(e,s,a,p){s={...s,player:{...s.player,x:p.x,z:p.z}};const choice=e.getInteraction(s,a);assert.ok(choice,JSON.stringify(a));return e.interact(s,choice);}
function recover(e,s){for(const item of Object.keys(DIRTY)){s=invoke(e,s,{type:"pickup",item},s.items[item]);s=invoke(e,s,{type:"deliver",item,target:{towel:"laundry",cup:"cart",trash:"bin"}[item]},TARGETS[{towel:"laundry",cup:"cart",trash:"bin"}[item]]);}return s;}
function stock(e,s){for(const item of Object.keys(STOCK)){s=invoke(e,s,{type:"pickup",item},itemPose(item,s));s=invoke(e,s,{type:"restock",item,slot:item},SLOTS[item]);}return s;}
test("three variants share all furniture/items, with increasingly strict completion",()=>{
 const states=["rf05","rf05-2","rf05-3"].map(id=>createHotelEngine(id).createInitialState());
 assert.deepEqual(states[0].items,states[1].items);assert.deepEqual(states[1].furniture,states[2].furniture);
 const a=createHotelEngine("rf05"),b=createHotelEngine("rf05-2"),c=createHotelEngine("rf05-3");
 assert.equal(recover(a,a.createInitialState()).complete,true);
 let s=recover(b,b.createInitialState());assert.equal(s.complete,false);assert.equal(stock(b,s).complete,true);
 s=stock(c,recover(c,c.createInitialState()));assert.equal(s.complete,false);
});
test("wrong containers and occupied/uncleared slots are reversible; reward is one-shot",()=>{
 const e=createHotelEngine("rf05-3");let s=e.createInitialState();s.progress=40;
 s=invoke(e,s,{type:"pickup",item:"towel"},s.items.towel);const before=s.progress;
 s=invoke(e,s,{type:"deliver",item:"towel",target:"bin"},TARGETS.bin);
 assert.equal(s.carriedItem,"towel");assert.equal(s.progress,before-5);
 s=invoke(e,s,{type:"deliver",item:"towel",target:"laundry"},TARGETS.laundry);
 assert.equal(s.carriedItem,null);assert.equal(s.delivered.towel,true);
});
test("water advances continuously only with faucet, rejects early/late wash, drains and can retry",()=>{
 const e=createHotelEngine("rf05-3");let s=recover(e,e.createInitialState());
 s=invoke(e,s,{type:"pickup",item:"cup"},itemPose("cup",s));s=invoke(e,s,{type:"sink-place",item:"cup"},BASIN.cup);
 s=invoke(e,s,{type:"wash"},BASIN.cup);assert.equal(s.sink.clean,false);
 s=invoke(e,s,{type:"tap"},BASIN.tap);
 const initial=s.sink.water;for(let i=0;i<150;i++)s=e.updateEnvironment(s,.05);assert.ok(s.sink.water>initial);
 s=invoke(e,s,{type:"wash"},BASIN.cup);assert.equal(s.sink.clean,false,"running water is rejected");
 for(let i=0;i<Math.ceil(.55/(BASIN.fillRate*.05));i++)s=e.updateEnvironment(s,.05);
 s=invoke(e,s,{type:"tap"},BASIN.tap);assert.ok(s.sink.water>.7);
 s=invoke(e,s,{type:"wash"},BASIN.cup);assert.equal(s.sink.clean,false);
 s=invoke(e,s,{type:"drain"},BASIN.drain);for(let i=0;i<200;i++)s=e.updateEnvironment(s,.05);assert.equal(s.sink.water,0);
 s.progress=100;s=invoke(e,s,{type:"tap"},BASIN.tap);for(let i=0;i<Math.ceil(.5/(BASIN.fillRate*.05));i++)s=e.updateEnvironment(s,.05);
 s=invoke(e,s,{type:"tap"},BASIN.tap);assert.ok(s.sink.water>=.4&&s.sink.water<=.7);
 s=invoke(e,s,{type:"wash"},BASIN.cup);assert.equal(s.sink.clean,true);
 assert.equal(e.getInteraction({...s,player:BASIN.cup},{type:"sink-take",item:"cup"}),null);
 s=invoke(e,s,{type:"drain"},BASIN.drain);for(let i=0;i<150;i++)s=e.updateEnvironment(s,.05);
 s=invoke(e,s,{type:"sink-take",item:"cup"},BASIN.cup);assert.equal(s.sink.washed,true);
});
test("wall, bed, vanity, toilet, chair and cart block local movement; door remains open",()=>{
 const e=createHotelEngine("rf05-3"),s=e.createInitialState();
 for(const p of [{x:-4.1,z:0},{x:-2.15,z:-3.5},{x:-3.6,z:3.95},ROOM_FIXTURES.toilet,FURNITURE.chair,FURNITURE.cart])assert.equal(e.isWalkable(s,p.x,p.z),false);
 assert.equal(e.isWalkable(s,0,5.0),true);
 let n={...s,player:{x:3.70,z:0,yaw:Math.PI/2}};for(let i=0;i<40;i++)n=e.updateMovement(n,{move:1},.05);assert.ok(n.player.x<=3.88);
});
test("manual cart obeys input and dynamic collision; releasing does not snap",()=>{
 const e=createHotelEngine("rf05-3");let s=e.createInitialState();s.player=standForFurniture(s.furniture.cart);
 s=e.interact(s,{type:"grip",key:"cart"});assert.equal(s.attachment,"cart");
 let start={...s.furniture.cart};for(let i=0;i<20;i++)s=e.updateMovement(s,{},.05);assert.deepEqual(s.furniture.cart,start);
 for(let i=0;i<20;i++)s=e.updateMovement(s,{move:1},.05);assert.ok(s.furniture.cart.z>start.z);
 start={...s.furniture.cart};s=e.interact(s,{type:"release",key:"cart"});assert.deepEqual(s.furniture.cart,start);assert.equal(s.attachment,null);
});
test("stale actions cannot mutate state and reset removes water, stock, hand and attachment state",()=>{
 const e=createHotelEngine("rf05-3"),s=e.createInitialState();
 const n=e.interact(s,{type:"wash"});assert.equal(n.interactions,0);assert.equal(n.lastEvent,"target_unavailable");
 const reset=e.createInitialState();assert.equal(reset.sink.water,0);assert.equal(reset.sink.faucet,false);assert.equal(reset.carriedItem,null);assert.equal(reset.attachment,null);
});

test("carried towel is blocked before its visible footprint crosses a wall",()=>{
 const e=createHotelEngine("rf05-3");let s=e.createInitialState();
 s.carriedItem="towel";s.items.towel.location="carried";s.player={x:-3.25,z:0,yaw:-Math.PI/2};
 for(let i=0;i<50;i++)s=e.updateMovement(s,{move:1},.05);
 assert.ok(s.player.x> -3.5, "towel edge stops before west wall");
 const x=s.player.x;for(let i=0;i<8;i++)s=e.updateMovement(s,{move:-1},.05);assert.ok(s.player.x>x,"can back away");
});
test("RF05-3 handover requires all work and resets cleanly",()=>{
 const e=createHotelEngine("rf05-3");let s=stock(e,recover(e,e.createInitialState()));
 s.player={x:.4,z:4.45,yaw:0};let n=e.interact(s,{type:"exit"});assert.equal(n.complete,false);
 s.sink={clock:0,water:0,faucet:false,draining:false,clean:true,washed:true};
 for(const key of ["cart","chair"])Object.assign(s.furniture[key],s.furniture[key].target);
 n=e.interact(s,{type:"exit"});assert.equal(n.complete,true);assert.equal(n.exitConfirmed,true);
 assert.equal(e.createInitialState().complete,false);
});

test("bedside corridor reaches the relocated cup and old furniture footprints are clear",()=>{
 const e=createHotelEngine("rf05-3");let s=e.createInitialState();
 s.player={x:-1,z:-1.6,yaw:Math.PI};
 for(let i=0;i<150;i++)s=e.updateMovement(s,{move:1,drain:false},.05);
 assert.ok(s.player.z< -3.72&&s.player.z>=-3.81,"walks between beds and stops at bedside table");
 assert.equal(e.getInteraction(s).item,"cup");
 assert.equal(e.isWalkable(s,-1,-2.54),true,"old table footprint is clear");
 assert.equal(e.isWalkable(s,-2.36,3.42),true,"old toilet footprint is clear");
 assert.equal(new Set(FIXED.map(r=>r.id)).size,FIXED.length,"one authoritative collider per object");
 s.player={x:-2.65,z:3.65,yaw:Math.PI/2};
 for(let i=0;i<50;i++)s=e.updateMovement(s,{move:1,drain:false},.05);
 assert.ok(s.player.x<=-2.22&&s.player.x> -2.3,"stops at new toilet");
 const x=s.player.x;s=e.updateMovement(s,{move:-1,drain:false},.05);assert.ok(s.player.x<x);
});
