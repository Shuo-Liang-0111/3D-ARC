import { SORTING, PARCEL_TYPES } from "../../rf01-sorting-layout.js";
const frame = document.querySelector("#game");
const status = document.querySelector("#status");
document.querySelector("header strong").textContent = SORTING.revision;
const result = document.querySelector("#result");
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const trace = [];
const frameTimes = [];
let previousFrame = 0;
let lastFrameReport = 0;
function measureFrame(now) {
  if (previousFrame) frameTimes.push(now - previousFrame);
  previousFrame = now;
  if (frameTimes.length > 120) frameTimes.shift();
  if (frameTimes.length === 120 && now - lastFrameReport >= 1000) {
    lastFrameReport = now;
    const average = frameTimes.reduce((sum, duration) => sum + duration, 0) / frameTimes.length;
    document.querySelector("#performance").textContent = "Live frame cadence: " + (1000 / average).toFixed(1) + " FPS / " + frame.clientWidth + " × " + frame.clientHeight;
  }
  requestAnimationFrame(measureFrame);
}
requestAnimationFrame(measureFrame);
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
async function walkSegment(targetX, targetZ) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const current = state();
    if (current.failed) throw new Error("余量耗尽");
    const dx = targetX - current.player.x, dz = targetZ - current.player.z;
    if (Math.hypot(dx, dz) < .075) return;
    const yaw = current.player.yaw;
    const forward = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const lateral = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const useForward = Math.abs(forward) >= Math.abs(lateral);
    const distance = Math.abs(useForward ? forward : lateral);
    const action = useForward ? (forward > 0 ? "W" : "S") : (lateral > 0 ? "A" : "D");
    const speed = action === "W" ? 1 : action === "S" ? .5 : .3;
    await agent().act({ action, durationMs: Math.max(50, Math.min(500, distance / speed * 1000)), harness: "state" });
  }
  throw new Error("路线受阻：" + JSON.stringify(state().player) + " → " + targetX + "," + targetZ);
}
async function walk(targetX, targetZ) {
  const start = state().player;
  const segments = Math.ceil(Math.hypot(targetX - start.x, targetZ - start.z) / .25);
  for (let index = 1; index <= segments; index += 1) {
    await walkSegment(start.x + (targetX - start.x) * index / segments,
      start.z + (targetZ - start.z) * index / segments);
  }
}
async function face(yaw) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const delta = Math.atan2(Math.sin(yaw - state().player.yaw), Math.cos(yaw - state().player.yaw));
    if (Math.abs(delta) < .12) {
      await wait(300);
      const settled = Math.atan2(Math.sin(yaw - state().player.yaw), Math.cos(yaw - state().player.yaw));
      if (Math.abs(settled) < .16) return;
      continue;
    }
    const code = delta > 0 ? "KeyQ" : "KeyE";
    frame.contentWindow.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
    await wait(Math.max(30, Math.min(220, Math.abs(delta) / .6 * 1000)));
    frame.contentWindow.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
    await wait(100);
  }
  throw new Error("转身未完成：" + state().player.yaw);
}
async function act(expected) {
  const action = demo().getInteraction();
  if (action?.type !== expected) throw new Error("交互不匹配 " + expected + " / " + JSON.stringify(action));
  frame.contentWindow.dispatchEvent(new KeyboardEvent("keydown", { key: "f", code: "KeyF", bubbles: true }));
  frame.contentWindow.dispatchEvent(new KeyboardEvent("keyup", { key: "f", code: "KeyF", bubbles: true }));
  await wait(1800);
  if (state().failed) throw new Error("交互后余量耗尽");
}
const actions = {
  supply: async () => {
    agent().reset();
    capture("01 起点 / 双视角");
    await walk(-6.8, 1.25); await face(Math.PI); await act("battery");
    capture("02 能源模块携带");
    await walk(-6.8, 2.1); await walk(6.15, 2.1); await act("slot");
    await walk(.6, -.3); await face(Math.PI); await walk(.6, -.3); await act("shutter");
    while (state().shutterLift < 2.1) await agent().act({action:"WAIT",durationMs:250,harness:"state"});
    capture("03 卷帘门开启");
  },
  lighting: async () => {
    if (state().shutterLift < 2.1) {
      await walk(.6, -.3); await face(Math.PI); await walk(.6, -.3); await act("shutter");
      while (state().shutterLift < 2.1) await agent().act({action:"WAIT",durationMs:250,harness:"state"});
    }
    await walk(.9, -.3); await walk(.9, -3.1);
    capture("04 进入厂房 / 照明关闭");
    await walk(3.8, -3.1); await walk(3.8, -5.5); await face(Math.PI); await act("lights");
    await walk(3.8, -3.85); await walk(.65, -3.85); await face(Math.PI);
    capture("05 分拣线 / 照明开启");
    const before = state();
    await agent().act({ action: "WAIT", durationMs: 700, harness: "state" });
    const after = state();
    const continuous = PARCEL_TYPES.filter(type => before.parcels[type].onBelt && after.parcels[type].onBelt);
    if (!continuous.length || !continuous.every(type => after.parcels[type].x - before.parcels[type].x > .3)) {
      throw new Error("传送带快递没有持续移动");
    }
    capture("05B 静止观察 / 快递持续传送");
  },
  sort: async () => {
    for (const type of PARCEL_TYPES) {
      await walk(.65, -4.1); await face(Math.PI); await walk(.65, -3.85);
      let ready = false;
      for (let attempt = 0; attempt < 180; attempt += 1) {
        if (Math.hypot(state().player.x - .65, state().player.z + 3.85) > .06) await walkSegment(.65, -3.85);
        const action = demo().getInteraction();
        if (action?.type === "parcel" && action.parcelType === type) { ready = true; break; }
        await agent().act({action:"WAIT",durationMs:100,harness:"state"});
      }
      if (!ready) throw new Error("未遇到快递：" + type);
      await act("parcel");
      if (state().carriedItem !== "parcel-" + type) throw new Error("取件未成功：" + type + " / " + state().lastEvent);
      capture("06 手持 " + type);
      await face(0); await walk(.65, -4.1); await walk(SORTING.bins[type].x, -4.1);
      await act("sort-parcel"); capture("07 入栏 " + type);
      if (!state().complete) await walk(.65, -4.1);
    }
    if (!state().complete) throw new Error("分拣未完成");
    capture("08 正式关卡完成");
  },
  capture: async () => capture("当前画面"),
  reset: async () => { agent().reset(); report("已重置"); },
  save: async () => {
    const screenshots = [...document.querySelectorAll("#captures img")].map(image => ({ label: image.alt, image: image.src }));
    const response = await fetch("/api/recordings", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ level: SORTING.revision + "-qa", revision: SORTING.revision, trace, screenshots,
        frameCadence: document.querySelector("#performance").textContent }) });
    if (!response.ok) throw new Error("Evidence save failed: " + response.status);
    const saved = await response.json();
    status.textContent = "证据已保存：" + saved.id;
  },
  full: async () => { await actions.supply(); await actions.lighting(); await actions.sort(); await actions.save(); },
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
