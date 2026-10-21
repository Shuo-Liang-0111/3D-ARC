import {
  SEED_PROTOCOL_VERSION,
  parseSeed,
  getSeedPolicy,
  createSeededInitialState,
} from "./environment-seed.js";

// Canonical JSON follows JSON serialization rules with sorted object keys.
// This fingerprint is diagnostic evidence, not a cryptographic signature.
export function initialStateFingerprint(state) {
  const canonical = JSON.stringify(state, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]));
    }
    return value;
  });
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(canonical)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return "fnv1a64-v1:" + hash.toString(16).padStart(16, "0");
}

/** Initialize once, before simulation advances, and retain only opaque evidence. */
export function createEpisodeEnvironment(runtime, levelId, seedValue) {
  const requestedSeed = parseSeed(seedValue);
  const seedPolicy = getSeedPolicy(levelId);
  const seed = seedPolicy === "seeded" ? requestedSeed : null;
  const seedApplied = seed !== null;
  const state = createSeededInitialState(runtime, levelId, seed);
  const environment = Object.freeze({
    protocolVersion: SEED_PROTOCOL_VERSION,
    seed,
    seedPolicy,
    seedApplied,
    initialStateFingerprint: seedApplied ? initialStateFingerprint(state) : null,
  });
  return { state, environment };
}
