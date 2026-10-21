// Monotonic wall time keeps a 30-second call deadline independent of rendering FPS.
export function createOfficeClock(engine,now=()=>performance.now()){
 let previous=null;
 function updateEnvironment(state,fallback=0){
  const current=now(),seconds=previous===null?fallback:Math.max(0,current-previous)/1000;previous=current;
  return engine.updateEnvironment(state,seconds);
 }
 return {
  createInitialState(...args){previous=null;return engine.createInitialState(...args);},
  updateEnvironment,
  interact(state,selected){return engine.interact(updateEnvironment(state),selected);},
 };
}
