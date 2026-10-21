// Preserved 2D prototype application.
import {
  ACTION,
  LEVEL,
  PALETTE,
  STATUS,
  cloneState,
  createInitialState,
  efficiencyScore,
  recordingToJsonl,
  renderFrame,
  startState,
  step,
} from "./engine.js";

const canvas = document.querySelector("#game-canvas");
const context = canvas.getContext("2d", { alpha: false });
const startOverlay = document.querySelector("#start-overlay");
const completeOverlay = document.querySelector("#complete-overlay");
const startButton = document.querySelector("#start-button");
const actionValue = document.querySelector("#action-value");
const levelValue = document.querySelector("#level-value");
const stateValue = document.querySelector("#state-value");
const scoreValue = document.querySelector("#score-value");
const frameValue = document.querySelector("#frame-value");
const signalCyan = document.querySelector("#signal-cyan");
const signalMagenta = document.querySelector("#signal-magenta");
const actionLog = document.querySelector("#action-log");
const replayProgress = document.querySelector("#replay-progress");
const replayButton = document.querySelector("#replay-button");
const exportButton = document.querySelector("#export-button");
const undoButton = document.querySelector("#undo-button");
const resetButton = document.querySelector("#reset-button");
const scanButton = document.querySelector("#scan-button");
const completeReplay = document.querySelector("#complete-replay");
const completeReset = document.querySelector("#complete-reset");
const liveRegion = document.querySelector("#live-region");
const movementButtons = [...document.querySelectorAll("[data-action]")];

const actionNames = {
  [ACTION.RESET]: "RESET",
  [ACTION.UP]: "UP",
  [ACTION.DOWN]: "DOWN",
  [ACTION.LEFT]: "LEFT",
  [ACTION.RIGHT]: "RIGHT",
  [ACTION.SCAN]: "SCAN",
  [ACTION.UNDO]: "UNDO",
};

const eventLabels = {
  boot: "Environment idle",
  environment_ready: "Initial frame received",
  move: "Position updated",
  boundary: "Boundary resisted",
  gate_resists: "Cyan barrier resisted",
  scan_silent: "No active echo",
  scan_echo: "Signal echo detected",
  signal_cyan: "Channel 01 acquired",
  signal_magenta: "Channel 02 acquired",
  terminal_dormant: "Terminal is dormant",
  win: "Terminal state reached",
  action_unavailable: "Action unavailable",
};

let state = createInitialState();
let timeline = [];
let isReplaying = false;
let replayTimer = null;

function now() {
  return new Date().toISOString();
}

function entry(action, currentState) {
  return {
    timestamp: now(),
    action,
    actionName: actionNames[action] ?? "UNKNOWN",
    state: cloneState(currentState),
  };
}

function paintFrame(currentState) {
  const indexedFrame = renderFrame(currentState);
  const image = context.createImageData(64, 64);
  indexedFrame.forEach((colorIndex, index) => {
    const color = PALETTE[colorIndex].slice(1);
    image.data[index * 4] = Number.parseInt(color.slice(0, 2), 16);
    image.data[index * 4 + 1] = Number.parseInt(color.slice(2, 4), 16);
    image.data[index * 4 + 2] = Number.parseInt(color.slice(4, 6), 16);
    image.data[index * 4 + 3] = 255;
  });
  context.putImageData(image, 0, 0);
}

function setControlState() {
  const disabled = state.status !== STATUS.PLAYING || isReplaying;
  movementButtons.forEach((button) => { button.disabled = disabled; });
  scanButton.disabled = disabled;
  undoButton.disabled = disabled || timeline.length <= 1;
  resetButton.disabled = state.status === STATUS.NOT_STARTED || isReplaying;
  replayButton.disabled = timeline.length <= 1 || isReplaying;
  exportButton.disabled = timeline.length === 0;
}

function renderSignals(currentState) {
  signalCyan.classList.toggle("active", currentState.signals.cyan);
  signalMagenta.classList.toggle("active", currentState.signals.magenta);
  signalCyan.querySelector("b").textContent = currentState.signals.cyan ? "ON" : "—";
  signalMagenta.querySelector("b").textContent = currentState.signals.magenta ? "ON" : "—";
}

function renderLog(currentTimeline = timeline) {
  const recent = currentTimeline.slice(-8);
  actionLog.replaceChildren(...recent.map((item) => {
    const li = document.createElement("li");
    li.className = `event-${item.state.lastEvent}`;
    const action = document.createElement("b");
    action.textContent = item.actionName;
    const event = document.createElement("span");
    event.textContent = eventLabels[item.state.lastEvent] ?? item.state.lastEvent;
    li.append(action, event);
    return li;
  }));
}

function render(currentState = state, currentTimeline = timeline) {
  paintFrame(currentState);
  actionValue.textContent = String(currentState.actions).padStart(3, "0");
  frameValue.textContent = String(currentState.frame).padStart(3, "0");
  levelValue.textContent = currentState.status === STATUS.WIN ? "1 / 1" : "0 / 1";
  stateValue.textContent = currentState.status.replaceAll("_", " ");
  const score = efficiencyScore(currentState);
  scoreValue.textContent = score === null ? "—" : `${score.toFixed(1)}%`;
  renderSignals(currentState);
  renderLog(currentTimeline);
  completeOverlay.hidden = currentState.status !== STATUS.WIN || isReplaying;
  setControlState();
}

function announce(message) {
  liveRegion.textContent = "";
  window.setTimeout(() => { liveRegion.textContent = message; }, 20);
}

function startGame() {
  stopReplay();
  state = startState();
  timeline = [entry(ACTION.RESET, state)];
  startOverlay.hidden = true;
  completeOverlay.hidden = true;
  replayProgress.textContent = "";
  render();
  announce("Environment started");
}

function perform(action) {
  if (state.status !== STATUS.PLAYING || isReplaying) return;
  state = step(state, action);
  timeline.push(entry(action, state));
  render();
  announce(eventLabels[state.lastEvent] ?? state.lastEvent);
}

function undo() {
  if (isReplaying || timeline.length <= 1) return;
  timeline.pop();
  state = cloneState(timeline.at(-1).state);
  state.lastEvent = "environment_ready";
  render();
  announce("Previous action removed");
}

function stopReplay() {
  if (replayTimer) window.clearInterval(replayTimer);
  replayTimer = null;
  isReplaying = false;
  replayProgress.textContent = "";
}

function playReplay() {
  if (timeline.length <= 1 || isReplaying) return;
  const replay = timeline.map((item) => ({ ...item, state: cloneState(item.state) }));
  isReplaying = true;
  completeOverlay.hidden = true;
  let index = 0;
  replayProgress.textContent = `REPLAY ${index + 1}/${replay.length}`;
  render(replay[index].state, replay.slice(0, index + 1));
  replayTimer = window.setInterval(() => {
    index += 1;
    if (index >= replay.length) {
      stopReplay();
      render();
      return;
    }
    replayProgress.textContent = `REPLAY ${index + 1}/${replay.length}`;
    render(replay[index].state, replay.slice(0, index + 1));
  }, 420);
  setControlState();
}

function exportRun() {
  if (timeline.length === 0) return;
  const data = recordingToJsonl(timeline);
  const url = URL.createObjectURL(new Blob([data], { type: "application/x-ndjson" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${LEVEL.id}-${Date.now()}.recording.jsonl`;
  link.click();
  URL.revokeObjectURL(url);
}

const buttonActions = {
  UP: ACTION.UP,
  DOWN: ACTION.DOWN,
  LEFT: ACTION.LEFT,
  RIGHT: ACTION.RIGHT,
};

movementButtons.forEach((button) => {
  button.addEventListener("click", () => perform(buttonActions[button.dataset.action]));
});
startButton.addEventListener("click", startGame);
scanButton.addEventListener("click", () => perform(ACTION.SCAN));
undoButton.addEventListener("click", undo);
resetButton.addEventListener("click", startGame);
replayButton.addEventListener("click", playReplay);
exportButton.addEventListener("click", exportRun);
completeReplay.addEventListener("click", playReplay);
completeReset.addEventListener("click", startGame);

window.addEventListener("keydown", (event) => {
  if (state.status === STATUS.NOT_STARTED && [" ", "Enter"].includes(event.key)) {
    event.preventDefault();
    startGame();
    return;
  }
  if (event.repeat || isReplaying) return;
  const keyActions = {
    ArrowUp: ACTION.UP, w: ACTION.UP, W: ACTION.UP,
    ArrowDown: ACTION.DOWN, s: ACTION.DOWN, S: ACTION.DOWN,
    ArrowLeft: ACTION.LEFT, a: ACTION.LEFT, A: ACTION.LEFT,
    ArrowRight: ACTION.RIGHT, d: ACTION.RIGHT, D: ACTION.RIGHT,
    " ": ACTION.SCAN,
  };
  if (keyActions[event.key]) {
    event.preventDefault();
    perform(keyActions[event.key]);
  } else if (["z", "Z"].includes(event.key)) {
    event.preventDefault();
    undo();
  } else if (["r", "R"].includes(event.key)) {
    event.preventDefault();
    startGame();
  }
});

render();
