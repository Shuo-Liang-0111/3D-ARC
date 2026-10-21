import { applyRobotMovement } from "../../movement.js";
import { BOOK_COLORS } from "./level.js";
import { BOOKS, BOOKENDS, CART, CHAIRS, shelfPose, landingPose, seriesLevel } from "./series-layout.js";
import { furnitureStand } from "./furnishings-layout.js";

const EPSILON = 1e-7;
const distance = (left, right) => Math.hypot(left.x - right.x, left.z - right.z);
const angleError = (target, current) => Math.atan2(Math.sin(target - current), Math.cos(target - current));
const clone = (state) => ({
  ...state, player: { ...state.player }, cart: { ...state.cart },
  chairs: Object.fromEntries(Object.entries(state.chairs).map(([id, chair]) => [id, { ...chair }])),
  books: Object.fromEntries(Object.entries(state.books).map(([id, book]) => [id, { ...book }])),
  rewardedActions: { ...state.rewardedActions }, incident: { ...state.incident },
  attachment: state.attachment ? { ...state.attachment } : null,
});

function rectangle(rect) {
  return { x: (rect.minX + rect.maxX) / 2, z: (rect.minZ + rect.maxZ) / 2, halfX: (rect.maxX - rect.minX) / 2, halfZ: (rect.maxZ - rect.minZ) / 2, yaw: 0, id: rect.id };
}

function axes(object) {
  return [{ x: Math.cos(object.yaw), z: -Math.sin(object.yaw) }, { x: Math.sin(object.yaw), z: Math.cos(object.yaw) }];
}

function rectanglesOverlap(left, right) {
  const leftAxes = axes(left), rightAxes = axes(right);
  const dot = (first, second) => first.x * second.x + first.z * second.z;
  return [...leftAxes, ...rightAxes].every((axis) => {
    const gap = Math.abs((left.x - right.x) * axis.x + (left.z - right.z) * axis.z);
    const reach = left.halfX * Math.abs(dot(axis, leftAxes[0])) + left.halfZ * Math.abs(dot(axis, leftAxes[1]))
      + right.halfX * Math.abs(dot(axis, rightAxes[0])) + right.halfZ * Math.abs(dot(axis, rightAxes[1]));
    return gap < reach - EPSILON;
  });
}

function circleOverlaps(x, z, radius, object) {
  const localX = (x - object.x) * Math.cos(object.yaw) - (z - object.z) * Math.sin(object.yaw);
  const localZ = (x - object.x) * Math.sin(object.yaw) + (z - object.z) * Math.cos(object.yaw);
  return Math.max(0, Math.abs(localX) - object.halfX) ** 2 + Math.max(0, Math.abs(localZ) - object.halfZ) ** 2 < radius ** 2 - EPSILON;
}

export function createArchiveEngine(id) {
  const LEVEL = seriesLevel(id);
  const movingIds = new Set(["return-cart", ...CHAIRS.filter((chair) => chair.task).map((chair) => chair.id)]);
  const fixed = LEVEL.staticColliders.filter((rect) => !movingIds.has(rect.id)).map(rectangle);

  function createInitialState(options = {}) {
    const value = typeof options.random === "function" ? options.random() : Math.random();
    const sample = Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0;
    return {
      player: { ...LEVEL.playerStart },
      books: Object.fromEntries(BOOKS.map((book) => [book.id, { ...book }])),
      chairs: Object.fromEntries(CHAIRS.filter((chair) => chair.task).map((chair) => [chair.id, { ...chair, restored: false }])),
      cart: { ...CART, parked: false, travel: 0 }, attachment: null,
      carriedBook: null, carriedItem: null, complete: false, failed: false, terminalOpen: false,
      progress: 100, minimumProgress: 100, rewardedActions: {},
      incident: { color: BOOK_COLORS[Math.floor(sample * 3)], phase: LEVEL.dynamic ? "waiting" : "disabled", elapsed: 0, drops: 0, nextDrop: 0 },
      motion: "idle", elapsed: 0, distanceTravelled: 0, blockedTime: 0, interactions: 0,
      lastEvent: "library_entered", revision: LEVEL.revision,
    };
  }

  function attachedObject(state) {
    return !state.attachment ? null : state.attachment.kind === "cart" ? state.cart : state.chairs[state.attachment.id];
  }

  function obstacles(state, omitted = null) {
    return [...fixed, state.cart, ...Object.values(state.chairs)].filter((object) => object.id !== omitted);
  }

  function insideBounds(object) {
    const bounds = LEVEL.bounds;
    const extentX = Math.abs(Math.cos(object.yaw)) * object.halfX + Math.abs(Math.sin(object.yaw)) * object.halfZ;
    const extentZ = Math.abs(Math.sin(object.yaw)) * object.halfX + Math.abs(Math.cos(object.yaw)) * object.halfZ;
    return object.x - extentX >= bounds.minX && object.x + extentX <= bounds.maxX && object.z - extentZ >= bounds.minZ && object.z + extentZ <= bounds.maxZ;
  }

  function furniturePose(state, x, z) {
    const object = attachedObject(state);
    return object ? { ...object,
      x: x + Math.sin(state.player.yaw) * state.attachment.forward + Math.cos(state.player.yaw) * state.attachment.lateral,
      z: z + Math.cos(state.player.yaw) * state.attachment.forward - Math.sin(state.player.yaw) * state.attachment.lateral,
      yaw: state.player.yaw + state.attachment.yawOffset,
    } : null;
  }

  function isWalkable(state, x, z, radius = LEVEL.playerRadius) {
    const bounds = LEVEL.bounds;
    if (![x, z, radius].every(Number.isFinite) || radius < 0) return false;
    if (x - radius < bounds.minX || x + radius > bounds.maxX || z - radius < bounds.minZ || z + radius > bounds.maxZ) return false;
    const furniture = furniturePose(state, x, z);
    const blocks = obstacles(state, furniture?.id);
    if (blocks.some((object) => circleOverlaps(x, z, radius, object))) return false;
    return !furniture || (insideBounds(furniture) && !blocks.some((object) => rectanglesOverlap(furniture, object)));
  }

  function settle(before, next, cost = 0, rewardKey = null, reward = 0) {
    if (cost > 0 && before.progress <= cost + EPSILON) {
      const failed = clone(before);
      Object.assign(failed, { progress: 0, minimumProgress: 0, failed: true, motion: "idle", lastEvent: "progress_depleted", interactions: next.interactions });
      return failed;
    }
    next.progress = before.progress - cost;
    next.minimumProgress = Math.min(before.minimumProgress, next.progress);
    if (rewardKey && !before.rewardedActions[rewardKey]) {
      next.rewardedActions[rewardKey] = true;
      next.progress = Math.min(100, next.progress + reward);
    }
    return next;
  }

  function completion(state) {
    return !state.settling && Object.values(state.chairs).every((chair) => chair.restored) && state.cart.parked && !state.attachment
      && (!LEVEL.dynamic || (state.incident.phase === "fixed" && state.incident.drops > 0
        && Object.values(state.books).filter((book) => book.fallen).every((book) => book.location === "shelved")));
  }

  function beginFault(state) {
    if (!LEVEL.dynamic || state.incident.phase !== "waiting") return;
    state.incident.phase = "loose";
    state.incident.drops = 1;
    state.incident.nextDrop = LEVEL.fallInterval;
    const bookId = "shelf-" + state.incident.color + "-0";
    Object.assign(state.books[bookId], { location: "falling", fallen: true, fallElapsed: 0, landing: landingPose(state.incident.color, 0) });
  }

  function updateMovement(state, input = {}, deltaSeconds = 0) {
    if (state.complete || state.failed) return clone(state);
    const next = clone(state);
    const dt = Number.isFinite(deltaSeconds) ? Math.min(0.05, Math.max(0, deltaSeconds)) : 0;
    const movement = applyRobotMovement(next, state, input, dt, LEVEL, isWalkable);
    const travelled = distance(next.player, state.player);
    const turnTravel = Math.abs(angleError(next.player.yaw, state.player.yaw));
    const furniture = furniturePose(next, next.player.x, next.player.z);
    if (furniture) {
      if (next.attachment.kind === "cart") {
        furniture.travel = state.cart.travel + distance(furniture, state.cart);
        next.cart = furniture;
        if (furniture.travel >= 1.5) beginFault(next);
      } else next.chairs[furniture.id] = furniture;
    }
    next.elapsed += dt;
    next.distanceTravelled += travelled;
    const blocked = (movement.translating && travelled < EPSILON) || (state.attachment && movement.turning && turnTravel < EPSILON);
    next.blockedTime += blocked ? dt : 0;
    next.motion = travelled > EPSILON ? "moving" : turnTravel > EPSILON ? "turning" : state.carriedBook ? "carrying" : "idle";
    if (blocked) next.lastEvent = "furniture_path_blocked";
    return settle(state, next, travelled * LEVEL.progress.movementDrainPerMeter + (blocked ? dt * LEVEL.progress.blockedDrainPerSecond : 0));
  }

  function lineClear(state, point, omitted) {
    const count = Math.max(1, Math.ceil(distance(state.player, point) / 0.05));
    for (let index = 1; index < count; index += 1) {
      const blend = index / count;
      if (obstacles(state, omitted).some((object) => circleOverlaps(state.player.x + (point.x - state.player.x) * blend, state.player.z + (point.z - state.player.z) * blend, 0.015, object))) return false;
    }
    return true;
  }

  function getInteraction(state) {
    if (state.complete || state.failed) return null;
    if (state.attachment) return { type: "release", ...state.attachment };
    const candidates = [];
    const offer = (action, point, omitted, range = LEVEL.interactionRange) => {
      const separation = distance(state.player, point);
      if (separation > range || !lineClear(state, point, omitted)) return;
      const angle = Math.abs(angleError(Math.atan2(point.x - state.player.x, point.z - state.player.z), state.player.yaw));
      candidates.push({ ...action, distance: separation, score: separation + angle * 0.10 });
    };
    if (state.carriedBook) {
      for (const color of BOOK_COLORS) offer({ type: "shelf", color }, LEVEL.shelves[color], color + "-target-shelf", 1.55);
      if (!candidates.length) return { type: "drop", bookId: state.carriedBook };
    } else {
      if (!state.cart.parked) offer({ type: "grip", kind: "cart", id: CART.id, stand: furnitureStand(state.cart) }, furnitureStand(state.cart), CART.id);
      for (const chair of Object.values(state.chairs)) if (!chair.restored) offer({ type: "grip", kind: "chair", id: chair.id, stand: furnitureStand(chair) }, furnitureStand(chair), chair.id);
      if (state.incident.phase === "loose") {
        const color = state.incident.color, stand = BOOKENDS[color].stand;
        offer({ type: "repair", color, stand }, stand, color + "-target-shelf");
      }
      for (const book of Object.values(state.books)) if (book.fallen && book.location === "ground") offer({ type: "book", bookId: book.id, color: book.color }, book, null, 1.25);
    }
    return candidates.sort((left, right) => left.score - right.score)[0] ?? null;
  }

  function interact(state) {
    if (state.complete || state.failed) return clone(state);
    const next = clone(state);
    next.interactions += 1;
    const action = getInteraction(state);
    if (!action) {
      next.lastEvent = "empty_interaction";
      return settle(state, next, LEVEL.progress.errorCost);
    }
    if (action.type === "grip") {
      if (distance(state.player, action.stand) > 0.12 || Math.abs(angleError(action.stand.yaw, state.player.yaw)) > 0.12) {
        next.lastEvent = "alignment_required";
        return settle(state, next, LEVEL.progress.errorCost);
      }
      const object = action.kind === "cart" ? state.cart : state.chairs[action.id];
      const dx = object.x - state.player.x, dz = object.z - state.player.z;
      next.attachment = { kind: action.kind, id: action.id,
        forward: dx * Math.sin(state.player.yaw) + dz * Math.cos(state.player.yaw),
        lateral: dx * Math.cos(state.player.yaw) - dz * Math.sin(state.player.yaw),
        yawOffset: angleError(object.yaw, state.player.yaw),
      };
      next.lastEvent = "furniture_gripped";
      return next;
    }
    if (action.type === "release") {
      const object = attachedObject(next), target = action.kind === "cart" ? CART.parking : object.home;
      const placed = distance(object, target) <= (action.kind === "cart" ? 0.20 : 0.10) && Math.abs(angleError(object.yaw, target.yaw)) <= 0.12;
      next.attachment = null;
      next.lastEvent = placed ? action.kind === "cart" ? "cart_parked" : "chair_restored" : "furniture_released";
      if (action.kind === "cart") next.cart.parked = placed;
      else next.chairs[action.id].restored = placed;
      if (placed) beginFault(next);
      next.complete = completion(next);
      return settle(state, next, 0, placed ? "restore:" + action.id : null, action.kind === "cart" ? LEVEL.progress.cartReward : LEVEL.progress.chairReward);
    }
    if (action.type === "repair") {
      next.incident.phase = "fixed";
      next.lastEvent = "bookend_fixed";
      next.complete = completion(next);
      return settle(state, next, 0, "repair:" + action.color, LEVEL.progress.repairReward);
    }
    if (action.type === "book") {
      next.books[action.bookId].location = "carried";
      next.carriedBook = action.bookId;
      next.carriedItem = action.bookId;
      next.lastEvent = "crate_collected";
      return settle(state, next, state.rewardedActions["pickup:" + action.bookId] ? LEVEL.progress.repeatCost : 0, "pickup:" + action.bookId, LEVEL.progress.pickupReward);
    }
    if (action.type === "drop") {
      const point = { x: state.player.x + Math.sin(state.player.yaw) * 0.60, z: state.player.z + Math.cos(state.player.yaw) * 0.60 };
      if (!isWalkable(state, point.x, point.z, 0.15)) {
        next.lastEvent = "blocked_drop";
        return settle(state, next, LEVEL.progress.errorCost);
      }
      Object.assign(next.books[state.carriedBook], point, { location: "ground", y: 0.012 });
      next.carriedBook = null; next.carriedItem = null; next.lastEvent = "crate_dropped";
      return settle(state, next, LEVEL.progress.repeatCost);
    }
    const book = next.books[state.carriedBook];
    if (book.color !== action.color) {
      next.lastEvent = "wrong_shelf";
      return settle(state, next, LEVEL.progress.errorCost);
    }
    Object.assign(book, shelfPose(book.color, book.id), { location: "shelved" });
    next.carriedBook = null; next.carriedItem = null; next.lastEvent = "crate_delivered";
    next.complete = completion(next);
    return settle(state, next, 0, "return:" + book.id, LEVEL.progress.correctBookReward);
  }

  function updateEnvironment(state, deltaSeconds = 0) {
    if (state.complete || state.failed || !LEVEL.dynamic) return state;
    const dt = Number.isFinite(deltaSeconds) ? Math.min(0.05, Math.max(0, deltaSeconds)) : 0;
    const next = clone(state);
    if (next.incident.phase === "loose") {
      next.incident.elapsed += dt;
      if (next.incident.drops < LEVEL.maximumFalls && next.incident.elapsed >= next.incident.nextDrop) {
        const index = next.incident.drops;
        const bookId = "shelf-" + next.incident.color + "-" + index;
        Object.assign(next.books[bookId], { location: "falling", fallen: true, fallElapsed: 0, landing: landingPose(next.incident.color, index) });
        next.incident.drops += 1;
        next.incident.nextDrop += LEVEL.fallInterval;
      }
    }
    for (const book of Object.values(next.books)) if (book.location === "falling") {
      book.fallElapsed = Math.min(LEVEL.fallDuration, (book.fallElapsed ?? 0) + dt);
      if (book.fallElapsed >= LEVEL.fallDuration - EPSILON) Object.assign(book, book.landing, { location: "ground", support: null });
    }
    next.complete = completion(next);
    return next;
  }

  return {
    LEVEL, createInitialState, updateMovement, updateEnvironment, isWalkable, getInteraction, interact,
    closeTerminal: (state) => ({ ...state, terminalOpen: false }),
    getObjective: () => LEVEL.dynamic ? "完成闭馆复位，并修复书架故障、收回全部落书" : "将两把离位椅子归桌，并把还书车停回车位",
  };
}
