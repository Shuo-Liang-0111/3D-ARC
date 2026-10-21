const HOLD_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
]);

function setText(element, value) {
  if (element && element.textContent !== value) element.textContent = value;
}

export function mountOperatorConsole({
  root,
  pressControl,
  releaseControl,
  interact,
  reset,
  stop,
}) {
  if (!root) return null;

  const controlState = root.querySelector("#operator-control-state");
  const motionState = root.querySelector("#operator-motion-state");
  const inputState = root.querySelector("#operator-input-state");
  const stopButton = root.querySelector("#operator-stop");
  const feedLabel = document.querySelector("#operator-live-label");
  const feedPip = document.querySelector("#operator-live-pip");
  const feedPath = document.querySelector("#operator-feed-path");
  const clock = document.querySelector("#operator-clock");
  const holdButtons = [...root.querySelectorAll("[data-control-code]")];
  const actionButtons = [...root.querySelectorAll("[data-operator-action]")];
  const buttonsByCode = new Map();
  const pressedCodes = new Set();
  let enabled = false;

  holdButtons.forEach((button) => {
    const code = button.dataset.controlCode;
    if (!HOLD_CODES.has(code)) return;
    const codeButtons = buttonsByCode.get(code) ?? [];
    codeButtons.push(button);
    buttonsByCode.set(code, codeButtons);

    const begin = (event) => {
      if (!enabled) return;
      event.preventDefault();
      if (event.pointerId !== undefined) button.setPointerCapture?.(event.pointerId);
      pressControl(code);
    };
    const end = (event) => {
      event?.preventDefault();
      releaseControl(code);
    };

    button.addEventListener("pointerdown", begin);
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", end);
    button.addEventListener("lostpointercapture", end);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
    button.addEventListener("keydown", (event) => {
      if ((event.code === "Space" || event.code === "Enter") && !event.repeat) begin(event);
    });
    button.addEventListener("keyup", (event) => {
      if (event.code === "Space" || event.code === "Enter") end(event);
    });
    button.addEventListener("blur", () => releaseControl(code));
  });

  actionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!enabled) return;
      const action = button.dataset.operatorAction;
      button.classList.add("active");
      window.setTimeout(() => button.classList.remove("active"), 180);
      if (action === "interact") interact();
      else if (action === "reset") reset();
    });
  });

  stopButton?.addEventListener("click", () => {
    stop();
    clearPressed();
  });

  function setPressed(code, active) {
    if (!HOLD_CODES.has(code)) return;
    if (active) pressedCodes.add(code);
    else pressedCodes.delete(code);
    (buttonsByCode.get(code) ?? []).forEach((button) => {
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function clearPressed() {
    [...pressedCodes].forEach((code) => setPressed(code, false));
  }

  function setEnabled(nextEnabled) {
    if (enabled && !nextEnabled) {
      [...pressedCodes].forEach((code) => releaseControl(code));
      clearPressed();
    }
    enabled = nextEnabled;
    root.dataset.controlEnabled = String(enabled);
    holdButtons.forEach((button) => { button.disabled = !enabled; });
    actionButtons.forEach((button) => { button.disabled = !enabled; });
    if (stopButton) stopButton.disabled = !enabled;
  }

  function update({
    controlEnabled,
    controlMode,
    motion,
    input,
    feed,
    level,
  }) {
    setEnabled(Boolean(controlEnabled));
    setText(controlState, controlMode);
    controlState?.classList.toggle("online", controlMode === "LOCAL");
    controlState?.classList.toggle("agent", controlMode === "AGENT");
    setText(motionState, motion);
    setText(inputState, input);
    inputState?.classList.toggle("ready", input === "READY");
    inputState?.classList.toggle("agent", input === "AGENT");
    setText(feedLabel, feed);
    setText(feedPath, `${level} → LOCAL SIM → G1`);
    feedPip?.classList.toggle("streaming", feed === "RUNNING");
    feedPip?.classList.toggle("agent", feed === "AGENT");
  }

  function updateClock() {
    setText(clock, new Date().toLocaleTimeString("zh-CN", { hour12: false }));
  }

  updateClock();
  const clockTimer = window.setInterval(updateClock, 1000);
  root.dataset.controlEnabled = "false";
  holdButtons.forEach((button) => { button.disabled = true; });
  actionButtons.forEach((button) => { button.disabled = true; });

  return {
    clearPressed,
    setPressed,
    update,
    destroy() {
      window.clearInterval(clockTimer);
      clearPressed();
    },
  };
}
