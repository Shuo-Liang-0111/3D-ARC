import test from 'node:test';
import assert from 'node:assert/strict';
import {createOfficeEngine} from '../game/levels/rf09/office-engine.js';
import {OfficeAnimation} from '../game/levels/rf09/office-animation.js';
import {CONFERENCE_LAYOUT,SEATS,PHONE_POINT} from '../game/levels/rf09/office-layout.js';

test('a parked chair leaves a collision-free animated side approach to both placement targets',()=>{
 const runtime=createOfficeEngine('rf09'),controller=Object.create(OfficeAnimation.prototype);
 controller.options={runtime};
 for(const [kind,id] of [['doc','docs-1'],['water','water-1']]){
  const s=runtime.createInitialState();
  s.carriedItem=id;s.items[id].location='carried';
  s.player={x:-2.8016583872946454,z:-2.8216715971213495,yaw:3.436116964863836};
  const a={type:'seat',target:'1',kind,item:id,point:SEATS[0][kind]};
  const stand=controller.standFor(s,a.point,a);
  assert(stand,kind+' has a formal animation stand');
  assert(runtime.isWalkable(s,stand.x,stand.z));
  assert(runtime.getInteraction({...s,player:stand},a));
 }
});

test('chairs reflect across table center and reception phone remains behind a solid counter',()=>{
 assert.equal(CONFERENCE_LAYOUT.northZ+CONFERENCE_LAYOUT.southZ,2*CONFERENCE_LAYOUT.centerZ);
 const e=createOfficeEngine('rf09-3');let s=e.createInitialState();
 s.player={x:-5.65,z:-3.1,yaw:Math.PI};
 for(let i=0;i<20;i++)s=e.updateMovement(s,{move:1},.05);
 assert(s.player.z<-4.1,'removed side table permits short local movement');
 s.player={x:PHONE_POINT.x,z:5.45,yaw:0};
 for(let i=0;i<20;i++)s=e.updateMovement(s,{move:1},.05);
 assert(s.player.z<5.67,'front desk blocks the robot');
});
