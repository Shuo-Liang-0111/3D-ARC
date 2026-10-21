import { createArchiveEngine } from "./series-engine.js";
import { createArchiveScene, syncArchiveVisuals } from "./series-scene.js";
import { createLibraryCargoModel, setLibraryCargoModel } from "./scene.js";
import { createFurnitureController } from "./furniture-controller.js";
import { ASSET_ROOT } from "./series-layout.js";

export function createArchiveRuntime(id) {
  const engine = createArchiveEngine(id), dynamic = engine.LEVEL.dynamic;
  return {
    ...engine,
    ui: Object.freeze({
      id, brand: "PUBLIC LIBRARY ARCHIVES", unit: id.toUpperCase() + " · MUNICIPAL LIBRARY",
      systemLabel: "LIBRARY", cargoLabel: "CARGO", gateLabel: "CLOSING",
      startKicker: "LEVEL " + id.toUpperCase() + " / PUBLIC LIBRARY",
      startTitle: dynamic ? "CLOSING<br />PATROL" : "CLOSING<br />RESET",
      startCopy: engine.getObjective(), completeKicker: "LIBRARY SECURED",
      completeTitle: dynamic ? "闭馆巡检完成" : "闭馆复位完成",
      completeCopy: dynamic ? "家具已复位，三本随机落书已全部归还。" : "两把椅子已归桌，还书车已停稳。",
      terminalHeading: "CATALOG TERMINAL",
    }),
    rendering: Object.freeze({ pixelRatioCap: 1 }),
    camera: Object.freeze({ position: [0, 34, 11], lookAt: [0, 0.45, 0], fov: 34 }),
    audio: Object.freeze({ assets: {}, eventSounds: {}, volume: {} }),
    eventMessages: Object.freeze({
      furniture_gripped: "已扶住家具 · 移动/转向键推行，F 松手",
      chair_restored: "椅子已归桌",
      cart_parked: "还书车已停稳",
      furniture_released: "已松手，家具尚未归位",
      furniture_path_blocked: "家具前方受阻",
      crate_collected: "已拿起书籍",
      crate_delivered: "书籍已归架",
      crate_dropped: "已放下书籍",
      wrong_shelf: "这本书不属于该书架",
      blocked_drop: "这里没有足够的放置空间",
      empty_interaction: "附近没有可操作的任务物品",
      alignment_required: "尚未到达推行位置",
    }),
    createInteractionAnimation: createFurnitureController,
    createScene() {
      const world = createArchiveScene();
      if (dynamic) {
        world.bookImpact = new Audio(ASSET_ROOT + "/book-impact.flac");
        world.bookImpact.volume = 0.65;
        world.bookImpact.preload = "auto";
        const original = world.assetReady;
        world.assetReady = Promise.all([original, fetch(ASSET_ROOT + "/book-impact.flac").then((response) => response.ok).catch(() => false)])
          .then(([results, loaded]) => [...results, { loaded, name: "book-impact-audio", url: ASSET_ROOT + "/book-impact.flac" }]);
      }
      return world;
    },
    syncVisuals: syncArchiveVisuals,
    createCargoModel: createLibraryCargoModel,
    syncRobotCargo(robot) {
      robot.userData.rackPayload.visible = false;
    },
    isCarrying: (state) => Boolean(state.carriedBook),
    getTelemetry(state) {
      return { system: state.complete ? "SECURED" : "ACTIVE", systemOnline: state.complete, cargo: state.carriedBook ? "BOOK" : state.attachment ? state.attachment.kind.toUpperCase() : "EMPTY", gate: state.complete ? "COMPLETE" : "IN PROGRESS" };
    },
    getProgressSteps: () => [],
    getTerminal: () => ({ title: "目录终端", copy: "", rows: [] }),
    getSoundPosition: (_before, state) => state.player,
    getDebugState: (state) => ({ revision: state.revision, chairs: state.chairs, cart: state.cart, incident: state.incident, attachment: state.attachment, carriedBook: state.carriedBook, books: state.books, minimumProgress: state.minimumProgress }),
  };
}
