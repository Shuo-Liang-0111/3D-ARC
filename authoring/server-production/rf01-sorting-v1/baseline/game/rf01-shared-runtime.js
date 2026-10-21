export const camera = Object.freeze({ position: [0, 18.5, 16], lookAt: [0, .6, 0], fov: 43 });
export function createParkRuntime(LEVEL) {
  const suffix = LEVEL.id.replace("rf", "").toUpperCase();
  const ui = Object.freeze({
    id: LEVEL.id, brand: "INDUSTRIAL PARK / " + suffix, unit: LEVEL.id.toUpperCase() + " · SHARED SERVICE YARD",
    systemLabel: "园区供电 / 厂房照明", cargoLabel: "携带物", gateLabel: "厂房卷帘门",
    startKicker: LEVEL.id.toUpperCase() + " / INDUSTRIAL PARK",
    startTitle: LEVEL.title, startCopy: LEVEL.title,
    completeKicker: "OBJECTIVE COMPLETE", completeTitle: "任务完成", completeCopy: LEVEL.title,
    terminalHeading: "门岗出库终端",
  });
  function getTelemetry(state) {
    const cargo = state.carriedItem ? "货箱 " + (Number(state.carriedItem.split("-")[1]) + 1) : state.battery.location === "carried" ? "能源模块" : "EMPTY";
    const gate = state.shutterBlocked ? "防夹停门" : state.shutterPhase === "open" ? Math.ceil(state.shutterHold) + "s"
      : ({ closed: "CLOSED", opening: "OPENING", closing: "CLOSING" })[state.shutterPhase];
    return { system: (state.powered ? "ON" : "OFF") + " / " + (state.lightsOn ? "ON" : "OFF"), systemOnline: state.powered, cargo, gate };
  }
  function getTerminal(state) {
    const delivered = state.crates.filter(crate => crate.location === "delivered").length;
    return { title: state.dispatchConfirmed ? "出库记录已确认" : "门岗运行记录",
      copy: "园区供电、厂房照明和两箱货物均就绪时，在终端前按 F 确认出库。",
      rows: [["园区供电", state.powered ? "ONLINE" : "OFFLINE"], ["厂房照明", state.lightsOn ? "ON" : "OFF"], ["货物到位", delivered + " / 2"]] };
  }
  function getDebugState(state) {
    return { revision: LEVEL.revision, powered: state.powered, shutterLift: state.shutterLift, shutterPhase: state.shutterPhase,
      shutterHold: state.shutterHold, shutterBlocked: state.shutterBlocked, enteredWorkshop: state.enteredWorkshop,
      lightsOn: state.lightsOn, conveyorPhase: state.conveyorPhase, conveyorDirection: state.conveyorDirection, dynamic: state.dynamic, crates: state.crates, carriedItem: state.carriedItem,
      dispatchConfirmed: state.dispatchConfirmed, distanceMoved: state.distanceMoved, minimumReserve: state.minimumReserve };
  }
  return { ui, audio: Object.freeze({ assets: {}, eventSounds: {}, volume: {} }), eventMessages: Object.freeze({}),
    getTelemetry, getTerminal, getDebugState, getProgressSteps: () => [],
    getSoundPosition: (_before, state) => state.player };
}
