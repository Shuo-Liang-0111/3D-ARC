import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as engine from "../game/levels/rf12/engine.js";
import { HAZARD_TYPES, LEVEL } from "../game/levels/rf12/level.js";
import { KITCHEN } from "../game/levels/rf12/interaction-layout.js";
const at=(s,p)=>({...s,player:{...s.player,...p}});
test("RF-10 has exactly three checks and completes without checklist or terminal",()=>{
 assert.deepEqual(HAZARD_TYPES,["window","gasKnob","gasValve"]);
 let s=engine.createInitialState();
 for(const type of HAZARD_TYPES){
  assert.equal(s.complete,false);
  s=engine.interact(at(s,LEVEL[type]),{type});
 }
 assert.equal(s.interactions,3);assert.equal(s.complete,true);
 assert.equal(s.checklistRead,false);assert.equal(s.lastEvent,"kitchen_safety_complete");
 assert.equal(engine.getTelemetry(s).gate,"3/3 CLEAR");
});
test("old sink-side window, cloth and entry terminal cannot become extra tasks",()=>{
 const s=engine.createInitialState();
 for(const p of [LEVEL.checklist,LEVEL.terminal,LEVEL.cloth,{x:-.75,z:-1.8}]){
  assert.equal(engine.getInteraction(at(s,p)),null);
 }
 assert.equal(engine.interact(at(s,LEVEL.hood),{type:"hood"}).interactions,0);
});
test("the gas valve still requires shutting the stove and partial checks cannot complete",()=>{
 let s=engine.interact(at(engine.createInitialState(),LEVEL.gasValve));
 assert.equal(s.hazards.gasValve,false);assert.equal(s.lastEvent,"gas_valve_requires_knob");
 for(const type of ["gasKnob","gasValve"])s=engine.interact(at(s,LEVEL[type]),{type});
 assert.equal(s.complete,false);
 s=engine.interact(at(s,LEVEL.window));assert.equal(s.complete,true);
 assert.equal(engine.getInteraction(s),null);
});
test("window has a counter-free approach and the wall remains impassable",()=>{
 let s=at(engine.createInitialState(),{x:3.66,z:.09,yaw:Math.PI/2});
 assert.equal(LEVEL.window,KITCHEN.window);assert.equal(LEVEL.window.y,1.15);
 assert.ok(engine.isWalkable(s,s.player.x,s.player.z));
 assert.equal(engine.getInteraction(s).type,"window");
 for(let i=0;i<50;i++)s=engine.updateMovement(s,{move:1,drain:false},.05);
 assert.ok(s.player.x<=3.731);assert.ok(engine.isWalkable(s,s.player.x,s.player.z));
});
function glb(file){
 const b=readFileSync(new URL("../public/local-assets/levels/rf12/window-v5/"+file,import.meta.url));
 assert.equal(b.toString("utf8",0,4),"glTF");
 return JSON.parse(b.toString("utf8",20,20+b.readUInt32LE(12)));
}
test("exported wall and collision both contain a real side-window aperture",()=>{
 for(const [file,prefix] of [["kitchen-environment.glb","RF12_EAST_WALL_WINDOW_"],["kitchen-collision.glb","COLLIDER_east-window-"]]){
  const j=glb(file),nodes=j.nodes.filter(n=>n.name.startsWith(prefix));
  assert.equal(nodes.length,4);
  for(const n of nodes){
   if(file.includes("collision"))assert.equal(n.extras.collision,true);
   const a=j.accessors[j.meshes[n.mesh].primitives[0].attributes.POSITION];
   const t=n.translation??[0,0,0];
   const min=a.min.map((v,i)=>v+t[i]),max=a.max.map((v,i)=>v+t[i]);
   assert.ok(!(1.15>min[1]+.001&&1.15<max[1]-.001&&.42>min[2]+.001&&.42<max[2]-.001),n.name);
  }
 }
});
test("the exported pull handle belongs to the moving sash",()=>{
 const j=glb("sliding-window.glb");
 const sash=j.nodes.find(n=>n.name==="RF12_WINDOW_MOVING_SASH");
 const handle=j.nodes.findIndex(n=>n.name==="RF10_WINDOW_PULL");
 assert.ok(sash.children.includes(handle));
 const t=j.nodes[handle].translation;
 assert.ok(Math.abs(t[0]-.02)<1e-5&&Math.abs(t[1]-.3)<1e-5&&Math.abs(t[2]-.12)<1e-5);
});
