/** Seeded initialization for the environment, independent of model sampling. */
export const SEED_PROTOCOL_VERSION = "arc-seed-v1";

export const SEEDED_LEVEL_IDS = Object.freeze([
  "rf02-3",
  "rf05-3",
  "rf06-3",
  "rf07-2",
  "rf07-3",
  "rf09-3",
  "rf13-03",
  "rf14-3",
]);

const seededLevels = new Set(SEEDED_LEVEL_IDS);

/** Parse an optional unsigned 32-bit seed from JSON or a decimal URL value. */
export function parseSeed(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string" && /^[0-9]+$/.test(value)) value = Number(value);
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError("seed must be an integer between 0 and 4294967295");
  }
  return value === 0 ? 0 : value;
}

/** Mulberry32: its exact integer sequence is part of arc-seed-v1. */
export function createSeededRandom(seed) {
  let state = parseSeed(seed);
  if (state === null) throw new RangeError("A seed is required to create a random stream");
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function getSeedPolicy(levelId) {
  return seededLevels.has(levelId) ? "seeded" : "fixed";
}

/** Preserve each runtime's native constructor signature without global hooks. */
export function createSeededInitialState(runtime, levelId, seed) {
  const parsed = parseSeed(seed);
  if (parsed === null || getSeedPolicy(levelId) === "fixed") return runtime.createInitialState();

  switch (levelId) {
    case "rf02-3":
    case "rf09-3":
      return runtime.createInitialState({ random: createSeededRandom(parsed) });
    case "rf05-3":
    case "rf14-3":
      return runtime.createInitialState({ seed: parsed });
    case "rf06-3":
    case "rf13-03":
      return runtime.createInitialState(parsed);
    case "rf07-2":
    case "rf07-3":
      return runtime.createInitialState(createSeededRandom(parsed));
    default:
      throw new RangeError("No seeded initializer for level " + levelId);
  }
}
