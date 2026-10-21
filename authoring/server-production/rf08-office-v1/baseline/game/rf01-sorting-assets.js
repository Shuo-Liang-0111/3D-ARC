const sourceRoot = "/local-assets/cardinal/rf03/models/runtime";
export const SORTING_SOURCE_ASSETS = Object.freeze({
  automaticInfeed: sourceRoot + "/automatic_infeed_machine.glb",
  beltConveyor: sourceRoot + "/belt_conveyor_module.glb",
  dwsGantry: sourceRoot + "/dws_scanner_gantry.glb",
  routeCage: sourceRoot + "/route_roll_cage.glb",
  parcel: sourceRoot + "/corrugated_parcel.glb",
});
export const SORTING_ASSETS = Object.freeze({
  ...Object.fromEntries(Object.entries(SORTING_SOURCE_ASSETS)
    .map(([id, url]) => [id, url.replace(sourceRoot, sourceRoot + "/rf01-sorting-v1")])),
  compactInfeed: "/local-assets/cardinal/rf01/models/runtime/sorting-v4/compact-infeed.glb",
});
