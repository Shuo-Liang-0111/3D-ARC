export function installToolRoomQA() {
  if(document.querySelector("#tool-room-qa"))return;
  const panel=document.createElement("aside");panel.id="tool-room-qa";panel.style.cssText="position:fixed;bottom:85px;left:20px;background:#14271eee;color:#fff;padding:10px;z-index:120;font:13px monospace";
  const button=document.createElement("button");button.textContent="工具房验收 · 下一段";button.style.cssText="padding:8px";
  const status=document.createElement("div");status.textContent="0/5";panel.append(button,status);document.body.append(panel);
  const state=()=>window.__RELAY_DEMO__.getState();
  async function act(action,durationMs=100){await window.__ARC_AGENT__.act({action,durationMs,harness:"state"});if(state().failed)throw Error("reserve exhausted");}
  async function walk(x,z){
    await walkPoint(x,state().player.z,"z");
    await walkPoint(x,z,"x");
  }
  async function walkPoint(x,z,lockedAxis){
    for(let count=0;count<300;count++){
      const before=state();let dx=x-before.player.x;let dz=z-before.player.z;
      if(Math.hypot(dx,dz)<.08)return;
      if(lockedAxis==="z"&&Math.abs(dz)>.10)dx=0;
      if(lockedAxis==="x"&&Math.abs(dx)>.10)dz=0;
      const sine=Math.sin(before.player.yaw);const cosine=Math.cos(before.player.yaw);
      const choices=[
        {action:"W",projection:dx*sine+dz*cosine},
        {action:"S",projection:-dx*sine-dz*cosine},
        {action:"A",projection:dx*cosine-dz*sine},
        {action:"D",projection:-dx*cosine+dz*sine}
      ].sort((left,right)=>right.projection-left.projection);
      const speed={W:1,S:.5,A:.3,D:.3}[choices[0].action];
      await act(choices[0].action,Math.min(1000,Math.max(50,choices[0].projection/speed*1000)));
      if(Math.hypot(state().player.x-before.player.x,state().player.z-before.player.z)<.00001)throw Error("route blocked "+JSON.stringify(before.player));
    }
    throw Error("route timeout "+JSON.stringify(state().player));
  }
  async function interact(type){
    const action=window.__RELAY_DEMO__.getInteraction();
    if(action?.type!==type)throw Error("Expected "+type+", got "+JSON.stringify(action));
    await act("E");
  }
  const stages=[
    async()=>{for(const point of [[2.8,2.5],[2.8,-8.7],[-2.6,-8.7],[-2.6,-9.2]])await walk(...point);},
    async()=>{await walk(-2.6,-9.2);await interact("open-tool-room");await act("WAIT",1000);await walk(-4,-9.1);},
    async()=>{await walk(-4,-11.65);await walk(-5.9,-11.95);await interact("take-tool");},
    async()=>{await walk(-5.9,-11.95);await interact("return-tool");await walk(-4.7,-11.95);await interact("take-tool");},
    async()=>{await walk(-4.7,-11.95);await interact("return-tool");await walk(-4,-11.65);await walk(-4,-9.2);await walk(-2.6,-9.2);await interact("close-tool-room");await act("WAIT",1000);}
  ];
  let stage=0;
  button.onclick=async()=>{
    button.disabled=true;
    try{status.textContent="运行 "+(stage+1)+"/5";await stages[stage]();stage++;panel.dataset.stage=String(stage);panel.dataset.state=JSON.stringify(state());status.textContent="通过 "+stage+"/5 · "+state().lastEvent;button.disabled=stage===5;}
    catch(error){panel.dataset.error=error.message;status.textContent=error.message;}
  };
}
