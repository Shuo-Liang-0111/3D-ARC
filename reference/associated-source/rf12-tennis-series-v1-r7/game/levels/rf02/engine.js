import { BOOK_COLORS, LEVEL } from "./level.js";
import { applyRobotMovement } from "../../movement.js";

const EPSILON = 1e-6;

export function createInitialState() {
  return {
    player: { ...LEVEL.playerStart },
    books: Object.fromEntries(BOOK_COLORS.map((color) => [color, { color, location: "table", ...LEVEL.books[color] }])),
    carriedBook: null,
    terminalOpen: false,
    complete: false,
    failed: false,
    progress: LEVEL.progress.initial,
    rewardedBooks: {},
    rewardedPickups: {},
    motion: "idle",
    elapsed: 0,
    interactions: 0,
    lastEvent: "library_entered",
  };
}

export function cloneState(state) {
  return {
    ...state,
    player: { ...state.player },
    books: Object.fromEntries(BOOK_COLORS.map((color) => [color, { ...state.books[color] }])),
    rewardedBooks: { ...state.rewardedBooks },
    rewardedPickups: { ...state.rewardedPickups },
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function circleOverlapsRect(x, z, radius, rect) {
  const nearX = Math.max(rect.minX, Math.min(x, rect.maxX));
  const nearZ = Math.max(rect.minZ, Math.min(z, rect.maxZ));
  return (x - nearX) ** 2 + (z - nearZ) ** 2 < radius ** 2;
}

export function isWalkable(_state, x, z) {
  const { bounds, playerRadius: radius } = LEVEL;
  if (x - radius < bounds.minX || x + radius > bounds.maxX || z - radius < bounds.minZ || z + radius > bounds.maxZ) return false;
  return !LEVEL.staticColliders.some((rect) => circleOverlapsRect(x, z, radius, rect));
}

export function updateMovement(state, input, deltaSeconds) {
  const next = cloneState(state);
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
  next.elapsed += dt;
  if (state.complete || state.failed || state.terminalOpen) {
    next.motion = state.carriedBook ? "carrying" : "idle";
    return next;
  }

  const movement = applyRobotMovement(next, state, input, dt, LEVEL, isWalkable);
  if (!movement.active) {
    next.motion = state.carriedBook ? "carrying" : "idle";
    return next;
  }
  if (input.drain !== false) next.progress = Math.max(0, state.progress - LEVEL.progress.movementDrainPerSecond * dt);
  next.motion = movement.motionTurning ? "turning" : (state.carriedBook ? "carrying" : "moving");
  if (next.progress <= EPSILON) {
    next.progress = 0;
    next.failed = true;
    next.terminalOpen = false;
    next.motion = "idle";
    next.lastEvent = "progress_depleted";
  }
  return next;
}

function nearbyCandidates(state) {
  const candidates = [];
  if (!state.carriedBook) {
    for (const color of BOOK_COLORS) {
      const book = state.books[color];
      if (book.location === "table" || book.location === "ground") {
        candidates.push({ type: "book", color, distance: distance(state.player, book) });
      }
    }
  } else {
    for (const color of BOOK_COLORS) {
      candidates.push({ type: "shelf", color, distance: distance(state.player, LEVEL.shelves[color]) });
    }
  }
  candidates.push({ type: "terminal", distance: distance(state.player, LEVEL.terminal) });
  return candidates.filter((candidate) => candidate.distance <= LEVEL.interactionRange).sort((a, b) => a.distance - b.distance);
}

export function getInteraction(state) {
  if (state.complete || state.failed) return null;
  if (state.terminalOpen) return { type: "terminal-close", label: "关闭目录终端" };
  const nearest = nearbyCandidates(state)[0];
  if (nearest?.type === "book") return { ...nearest, label: `抓取${colorName(nearest.color)}书籍` };
  if (nearest?.type === "shelf") return { ...nearest, label: `放入${colorName(nearest.color)}书架` };
  if (nearest?.type === "terminal") return { ...nearest, label: "读取目录终端" };
  if (state.carriedBook) return { type: "drop", color: state.carriedBook, label: "放下书籍" };
  return null;
}

export function interact(state) {
  const interaction = getInteraction(state);
  if (!interaction) return cloneState(state);
  const next = cloneState(state);
  next.interactions += 1;

  if (interaction.type === "book") {
    next.carriedBook = interaction.color;
    next.books[interaction.color] = { color: interaction.color, location: "carried" };
    next.motion = "carrying";
    next.lastEvent = `book_collected_${interaction.color}`;
    if (!next.rewardedPickups[interaction.color]) {
      next.rewardedPickups[interaction.color] = true;
      next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.pickupReward);
    }
  } else if (interaction.type === "drop") {
    const color = state.carriedBook;
    next.books[color] = { color, location: "ground", x: state.player.x, z: state.player.z };
    next.carriedBook = null;
    next.motion = "idle";
    next.lastEvent = `book_dropped_${color}`;
  } else if (interaction.type === "shelf") {
    const carried = state.carriedBook;
    if (carried !== interaction.color) {
      next.lastEvent = "wrong_shelf";
    } else {
      next.books[carried] = { color: carried, location: "shelved", ...LEVEL.shelves[carried] };
      next.carriedBook = null;
      next.motion = "idle";
      next.lastEvent = `book_shelved_${carried}`;
      if (!next.rewardedBooks[carried]) {
        next.rewardedBooks[carried] = true;
        next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.correctBookReward);
      }
      if (BOOK_COLORS.every((color) => next.books[color].location === "shelved")) {
        next.progress = Math.min(LEVEL.progress.maximum, next.progress + LEVEL.progress.allBooksReward);
        next.progress = LEVEL.progress.maximum;
        next.complete = true;
        next.lastEvent = "all_books_shelved";
      }
    }
  } else if (interaction.type === "terminal") {
    next.terminalOpen = true;
    next.motion = "idle";
    next.lastEvent = "terminal_opened";
  } else if (interaction.type === "terminal-close") {
    next.terminalOpen = false;
    next.lastEvent = "terminal_closed";
  }
  return next;
}

export function closeTerminal(state) {
  if (!state.terminalOpen) return cloneState(state);
  const next = cloneState(state);
  next.terminalOpen = false;
  next.lastEvent = "terminal_closed";
  return next;
}

export function getObjective(state) {
  if (state.failed) return { step: 0, title: "任务失败", detail: "任务余量已耗尽，按 R 重新开始。" };
  if (state.complete) return { step: 4, title: "归位完成", detail: "三本书已回到对应颜色的书架。" };
  if (state.carriedBook) return { step: 2, title: `归还${colorName(state.carriedBook)}书籍`, detail: `将背部书籍送到装有同色书籍的${colorName(state.carriedBook)}书架。` };
  const remaining = BOOK_COLORS.filter((color) => state.books[color].location !== "shelved");
  return { step: 1, title: "整理馆藏", detail: `中央归还桌还有 ${remaining.length} 本书需要归位。` };
}

export function colorName(color) {
  return ({ red: "红色", black: "黑色", white: "白色" })[color] ?? color;
}
