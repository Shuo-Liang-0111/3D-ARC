const CARDINAL_ROOT = "/local-assets/cardinal/rf07";

export const RF07_CARDINAL_ASSETS = Object.freeze({
  classIiA2Bsc: `${CARDINAL_ROOT}/models/runtime/class_ii_a2_bsc.glb?v=20260819`,
  receivingBench: `${CARDINAL_ROOT}/models/runtime/receiving_bench_equipment_bank.glb?v=20260819`,
  transferCart: `${CARDINAL_ROOT}/models/runtime/specimen_transfer_cart.glb?v=20260819`,
  packingIsland: `${CARDINAL_ROOT}/models/runtime/cold_chain_packing_island.glb?v=20260819`,
  reagentCabinet: `${CARDINAL_ROOT}/models/runtime/dry_reagent_cabinet.glb?v=20260819`,
  handwashStation: `${CARDINAL_ROOT}/models/runtime/handwash_eyewash_station.glb?v=20260819`,
  ppeLockers: `${CARDINAL_ROOT}/models/runtime/ppe_locker_bank.glb?v=20260819`,
  medicalRefrigerator: "/local-assets/levels/rf07/series-v1/medical_refrigerator.glb",
  transportCase: `${CARDINAL_ROOT}/models/runtime/p650_transport_case.glb?v=20260819`,
  coolingModule: `${CARDINAL_ROOT}/models/runtime/pcm_cooling_plate.glb?v=20260819`,
  secondaryCarrier: `${CARDINAL_ROOT}/models/runtime/secondary_specimen_carrier.glb?v=20260819`,
  wasteBin: `${CARDINAL_ROOT}/models/runtime/medical_waste_bin.glb?v=20260819`,
});

export const RF07_SURFACE_ASSETS = Object.freeze({
  floorBaseColor: `${CARDINAL_ROOT}/textures/runtime/epoxy_floor-basecolor.webp?v=20260819`,
  floorNormal: `${CARDINAL_ROOT}/textures/runtime/epoxy_floor-normal.webp?v=20260819`,
  floorRoughness: `${CARDINAL_ROOT}/textures/runtime/epoxy_floor-roughness.webp?v=20260819`,
  floorAo: `${CARDINAL_ROOT}/textures/runtime/epoxy_floor-ao.webp?v=20260819`,
});

export const RF07_CARDINAL_SPECS = Object.freeze({
  classIiA2Bsc: Object.freeze({ size: [1.5, 2.18, 0.78], front: "+Z" }),
  receivingBench: Object.freeze({ size: [7.9, 1.75, 1.0], front: "+Z" }),
  transferCart: Object.freeze({ size: [1.05, 1.15, 0.58], front: "+Z" }),
  packingIsland: Object.freeze({ size: [4.8, 1.72, 1.6], front: "+Z" }),
  reagentCabinet: Object.freeze({ size: [2.2, 2.2, 0.78], front: "+Z" }),
  handwashStation: Object.freeze({ size: [2.65, 1.8, 1.42], front: "+Z" }),
  ppeLockers: Object.freeze({ size: [2.8, 2.1, 0.82], front: "+Z" }),
  medicalRefrigerator: Object.freeze({ size: [0.76, 1.98, 0.82], front: "+Z" }),
  transportCase: Object.freeze({ size: [0.62, 0.468, 0.505], front: "+Z" }),
  coolingModule: Object.freeze({ size: [0.19, 0.046, 0.13], front: "+Z" }),
  secondaryCarrier: Object.freeze({ size: [0.18, 0.159, 0.11], front: "+Z" }),
  wasteBin: Object.freeze({ size: [0.42, 0.8, 0.36], front: "+Z" }),
});

const fixture = (id, asset, position, yaw, hidePrefixes) => Object.freeze({
  id,
  asset,
  position: Object.freeze(position),
  yaw,
  supportY: position[1],
  hidePrefixes: Object.freeze(hidePrefixes),
});

export const RF07_CARDINAL_FIXTURES = Object.freeze([
  fixture("receiving-bench", "receivingBench", [-7.35, 0, -7.1], 0, [
    "Specimen_Receiving_Bench_",
    "Barcode_",
    "Benchtop_Centrifuge",
    "Centrifuge_",
    "Compact_PCR_Analyzer",
    "Analyzer_",
    "LIMS_",
    "Printer_",
  ]),
  fixture("bsc-01", "classIiA2Bsc", [-2, 0, -7.12], 0, ["Class_II_A2_BSC_01_"]),
  fixture("bsc-02", "classIiA2Bsc", [0, 0, -7.12], 0, ["Class_II_A2_BSC_02_"]),
  fixture("bsc-03", "classIiA2Bsc", [2, 0, -7.12], 0, ["Class_II_A2_BSC_03_"]),
  fixture("transfer-cart-01", "transferCart", [-6.65, 0, -2.35], Math.PI, ["Specimen_Transfer_Cart_01_"]),
  fixture("transfer-cart-02", "transferCart", [-3.95, 0, -2.35], Math.PI, ["Specimen_Transfer_Cart_02_"]),
  fixture("packing-island", "packingIsland", [2, 0, 1.1], 0, [
    "Cold_Chain_Packing_Island_",
    "Island_Bumper_",
    "Packing_Consumables_Rack",
    "Packing_Rack_",
  ]),
  fixture("reagent-cabinet", "reagentCabinet", [7.75, 0, -7.18], 0, ["Dry_Reagent_"]),
  fixture("handwash-station", "handwashStation", [-11.12, 0, 4.1], Math.PI / 2, [
    "Eyewash_",
    "Gooseneck_",
    "Handsfree_",
    "Handwash_",
    "Knee_",
    "Soap_",
  ]),
  fixture("ppe-lockers", "ppeLockers", [3.8, 0, 7.23], Math.PI, ["PPE_Locker_"]),
  fixture("waste-bin-01", "wasteBin", [-3.65, 0, -5.75], 0, ["Biohazard_Waste_01_"]),
  fixture("waste-bin-02", "wasteBin", [3.65, 0, -5.75], 0, ["Biohazard_Waste_02_"]),
]);
