const frame = document.querySelector("#game");
const result = document.querySelector("#result");
const status = document.querySelector("#status");
const wait = duration => new Promise(resolve => setTimeout(resolve, duration));
const trace = [];
const captures = [];
function agent() { return frame.contentWindow.__ARC_AGENT__; }
function report(label) {
  const state = agent().getState();
  trace.push({ label, state });
  result.textContent = JSON.stringify({ label, ...state });
  status.textContent = label;
}
async function ready() {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (agent()?.ready().ready) return;
    await wait(200);
  }
  throw new Error("正式关卡加载失败");
}
async function walkTo(x, z) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const state = agent().getState();
    if (state.failed) throw new Error("任务余量耗尽");
    const dx = x - state.player.x;
    const dz = z - state.player.z;
    if (Math.hypot(dx, dz) < .08) return;
    const forward = dx * Math.sin(state.player.yaw) + dz * Math.cos(state.player.yaw);
    const lateral = dx * Math.cos(state.player.yaw) - dz * Math.sin(state.player.yaw);
    const useForward = Math.abs(forward) >= Math.abs(lateral);
    const distance = Math.abs(useForward ? forward : lateral);
    const action = useForward ? (forward > 0 ? "W" : "S") : (lateral > 0 ? "A" : "D");
    await agent().act({ action, durationMs: Math.max(50, Math.min(350, distance / 1.4 * 1000)), harness: "state" });
  }
  throw new Error("路线受阻: " + JSON.stringify(agent().getState().player));
}
const actions = {
  reset: async () => { await ready(); agent().reset(); report("初始：门关闭，照明 OFF"); },
  approach: async () => { await walkTo(-.68, 0); report("到达门外按钮"); },
  open: async () => { await walkTo(-.68, -.05); await agent().act({ action: "E", harness: "state" }); report("卷帘门升起中"); },
  enter: async () => {
    while (agent().getState().shutterLift < 2.1) await agent().act({ action: "WAIT", durationMs: 500, harness: "state" });
    await walkTo(1.6, 0); await walkTo(1.6, -3); report("已进入，照明仍 OFF");
  },
  switch: async () => { await walkTo(3.8, -3); await walkTo(3.8, -5.5); report("到达室内开关"); },
  light: async () => { await agent().act({ action: "E", harness: "state" }); report("开灯结果"); },
  full: async () => {
    await actions.reset();
    await actions.approach();
    await actions.open();
    await actions.enter();
    captures.push({ label: "进入黑暗厂房", image: frame.contentWindow.__RELAY_DEMO__.captureFrame() });
    await actions.switch();
    captures.push({ label: "开灯前", image: frame.contentWindow.__RELAY_DEMO__.captureFrame() });
    await actions.light();
    captures.push({ label: "开灯后", image: frame.contentWindow.__RELAY_DEMO__.captureFrame() });
    const state = agent().getState();
    if (!state.complete) throw new Error("未完成: " + JSON.stringify(state));
    status.textContent = "正式游戏完整通关，余量 " + state.progress.toFixed(1);
    for (const capture of captures) {
      const heading = document.createElement("h2"); heading.textContent = capture.label; document.body.append(heading);
      const image = document.createElement("img"); image.src = capture.image; image.style.width = "100%"; document.body.append(image);
    }
  },
  save: async () => {
    for (const capture of captures) {
      const saved = document.createElement("a"); saved.href = capture.image; saved.download = capture.label + ".jpg"; saved.click();
    }
    const link = document.createElement("a");
    link.href = frame.contentWindow.__RELAY_DEMO__.captureFrame();
    link.download = "rf01-2-" + (agent().getState().lightsOn ? "lit" : "dark") + ".jpg";
    link.click();
    const evidence = document.createElement("a");
    evidence.href = URL.createObjectURL(new Blob([JSON.stringify(trace, null, 2)], { type: "application/json" }));
    evidence.download = "rf01-2-browser-trace.json";
    evidence.click();
  },
};
for (const [name, action] of Object.entries(actions)) {
  document.getElementById(name).onclick = async () => {
    const buttons = [...document.querySelectorAll("button")];
    buttons.forEach(button => { button.disabled = true; });
    try { status.textContent = "执行中"; await action(); }
    catch (error) { status.textContent = error.message; }
    finally { buttons.forEach(button => { button.disabled = false; }); }
  };
}
await ready();
status.textContent = "正式关卡已加载，点击重置开始验证";
