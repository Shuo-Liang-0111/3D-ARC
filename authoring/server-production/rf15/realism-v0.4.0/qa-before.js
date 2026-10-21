export function installRouteQA() {
  if (new URLSearchParams(location.search).get('qa') !== 'rf15') return;
  const panel=document.createElement('aside');panel.id='rf15-qa';panel.style.cssText='position:fixed;bottom:92px;left:20px;z-index:100;background:#102a20ee;color:#eee;padding:14px;font:12px monospace;max-width:380px;border:1px solid #bdd77a';
  const button=document.createElement('button');button.textContent='验收路线 · 下一段';button.style.cssText='padding:10px;background:#c5e285;color:#14221c;border:0;cursor:pointer';
  const status=document.createElement('div');status.id='rf15-qa-status';status.textContent='使用正式 Agent 动作接口，不改写场景状态';panel.append(button,status);document.body.append(panel);
  const look=document.createElement('button');look.textContent='抬头验收';look.style.cssText=button.style.cssText;panel.append(look);
  look.onclick=async()=>{look.disabled=true;document.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowUp',bubbles:true}));await new Promise(resolve=>setTimeout(resolve,2100));document.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowUp',bubbles:true}));look.disabled=false;};
  const records=[];let stage=0;
  const state=()=>window.__ARC_AGENT__.getState();
  async function act(action,durationMs=100) { await window.__ARC_AGENT__.act({action,durationMs,harness:'state'}); if(state().failed)throw Error('Reserve depleted'); }
  async function walk(x,z) {
    for(const axis of ['x','z']) for(let count=0;count<100;count++) {
      const before=state();const difference=(axis==='x'?x:z)-before.player[axis];
      if(Math.abs(difference)<.045)break;
      const action=axis==='x'?(difference>0?'D':'A'):(difference>0?'S':'W');
      await act(action,Math.min(1000,Math.max(50,Math.abs(difference)/1.4*1000)));
      if(Math.abs(state().player[axis]-before.player[axis])<.00001)throw Error(`Blocked: ${axis} at ${before.player[axis]}`);
    }
  }
  async function interaction(expected) { const actual=window.__RELAY_DEMO__.getInteraction()?.type; if(actual!==expected)throw Error(`Expected ${expected}, received ${actual}`);const errors=state().errors;await act('E');if(state().errors!==errors)throw Error(state().lastEvent); }
  const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
  async function faceSouth(){
    for(let count=0;count<90;count++){
      const yaw=state().player.yaw;const difference=Math.atan2(Math.sin(-yaw),Math.cos(-yaw));if(Math.abs(difference)<.04)return;
      const code=difference>0?'KeyQ':'KeyE';document.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));await sleep(Math.min(120,Math.abs(difference)/1.8*1000));document.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));await sleep(40);
    }
    throw Error('Turn timeout');
  }
  const stages=[
    async()=>{await walk(-6.4,2.5);await walk(-6.4,-2.7);await interaction('pickup')},
    async()=>{await walk(-2.6,-2.7);await interaction('place-scale');await interaction('weigh');await interaction('pickup-scale')},
    async()=>{await walk(-2.6,-2.3);await walk(.6,-2.3);await interaction('place-pack');await interaction('pack')},
    async()=>{await interaction('pickup-pack');await walk(2.7,-2.3);await walk(2.7,3);await walk(5.3,3);await interaction('place-tail')},
    async()=>{await walk(7.15,2.9);await interaction('lift');for(let count=0;count<8 && state().liftActive;count++)await act('WAIT',1000)},
    async()=>{await walk(2.7,3);await walk(-5.3,2.5);await walk(-5.3,-2.7);await interaction('pickup');await walk(-2.6,-2.7);await interaction('place-scale');await interaction('weigh');await interaction('pickup-scale');await walk(-2.6,-2.3);await walk(.6,-2.3);await interaction('place-pack');await interaction('pack')},
    async()=>{await interaction('pickup-pack');await walk(2.7,-2.3);await walk(2.7,3);await walk(5.3,3);await interaction('place-tail');await walk(7.15,2.9);await interaction('lift');for(let count=0;count<8 && state().liftActive;count++)await act('WAIT',1000)},
    async()=>{await walk(2.7,3);await walk(-6.8,3.4);await faceSouth();await interaction('dispatch')},
  ];
  button.onclick=async()=>{
    button.disabled=true;
    try {if(stage>=stages.length)return;status.textContent=`运行 ${stage+1}/${stages.length}`;await stages[stage]();stage++;const current=state();records.push({stage,player:current.player,event:current.lastEvent,reserve:current.progress,minimum:current.minimumReserve,meters:current.distanceMoved,errors:current.errors,loaded:current.loaded,complete:current.complete});status.textContent=`通过 ${stage}/8 · ${current.lastEvent} · 余量 ${current.progress.toFixed(1)}%`;panel.dataset.evidence=JSON.stringify(records);button.disabled=stage===stages.length;}catch(error){status.textContent='FAILED: '+error.message;panel.dataset.error=error.message;}
  };
}
