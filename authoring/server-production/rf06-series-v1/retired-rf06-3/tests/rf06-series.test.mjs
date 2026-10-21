import test from "node:test";
import assert from "node:assert/strict";
import {createLeakEngine,CAPACITY} from "../game/levels/rf06/series-engine.js";
const e=id=>createLeakEngine(id);
test("RF06 fixed water; RF06-2 grows while idle and stops on shutoff",()=>{
 let r=e("rf06"),s=r.createInitialState();for(let i=0;i<100;i++)s=r.updateEnvironment(s,.05);assert.equal(s.water,3);
 r=e("rf06-2");s=r.createInitialState();for(let i=0;i<100;i++)s=r.updateEnvironment(s,.05);assert.ok(s.water>3.79);s.valveClosed=true;assert.equal(r.updateEnvironment(s,.05).water,s.water);
});
test("bucket capacity conserves overflow and emptying conserves discharged water",()=>{
 const r=e("rf06-3");let s=r.createInitialState();s.items.bucket.location="placed";s.bucketWater=CAPACITY-.004;
 const n=r.updateEnvironment(s,.05);assert.equal(n.bucketWater,CAPACITY);assert.ok(Math.abs(n.water-s.water-.004)<1e-9);
 s={...n,carriedItem:"bucket",player:{x:-4.03,z:2.1,yaw:0}};const a={type:"empty",point:{x:-4.03,y:.58,z:2.53}};const t=r.interact(s,a);assert.equal(t.bucketWater,0);assert.equal(t.totalDrained,CAPACITY);
});
test("mopping transfers only free bucket volume and rejects a full bucket",()=>{
 const r=e("rf06-3");let s=r.createInitialState();s.bucketPlaced=true;s.items.bucket.location="placed";s.carriedItem="mop";s.bucketWater=5;s.player={x:-2.55,z:2,yaw:0};
 const a={type:"mop",point:{x:-2.55,y:.75,z:2.5}};
 s=r.interact(s,a);assert.equal(s.water,7);assert.equal(s.bucketWater,6);const n=r.interact(s,a);assert.equal(n.water,7);assert.equal(n.lastEvent,"bucket_unavailable");
});
test("original completion keeps bucket placed; advanced completion requires emptied returned bucket",()=>{
 for(const id of ["rf06","rf06-2","rf06-3"]){
  const r=e(id),s=r.createInitialState();Object.assign(s,{valveClosed:true,bucketPlaced:true,puddleClean:true,water:0,carriedItem:"mop",returned:{wrench:true,mop:false},player:{x:4,z:2.22,yaw:0}});
  const n=r.interact(s,{type:"return",point:{x:4.58,y:.82,z:2.22}});assert.equal(n.complete,id!=="rf06-3");
 }
});
test("reset clears water, bucket, rewards and interaction results",()=>{const r=e("rf06-3"),a=r.createInitialState(),b=r.createInitialState();a.rewards.x=true;a.water=99;assert.equal(b.water,8);assert.deepEqual(b.rewards,{});});
