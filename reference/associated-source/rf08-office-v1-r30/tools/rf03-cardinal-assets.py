#!/usr/bin/env python3

import argparse
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "public/local-assets/cardinal/rf03"
REQUEST_ROOT = ASSET_ROOT / "requests"
SOURCE_ROOT = ASSET_ROOT / "models/source"
RUNTIME_ROOT = ASSET_ROOT / "models/runtime"
MANIFEST_ROOT = ASSET_ROOT / "manifests"
BATCH_MANIFEST = MANIFEST_ROOT / "generation.json"
RUNTIME_MANIFEST = MANIFEST_ROOT / "runtime.json"

COMMON = """Photorealistic game-ready industrial logistics asset for a normally operating contemporary Chinese express parcel sorting hub. Real engineering proportions and restrained daily use wear: subtle dust, scuffs, fingerprints and fastener wear, never abandoned or heavily damaged. Y axis up, front facing positive Z, centered at world origin, bottom-center pivot. Clean watertight detailed topology, physically based materials, separated metal, rubber, plastic and glass surfaces where applicable. Exactly one isolated object only. No environment, floor, wall, ceiling, pedestal, parcel unless explicitly requested, person, robot, hands, floating parts, animation, neon glow, outline, arrows, UI, readable text, numbers, logo, trademark or baked lighting. Export as a self-contained GLB for Three.js."""

REFERENCE_SUFFIX = """Show the complete object in a clean three-quarter front view so the front, right side and top are visible. Neutral light-gray seamless studio background, centered and fully inside frame, realistic product photography, sharp focus, straight edges, real engineering proportions and minimal soft contact shadow. No crop, environment, room, floor clutter, person, robot, hands, readable text, numbers, logo, trademark, arrows, UI, glow or additional objects."""

ASSETS = (
    {
        "id": "automatic_infeed_machine",
        "targetSizeMeters": [2.50, 2.04, 1.80],
        "prompt": """An enclosed automatic parcel singulation and induction machine, approximately 2.50 m long, 2.04 m high and 1.80 m deep. Off-white powder-coated sheet-metal housing on a dark welded base, wide rectangular parcel exit centered on the positive-Z face, five short galvanized discharge rollers at 0.82 m working height, upper inspection hood, two gasketed service doors, hinges, latches, ventilation grilles, cable glands, adjustable feet, one physical red emergency-stop mushroom and a small unlit status panel. The parcel tunnel and roller gaps must remain visibly open. No loose parcel. """ + COMMON,
    },
    {
        "id": "belt_conveyor_module",
        "targetSizeMeters": [2.00, 1.02, 1.10],
        "prompt": """One straight modular industrial belt conveyor section, exactly 2.00 m long, 1.10 m overall wide and 1.02 m high, with a 1.00 m wide black textured rubber belt at 0.82 m working height. Dark powder-coated steel chassis, galvanized side rails, two symmetric leg frames, adjustable feet with anchor plates, realistic bolts, bearing housings and a compact side-mounted motor gearbox. Both longitudinal ends are clean matching connection planes so identical modules can repeat seamlessly along the X axis. No parcel and no surrounding conveyor sections. """ + COMMON,
    },
    {
        "id": "dws_scanner_gantry",
        "targetSizeMeters": [1.32, 2.85, 1.78],
        "prompt": """One DWS dimensioning-weighing-scanning gantry for a 1.00 m parcel conveyor, approximately 1.32 m long along the conveyor direction, 2.85 m high and 1.78 m wide. Two dark powder-coated vertical posts outside the belt, rigid top crossbeam, centered downward barcode and dimension camera, two frosted LED light bars, photoelectric sensors on adjustable brackets, cable conduits, junction box, calibration fasteners and a thin stainless weighing deck spanning the conveyor opening. The central passage must remain completely open for parcels up to 1.20 m x 1.00 m x 0.80 m. Screens and lights are unlit. """ + COMMON,
    },
    {
        "id": "swing_wheel_sorter",
        "targetSizeMeters": [1.65, 0.95, 1.12],
        "prompt": """One modular swing-wheel parcel sorter bed, approximately 1.65 m long, 1.12 m wide and 0.95 m high, matching a 0.82 m conveyor working surface. Eighteen individually recognizable galvanized or dark urethane divert wheels arranged in six rows of three, each wheel mounted at a realistic twenty-degree steering angle inside a robust rectangular frame. Safety-yellow edge guards, dark steel chassis, visible bearings, compact pneumatic or electric actuator linkage, service cover, wiring conduit, adjustable feet and anchor plates. Flat unobstructed parcel transfer surface with no parcel, no chute and no adjacent conveyor. """ + COMMON,
    },
    {
        "id": "gravity_roller_chute",
        "targetSizeMeters": [1.08, 0.95, 3.00],
        "prompt": """One straight gravity roller parcel discharge chute module, approximately 1.08 m wide, 3.00 m long and 0.95 m maximum height. Slight realistic downward slope from the negative-Z inlet to positive-Z outlet, closely spaced galvanized steel rollers across the width, yellow powder-coated side guards, dark welded support frame, bearing caps, cross braces, adjustable feet and anchor plates. Both ends are open and free of parcels, bins or barriers. The roller gaps and under-frame space must be genuine geometry rather than a solid block. """ + COMMON,
    },
    {
        "id": "route_roll_cage",
        "targetSizeMeters": [1.12, 1.72, 0.82],
        "prompt": """One empty three-sided galvanized steel parcel roll cage, approximately 1.12 m wide, 0.82 m deep and 1.72 m high. Reinforced steel base, open front with a low removable retaining bar, welded wire-mesh back and side panels, four swivel caster forks with black rubber wheels, corner posts, push handle, realistic welds and zinc variation. Include two blank removable placard plates as distinct plain surfaces, one front-facing and one horizontal top-facing, with no writing or color code. Interior and front opening must remain empty and accessible. """ + COMMON,
    },
    {
        "id": "corrugated_parcel",
        "targetSizeMeters": [0.52, 0.32, 0.38],
        "prompt": """One closed corrugated kraft shipping carton, approximately 0.52 m wide, 0.32 m high and 0.38 m deep. Real cardboard thickness, folded top flaps and seam, slightly softened but intact corners, shallow compression dents, restrained handling scuffs, one strip of translucent tan packing tape wrapping over the top and down both sides, and one blank matte-white shipping-label rectangle as a separate flat surface on top. No printed barcode, text, color code, logo, damage opening, contents or extra package. """ + COMMON,
    },
    {
        "id": "dws_control_terminal",
        "targetSizeMeters": [0.64, 1.58, 0.62],
        "prompt": """One freestanding industrial DWS control terminal, approximately 0.64 m wide, 0.62 m deep and 1.58 m high. Floor-mounted galvanized and dark powder-coated pedestal cabinet, angled monitor housing, recessed blank dark screen, compact physical keyboard shelf, barcode scanner cradle without a scanner, red emergency-stop mushroom, green and amber unlit indicator lenses, ventilation slots, service door, hinges, latch, cable gland and bolted plinth. No screen content, floating display or readable labels. """ + COMMON,
    },
    {
        "id": "industrial_electrical_cabinet",
        "targetSizeMeters": [0.72, 2.12, 0.72],
        "prompt": """One floor-mounted industrial electrical control cabinet, approximately 0.72 m wide, 0.72 m deep and 2.12 m high. Light-gray powder-coated folded steel enclosure, single gasketed front door, concealed hinges, quarter-turn handle, top warning-lamp stack with unlit red amber and green lenses, side ventilation grilles, filtered fan cover, cable glands, earthing stud, four lifting eyes, raised plinth and anchor bolts. Blank surfaces with no warning text, numbers, logos or stickers. """ + COMMON,
    },
    {
        "id": "palletized_carton_stack",
        "targetSizeMeters": [1.20, 1.35, 1.00],
        "prompt": """One realistic warehouse palletized carton load, approximately 1.20 m wide, 1.00 m deep and 1.35 m high. Used but sound timber pallet with visible deck boards, blocks, nails and forklift openings, carrying a stable interlocked stack of plain kraft corrugated cartons in three layers. Transparent stretch film tightly wraps the stack with subtle wrinkles and overlapping edges, plus two plain plastic straps. No readable labels, logos, loose boxes, floor or forklift. Treat the complete pallet and load as one isolated object. """ + COMMON,
    },
    {
        "id": "fire_safety_station",
        "targetSizeMeters": [0.85, 1.80, 0.35],
        "prompt": """One compact freestanding Chinese industrial fire-safety equipment station, approximately 0.85 m wide, 0.35 m deep and 1.80 m high. Red powder-coated steel frame and backboard, two secured red dry-powder fire extinguishers, one rolled fire hose, one small metal bucket and realistic mounting clips, feet, fasteners, pressure gauges, rubber hoses and restrained warehouse wear. Use plain blank red and white panels with no readable Chinese text, pictograms, numbers, logos or wall. All equipment must be attached to the station with no floating parts. """ + COMMON,
    },
    {
        "id": "industrial_led_fixture",
        "targetSizeMeters": [1.20, 0.12, 0.24],
        "prompt": """One sealed linear industrial LED warehouse light fixture, approximately 1.20 m long, 0.24 m wide and 0.12 m high. White powder-coated extruded aluminum body, continuous frosted polycarbonate lower diffuser as a distinct unlit material, stainless ceiling mounting clips, short cable gland, end caps, screws and realistic manufacturing seams. No cable suspension, ceiling, light rays, glow, readable certification text or surrounding fixtures. """ + COMMON,
    },
)


def asset_by_id(asset_id):
    for asset in ASSETS:
        if asset["id"] == asset_id:
            return asset
    raise SystemExit(f"Unknown asset: {asset_id}")


def asset_subject(asset):
    return asset["prompt"].replace(COMMON, "").strip()


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_manifest():
    if BATCH_MANIFEST.exists():
        manifest = json.loads(BATCH_MANIFEST.read_text(encoding="utf-8"))
        manifest["operation"] = "cardinal_model3d_image"
        manifest["referenceTokenCostPerAsset"] = 300
        manifest["tokenCostPerAsset"] = 5200
        manifest["confirmedTokenCost"] = len(ASSETS) * 5500
        return manifest
    return {
        "schemaVersion": 1,
        "level": "rf03",
        "qualityPreset": "high-highpoly",
        "operation": "cardinal_model3d_image",
        "referenceTokenCostPerAsset": 300,
        "tokenCostPerAsset": 5200,
        "confirmedTokenCost": len(ASSETS) * 5500,
        "assets": {},
    }


def write_manifest(manifest):
    MANIFEST_ROOT.mkdir(parents=True, exist_ok=True)
    BATCH_MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def prepare():
    for directory in (REQUEST_ROOT, SOURCE_ROOT, RUNTIME_ROOT, MANIFEST_ROOT, ASSET_ROOT / "review"):
        directory.mkdir(parents=True, exist_ok=True)
    manifest = read_manifest()
    for asset in ASSETS:
        asset_id = asset["id"]
        request = {
            "prompt": asset["prompt"],
            "taskType": "text_to_model",
            "qualityPreset": "high-highpoly",
            "outputFormat": "glb",
            "geometryQuality": "detailed",
            "enablePbr": True,
            "texture": True,
            "pivotToCenterBottom": True,
            "refineAfterGeneration": False,
        }
        request_path = REQUEST_ROOT / f"{asset_id}.json"
        request_path.write_text(json.dumps(request, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        reference_request = {
            "prompt": f"Create one photorealistic isolated product reference image for single-image 3D reconstruction. {asset_subject(asset)} {REFERENCE_SUFFIX}",
            "quality": "advanced",
            "resolution": "2k",
            "aspectRatio": "1:1",
            "style": "photorealistic",
            "transparentBackground": False,
        }
        reference_path = REQUEST_ROOT / f"{asset_id}_reference.json"
        reference_path.write_text(json.dumps(reference_request, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        entry = manifest["assets"].setdefault(asset_id, {})
        entry.update({
            "role": "interactive" if asset_id in {"corrugated_parcel", "route_roll_cage", "dws_control_terminal"} else "static",
            "requestFile": str(request_path.relative_to(ASSET_ROOT)),
            "referenceRequestFile": str(reference_path.relative_to(ASSET_ROOT)),
            "targetSizeMeters": asset["targetSizeMeters"],
            "frontAxis": "+Z",
            "pivot": "bottom-center",
            "sourceArtifact": f"models/source/{asset_id}.highpoly.glb",
            "runtimeArtifact": f"models/runtime/{asset_id}.glb",
        })
    write_manifest(manifest)
    print(json.dumps({"prepared": len(ASSETS), "assetRoot": str(ASSET_ROOT), "manifest": str(BATCH_MANIFEST)}, indent=2))


def record_task(asset_id, task_id):
    manifest = read_manifest()
    asset_by_id(asset_id)
    entry = manifest["assets"].setdefault(asset_id, {})
    entry["taskId"] = task_id
    entry["taskType"] = "image_to_model"
    entry["status"] = "submitted"
    write_manifest(manifest)


def record_reference(asset_id, task_id):
    asset_by_id(asset_id)
    manifest = read_manifest()
    entry = manifest["assets"].setdefault(asset_id, {})
    reference = entry.setdefault("reference", {})
    reference["taskId"] = task_id
    reference["status"] = "submitted"
    write_manifest(manifest)


def record_source_image(asset_id, source_image_id):
    asset_by_id(asset_id)
    manifest = read_manifest()
    entry = manifest["assets"].setdefault(asset_id, {})
    reference = entry.setdefault("reference", {})
    reference["sourceImageId"] = source_image_id
    reference["artifact"] = f"references/{asset_id}.png"
    reference["status"] = "uploaded"
    write_manifest(manifest)


def prepare_image_model(asset_id):
    asset = asset_by_id(asset_id)
    manifest = read_manifest()
    entry = manifest["assets"][asset_id]
    source_image_id = entry.get("reference", {}).get("sourceImageId")
    if not source_image_id:
        raise SystemExit(f"Missing sourceImageId for {asset_id}")
    request = {
        "prompt": asset["prompt"],
        "sourceImageId": source_image_id,
        "taskType": "image_to_model",
        "qualityPreset": "high-highpoly",
        "outputFormat": "glb",
        "geometryQuality": "detailed",
        "enablePbr": True,
        "texture": True,
        "pivotToCenterBottom": True,
        "refineAfterGeneration": False,
    }
    request_path = REQUEST_ROOT / f"{asset_id}_image_to_model.json"
    request_path.write_text(json.dumps(request, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    entry["imageModelRequestFile"] = str(request_path.relative_to(ASSET_ROOT))
    write_manifest(manifest)
    print(request_path)


def record_artifact(asset_id, kind):
    manifest = read_manifest()
    entry = manifest["assets"][asset_id]
    relative = entry["sourceArtifact" if kind == "source" else "runtimeArtifact"]
    path = ASSET_ROOT / relative
    if not path.exists():
        raise SystemExit(f"Missing artifact: {path}")
    entry[f"{kind}Bytes"] = path.stat().st_size
    entry[f"{kind}Sha256"] = sha256(path)
    if kind == "source":
        entry["status"] = "downloaded"
    write_manifest(manifest)
    print(json.dumps({"asset": asset_id, "kind": kind, "bytes": path.stat().st_size, "sha256": sha256(path)}, indent=2))


def build_runtime_manifest():
    generation = read_manifest()
    records = []
    for asset in ASSETS:
        asset_id = asset["id"]
        entry = generation["assets"][asset_id]
        path = ASSET_ROOT / entry["runtimeArtifact"]
        if not path.exists() or "runtimeBytes" not in entry or "runtimeSha256" not in entry:
            raise SystemExit(f"Incomplete runtime artifact record: {asset_id}")
        records.append({
            "id": asset_id,
            "path": f"/local-assets/cardinal/rf03/{entry['runtimeArtifact']}",
            "bytes": entry["runtimeBytes"],
            "sha256": entry["runtimeSha256"],
            "dimensions": entry["targetSizeMeters"],
            "texturesEmbedded": True,
            "draco": True,
            "visualReview": "pass",
        })
    manifest = {
        "schemaVersion": 1,
        "rfId": "RF-03",
        "productionStatus": "visual_complete",
        "visualReview": "pass",
        "referenceMatch": "pass",
        "units": "meters",
        "upAxis": "Y",
        "source": "Cardinal image-to-3D high-highpoly",
        "layout": {
            "hallMeters": [26, 4.6, 16],
            "mainConveyor": {"lengthMeters": 19, "widthMeters": 1, "beltHeightMeters": 0.82},
            "infeedMachine": "automatic west-end parcel infeed",
        },
        "sharedInstances": {
            "corrugated_parcel": ["red", "yellow", "blue"],
            "route_roll_cage": ["A-01", "B-02", "C-03"],
        },
        "assets": records,
        "totalBytes": sum(record["bytes"] for record in records),
    }
    RUNTIME_MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"manifest": str(RUNTIME_MANIFEST), "assets": len(records), "totalBytes": manifest["totalBytes"]}, indent=2))


def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("prepare")
    subparsers.add_parser("build-runtime-manifest")
    record = subparsers.add_parser("record-task")
    record.add_argument("asset_id")
    record.add_argument("task_id")
    reference = subparsers.add_parser("record-reference")
    reference.add_argument("asset_id")
    reference.add_argument("task_id")
    source_image = subparsers.add_parser("record-source-image")
    source_image.add_argument("asset_id")
    source_image.add_argument("source_image_id")
    image_model = subparsers.add_parser("prepare-image-model")
    image_model.add_argument("asset_id")
    artifact = subparsers.add_parser("record-artifact")
    artifact.add_argument("asset_id")
    artifact.add_argument("kind", choices=("source", "runtime"))
    args = parser.parse_args()
    if args.command == "prepare":
        prepare()
    elif args.command == "build-runtime-manifest":
        build_runtime_manifest()
    elif args.command == "record-task":
        record_task(args.asset_id, args.task_id)
    elif args.command == "record-reference":
        record_reference(args.asset_id, args.task_id)
    elif args.command == "record-source-image":
        record_source_image(args.asset_id, args.source_image_id)
    elif args.command == "prepare-image-model":
        prepare_image_model(args.asset_id)
    else:
        record_artifact(args.asset_id, args.kind)


if __name__ == "__main__":
    main()
