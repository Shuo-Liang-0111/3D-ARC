import {applyRobotMovement} from "../../movement.js";
import {IDS,OBJECTIVES,makeLevel,initialItems,HOME,SEATS,CHAIRS,POINTS,TYPES,STATIC,rect,distance,furniturePoint,chairStand} from "./office-layout.js";
export const circleRect=(x,z,r,b)=>Math.hypot(x-Math.max(b.minX,Math.min(x,b.maxX)),z-Math.max(b.minZ,Math.min(z,b.maxZ)))<r-1e-6;
export function createOfficeEngine(id){
 if(!IDS.includes(id))throw Error("Unknown office level");
 const LEVEL=makeLevel(id);
 const clone=s=>({...s,player:{...s.player},items:Object.fromEntries(Object.entries(s.items).map(([k,v])=>[k,{...v}])),chairs:Object.fromEntries(Object.entries(s.chairs).map(([k,v])=>[k,{...v,target:{...v.target}}])),seats:s.seats.map(x=>({...x})),requests:s.requests.map(x=>({...x})),printer:{...s.printer},returned:{...s.returned}});
 function createInitialState(){return {level:id,player:{...LEVEL.playerStart},items:initialItems(id),chairs:Object.fromEntries(Object.entries(CHAIRS).map(([k,v])=>[k,{...v,...(id==="rf09-2"?{}:v.target)}])),carriedItem:null,attachment:null,
 seats:SEATS.map(x=>({id:x.id,doc:id==="rf09-3"?"docs-"+x.id:null,water:id==="rf09-3"?"water-"+x.id:null})),
 returned:{folder:id!=="rf09",tray:id!=="rf09",remote:id!=="rf09"},printer:{paper:false,phase:"empty",time:0},
 requests:[{id:"print",status:"active"},{id:"water",status:"pending",count:0},{id:"collect",status:"pending"}],
 progress:100,complete:false,failed:false,settling:false,terminalOpen:false,elapsed:0,clock:0,interactions:0,motion:"idle",lastEvent:"started"};}
 function collisionRects(s,exclude=null){return [...STATIC,...Object.values(s.chairs).filter(c=>c.id!==exclude).map(c=>rect(c.id,c.x,c.z,c.width,c.depth))];}
 function isWalkable(s,x,z,r=LEVEL.playerRadius,exclude=null){const b=LEVEL.bounds;return Number.isFinite(x)&&Number.isFinite(z)&&x-r>=b.minX&&x+r<=b.maxX&&z-r>=b.minZ&&z+r<=b.maxZ&&!collisionRects(s,exclude).some(b=>circleRect(x,z,r,b))&&(!s.carriedItem||STATIC.filter(q=>q.id.includes("wall")||q.id.includes("glass")||["supply-cabinet","it-locker","reception-desk","meeting-terminal"].includes(q.id)).every(b=>!circleRect(x,z,.56,b)));}
 function clearRay(s,a,b){
  const count=Math.ceil(distance(a,b)/.04),blocks=STATIC.filter(r=>!["conference-table","admin-counter","it-counter","reception-desk","printer-counter","meeting-terminal","returns-counter"].includes(r.id)&&!r.id.startsWith("cubicle"));
  for(let i=1;i<count;i++){const t=i/count,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(blocks.some(r=>x>r.minX&&x<r.maxX&&z>r.minZ&&z<r.maxZ))return false;}return true;
 }
 function near(s,p){return distance(s.player,p)<=LEVEL.interactionRange&&clearRay(s,s.player,p);}
 function chairFits(s,c,exclude){
  const r=.30,b=LEVEL.bounds;
  if(c.x-r<b.minX||c.x+r>b.maxX||c.z-r<b.minZ||c.z+r>b.maxZ)return false;
  return collisionRects(s,exclude).filter(r=>r.id!=="conference-table").every(b=>!circleRect(c.x,c.z,r,b))&&c.z>=-3.52;
 }
 // Carry footprint follows the same hand-relative anchor as the animation.
 // Only surfaces at or above the carried object can block it.
 function payloadFits(s,x,z){
  if(!s.carriedItem)return true;
  const type=s.items[s.carriedItem].type,[w,,d]=TYPES[type].size,yaw=s.player.yaw;
  const side=type==="tray"?0:-.15,fx=x+Math.sin(yaw)*.32+Math.cos(yaw)*side,fz=z+Math.cos(yaw)*.32-Math.sin(yaw)*side;
  const rx=Math.abs(Math.cos(yaw))*w/2+Math.abs(Math.sin(yaw))*d/2,rz=Math.abs(Math.sin(yaw))*w/2+Math.abs(Math.cos(yaw))*d/2,b=LEVEL.bounds;
  if(fx-rx<b.minX||fx+rx>b.maxX||fz-rz<b.minZ||fz+rz>b.maxZ)return false;
  return STATIC.filter(q=>q.id.includes("wall")||q.id.includes("glass")||["supply-cabinet","it-locker","reception-desk","meeting-terminal"].includes(q.id)).every(q=>fx+rx<=q.minX||fx-rx>=q.maxX||fz+rz<=q.minZ||fz-rz>=q.maxZ);
 }
 function updateMovement(s,input,seconds){
  const n=clone(s),dt=Math.min(.05,Math.max(0,seconds));n.elapsed+=dt;
  if(s.complete||s.failed||s.settling)return n;
  const m=applyRobotMovement(n,s,input,dt,LEVEL,(st,x,z)=>isWalkable(st,x,z,LEVEL.playerRadius,s.attachment)&&payloadFits(st,x,z));
  if(s.attachment){
   const c=s.chairs[s.attachment],f={...c,x:n.player.x+Math.sin(n.player.yaw)*.82,z:n.player.z+Math.cos(n.player.yaw)*.82,yaw:n.player.yaw};
   if(!chairFits(s,f,c.id)||!isWalkable(s,n.player.x,n.player.z,LEVEL.playerRadius,c.id))n.player={...s.player};else n.chairs[c.id]=f;
  }
  n.motion=m.motionTurning?"turning":m.translating?"moving":s.carriedItem?"carrying":s.attachment?"pushing":"idle";return n;
 }
 const targetAction=(s,type,target,point,extra={})=>near(s,point)?{type,target,point,...extra}:null;
 function candidates(s){
  if(s.complete||s.failed||s.settling)return [];
  if(s.attachment){const c=s.chairs[s.attachment];return [{type:"release",chair:c.id,point:furniturePoint(c)}];}
  const out=[],push=a=>{if(a)out.push(a);};
  if(s.carriedItem){
   const item=s.items[s.carriedItem];
   for(const [key,p]of Object.entries(HOME))push(targetAction(s,"return",key,p,{item:item.id,blocked:key!==item.id}));
   if(["documents","water"].includes(item.type))for(const seat of SEATS){const kind=item.type==="documents"?"doc":"water",filled=s.seats.find(x=>x.id===seat.id)[kind];push(targetAction(s,"seat",seat.id,seat[kind],{item:item.id,kind,blocked:Boolean(filled)}));}
   push(targetAction(s,"paper-load","printer",POINTS.printerInput,{item:item.id,blocked:item.type!=="paper"||s.printer.paper}));
   push(targetAction(s,"deliver","print",POINTS.delivery,{item:item.id,blocked:item.type!=="printed"||s.requests[0].status!=="active"}));
   push(targetAction(s,"deliver","water",POINTS.refill,{item:item.id,blocked:item.type!=="water"||s.requests[1].status!=="active"}));
   push(targetAction(s,"deliver","collect",POINTS.recycle,{item:item.id,blocked:item.type!=="used"||s.requests[2].status!=="active"}));
   const d={x:s.player.x+Math.sin(s.player.yaw)*.60,y:.012,z:s.player.z+Math.cos(s.player.yaw)*.60};
   if(!out.length)out.push({type:"drop",item:item.id,point:d,blocked:!isWalkable(s,d.x,d.z,.18)});
  }else{
   for(const item of Object.values(s.items))if(item.available!==false&&["surface","floor"].includes(item.location))push(targetAction(s,"pickup",item.id,item,{item:item.id,blocked:item.type==="used"&&s.requests[2].status!=="active"}));
   push(targetAction(s,"printer","printer",POINTS.printerButton,{blocked:!s.printer.paper||s.printer.phase!=="loaded"}));
   push(targetAction(s,"confirm","terminal",POINTS.terminal));
   for(const c of Object.values(s.chairs)){const stand=chairStand(c);if(distance(s.player,stand)<1.35)push({type:"grip",chair:c.id,point:furniturePoint(c),stand});}
  }return out;
 }
 function getInteraction(s,selected=null){
  const list=candidates(s);
  if(selected)return list.find(a=>a.type===selected.type&&a.item===selected.item&&a.target===selected.target&&a.chair===selected.chair&&a.kind===selected.kind)??null;
  const score=a=>{const dx=a.point.x-s.player.x,dz=a.point.z-s.player.z,d=Math.hypot(dx,dz),f=d?(dx*Math.sin(s.player.yaw)+dz*Math.cos(s.player.yaw))/d:1;return d+(1-f)*.22+(a.blocked?.12:0);};
  const a=list.sort((a,b)=>score(a)-score(b))[0]??null; if(a)a.label=({pickup:"拿起",return:"归还",seat:"摆放",deliver:"交付","paper-load":"补充纸张",printer:"开始打印",confirm:"确认会场",grip:"扶住椅背",release:"松开椅子",drop:"放下"})[a.type]+(a.item?" "+TYPES[s.items[a.item].type].name:"");return a;
 }
 const chairsReady=s=>Object.values(s.chairs).every(c=>distance(c,c.target)<.14&&Math.abs(Math.atan2(Math.sin(c.yaw-c.target.yaw),Math.cos(c.yaw-c.target.yaw)))<.16);
 const readiness=s=>({returned:Object.values(s.returned).filter(Boolean).length,seats:s.seats.filter(x=>x.doc&&x.water).length,chairs:chairsReady(s),requests:s.requests.filter(r=>r.status==="done").length});
 function interact(s,selected=null){
  const n=clone(s),a=getInteraction(s,selected);
  if(s.complete||s.failed||s.settling)return n;
  n.interactions++;
  if(!a){n.lastEvent="no_target";return n;}
  if(a.blocked){n.lastEvent=a.type==="printer"?(s.printer.phase==="printing"?"printing_wait":"printer_needs_paper"):a.type==="pickup"?"request_pending":a.type==="seat"?"seat_occupied":"wrong_target";return n;}
  const item=n.items[a.item??s.carriedItem];n.lastEvent=a.type;
  if(a.type==="pickup"){
   n.carriedItem=a.item;item.location="carried";n.motion="carrying";
   for(const seat of n.seats)for(const key of ["doc","water"])if(seat[key]===item.id)seat[key]=null;
   if(item.id in n.returned)n.returned[item.id]=false;
  }else if(["return","seat","deliver","paper-load","drop"].includes(a.type)){
   item.location=a.type==="paper-load"?"printer-loaded":"surface";Object.assign(item,a.point,{yaw:s.player.yaw});n.carriedItem=null;n.motion="idle";
   if(a.type==="return")n.returned[a.target]=true;
   if(a.type==="seat")n.seats.find(x=>x.id===a.target)[a.kind]=item.id;
   if(a.type==="paper-load")n.printer={paper:true,phase:"loaded",time:0};
   if(a.type==="deliver"){
    const req=n.requests.find(r=>r.id===a.target);
    if(a.target==="water"){req.count++;item.x+=.13*(req.count-1);if(req.count>=2)req.status="done";}else req.status="done";
    item.location="delivered";
   }
   if(a.type==="drop")item.location="floor";
  }else if(a.type==="printer"){n.printer.phase="printing";n.printer.time=0;}
  else if(a.type==="grip"){n.attachment=a.chair;n.motion="pushing";}
  else if(a.type==="release"){n.attachment=null;n.motion="idle";}
  else if(a.type==="confirm"){const ready=readiness(n);if(id==="rf09-2"&&ready.seats===4&&ready.chairs)n.complete=true;else n.lastEvent="not_ready";}
  if(id==="rf09"&&Object.values(n.returned).every(Boolean)&&!n.carriedItem)n.complete=true;
  if(id==="rf09-3"&&n.requests.every(r=>r.status==="done")&&!n.carriedItem)n.complete=true;
  if(id==="rf09-3"&&n.requests[0].status==="done"&&n.requests[2].status==="pending")n.requests[2].status="active";
  return n;
 }
 function updateEnvironment(s,dt){
  if(s.complete||s.failed||s.settling)return s;
  const n=clone(s);n.clock+=Math.min(.1,Math.max(0,dt));
  if(id==="rf09-3"&&n.clock>=10&&n.requests[1].status==="pending"){n.requests[1].status="active";n.lastEvent="water_request";}
  if(n.printer.phase==="printing"){n.printer.time+=Math.min(.1,Math.max(0,dt));if(n.printer.time>=6){n.printer.phase="ready";n.items.printed={...n.items.printed,...POINTS.printerOutput,available:true,location:"surface"};n.lastEvent="print_ready";}}
  return n;
 }
 return {LEVEL,createInitialState,cloneState:clone,isWalkable,payloadFits,collisionRects,clearRay,updateMovement,getInteraction,interact,updateEnvironment,readiness,chairsReady,closeTerminal:s=>({...s,terminalOpen:false}),getObjective:s=>({title:OBJECTIVES[id],detail:s.complete?"任务完成":"靠近物品或设备按 F 操作"})};
}
