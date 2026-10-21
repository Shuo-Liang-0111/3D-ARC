import {findLaundryStand} from "../game/levels/rf04/series-animation.js";
import {wallDistance,vacuumInside} from "../game/levels/rf04/vacuum-navigation.js";
import test from "node:test";import assert from "node:assert/strict";
import {createLaundryEngine} from "../game/levels/rf04/series-engine.js";
import {BAYS,DOCK,VACUUM,SHARED_COLLIDERS,clearCircle,DRY_SECONDS} from "../game/levels/rf04/series-layout.js";
const types=["shirt","pants","towel"];
function at(e,s,a){const p=e.pointFor(s,a);for(const radius of [.65,.8])for(let i=0;i<32;i++){const yaw=i*Math.PI/16,player={x:p.x-Math.sin(yaw)*radius,z:p.z-Math.cos(yaw)*radius,yaw};const n={...s,player};if(e.isWalkable(n,player.x,player.z)&&e.getInteraction(n,a))return n;} throw Error("No legal station: "+JSON.stringify(a));}
function act(e,s,a){return e.interact(at(e,s,a),a);}
function wait(e,s,seconds){for(let i=0;i<Math.ceil(seconds/.05);i++)s=e.updateEnvironment(s,.05);return s;}
function wash(e,s=e.createInitialState()){
 for(const t of types){s=act(e,s,{type:"clothing",clothingType:t});assert.equal(s.carriedItem,t);s=act(e,s,{type:"washer-load",clothingType:t});}
 s=act(e,s,{type:"washer-start"});s=wait(e,s,8.1);assert.equal(s.washerPhase,"done");
 s=act(e,s,{type:"washer-unload"});return act(e,s,{type:"drying-rack"});
}
function store(e,s){s=wait(e,s,8.1);for(const t of types){s=act(e,s,{type:"dry-clothing",clothingType:t});assert.equal(s.carriedItem,t);s=act(e,s,{type:"store",clothingType:t,bay:t});assert.equal(s.clothes[t].location,"stored");}return s;}
test("all variants share architecture and collision inventory",()=>{for(const id of ["rf04","rf04-2","rf04-3"])assert.deepEqual(createLaundryEngine(id).LEVEL.staticColliders,SHARED_COLLIDERS);});
test("original finishes at hanging, second only after dry storage",()=>{let e=createLaundryEngine("rf04");assert.equal(wash(e).complete,true);e=createLaundryEngine("rf04-2");let s=wash(e);assert.equal(s.complete,false);assert.equal(s.dryElapsed,0);const p=e.pointFor(s,{type:"dry-clothing",clothingType:"shirt"});const n=e.interact({...s,player:{x:p.x,z:p.z+.6,yaw:Math.PI}},{type:"dry-clothing",clothingType:"shirt"});assert.equal(n.carriedItem,null);assert.equal(store(e,s).complete,true);});
test("wet clothes cannot be stored and wrong bay retains carried dry item",()=>{const e=createLaundryEngine("rf04-2");let s=wait(e,wash(e),8.1);s=act(e,s,{type:"dry-clothing",clothingType:"shirt"});const n=act(e,s,{type:"store",clothingType:"shirt",bay:"pants"});assert.equal(n.lastEvent,"wrong_storage");assert.equal(n.carriedItem,"shirt");assert.equal(n.interactions,s.interactions);});
test("dynamic vacuum moves while player waits, stays inside room and avoids walls",()=>{const e=createLaundryEngine("rf04-3");let s=e.createInitialState();const original={...s.vacuum};for(let i=0;i<6000;i++){s=e.updateEnvironment(s,.05);assert.ok(clearCircle(s.vacuum.x,s.vacuum.z,.175));assert.ok(vacuumInside(s.vacuum));}assert.ok(Math.hypot(s.vacuum.x-original.x,s.vacuum.z-original.z)>.1);assert.ok(s.vacuum.turn>0);});
test("RF04-3 allows vacuum before laundry, can be picked up, completes both objectives",()=>{const e=createLaundryEngine("rf04-3");let s=e.createInitialState();s=act(e,s,{type:"vacuum"});assert.equal(s.carriedItem,"vacuum");let n=wait(e,s,3);assert.equal(n.vacuum.x,s.vacuum.x);s=act(e,n,{type:"dock"});assert.equal(s.vacuum.mode,"docked");assert.equal(s.complete,false);assert.equal(store(e,wash(e,s)).complete,true);});
test("RF04-3 laundry alone cannot complete, then vacuum can finish",()=>{const e=createLaundryEngine("rf04-3");let s=store(e,wash(e));assert.equal(s.complete,false);s=act(e,s,{type:"vacuum"});assert.equal(act(e,s,{type:"dock"}).complete,true);});
test("wrong-location vacuum release resumes motion and does not complete",()=>{const e=createLaundryEngine("rf04-3");let s=act(e,e.createInitialState(),{type:"vacuum"});s.player={x:-7.2,z:5.4,yaw:Math.PI/2};s=e.interact(s,{type:"drop"});assert.equal(s.vacuum.mode,"roaming");assert.equal(s.complete,false);const next=wait(e,s,1);assert.notEqual(next.vacuum.x,s.vacuum.x);});
test("reset restores garments, vacuum and timers",()=>{const e=createLaundryEngine("rf04-3");const old=store(e,wash(e));assert.equal(Object.values(old.clothes).filter(c=>c.location==="stored").length,3);const fresh=e.createInitialState();assert.equal(fresh.dryElapsed,0);assert.equal(fresh.vacuum.mode,"roaming");assert.ok(Object.values(fresh.clothes).every(c=>c.location==="living-room"));});
test("walls/storage block player and nearby door passage remains open",()=>{const e=createLaundryEngine("rf04-2"),s=e.createInitialState();assert.equal(e.isWalkable(s,-1.95,6.55),false);assert.equal(e.isWalkable(s,-6.16,3.2),false);assert.equal(e.isWalkable(s,-5.0,4.5),true);assert.equal(e.isWalkable(s,-1.95,5.6),true);});
test("remote F and selection behind walls cannot acquire clothing",()=>{const e=createLaundryEngine("rf04-2");let s=e.createInitialState();assert.equal(e.interact(s,{type:"clothing",clothingType:"towel"}).carriedItem,null);s.player={x:-6.8,z:2.65,yaw:Math.PI/2};assert.equal(e.interact(s,{type:"clothing",clothingType:"towel"}).carriedItem,null);});
test("holding vacuum adds front clearance during approach and turn",()=>{const e=createLaundryEngine("rf04-3");let s=e.createInitialState();s.vacuum.mode="carried";s.carriedItem="vacuum";s.player={x:-8.70,z:5.8,yaw:-Math.PI/2};assert.equal(e.isWalkable(s,s.player.x,s.player.z),true);s.player.x=-8.9;assert.equal(e.isWalkable(s,s.player.x,s.player.z),false);});

test("vacuum dropped in another clear room continues moving there",()=>{const e=createLaundryEngine("rf04-3");let s=act(e,e.createInitialState(),{type:"vacuum"});s.player={x:5,z:-5,yaw:0};s=e.interact(s,{type:"drop"});assert.equal(s.vacuum.mode,"roaming");const near=wait(e,s,1);const crawl=Math.hypot(near.vacuum.x-s.vacuum.x,near.vacuum.z-s.vacuum.z);assert.ok(crawl>.05);s.player={x:3,z:-5,yaw:0};const n=wait(e,s,1);assert.ok(Math.hypot(n.vacuum.x-s.vacuum.x,n.vacuum.z-s.vacuum.z)>.05);});

test("wall following matches player speed without proximity slowdown",()=>{
 const e=createLaundryEngine("rf04-3");assert.equal(VACUUM.speed,e.LEVEL.moveSpeed);
 for(const distance of [.7,3]){let s=e.createInitialState();s.vacuum={...s.vacuum,x:-7,z:6.869,yaw:-Math.PI/2};s.player={x:-7+distance,z:6.869,yaw:0};
 const n=e.updateEnvironment(s,.05);assert.ok(Math.abs(Math.hypot(n.vacuum.x-s.vacuum.x,n.vacuum.z-s.vacuum.z)-e.LEVEL.moveSpeed*.05)<1e-9);}
});
test("vacuum follows walls through corners without roaming across room centers",()=>{
 const e=createLaundryEngine("rf04-3");let s=e.createInitialState(),near=0,length=0; s.player={x:5,z:-5,yaw:0};
 for(let i=0;i<3000;i++){const prev=s;s=e.updateEnvironment(s,.05);assert.ok(vacuumInside(s.vacuum));assert.ok(clearCircle(s.vacuum.x,s.vacuum.z,VACUUM.radius));length+=Math.hypot(s.vacuum.x-prev.vacuum.x,s.vacuum.z-prev.vacuum.z);if(wallDistance(s.vacuum)<.65)near++;}
 assert.ok(near/3000>.85);assert.ok(length>100);assert.ok(s.vacuum.turn>0);
});


test("repaired doorways admit a carried vacuum across five room connections",()=>{
 const e=createLaundryEngine("rf04-3");
 for(const [x,z,yaw] of [[-5,4.45,0],[.475,-.54,Math.PI/2],[2.85,3.175,Math.PI/2],[2.675,-1.72,0],[3.8,-3,Math.PI/2]]){
  for(const lateral of [-.25,0,.25])for(let along=-.65;along<=.65;along+=.05){
   const s=e.createInitialState();s.carriedItem="vacuum";s.vacuum.mode="carried";
   s.player={x:x+Math.sin(yaw)*along+Math.cos(yaw)*lateral,z:z+Math.cos(yaw)*along-Math.sin(yaw)*lateral,yaw};
   assert.ok(e.isWalkable(s,s.player.x,s.player.z),JSON.stringify(s.player));
  }
 }
});


test("nearby F stops immediately without pickup or reward, remaining solid and retryable",()=>{
 const e=createLaundryEngine("rf04-3"),a={type:"vacuum"};
 const s=at(e,e.createInitialState(),a),n=e.beginInteraction(s,a);
 assert.equal(s.vacuum.mode,"roaming");assert.equal(n.vacuum.mode,"stopped");
 assert.equal(n.carriedItem,null);assert.equal(n.interactions,s.interactions);assert.equal(n.progress,s.progress);assert.equal(n.complete,false);
 assert.deepEqual({...n.vacuum,mode:"roaming"},s.vacuum);
 const later=wait(e,n,6);assert.deepEqual(later.vacuum,n.vacuum);
 assert.equal(e.isWalkable(later,n.vacuum.x,n.vacuum.z),false);
 assert.equal(e.getInteraction(later,a).type,"vacuum");
 assert.equal(e.beginInteraction(later,a).vacuum.mode,"stopped");
 assert.equal(e.interact(later,a).carriedItem,"vacuum");
});
test("remote F cannot stop vacuum",()=>{
 const e=createLaundryEngine("rf04-3"),s=e.createInitialState();s.player={x:5,z:-5,yaw:0};
 assert.equal(e.beginInteraction(s,{type:"vacuum"}).vacuum.mode,"roaming");
});


test("washer unload selects a stand clear after pickup at high frame rates",()=>{
 for(const id of ["rf04","rf04-2","rf04-3"]){
  const e=createLaundryEngine(id),a={type:"washer-unload"};
  for(const x of [8.0,8.36,8.7]){
   let s=e.createInitialState();s.washerPhase="done";s.player={x,z:-5.35,yaw:Math.PI};
   const stand=findLaundryStand(e,s,e.pointFor(s,a),a);assert.ok(stand);
   s=e.interact({...s,player:stand},a);assert.equal(s.carriedItem,"wet-batch");assert.ok(e.isWalkable(s,stand.x,stand.z));
   for(const input of [{move:-1},{strafe:1},{strafe:-1},{turn:1},{turn:-1}]){
    const n=e.updateMovement(s,input,1/144);assert.notDeepEqual(n.player,s.player,JSON.stringify({id,x,input,stand}));
   }
   for(let i=0;i<72;i++)assert.ok(e.isWalkable({...s,player:{...stand,yaw:i*Math.PI/36}},stand.x,stand.z));
  }
 }
});
