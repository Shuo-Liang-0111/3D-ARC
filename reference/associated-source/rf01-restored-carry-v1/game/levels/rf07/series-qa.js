import {CASE,MODULE,CONTAINER,SINK,DEVICES} from './series-engine.js';
export function installQA(c){
 const api=c.options,r=api.runtime;
 window.__RF07_QA__={state:()=>structuredClone(api.getState()),snapshot:()=>c.snapshot(),world:()=>({ceiling:c.world.ceiling.visible,items:Object.fromEntries(Object.entries(c.world.assetRoots.items).map(([k,o])=>[k,{visible:o.visible,position:o.position.toArray()}]))}),
 station(type,item){if(c.busy)throw Error('Animation busy');const s=structuredClone(api.getState());let p;
 if(type==='cabinet-power'||type==='cabinet'){p={x:9.3,z:r.LEVEL.coldCabinets[item??'cold-02'].assetZ,yaw:Math.PI/2};}
 else if(type==='sample'){const q=s.samples[item];p={x:q.x,z:q.z+1.10,yaw:Math.PI};}
 else if(type==='cooling-module')p={x:s.modulePoint.x,z:s.modulePoint.z+1.1,yaw:Math.PI};
 else if(type==='device-off'){const q=DEVICES.find(d=>d.id===s.alarm.device);p={x:q.x,z:q.z+1.1,yaw:Math.PI};}
 else if(type==='container')p={x:s.containerPoint.x,z:s.containerPoint.z+1.1,yaw:Math.PI};
 else if(type==='contain')p={x:SINK.x+1.1,z:SINK.z,yaw:-Math.PI/2};
 else if(type==='drop')p={x:6,z:4,yaw:Math.PI};
 else p={x:s.casePoint.x,z:s.casePoint.z+1.1,yaw:Math.PI};
 if(!r.isWalkable(s,p.x,p.z))throw Error('Invalid QA station '+JSON.stringify(p));s.player=p;s.clockStamp=performance.now();api.setState(s);return r.getInteraction(s);
 },fixture(kind){c.reset();const s=r.createInitialState();s.clockStamp=performance.now();if(kind==='device'){s.alarm={type:'device',device:'bsc-02',status:'active',triggerAt:0,startedAt:0};}if(kind==='module-install'){s.caseSamples=['sampleA','sampleC','sampleB'];for(const k of s.caseSamples)s.samples[k].location='case';s.casePhase='ordered';s.coolingModuleLocation='carried';s.carriedItem='cooling-module';s.alarm.status='disabled';}if(kind==='carry-case'){s.caseSamples=['sampleA','sampleC','sampleB'];for(const k of s.caseSamples)s.samples[k].location='case';s.casePhase='active';s.coolingModuleLocation='case';s.alarm.status='resolved';}api.setState(s);return s;},
 schedule(type,seconds){const s=structuredClone(api.getState());s.alarm={type:'device',device:'bsc-02',status:'pending',triggerAt:s.clock+seconds,startedAt:null};api.setState(s);},
 deadline(seconds){const s=structuredClone(api.getState());s.alarm={type:'device',device:'bsc-02',status:'active',startedAt:s.clock-(120-seconds),triggerAt:0};api.setState(s);},
 teleport(p){const s=structuredClone(api.getState());if(!r.isWalkable(s,p.x,p.z))throw Error('Invalid station');s.player=p;api.setState(s);},
 collision(p,input,steps=60){let s=structuredClone(api.getState());s.player=p;const start={...p};for(let i=0;i<steps;i++)s=r.updateMovement(s,{...input,drain:false},.05);api.setState(s);return {start,end:s.player};},
 };
}
