import { SORTING, PARCEL_TYPES } from "../../rf01-sorting-layout.js";
const frame = document.querySelector("#game");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const trace = [];
const state = () => frame.contentWindow.__ARC_AGENT__.getState();
const agent = () => frame.contentWindow.__ARC_AGENT__;
const demo = () => frame.contentWindow.__RELAY_DEMO__;

function report(label) {
  const current = state();
  trace.push({ label, state: current, time: new Date().toISOString() });
  status.textContent = label;
  result.textContent = JSON.stringify({ label, revision: SORTING.revision, trace }, null, 2);
}
function capture(label) {
  const heading = document.createElement("h2");
  heading.textContent = label;
  const image = document.createElement("img");
  image.alt = label;
  image.src = demo().captureFrame();
  document.querySelector("#captures").append(heading, image);
  report(label);
}
async function walk(x, z) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const current = state();
    if (current.failed) throw new Error("余量耗尽");
    const dx = x - current.player.x, dz = z - current.player.z;
    if (Math.hypot(dx, dz) < .045) return;
    const yaw = current.player.yaw;
    const forward = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const lateral = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const useForward = Math.abs(forward) >= Math.abs(lateral);
    const distance = Math.abs(useForward ? forward : lateral);
    const action = useForward ? (forward > 0 ? "W" : "S") : (lateral > 0 ? "A" : "D");
    await agent().act({ action, durationMs: Math.max(50, Math.min(500, distance / .8 * 1000)), harness: "state" });
  }
  throw new Error("路线受阻：" + JSON.stringify(state().player) + " → " + x + "," + z);
}
async function face(yaw) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const delta = Math.atan2(Math.sin(yaw - state().player.yaw), Math.cos(yaw - state().player.yaw));
    if (Math.abs(delta) < .025) return;
    const code = delta > 0 ? "KeyQ" : "KeyE";
    frame.contentWindow.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
    await wait(Math.max(30, Math.min(160, Math.abs(delta) / .8 * 1000)));
    frame.contentWindow.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
    await wait(100);
  }
  throw new Error("转身未完成：" + state().player.yaw);
}
async function act(expected) {
  const action = demo().getInteraction();
  if (action?.type !== expected) throw new Error("交互不匹配 " + expected + " / " + JSON.stringify(action));
  await agent().act({ action: "E", harness: "state" });
  if (state().failed) throw new Error("交互后余量耗尽");
}
const actions = {
  supply: async () => {
    agent().reset();
    capture("01 起点 / 双视角");
    await walk(-6.8, 1.25); await face(Math.PI); await act("battery");
    capture("02 能源模块携带");
    await walk(-6.8, 2.1); await walk(6.15, 2.1); await act("slot");
    await walk(-.68, 0); await face(Math.PI); await act("shutter");
    while (state().shutterLift < 2.1) await agent().act({action:"WAIT",durationMs:250,harness:"state"});
    capture("03 卷帘门开启");
  },
  lighting: async () => {
    if (state().shutterLift < 2.1) {
      await walk(-.68, 0); await face(Math.PI); await act("shutter");
      while (state().shutterLift < 2.1) await agent().act({action:"WAIT",durationMs:250,harness:"state"});
    }
    await walk(1.6, 0); await walk(1.6, -3.1);
    capture("04 进入厂房 / 照明关闭");
    await walk(3.8, -3.1); await walk(3.8, -5.5); await face(Math.PI); await act("lights");
    await walk(3.8, -3.95); await walk(.65, -3.95); await face(Math.PI);
    capture("05 分拣线 / 照明开启");
  },
  sort: async () => {
    for (const type of PARCEL_TYPES) {
      await walk(3.8, -3.95); await walk(.65, -3.95); await face(Math.PI);
      let ready = false;
      for (let attempt = 0; attempt < 180; attempt += 1) {
        const action = demo().getInteraction();
        if (action?.type === "parcel" && action.parcelType === type) { ready = true; break; }
        await agent().act({action:"WAIT",durationMs:100,harness:"state"});
      }
      if (!ready) throw new Error("未遇到快递：" + type);
      await act("parcel"); capture("06 手持 " + type);
      await face(0); await walk(.65, -4.05); await walk(SORTING.bins[type].x, -4.05);
      await act("sort-parcel"); capture("07 入栏 " + type);
      if (!state().complete) { await walk(.65, -4.05); await walk(3.8, -4.05); }
    }
    if (!state().complete) throw new Error("分拣未完成");
    capture("08 正式关卡完成");
  },
  capture: async () => capture("当前画面"),
  reset: async () => { agent().reset(); report("已重置"); },
};
for (const [name, action] of Object.entries(actions)) {
  document.getElementById(name).onclick = async () => {
    const buttons = [...document.querySelectorAll("header button")];
    buttons.forEach(button => { button.disabled = true; });
    status.textContent = "执行中：" + name;
    try { await action(); }
    catch (error) { status.textContent = error.message; report("失败：" + error.message); }
    finally { buttons.forEach(button => { button.disabled = false; }); }
  };
}
for (let attempt = 0; attempt < 300; attempt += 1) {
  if (agent()?.ready().ready) { status.textContent = "正式游戏已就绪"; break; }
  await wait(200);
}
