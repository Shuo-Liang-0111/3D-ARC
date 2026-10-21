// Preserved 2D prototype engine.
export const ACTION = Object.freeze({
  RESET: 0,
  UP: 1,
  DOWN: 2,
  LEFT: 3,
  RIGHT: 4,
  SCAN: 5,
  CLICK: 6,
  UNDO: 7,
});

export const STATUS = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  PLAYING: "NOT_FINISHED",
  WIN: "WIN",
});

export const PALETTE = Object.freeze([
  "#050708", "#101820", "#29353f", "#47e5e8",
  "#ff5aab", "#ffe06a", "#eef4f7", "#7df09a",
  "#ff6b64", "#53616d", "#1b252c", "#0c3235",
  "#3b1930", "#3a3518", "#223128", "#15191d",
]);

export const LEVEL = Object.freeze({
  id: "pr01",
  title: "Pulse Relay",
  baselineActions: 22,
  map: Object.freeze([
    "###########",
    "#...#....G#",
    "#...#.....#",
    "#...#..m..#",
    "#...C.....#",
    "#...#.....#",
    "#...#.....#",
    "#.c.#.....#",
    "#...#.....#",
    "#P..#.....#",
    "###########",
  ]),
});

const VECTORS = {
  [ACTION.UP]: { x: 0, y: -1 },
  [ACTION.DOWN]: { x: 0, y: 1 },
  [ACTION.LEFT]: { x: -1, y: 0 },
  [ACTION.RIGHT]: { x: 1, y: 0 },
};

export function createInitialState(started = false) {
  return {
    gameId: LEVEL.id,
    status: started ? STATUS.PLAYING : STATUS.NOT_STARTED,
    player: { x: 1, y: 9 },
    signals: { cyan: false, magenta: false },
    actions: 0,
    frame: 0,
    lastAction: ACTION.RESET,
    lastEvent: started ? "environment_ready" : "boot",
    availableActions: [ACTION.UP, ACTION.DOWN, ACTION.LEFT, ACTION.RIGHT, ACTION.SCAN, ACTION.UNDO],
  };
}

export function startState() {
  return createInitialState(true);
}

export function cloneState(state) {
  return {
    ...state,
    player: { ...state.player },
    signals: { ...state.signals },
    availableActions: [...state.availableActions],
  };
}

export function tileAt(x, y) {
  return LEVEL.map[y]?.[x] ?? "#";
}

export function step(state, action) {
  if (state.status !== STATUS.PLAYING) return cloneState(state);

  const next = cloneState(state);
  next.lastAction = action;
  next.actions += 1;
  next.frame += 1;

  if (action === ACTION.SCAN) {
    next.lastEvent = next.signals.cyan || next.signals.magenta ? "scan_echo" : "scan_silent";
    return next;
  }

  const vector = VECTORS[action];
  if (!vector) {
    next.lastEvent = "action_unavailable";
    return next;
  }

  const target = {
    x: state.player.x + vector.x,
    y: state.player.y + vector.y,
  };
  const tile = tileAt(target.x, target.y);
  const gateClosed = tile === "C" && !state.signals.cyan;

  if (tile === "#" || gateClosed) {
    next.lastEvent = gateClosed ? "gate_resists" : "boundary";
    return next;
  }

  next.player = target;
  next.lastEvent = "move";

  if (tile === "c" && !next.signals.cyan) {
    next.signals.cyan = true;
    next.lastEvent = "signal_cyan";
  } else if (tile === "m" && !next.signals.magenta) {
    next.signals.magenta = true;
    next.lastEvent = "signal_magenta";
  } else if (tile === "G") {
    if (next.signals.cyan && next.signals.magenta) {
      next.status = STATUS.WIN;
      next.lastEvent = "win";
    } else {
      next.lastEvent = "terminal_dormant";
    }
  }

  return next;
}

export function efficiencyScore(state) {
  if (state.status !== STATUS.WIN || state.actions <= 0) return null;
  const raw = (LEVEL.baselineActions / state.actions) ** 2;
  return Math.min(1.15, raw) * 100;
}

function fillRect(frame, x, y, width, height, color) {
  for (let py = Math.max(0, y); py < Math.min(64, y + height); py += 1) {
    for (let px = Math.max(0, x); px < Math.min(64, x + width); px += 1) {
      frame[py * 64 + px] = color;
    }
  }
}

export function renderFrame(state) {
  const frame = new Uint8Array(64 * 64);
  frame.fill(0);
  const size = 5;
  const offset = 4;

  LEVEL.map.forEach((row, y) => {
    [...row].forEach((tile, x) => {
      const px = offset + x * size;
      const py = offset + y * size;
      fillRect(frame, px, py, size, size, 1);
      fillRect(frame, px + 1, py + 1, size - 2, size - 2, 10);

      if (tile === "#") {
        fillRect(frame, px, py, size, size, 2);
        if ((x + y) % 2 === 0) fillRect(frame, px + 1, py + 1, 1, 1, 9);
      }

      if (tile === "C") {
        if (state.signals.cyan) {
          fillRect(frame, px, py, size, size, 11);
          fillRect(frame, px + 2, py, 1, size, 3);
        } else {
          fillRect(frame, px, py, size, size, 3);
          fillRect(frame, px + 1, py + 1, size - 2, size - 2, 11);
        }
      }

      if (tile === "c" || tile === "m") {
        const isCyan = tile === "c";
        const active = isCyan ? state.signals.cyan : state.signals.magenta;
        const color = isCyan ? 3 : 4;
        fillRect(frame, px, py, size, size, isCyan ? 11 : 12);
        fillRect(frame, px + 1, py + 1, size - 2, size - 2, color);
        if (active) fillRect(frame, px + 2, py + 2, 1, 1, 6);
      }

      if (tile === "G") {
        const unlocked = state.signals.cyan && state.signals.magenta;
        fillRect(frame, px, py, size, size, unlocked ? 14 : 13);
        fillRect(frame, px + 1, py + 1, size - 2, size - 2, unlocked ? 7 : 5);
        fillRect(frame, px + 2, py + 2, 1, 1, unlocked ? 6 : 0);
      }
    });
  });

  const playerX = offset + state.player.x * size;
  const playerY = offset + state.player.y * size;
  fillRect(frame, playerX + 1, playerY + 1, 3, 3, 6);
  fillRect(frame, playerX + 2, playerY + 2, 1, 1, state.status === STATUS.WIN ? 7 : 3);

  if (state.lastEvent.startsWith("scan")) {
    const radius = 6 + (state.frame % 3) * 3;
    const cx = playerX + 2;
    const cy = playerY + 2;
    for (let i = -radius; i <= radius; i += 1) {
      const points = [[cx + i, cy - radius], [cx + i, cy + radius], [cx - radius, cy + i], [cx + radius, cy + i]];
      points.forEach(([x, y]) => {
        if (x >= 0 && x < 64 && y >= 0 && y < 64 && frame[y * 64 + x] === 0) frame[y * 64 + x] = 9;
      });
    }
  }

  return frame;
}

export function frameToRows(frame) {
  return Array.from({ length: 64 }, (_, row) => Array.from(frame.slice(row * 64, row * 64 + 64)));
}

export function recordingToJsonl(timeline) {
  return timeline.map((entry, index) => JSON.stringify({
    timestamp: entry.timestamp,
    data: {
      game_id: LEVEL.id,
      frame: [frameToRows(renderFrame(entry.state))],
      state: entry.state.status,
      levels_completed: entry.state.status === STATUS.WIN ? 1 : 0,
      win_levels: 1,
      available_actions: entry.state.availableActions,
      action_input: {
        id: entry.action,
        name: entry.actionName,
      },
      signals: entry.state.signals,
      actions: entry.state.actions,
    },
    guid: `local-pr01-${String(index).padStart(4, "0")}`,
    full_reset: index === 0,
  })).join("\n");
}
