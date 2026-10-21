import test from 'node:test';
import assert from 'node:assert/strict';
import {createOfficeEngine} from '../game/levels/rf09/office-engine.js';
import {IDS,SEATS,TASK_ITEMS,PHONE_POINT,PHONE_START_DELAY_MIN,PHONE_START_DELAY_MAX,chairStand} from '../game/levels/rf09/office-layout.js';

function act(e,s,a,p){
 for(const radius of [.65,.75,.95,1.2])for(let i=0;i<64;i++){
  const yaw=i*Math.PI/32,player={x:p.x-Math.sin(yaw)*radius,z:p.z-Math.cos(yaw)*radius,yaw},candidate={...s,player};
  if(e.isWalkable(candidate,player.x,player.z)&&e.getInteraction(candidate,a))return e.interact(candidate,a);
 }
 throw Error('No reachable station: '+JSON.stringify(a));
}
const pick=(e,s,id)=>act(e,s,{type:'pickup',target:id,item:id},s.items[id]);
const place=(e,s,kind,seat='1')=>act(e,s,{type:'seat',target:seat,item:s.carriedItem,kind},SEATS.find(entry=>entry.id===seat)[kind]);
function park(e,s){
 s={...s,player:chairStand(s.chairs['chair-a'])};
 s=e.interact(s,{type:'grip',chair:'chair-a'});
 assert.equal(s.attachment,'chair-a');
 for(let i=0;i<32;i++)s=e.updateMovement(s,{move:1},.05);
 for(let i=0;i<43;i++)s=e.updateMovement(s,{strafe:1},.05);
 for(let i=0;i<20;i++)s=e.updateMovement(s,{move:1},.05);
 s=e.interact(s);
 assert.equal(e.chairParked(s),true);
 assert.equal(s.attachment,null);
 return s;
}

test('shared scene has eight seats with one missing pair and all files/water interactive',()=>{
 const engines=IDS.map(createOfficeEngine),states=engines.map(e=>e.createInitialState());
 for(const s of states){
  assert.equal(s.seats.length,8);
  assert.deepEqual(s.seats[0],{id:'1',doc:null,water:null});
  for(const seat of s.seats.slice(1))assert.equal(Boolean(seat.doc&&seat.water),true);
  assert.deepEqual(Object.keys(s.items).filter(id=>TASK_ITEMS.includes(id)).sort(),TASK_ITEMS.slice().sort());
  const e=engines[states.indexOf(s)];
  for(const id of TASK_ITEMS){
   const item=s.items[id];let found=false;
   for(const radius of [.65,.75,.95,1.2])for(let i=0;i<64;i++){
    const yaw=i*Math.PI/32,player={x:item.x-Math.sin(yaw)*radius,z:item.z-Math.cos(yaw)*radius,yaw};
    if(e.isWalkable({...s,player},player.x,player.z)&&e.getInteraction({...s,player},{type:'pickup',target:id,item:id})){found=true;break;}
   }
   assert.equal(found,true,id);
  }
 }
 assert.equal(states[0].phone.status,'inactive');
 assert.equal(states[1].phone.status,'inactive');
 assert.equal(states[2].phone.status,'pending');
 assert.equal(states[2].phone.ringAt>=PHONE_START_DELAY_MIN,true);
 assert.equal(states[2].phone.ringAt<=PHONE_START_DELAY_MAX,true);
});

test('RF-08 completes by replenishing the missing seat',()=>{
 const e=createOfficeEngine('rf09');
 let s=e.createInitialState();
 s=pick(e,s,'docs-1');s=place(e,s,'doc');assert.equal(s.complete,false);
 s=pick(e,s,'water-1');s=place(e,s,'water');assert.equal(s.complete,true);
 assert.deepEqual(s.seats[0],{id:'1',doc:'docs-1',water:'water-1'});
});

const permutations=xs=>xs.length?xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>j!==i)).map(rest=>[x,...rest])):[[]];
for(const id of IDS){
 const tasks=id==='rf09'?['doc','water']:id==='rf09-2'?['doc','water','chair']:['doc','water','chair','phone'];
 test(id+' accepts every task order and completes only after all requirements',()=>{
  for(const order of permutations(tasks)){
   const e=createOfficeEngine(id);let s=e.createInitialState();
   for(const [index,task]of order.entries()){
    if(task==='chair')s=park(e,s);
    else if(task==='phone'){
     s=e.updateEnvironment(s,Math.max(0,s.phone.ringAt-s.clock));
     s=act(e,s,{type:'answer',target:'phone'},PHONE_POINT);
     assert.equal(s.phone.status,'answered');
    }else{
     s=pick(e,s,task==='doc'?'docs-1':'water-1');
     s=place(e,s,task);
     assert(s.seats[0][task]);
    }
    assert.equal(s.complete,index===order.length-1,order.join(' → ')+' after '+task);
    assert.equal(s.failed,false);
   }
  }
 });
}
test('occupied seats still reject duplicate placements while the chair is unparked',()=>{
 const e=createOfficeEngine('rf09-2');let s=e.createInitialState();
 s=pick(e,s,'docs-1');s=place(e,s,'doc','2');
 assert.equal(s.lastEvent,'seat_occupied');
 assert.equal(s.carriedItem,'docs-1');
 assert.equal(s.seats[1].doc,'docs-2');
 s=place(e,s,'doc');assert.equal(s.seats[0].doc,'docs-1');
 assert.equal(e.chairParked(s),false);assert.equal(s.complete,false);
});

test('RF-08-3 rings randomly after one minute and starts a real 30 second deadline',()=>{
 const e=createOfficeEngine('rf09-3');
 const initial=e.createInitialState();
 const before=e.updateEnvironment(initial,59.999);
 assert.equal(before.phone.status,'pending');
 const ring=e.updateEnvironment(initial,initial.phone.ringAt);
 assert.equal(ring.phone.status,'ringing');
 assert.equal(ring.phone.deadline,ring.phone.ringAt+30);
 const timeout=e.updateEnvironment(ring,30);
 assert.equal(timeout.failed,true);
 assert.equal(timeout.failureReason,'phone_timeout');
 assert.equal(timeout.progress,100);
});

test('RF-08-3 can answer from the office phone station before deadline',()=>{
 const e=createOfficeEngine('rf09-3');
 let s=e.createInitialState();
 s=e.updateEnvironment(s,s.phone.ringAt);
 const answer=act(e,s,{type:'answer',target:'phone'},PHONE_POINT);
 assert.equal(answer.phone.status,'answered');
 assert.equal(answer.failed,false);
 assert.equal(answer.complete,false);
});

test('answering and placement can be completed in either order',()=>{
 const e=createOfficeEngine('rf09-3');
 let s=e.createInitialState();
 s=e.updateEnvironment(s,s.phone.ringAt);
 s=act(e,s,{type:'answer',target:'phone'},PHONE_POINT);
 s=park(e,s);
 s=pick(e,s,'docs-1');s=place(e,s,'doc');
 s=pick(e,s,'water-1');s=place(e,s,'water');
 assert.equal(s.complete,true);
});
