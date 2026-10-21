const CARDINAL_ROOT = "/local-assets/cardinal/rf09";

export const RF09_CARDINAL_ASSETS = Object.freeze({
  conferenceTable: `${CARDINAL_ROOT}/models/runtime/conference_table.glb?v=20260819`,
  executiveChair: `${CARDINAL_ROOT}/models/runtime/executive_chair.glb?v=20260819`,
  podium: `${CARDINAL_ROOT}/models/runtime/av_podium.glb?v=20260819`,
  terminal: `${CARDINAL_ROOT}/models/runtime/conference_terminal.glb?v=20260819`,
  workstation: `${CARDINAL_ROOT}/models/runtime/office_workstation.glb?v=20260819`,
  receptionDesk: `${CARDINAL_ROOT}/models/runtime/reception_desk.glb?v=20260819`,
  supplyCabinet: `${CARDINAL_ROOT}/models/runtime/supply_cabinet.glb?v=20260819`,
  itLocker: `${CARDINAL_ROOT}/models/runtime/it_equipment_locker.glb?v=20260819`,
  loungeSofa: `${CARDINAL_ROOT}/models/runtime/lounge_sofa.glb?v=20260819`,
  adapter: `${CARDINAL_ROOT}/models/runtime/usb_c_video_adapter.glb?v=20260819`,
  clicker: `${CARDINAL_ROOT}/models/runtime/wireless_presenter.glb?v=20260819`,
  ceilingLight: `${CARDINAL_ROOT}/models/runtime/ceiling_light.glb?v=20260819`,
});

export const RF09_SURFACE_ASSETS = Object.freeze({
  carpetBaseColor: `${CARDINAL_ROOT}/textures/runtime/carpet_floor-basecolor.webp?v=20260819`,
  wallBaseColor: `${CARDINAL_ROOT}/textures/runtime/painted_wall-basecolor.webp?v=20260819`,
});

export const RF09_CARDINAL_SPECS = Object.freeze({
  conferenceTable: Object.freeze({ size: [8.8, 0.78, 2.8], front: "+Z", support: "floor" }),
  executiveChair: Object.freeze({ size: [0.62, 1.12, 0.62], front: "+Z", support: "floor" }),
  podium: Object.freeze({ size: [0.84, 0.18, 0.5], front: "+Z", support: "tabletop" }),
  terminal: Object.freeze({ size: [0.72, 0.18, 0.48], front: "+Z", support: "tabletop" }),
  workstation: Object.freeze({ size: [3.4, 1.28, 1.45], front: "+Z", support: "floor" }),
  receptionDesk: Object.freeze({ size: [5.4, 1.1, 0.95], front: "+Z", support: "floor" }),
  supplyCabinet: Object.freeze({ size: [3.1, 2.35, 1.3], front: "+Z", support: "floor" }),
  itLocker: Object.freeze({ size: [3, 2.4, 1.45], front: "+Z", support: "floor" }),
  loungeSofa: Object.freeze({ size: [3.4, 0.88, 1.1], front: "+Z", support: "floor" }),
  adapter: Object.freeze({ size: [0.34, 0.07, 0.2], front: "+Z", support: "surface" }),
  clicker: Object.freeze({ size: [0.13, 0.06, 0.42], front: "+Z", support: "surface" }),
  ceilingLight: Object.freeze({ size: [1.2, 0.08, 0.3], front: "+Z", support: "ceiling" }),
});

const fixture = (id, asset, position, yaw, fallback) => Object.freeze({
  id,
  asset,
  position: Object.freeze(position),
  yaw,
  supportY: position[1],
  fallback,
});

export const RF09_CARDINAL_FIXTURES = Object.freeze([
  fixture("conference-table", "conferenceTable", [0, 0, -5.15], 0, "conferenceTable"),
  ...[-3, -1, 1, 3].flatMap((x, index) => [
    fixture(`chair-north-${index + 1}`, "executiveChair", [x, 0, -7.05], 0, `chair-north-${index + 1}`),
    fixture(`chair-south-${index + 1}`, "executiveChair", [x, 0, -3.25], Math.PI, `chair-south-${index + 1}`),
  ]),
  fixture("podium", "podium", [0, 0.78, -6.05], 0, "podium"),
  fixture("terminal", "terminal", [2.1, 0.78, -6.05], 0, "terminal"),
  fixture("workstation-west-1", "workstation", [-9.05, 0, 1.55], 0, "workstation-west-1"),
  fixture("workstation-east-1", "workstation", [4, 0, 1.55], 0, "workstation-east-1"),
  fixture("workstation-east-2", "workstation", [9.05, 0, 1.55], 0, "workstation-east-2"),
  fixture("reception-desk", "receptionDesk", [0, 0, 6.45], Math.PI, "receptionDesk"),
  fixture("supply-cabinet", "supplyCabinet", [-10.2, 0, 5.7], 0, "supplyCabinet"),
  fixture("it-locker", "itLocker", [9.25, 0, 5.3], 0, "itLocker"),
  fixture("lounge-west", "loungeSofa", [-9.7, 0, -0.9], 0, "lounge-west"),
  fixture("lounge-east", "loungeSofa", [9.7, 0, -0.9], 0, "lounge-east"),
  ...[-10, -6, -2, 2, 6, 10].flatMap((x) => [-6.4, 0, 6.4].map((z) =>
    fixture(`ceiling-light-${x}-${z}`, "ceilingLight", [x, 3.22, z], 0, `ceiling-light-${x}-${z}`))),
]);
