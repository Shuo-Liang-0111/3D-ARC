import { WETROOM, waterAmount, toolPoint, toolPose } from "../game/levels/rf05/series-leak.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createHotelEngine } from "../game/levels/rf05/series-engine.js";
import { DIRTY, STOCK, SLOTS, TARGETS, itemPose, FURNITURE, FIXED, ROOM_FIXTURES, standForFurniture } from "../game/levels/rf05/series-layout.js";
function invoke(e,s,a,p){s={...s,player:{...s.player,x:p.x,z:p.z}};const choice=e.getInteraction(s,a);assert.ok(choice,JSON.stringify(a));return e.interact(s,choice);}
function recover(e,s){for(const item of Object.keys(DIRTY)){s=invoke(e,s,{type:"pickup",item},s.items[item]);s=invoke(e,s,{type:"deliver",item,target:{towel:"laundry",cup:"cart",trash:"bin"}[item]},TARGETS[{towel:"laundry",cup:"cart",trash:"bin"}[item]]);}return s;}
function stock(e,s){for(const item of Object.keys(STOCK)){s=invoke(e,s,{type:"pickup",item},itemPose(item,s));s=invoke(e,s,{type:"restock",item,slot:item},SLOTS[item]);}return s;}
test("three variants share all furniture/items, with increasingly strict completion",()=>{
 const states=["rf05","rf05-2","rf05-3"].map(id=>createHotelEngine(id).createInitialState());
 assert.deepEqual(states[0].items,states[1].items);assert.deepEqual(states[1].furniture,states[2].furniture);
 assert.deepEqual(states[0].leak,states[2].leak);assert.deepEqual(states[0].tool,states[2].tool);
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
test("shower spreads while open, stopping alone never removes water, and reopening is recoverable",()=>{
 const e=createHotelEngine("rf05-3");let s=e.createInitialState(),before=waterAmount(s.leak);
 for(let i=0;i<100;i++)s=e.updateEnvironment(s,.05);
 assert.ok(waterAmount(s.leak)>before);
 s=invoke(e,s,{type:"valve"},WETROOM.valve);assert.equal(s.leak.open,false);
 before=waterAmount(s.leak);for(let i=0;i<500;i++)s=e.updateEnvironment(s,.05);
 assert.equal(waterAmount(s.leak),before);assert.equal(s.leak.cleared,false);
 const progress=s.progress;s=invoke(e,s,{type:"valve"},WETROOM.valve);s=invoke(e,s,{type:"valve"},WETROOM.valve);
 assert.equal(s.progress,progress-10,"shutoff reward cannot be farmed");
 assert.equal(e.getInteraction(s,{type:"wash"}),null);
 assert.equal(e.getInteraction(s,{type:"sink-place",item:"cup"}),null);
});
test("squeegee pushes water into the visible drain only during actual forward movement",()=>{
 const e=createHotelEngine("rf05-3");let s=e.createInitialState();
 s=invoke(e,s,{type:"valve"},WETROOM.valve);s.tool.held=true;s.tool.returned=false;
 s.player={x:-2.48,z:3.22,yaw:0};const initial=waterAmount(s.leak);
 for(let i=0;i<100;i++)s=e.updateMovement(s,{},.05);
 assert.equal(waterAmount(s.leak),initial,"standing still cannot clean");
 for(let i=0;i<52;i++)s=e.updateMovement(s,{move:1,drain:false},.05);
 assert.ok(waterAmount(s.leak)<=WETROOM.dryThreshold,JSON.stringify(s.leak));
 assert.equal(s.leak.cleared,true);assert.ok(Math.abs(s.leak.drained-initial)<1e-8,"water goes to drain rather than disappearing");
 assert.equal(e.ready(s),false,"cleanup alone does not finish the room");
});
test("a held squeegee cannot cross walls and the shower entrance is physically open",()=>{
 const e=createHotelEngine("rf05-3");let s=e.createInitialState();s.tool.held=true;s.tool.returned=false;
 s.player={x:-3.30,z:0,yaw:-Math.PI/2};
 for(let i=0;i<50;i++)s=e.updateMovement(s,{move:1,drain:false},.05);
 assert.ok(toolPose(s).x-WETROOM.bladeDepth/2>=-4.05-.01);
 const x=s.player.x;for(let i=0;i<10;i++)s=e.updateMovement(s,{move:-1,drain:false},.05);assert.ok(s.player.x>x);
 assert.equal(e.isWalkable(s,-2.48,4.60),true);
 assert.equal(e.isWalkable(s,-1.50,4.60),false);
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
test("stale actions cannot mutate state and reset restores leak, stock, tool and attachment state",()=>{
 const e=createHotelEngine("rf05-3"),s=e.createInitialState();
 const n=e.interact(s,{type:"wash"});assert.equal(n.interactions,0);assert.equal(n.lastEvent,"target_unavailable");
 const reset=e.createInitialState();assert.equal(reset.leak.open,true);assert.equal(reset.tool.held,false);assert.equal(reset.carriedItem,null);assert.equal(reset.attachment,null);
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
 s.leak.open=false;s.leak.cleared=true;for(const p of s.leak.parcels)p.amount=0;
 for(const key of ["cart","chair"])Object.assign(s.furniture[key],s.furniture[key].target);
 s.tool.held=true;s.tool.returned=false;assert.equal(e.ready(s),false,"holding the tool blocks handover");
 s.tool.held=false;assert.equal(e.ready(s),false,"unreturned tool blocks handover");
 s.tool.returned=true;
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


test("backward/sideways movement preserves water, far tool return is rejected, reopening invalidates cleanup",()=>{
 const e=createHotelEngine("rf05-3");let s=e.createInitialState();
 s.leak.open=false;s.tool.held=true;s.tool.returned=false;s.player={x:-2.48,z:3.85,yaw:0};
 const initial=structuredClone(s.leak.parcels);
 for(let i=0;i<8;i++)s=e.updateMovement(s,{move:-1,drain:false},.05);
 for(let i=0;i<5;i++)s=e.updateMovement(s,{strafe:1,drain:false},.05);
 assert.deepEqual(s.leak.parcels,initial);
 s=e.interact(s);assert.equal(s.lastEvent,"tool_rack_far");assert.equal(s.tool.held,true);
 s.tool.held=false;s.tool.returned=true;s.leak.cleared=true;for(const p of s.leak.parcels)p.amount=0;
 s=invoke(e,s,{type:"valve"},WETROOM.valve);assert.equal(s.leak.cleared,false);
 s=e.updateEnvironment(s,.05);assert.ok(waterAmount(s.leak)>0);
});
