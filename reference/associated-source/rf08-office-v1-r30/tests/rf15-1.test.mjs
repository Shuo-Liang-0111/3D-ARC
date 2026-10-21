import test from "node:test";
import assert from "node:assert/strict";
import { FIELD_CROPS, FIELD } from "../game/levels/rf15/field-layout.js";
import { createInitialState, getInteraction, interact, updateEnvironment } from "../game/levels/rf15-2/engine.js";

test("RF15-2 cuts the field plant with a knife before collecting it in the nearby basket", () => {
  let state = createInitialState();
  const crop = FIELD_CROPS[3];
  state.player = { ...state.player, x: 11.95, z: crop.z };
  assert.equal(getInteraction(state).type, "knife-required");
  state.heldTool = "harvest-knife";
  state = interact(state);
  assert.equal(state.cuttingCrop, crop.id);
  assert.equal(state.crops[crop.id].location, "field");
  for (let frame = 0; frame < 20; frame++) state = updateEnvironment(state, .05);
  assert.equal(state.carriedCrop, crop.id);
  state.player = { ...state.player, x: FIELD.basket.x, z: FIELD.basket.z + .8 };
  state = interact(state);
  assert.equal(state.crops[crop.id].location, "basket");
  assert.equal(state.complete, false);
  assert.equal(createInitialState().crops[crop.id].location, "field");
});
