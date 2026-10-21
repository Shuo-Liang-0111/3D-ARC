import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_VIEW_MODE, fitAspectViewport, getViewports, resolveViewMode } from "../game/view-mode.js";

test("view mode defaults to third person and URL selection wins", () => {
  assert.equal(DEFAULT_VIEW_MODE, "third");
  assert.equal(resolveViewMode(null, null), "third");
  assert.equal(resolveViewMode("first", "dual"), "first");
  assert.equal(resolveViewMode("unknown", "dual"), "dual");
  assert.equal(resolveViewMode("unknown", "also-unknown"), "third");
});

test("single view modes use the complete frame", () => {
  assert.deepEqual(getViewports("first", 1280, 720), [
    { view: "first", x: 0, y: 0, width: 1280, height: 720 },
  ]);
  assert.deepEqual(getViewports("third", 1280, 720), [
    { view: "third", x: 0, y: 0, width: 1280, height: 720 },
  ]);
});

test("dual landscape view splits into equal left and right frames", () => {
  const [first, third] = getViewports("dual", 1280, 720);
  assert.deepEqual(first, { view: "first", x: 0, y: 0, width: 640, height: 720 });
  assert.deepEqual(third, { view: "third", x: 640, y: 0, width: 640, height: 720 });
  assert.equal(first.width * first.height, third.width * third.height);
});

test("dual portrait view splits into equal top and bottom frames", () => {
  const [first, third] = getViewports("dual", 720, 1280);
  assert.deepEqual(first, { view: "first", x: 0, y: 640, width: 720, height: 640 });
  assert.deepEqual(third, { view: "third", x: 0, y: 0, width: 720, height: 640 });
  assert.equal(first.width * first.height, third.width * third.height);
});

test("D435 aspect fitting preserves the sensor frame without stretching", () => {
  assert.deepEqual(fitAspectViewport({ view: "first", x: 0, y: 0, width: 848, height: 600 }, 848 / 480), {
    view: "first", x: 0, y: 60, width: 848, height: 480,
  });
  assert.deepEqual(fitAspectViewport({ view: "first", x: 0, y: 0, width: 1000, height: 480 }, 848 / 480), {
    view: "first", x: 76, y: 0, width: 848, height: 480,
  });
});
