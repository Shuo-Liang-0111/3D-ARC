import { taskPoint, WINDOW_CLOSE_DURATION } from "../game/levels/rf05/series-wind.js";
import { TISSUE, TISSUE_IDS, createTissues, chooseDirection, advanceTissue, tissueRectClear, tissueCatchable, reserveTissue } from "../game/levels/rf05/series-tissues.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createHotelEngine } from "../game/levels/rf05/series-engine.js";
import { DIRTY, STOCK, SLOTS, TARGETS, itemPose, FURNITURE, FIXED, ROOM_FIXTURES, standForFurniture } from "../game/levels/rf05/series-layout.js";
function invoke(e,s,a,p){s={...s,player:{...s.player,x:p.x,z:p.z}};const choice=e.getInteraction(s,a);assert.ok(choice,JSON.stringify(a));return e.interact(s,choice);}
function recover(e,s){for(const item of Object.keys(DIRTY)){s=invoke(e,s,{type:"pickup",item},s.items[item]);s=invoke(e,s,{type:"deliver",item,target:{towel:"laundry",cup:"cart",trash:"bin"}[item]},TARGETS[{towel:"laundry",cup:"cart",trash:"bin"}[item]]);}return s;}
function stock(e,s){for(const item of Object.keys(STOCK)){s=invoke(e,s,{type:"pickup",item},itemPose(item,s));s=invoke(e,s,{type:"restock",item,slot:item},SLOTS[item]);}return s;}
test("three variants share furnishings and retain increasingly strict completion",()=>{
 const states=["rf05","rf05-2","rf05-3"].map(id=>createHotelEngine(id).createInitialState());
 assert.deepEqual(states[0].items,states[1].items);assert.deepEqual(states[1].furniture,states[2].furniture);
 assert.deepEqual(states[0].wind,states[1].wind);
 assert.deepEqual(states[0].items,Object.fromEntries(Object.entries(states[2].items).filter(([,item])=>item.type!=="tissue")));
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
 for(const key of ["cart","chair"])Object.assign(s.furniture[key],s.furniture[key].target);
 s=task(e,s,{type:"window-close"});assert.equal(e.ready(s),false);
 for(const key of TISSUE_IDS)s.items[key].location="floor";
 for(const key of TISSUE_IDS){s=invoke(e,s,{type:"pickup",item:key},s.items[key]);s=invoke(e,s,{type:"deliver",item:key,target:"bin"},TARGETS.bin);}
 assert.equal(e.ready(s),true);
 assert.equal(e.ready({...s,actionTarget:"tissue-catch"}),false,"handover waits until the robot recovers to standing");
 s.player={x:.4,z:4.45,yaw:0};
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
 assert.ok(s.player.x<=-2.121&&s.player.x> -2.2,"stops at new toilet");
 const x=s.player.x;s=e.updateMovement(s,{move:-1,drain:false},.05);assert.ok(s.player.x<x);
});





// Unit fixtures are separate from formal browser contact-animation evidence.
function task(e,s,a){
 const p=taskPoint(s,a);s={...s,player:{x:p.x,z:p.z+.75,yaw:Math.PI}};
 s=e.updateTaskAction(s,a,1,{opening:s.wind.opening});return e.interact(s,a);
}
test("retired bedding and bathroom tasks are absent; RF05-3 has exactly three tissues",()=>{
 const e=createHotelEngine("rf05-3"),s=e.createInitialState();
 assert.equal(s.bedding,undefined);assert.equal(s.leak,undefined);assert.equal(s.tool,undefined);
 assert.equal(Object.values(s.items).filter(i=>i.type==="tissue").length,3);
 for(const type of ["smooth","valve","wash","tool-take","tool-return"])assert.equal(e.interact(s,{type}).interactions,0);
});
test("unobstructed 3D flight speed is exactly 2.5 times the configured robot speed",()=>{
 const e=createHotelEngine("rf05-3"),t=createTissues().tissue1,b={minX:-1e6,maxX:1e6,minZ:-1e6,maxZ:1e6};
 for(let i=0;i<100;i++){advanceTissue(t,{latched:false},.016,e.LEVEL.moveSpeed,[],b);assert.ok(Math.abs(Math.hypot(t.vx,t.vy,t.vz)-3.5)<1e-9);}
 assert.equal(t.turns,4,"direction decisions every 0.4 seconds");
 const copy=structuredClone(t);advanceTissue(t,{latched:false},0,1.4,[],b);assert.deepEqual(t,copy,"pause freezes motion and RNG");
});
test("independent 80/20 horizontal and vertical choices use current direction",()=>{
 const t=createTissues().tissue1;let front=0,vertical=0;
 for(let i=0;i<20000;i++){
  const old=t.heading,sign=Math.sign(t.pitch),result=chooseDirection(t);
  const cos=Math.cos(t.targetHeading-old);
  assert.equal(cos>=0,result.forward);assert.equal(Math.sign(t.targetPitch)===sign,result.verticalForward);
  front+=result.forward;vertical+=result.verticalForward;
  t.heading=t.targetHeading;t.pitch=t.targetPitch;
 }
 assert.ok(Math.abs(front/20000-.8)<.012);assert.ok(Math.abs(vertical/20000-.8)<.012);
});
test("fast sheets bounce off thin walls without teleporting or crossing obstacles",()=>{
 const t=createTissues().tissue1;t.x=-.20;t.z=0;t.y=1;t.heading=t.targetHeading=Math.PI/2;t.pitch=t.targetPitch=.15;
 const wall={minX:0,maxX:.04,minZ:-10,maxZ:10},b={minX:-10,maxX:10,minZ:-10,maxZ:10};
 for(let i=0;i<12;i++){advanceTissue(t,{latched:false},.05,1.4,[wall],b);assert.ok(t.x<=-.15+1e-6);assert.ok(tissueRectClear(t.x,t.z,[wall]));}
 assert.ok(t.bounces>0);
});
test("closing causes continuous deceleration and slow landing; sheets stay on the floor",()=>{
 const t=createTissues().tissue1,b={minX:-10,maxX:10,minZ:-10,maxZ:10};
 advanceTissue(t,{latched:false},.05,1.4,[],b);
 const y=t.y,copy=structuredClone(t);advanceTissue(t,{latched:true},.05,1.4,[],b);
 assert.equal(t.location,"falling");assert.ok(t.y>.018);assert.ok(Math.abs(t.y-y)<.2);
 assert.equal(t.vx,0,"latched window removes horizontal draft immediately");assert.equal(t.vz,0,"latched window removes horizontal draft immediately");
 const initialHorizontal=Math.hypot(copy.vx,copy.vz);
 for(let i=0;i<500;i++)advanceTissue(t,{latched:true},.05,1.4,[],b);
 assert.equal(t.location,"floor");assert.equal(t.y,TISSUE.floorY);assert.equal(t.vx,0);assert.ok(initialHorizontal>0);
 const landed=structuredClone(t);advanceTissue(t,{latched:true},.05,1.4,[],b);assert.deepEqual(t,landed);
});
test("air F requires a real hand within 20 cm, cannot chase, and carrying prevents another catch",()=>{
 const e=createHotelEngine("rf05-3");let s=e.createInitialState();s.player={x:0,z:0,yaw:0};s.catchHand={x:-.15,y:.9,z:.34};
 const t=s.items.tissue1;Object.assign(t,{x:-.15,y:.9,z:.541});assert.equal(tissueCatchable(s,t),false);assert.equal(reserveTissue(s,"tissue1"),null);
 t.z=.539;assert.equal(tissueCatchable(s,t),true);
 s=reserveTissue(s,"tissue1");assert.deepEqual(s.player,{x:0,z:0,yaw:0});assert.equal(s.items.tissue1.location,"catching");
 const rejected=e.interact(s,{type:"tissue-catch",item:"tissue1"});assert.equal(rejected.carriedItem,null,"authoritative commit waits for actual hand contact");
 s.catchHand={x:t.x,y:t.y,z:t.z};s=e.interact(s,{type:"tissue-catch",item:"tissue1"});assert.equal(s.carriedItem,"tissue1");
 assert.equal(tissueCatchable(s,s.items.tissue2),false);
 s.actionTarget=null;s=invoke(e,s,{type:"deliver",item:"tissue1",target:"bin"},TARGETS.bin);assert.equal(s.items.tissue1.location,"bin");
 assert.equal(e.ready(s),false,"other two tissues and existing duties still required");
});
test("window animation remains progressive, finishes quickly, and latch stops flight",()=>{
 const e=createHotelEngine("rf05-3");let s=e.createInitialState(),a={type:"window-close"},from={opening:1};
 assert.equal(WINDOW_CLOSE_DURATION,1.6);
 s.player={x:2.5,z:-4.1,yaw:Math.PI};
 s=e.updateTaskAction(s,a,.4,from);assert.ok(s.wind.opening>0&&s.wind.opening<1);
 assert.equal(e.interact(s,a).interactions,0);
 s=e.updateTaskAction(s,a,1,from);s=e.interact(s,a);assert.equal(s.wind.latched,true);
 const before=structuredClone(s.items);s=e.updateEnvironment(s,0);assert.deepEqual(s.items,before);
 s=e.updateEnvironment(s,.05);assert.ok(TISSUE_IDS.every(id=>s.items[id].location==="falling"));
 const reset=e.createInitialState();assert.equal(reset.wind.latched,false);assert.ok(TISSUE_IDS.every(id=>reset.items[id].location==="air"));
});

test("possible closing times keep paper landings reachable outside narrow furniture gaps",()=>{
 const e=createHotelEngine("rf05-3");let s=e.createInitialState();
 for(let frame=0;frame<1800;frame++){
  s=e.updateEnvironment(s,.05);if(frame%150)continue;
  let trial=structuredClone(s);trial.wind.latched=true;
  for(let k=0;k<320;k++)trial=e.updateEnvironment(trial,.05);
  for(const id of TISSUE_IDS){const t=trial.items[id];assert.equal(t.location,"floor");
   assert.equal(e.isWalkable(trial,t.x,t.z),true,"landing remains in an accessible floor corridor");
  }
 }
});

test("tissue delivery target remains the existing bin",()=>{
 const e=createHotelEngine("rf05-3");let s=e.createInitialState();
 s.items.tissue1.location="carried";s.carriedItem="tissue1";s.player={x:3.05,z:3.72,yaw:0};
 const choice=e.getInteraction(s,{type:"deliver",item:"tissue1",target:"bin"});
 assert.equal(choice?.type,"deliver");assert.equal(choice?.target,"bin");
 s=e.interact(s,choice);assert.equal(s.items.tissue1.location,"bin");assert.equal(s.carriedItem,null);
});
test("carried tissue footprint stops before walls and can retreat",()=>{
 const e=createHotelEngine("rf05-3");let s=e.createInitialState();s.carriedItem="tissue1";s.items.tissue1.location="carried";s.player={x:-3.25,z:0,yaw:-Math.PI/2};
 for(let i=0;i<50;i++)s=e.updateMovement(s,{move:1,drain:false},.05);
 assert.ok(s.player.x>=-3.56-1e-6);const x=s.player.x;
 for(let i=0;i<8;i++)s=e.updateMovement(s,{move:-1,drain:false},.05);assert.ok(s.player.x>x);
});

test("RF05 and RF05-2 start and reset without tissues and keep the window closed",()=>{
 for(const id of ["rf05","rf05-2"]){
  const e=createHotelEngine(id);let s=e.createInitialState();
  const initial=structuredClone(s);
  for(let i=0;i<200;i++){s=e.updateEnvironment(s,.05);s=e.updateMovement(s,{},.05);}
  assert.deepEqual(s.items,initial.items);
  assert.equal(Object.values(s.items).some(item=>item.type==="tissue"),false);
  assert.deepEqual({...s.wind,clock:0},{clock:0,opening:0,latch:1,latched:true,wind:0});
  s.player={x:2.5,z:-4.1,yaw:Math.PI};
  assert.equal(e.getInteraction(s,{type:"window-close"}),null);
  for(const item of TISSUE_IDS)assert.equal(e.getInteraction(s,{type:"tissue-catch",item}),null);
  assert.deepEqual(e.createInitialState(),initial);
 }
 const e=createHotelEngine("rf05-3"),s=e.createInitialState();
 assert.equal(s.wind.opening,1);assert.equal(s.wind.latched,false);assert.equal(s.wind.wind,1);
 assert.ok(TISSUE_IDS.every(id=>s.items[id].location==="air"));
 const next=e.updateEnvironment(s,.05);
 assert.ok(TISSUE_IDS.every(id=>next.items[id].clock>s.items[id].clock));
});

test("stock towels are taken top-first and leave the second towel supported on the cart",()=>{
 const e=createHotelEngine("rf05-2");let s=e.createInitialState();
 s.player={x:STOCK.towel1.x,z:STOCK.towel1.z+.95,yaw:Math.PI};
 assert.equal(e.getInteraction(s).item,"towel1");
 assert.equal(e.getInteraction(s,{type:"pickup",item:"towel2"}),null,"lower towel is covered");
 const second=itemPose("towel2",s);
 s=e.interact(s,{type:"pickup",item:"towel1"});
 assert.equal(s.carriedItem,"towel1");
 assert.deepEqual(itemPose("towel2",s),second,"remaining towel does not float or jump");
 s=invoke(e,s,{type:"restock",item:"towel1",slot:"towel2"},SLOTS.towel2);
 s.player={x:STOCK.towel2.x,z:STOCK.towel2.z+.95,yaw:Math.PI};
 assert.equal(e.getInteraction(s).item,"towel2");
 s=e.interact(s,{type:"pickup",item:"towel2"});
 assert.equal(s.carriedItem,"towel2");
 assert.equal(s.items.towel1.location,"slot");
});
