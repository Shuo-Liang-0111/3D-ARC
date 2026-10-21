import { BOOK_COLORS, LEVEL } from "./level.js";
import { createArchiveScene, syncArchiveVisuals } from "./series-scene.js";
import { createFurnitureController } from "./furniture-controller.js";
import { closeTerminal, colorName, createInitialState, getInteraction, getObjective, interact, isWalkable, updateMovement } from "./engine.js";
import { createLibraryCargoModel } from "./scene.js";

export { LEVEL, closeTerminal, createInitialState, getInteraction, getObjective, interact, isWalkable, updateMovement };
export const createInteractionAnimation = createFurnitureController;

export const ui = Object.freeze({
  id: "rf02",
  brand: "PUBLIC LIBRARY ARCHIVES",
  unit: "UNIT R-04 · MUNICIPAL LIBRARY",
  systemLabel: "CATALOG STATUS",
  cargoLabel: "CARGO",
  gateLabel: "SHELVES",
  startKicker: "LEVEL RF-02 / PUBLIC LIBRARY",
  startTitle: "CHROMATIC<br />ARCHIVES",
  startCopy: "从入口防盗检测门进入市级公共图书馆，在中央还书整理台找到红色、黑色和白色三本待归还精装书。一次携带一本，根据对应馆藏书架中已有书脊颜色完成归位。",
  completeKicker: "CATALOG RESTORED",
  completeTitle: "归位完成",
  completeCopy: "三本待归还书籍已进入对应开架馆藏区，目录一致性恢复。",
  terminalHeading: "CATALOG TERMINAL / C-02",
});

export const camera = Object.freeze({ position: [0, 34, 11], lookAt: [0, 0.45, 0], fov: 34 });

export const rendering = Object.freeze({ pixelRatioCap: 1 });

export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });

export const eventMessages = Object.freeze({
  book_collected_red: "红色精装书已拿在手中 · 任务余量 +30",
  book_collected_black: "黑色精装书已拿在手中 · 任务余量 +30",
  book_collected_white: "白色精装书已拿在手中 · 任务余量 +30",
  book_dropped_red: "红色精装书已放置在地面",
  book_dropped_black: "黑色精装书已放置在地面",
  book_dropped_white: "白色精装书已放置在地面",
  book_shelved_red: "红色精装书归位 · 任务余量 +30",
  book_shelved_black: "黑色精装书归位 · 任务余量 +30",
  book_shelved_white: "白色精装书归位 · 任务余量 +30",
  blocked_drop: "这里没有足够的放置空间",
  wrong_shelf: "书籍颜色与该馆藏区不一致",
  terminal_closed: "目录终端已关闭",
  all_books_shelved: "全部书籍归位，目录一致性恢复",
  progress_depleted: "任务余量耗尽，整理行动终止",
});

export function createScene() {
  return createArchiveScene();
}

export function syncVisuals(world, state) {
  syncArchiveVisuals(world, state);
}

export function createCargoModel() {
  return createLibraryCargoModel();
}

export function syncRobotCargo(robot) {
  robot.userData.rackPayload.visible = false;
}

export function isCarrying(state) {
  return Boolean(state.carriedBook);
}

export function getTelemetry(state) {
  const shelved = BOOK_COLORS.filter((color) => state.books[color].location === "shelved").length;
  return {
    system: state.complete ? "RESTORED" : `${shelved}/3 FILED`,
    systemOnline: state.complete,
    cargo: state.carriedBook ? `${state.carriedBook.toUpperCase()} BOOK` : "EMPTY",
    gate: `${shelved}/3 COMPLETE`,
  };
}

export function getProgressSteps(state) {
  return BOOK_COLORS.map((color) => ({
    label: `${colorName(color)}书籍`,
    done: state.books[color].location === "shelved",
    active: state.carriedBook === color,
  })).concat({ label: "目录恢复", done: state.complete, active: false });
}

function bookStatus(state, color) {
  const location = state.books[color].location;
  return ({ table: "ON RETURN TABLE", ground: "ON FLOOR", carried: "IN TRANSIT", shelved: "SHELVED" })[location];
}

export function getTerminal(state) {
  const shelved = BOOK_COLORS.filter((color) => state.books[color].location === "shelved").length;
  return {
    title: state.complete ? "馆藏目录一致" : `待归位书籍 ${3 - shelved} 本`,
    copy: state.complete
      ? "红、黑、白三类馆藏均已核对完成。"
      : "将中央还书整理台上的书送到拥有同色书脊的开架书架。错误的馆藏区不会接收书籍。",
    rows: BOOK_COLORS.map((color) => [`${color.toUpperCase()} COLLECTION`, bookStatus(state, color)]),
  };
}

export function getSoundPosition(beforeState, state) {
  const color = state.carriedBook ?? beforeState.carriedBook;
  return color ? (state.books[color] ?? beforeState.books[color]) : state.player;
}

export function getDebugState(state) {
  return {
    carriedBook: state.carriedBook,
    books: Object.fromEntries(BOOK_COLORS.map((color) => [color, state.books[color].location])),
    shelvedCount: BOOK_COLORS.filter((color) => state.books[color].location === "shelved").length,
  };
}
