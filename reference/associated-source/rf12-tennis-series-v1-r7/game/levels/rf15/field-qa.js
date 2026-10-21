import { FIELD_CROPS } from "./field-layout.js";

export function installFieldQA() {
  const panel = document.createElement("aside"); panel.id = "field-qa";
  panel.style.cssText = "position:fixed;bottom:85px;left:20px;background:#14271eee;color:white;padding:10px;z-index:120;font:13px monospace";
  const button = document.createElement("button"); button.textContent = "田间收割验收 · 下一段";
  const status = document.createElement("div"); status.textContent = "0/4";
  panel.append(button, status); document.body.append(panel);
  const state = () => window.__RELAY_DEMO__.getState();
  async function act(action, durationMs = 100) {
    await window.__ARC_AGENT__.act({ action, durationMs, harness: "state" });
    if (state().failed) throw Error("reserve exhausted");
  }
  async function walkPoint(x, z, lockedAxis) {
    for (let count = 0; count < 350; count++) {
      const before = state(); let dx = x - before.player.x; let dz = z - before.player.z;
      if (Math.hypot(dx, dz) < .065) return;
      if (lockedAxis === "z" && Math.abs(dz) > .085) dx = 0;
      if (lockedAxis === "x" && Math.abs(dx) > .085) dz = 0;
      const sine = Math.sin(before.player.yaw), cosine = Math.cos(before.player.yaw);
      const choices = [{ action: "W", projection: dx*sine + dz*cosine }, { action: "S", projection: -dx*sine - dz*cosine }, { action: "A", projection: dx*cosine - dz*sine }, { action: "D", projection: -dx*cosine + dz*sine }].sort((left,right) => right.projection - left.projection);
      const speed = { W: 1, S: .5, A: .3, D: .3 }[choices[0].action];
      await act(choices[0].action, Math.min(700, Math.max(50, choices[0].projection / speed * 1000)));
      if (Math.hypot(state().player.x - before.player.x, state().player.z - before.player.z) < .00001) throw Error("route blocked " + JSON.stringify(before.player));
    }
    throw Error("route timeout");
  }
  async function walk(x,z) { await walkPoint(x,state().player.z,"z"); await walkPoint(x,z,"x"); }
  async function route(points) { for (const point of points) await walk(...point); }
  async function interact(type) {
    const action = window.__RELAY_DEMO__.getInteraction();
    if (action?.type !== type) throw Error(`Expected ${type}, got ${JSON.stringify(action)}`);
    await act("E"); await act("WAIT", 850);
  }
  async function harvest(crop) {
    const standX = crop.kind === "lettuce" ? 11.95 : 12.65;
    await route([[12.3,2.8],[12.3,1.65],[standX,1.65],[standX,crop.z]]);
    if (window.__RELAY_DEMO__.getInteraction()?.item !== crop.id) throw Error("wrong crop");
    await interact("pickup-crop");
    await route([[standX,1.65],[12.3,1.65],[12.3,2.8],[10.2,2.8]]);
    await interact("harvest-drop");
    status.textContent = `已收割装筐 ${state().harvested.length}/8`;
  }
  const stages = [
    async () => {
      await route([[2.8,2.5],[2.8,-8.7],[-2.6,-8.7],[-2.6,-9.2]]);
      await interact("open-tool-room");
      await route([[-4,-9.2],[-4,-11.65],[-5.9,-11.95]]);
      await interact("take-tool");
    },
    async () => { await route([[-4,-11.65],[-4,-9.2],[-2.6,-9.2],[2.8,-9.2],[2.8,2.8],[10.2,2.8],[12.3,2.8],[12.3,1.65]]); },
    async () => { await harvest(FIELD_CROPS[3]); },
    async () => { for (const crop of FIELD_CROPS.filter(crop => !state().harvested.includes(crop.id))) await harvest(crop); if (!state().complete) throw Error("mission incomplete"); }
  ];
  let stage = 0;
  button.onclick = async () => {
    button.disabled = true;
    try { status.textContent = `运行 ${stage+1}/4`; await stages[stage](); stage++; panel.dataset.stage = String(stage); panel.dataset.state = JSON.stringify(state()); status.textContent = `通过 ${stage}/4 · ${state().lastEvent}`; button.disabled = stage === stages.length; }
    catch (error) { status.textContent = error.message; panel.dataset.error = error.message; button.disabled = false; }
  };
}
