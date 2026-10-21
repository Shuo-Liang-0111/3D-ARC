import test from "node:test";
import assert from "node:assert/strict";
import { LEVEL } from "../game/levels/rf12/level.js";
import { createInitialState, getInteraction, interact, isWalkable, updateMovement } from "../game/levels/rf12/engine.js";

test("RF-12 starts at the kitchen entrance with four task items", () => {
  const state = createInitialState();
  assert.equal(state.player.x, 0);
  assert.deepEqual(Object.keys(state.items), ["tomato", "tofu", "oil", "pan"]);
  assert.equal(isWalkable(state, state.player.x, state.player.z), true);
});

test("RF-12 enforces hood-before-burner safety order", () => {
  let state = createInitialState();
  state.recipeRead = true;
  state.items.pan = { type: "pan", location: "prep", ...LEVEL.prepTargets.oil };
  state.player = { ...LEVEL.burner };
  assert.equal(getInteraction(state).type, "hood");
  state.player = { ...LEVEL.hoodSwitch };
  state = interact(state);
  assert.equal(state.hoodOn, true);
  state.panOnBurner = true;
  state.items.pan = { type: "pan", location: "burner", ...LEVEL.burner };
  state.player = { ...LEVEL.burner };
  state = interact(state);
  assert.equal(state.burnerOn, true);
});

test("RF-12 cooking timer completes after eight seconds", () => {
  let state = createInitialState();
  state.recipeRead = true;
  state.panOnBurner = true;
  state.items.pan = { type: "pan", location: "burner", ...LEVEL.burner };
  state.hoodOn = true;
  state.burnerOn = true;
  for (let index = 0; index < 170; index += 1) state = updateMovement(state, { drain: false }, 0.05);
  assert.equal(state.cookingDone, true);
});
