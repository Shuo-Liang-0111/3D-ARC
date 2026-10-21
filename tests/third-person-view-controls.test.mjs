import assert from "node:assert/strict";
import test from "node:test";

import {
  getThirdPersonCssViewport,
  isPointInThirdPersonViewport,
  mountThirdPersonViewControls,
  nextThirdPersonZoom,
} from "../game/third-person-view-controls.js";

function createPointerEvent(type, properties) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.entries(properties).forEach(([key, value]) => {
    Object.defineProperty(event, key, { value });
  });
  return event;
}

test("dual landscape assigns the right half to the third-person view", () => {
  assert.deepEqual(getThirdPersonCssViewport("dual", 1920, 1080), {
    x: 960,
    y: 0,
    width: 960,
    height: 1080,
  });
  assert.equal(isPointInThirdPersonViewport("dual", 1920, 1080, 1200, 500), true);
  assert.equal(isPointInThirdPersonViewport("dual", 1920, 1080, 700, 500), false);
});

test("dual portrait assigns the bottom half to the third-person view", () => {
  assert.deepEqual(getThirdPersonCssViewport("dual", 900, 1400), {
    x: 0,
    y: 700,
    width: 900,
    height: 700,
  });
  assert.equal(isPointInThirdPersonViewport("dual", 900, 1400, 450, 1100), true);
  assert.equal(isPointInThirdPersonViewport("dual", 900, 1400, 450, 300), false);
});

test("single-view hit testing only enables the third-person mode", () => {
  assert.equal(isPointInThirdPersonViewport("third", 1280, 720, 80, 80), true);
  assert.equal(isPointInThirdPersonViewport("first", 1280, 720, 80, 80), false);
});

test("mouse wheel zoom is smooth and clamped", () => {
  assert.ok(nextThirdPersonZoom(1, -120) < 1);
  assert.ok(nextThirdPersonZoom(1, 120) > 1);
  assert.equal(nextThirdPersonZoom(0.35, -10000), 0.35);
  assert.equal(nextThirdPersonZoom(2.6, 10000), 2.6);
});

test("third-person controls select, zoom, and orbit inside the right viewport", () => {
  const previousWindow = globalThis.window;
  globalThis.window = new EventTarget();

  const element = new EventTarget();
  element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1200, height: 700 });
  element.setPointerCapture = () => {};
  const shell = { dataset: {} };
  const orbitEvents = [];
  const zoomEvents = [];
  const controls = mountThirdPersonViewControls({
    element,
    shell,
    getViewMode: () => "dual",
    onOrbit: (event) => orbitEvents.push(event),
    onZoom: (deltaY) => zoomEvents.push(deltaY),
  });

  try {
    element.dispatchEvent(createPointerEvent("pointerdown", {
      button: 0,
      pointerId: 1,
      clientX: 900,
      clientY: 300,
    }));
    assert.equal(shell.dataset.thirdViewSelected, "true");

    const wheel = createPointerEvent("wheel", {
      deltaY: -240,
      clientX: 900,
      clientY: 300,
    });
    element.dispatchEvent(wheel);
    assert.equal(wheel.defaultPrevented, true);
    assert.deepEqual(zoomEvents, [-240]);

    element.dispatchEvent(createPointerEvent("pointerdown", {
      button: 1,
      pointerId: 2,
      clientX: 900,
      clientY: 300,
    }));
    assert.equal(shell.dataset.thirdViewDragging, "true");

    element.dispatchEvent(createPointerEvent("pointermove", {
      pointerId: 2,
      clientX: 940,
      clientY: 325,
    }));
    assert.deepEqual(orbitEvents, [{ yaw: -0.2, pitch: -0.1 }]);

    element.dispatchEvent(createPointerEvent("pointerup", { pointerId: 2 }));
    assert.equal(shell.dataset.thirdViewDragging, "false");
  } finally {
    controls.destroy();
    globalThis.window = previousWindow;
  }
});
