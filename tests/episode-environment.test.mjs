import test from "node:test";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import {
  initialStateFingerprint,
  createEpisodeEnvironment,
} from "../game/episode-environment.js";
import { SEED_PROTOCOL_VERSION } from "../game/environment-seed.js";
import * as rf01 from "../game/levels/rf01/engine.js";
import { createHotelEngine } from "../game/levels/rf05/series-engine.js";
import { createOfficeEngine } from "../game/levels/rf09/office-engine.js";

const fingerprintPattern = /^fnv1a64-v1:[0-9a-f]{16}$/;
const sameState = (actual, expected, message) => {
  assert.ok(isDeepStrictEqual(actual, expected), message);
};

test("initial state fingerprint canonicalizes nested object keys but preserves array order", () => {
  const first = {
    z: { b: 2, a: 1 },
    a: [{ right: true, left: false }, { count: 0 }],
    label: "环境",
  };
  const reordered = {
    label: "环境",
    a: [{ left: false, right: true }, { count: 0 }],
    z: { a: 1, b: 2 },
  };
  const before = structuredClone(first);
  const fingerprint = initialStateFingerprint(first);
  assert.match(fingerprint, fingerprintPattern);
  assert.equal(fingerprint, initialStateFingerprint(reordered));
  assert.notEqual(fingerprint, initialStateFingerprint({ ...first, a: [...first.a].reverse() }));
  assert.notEqual(fingerprint, initialStateFingerprint({ ...first, label: "環境" }));
  sameState(first, before, "fingerprinting does not mutate input state");
});

test("canonical fingerprints follow JSON omission, null and array serialization rules", () => {
  assert.equal(initialStateFingerprint({ a: 0, omitted: undefined }), initialStateFingerprint({ a: 0 }));
  assert.equal(
    initialStateFingerprint({ numbers: [undefined, NaN, Infinity], value: -0 }),
    initialStateFingerprint({ value: 0, numbers: [null, null, null] }),
  );
  assert.equal(
    initialStateFingerprint({ "12": "b", "2": "a", nested: { z: 1, a: 2 } }),
    initialStateFingerprint({ nested: { a: 2, z: 1 }, "2": "a", "12": "b" }),
  );
});

test("zero is applied as a real seed and carries versioned initial evidence", () => {
  const engine = createOfficeEngine("rf09-3");
  const numeric = createEpisodeEnvironment(engine, "rf09-3", 0);
  const fromUrl = createEpisodeEnvironment(engine, "rf09-3", "0");
  sameState(numeric.state, fromUrl.state, "numeric and URL zero reproduce the real engine");
  assert.deepEqual(numeric.environment, fromUrl.environment);
  assert.equal(numeric.environment.protocolVersion, SEED_PROTOCOL_VERSION);
  assert.equal(numeric.environment.seed, 0);
  assert.equal(numeric.environment.seedPolicy, "seeded");
  assert.equal(numeric.environment.seedApplied, true);
  assert.match(numeric.environment.initialStateFingerprint, fingerprintPattern);
  assert.equal(numeric.environment.initialStateFingerprint, initialStateFingerprint(numeric.state));
  assert.equal(Object.isFrozen(numeric.environment), true);
});

test("a fixed real level never applies a supplied seed or advertises a seeded fingerprint", () => {
  for (const seed of [undefined, null, "", 0, 20261009, "4294967295"]) {
    const result = createEpisodeEnvironment(rf01, "rf01", seed);
    sameState(result.state, rf01.createInitialState(), "RF01 retains its fixed constructor");
    assert.deepEqual(result.environment, {
      protocolVersion: SEED_PROTOCOL_VERSION,
      seed: null,
      seedPolicy: "fixed",
      seedApplied: false,
      initialStateFingerprint: null,
    });
  }
});

test("missing seed preserves legacy random-level behavior without claiming it was applied", () => {
  const engine = createHotelEngine("rf05-3");
  for (const seed of [undefined, null, ""]) {
    const result = createEpisodeEnvironment(engine, "rf05-3", seed);
    sameState(result.state, engine.createInitialState(), "omitted seed keeps legacy tissue initialization");
    assert.deepEqual(result.environment, {
      protocolVersion: SEED_PROTOCOL_VERSION,
      seed: null,
      seedPolicy: "seeded",
      seedApplied: false,
      initialStateFingerprint: null,
    });
  }
});

test("the same seed retains the same fingerprint across independent real initializations", () => {
  for (const [levelId, factory] of [
    ["rf05-3", () => createHotelEngine("rf05-3")],
    ["rf09-3", () => createOfficeEngine("rf09-3")],
  ]) {
    for (const seed of [0, 20261009, 4294967295]) {
      const left = createEpisodeEnvironment(factory(), levelId, seed);
      const right = createEpisodeEnvironment(factory(), levelId, String(seed));
      sameState(left.state, right.state, levelId + " initial states match");
      assert.deepEqual(left.environment, right.environment);
      assert.match(left.environment.initialStateFingerprint, fingerprintPattern);
    }
  }
});

test("different seeds change real random events and their initial fingerprints", () => {
  const events = new Set();
  const fingerprints = new Set();
  for (const seed of [0, 1, 2, 42, 4294967295]) {
    const result = createEpisodeEnvironment(createOfficeEngine("rf09-3"), "rf09-3", seed);
    events.add(result.state.phone.ringAt);
    fingerprints.add(result.environment.initialStateFingerprint);
  }
  assert.ok(events.size > 1, "the actual event time changes");
  assert.ok(fingerprints.size > 1, "initial evidence distinguishes changed environments");
});

test("initial fingerprint remains immutable evidence after real simulation and state mutation", () => {
  const engine = createOfficeEngine("rf09-3");
  const result = createEpisodeEnvironment(engine, "rf09-3", 20261009);
  const before = result.environment.initialStateFingerprint;
  const next = engine.updateEnvironment(result.state, 0.25);
  assert.notEqual(initialStateFingerprint(next), before, "simulation advances the current state");
  assert.equal(result.environment.initialStateFingerprint, before, "metadata still describes initialization");
  result.state.player.x += 0.125;
  result.state.phone.ringAt += 1;
  assert.notEqual(initialStateFingerprint(result.state), before);
  assert.equal(result.environment.initialStateFingerprint, before);
  assert.throws(() => { result.environment.initialStateFingerprint = "changed"; }, TypeError);
});

test("invalid seed values fail before returning misleading environment evidence", () => {
  for (const value of [-1, 4294967296, 1.5, "1e2", true, {}, NaN]) {
    assert.throws(() => createEpisodeEnvironment(rf01, "rf01", value), RangeError);
    assert.throws(
      () => createEpisodeEnvironment(createOfficeEngine("rf09-3"), "rf09-3", value),
      RangeError,
    );
  }
});
