#!/usr/bin/env python3

import argparse
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "public/local-assets/cardinal/rf05"
REQUEST_ROOT = ASSET_ROOT / "requests"
REFERENCE_ROOT = ASSET_ROOT / "references"
TEXTURE_ROOT = ASSET_ROOT / "textures/source"
SOURCE_ROOT = ASSET_ROOT / "models/source"
RUNTIME_ROOT = ASSET_ROOT / "models/runtime"
MANIFEST_ROOT = ASSET_ROOT / "manifests"
BATCH_MANIFEST = MANIFEST_ROOT / "generation.json"
RUNTIME_MANIFEST = MANIFEST_ROOT / "runtime.json"

COMMON = """Photorealistic game-ready hospitality asset for a contemporary midscale Chinese business hotel twin room in normal daily use. Real-world manufacturing proportions and restrained wear: subtle fingerprints, fabric creases, contact scuffs and cleaning marks, never abandoned, broken, luxurious, sci-fi or heavily distressed. Y axis up, front facing positive Z, centered at world origin, bottom-center pivot. Clean watertight detailed topology, physically based materials, and distinct wood, textile, ceramic, metal, plastic and glass surfaces where applicable. Exactly one isolated object only. No room, floor, wall, ceiling, pedestal, person, robot, hands, floating parts, animation, neon glow, outline, arrows, UI, readable text, numbers, logo, trademark or baked lighting. Export as a self-contained GLB for Three.js."""

REFERENCE_SUFFIX = """Show the complete object in a clean three-quarter front view so the front, right side and top are visible. Neutral light-gray seamless studio background, centered and fully inside frame, realistic product photography, sharp focus, straight edges, accurate proportions and a minimal soft contact shadow. No crop, room, floor clutter, person, robot, hands, readable text, numbers, logo, trademark, arrows, UI, glow or additional objects."""

ASSETS = (
    {
        "id": "twin_bed",
        "role": "static",
        "targetSizeMeters": [1.86, 0.68, 2.65],
        "prompt": """One midscale business-hotel twin bed, approximately 1.86 m wide, 2.65 m long and 0.68 m high including bedding. A dark walnut veneered low platform and slim upholstered headboard, supportive mattress, warm ivory fitted sheet, white duvet with restrained natural folds, exactly two plump white pillows, and one narrow deep teal-gray fabric runner. The bed must be one connected object sitting flat, with no separate floating cloth, loose bedding, visible floor slab, bedside table or surrounding furniture. """ + COMMON,
    },
    {
        "id": "bedside_table",
        "role": "static",
        "targetSizeMeters": [0.55, 0.55, 0.45],
        "prompt": """One compact hotel bedside table, approximately 0.55 m wide, 0.45 m deep and 0.55 m high. Dark walnut veneer cabinet with one shallow drawer, one lower open shelf, softly rounded manufactured edges, recessed black pull, realistic panel seams, discreet cable grommet and four short hidden feet. Empty top and shelves. """ + COMMON,
    },
    {
        "id": "writing_desk",
        "role": "static",
        "targetSizeMeters": [1.60, 0.76, 0.62],
        "prompt": """One wall-side hotel writing desk, approximately 1.60 m wide, 0.62 m deep and 0.76 m high. Warm dark walnut veneer top with realistic thickness and edge banding, slim black powder-coated steel frame, two modesty-panel supports, one narrow under-top drawer, cable grommet, concealed cable tray, adjustable feet and restrained contact wear. Completely empty work surface. """ + COMMON,
    },
    {
        "id": "desk_chair",
        "role": "static",
        "targetSizeMeters": [0.58, 0.90, 0.58],
        "prompt": """One midscale hotel desk chair, approximately 0.58 m wide, 0.58 m deep and 0.90 m high. Deep teal-gray tightly woven upholstered seat and gently curved back, subtle piping, slim matte-black steel sled legs, protective feet, realistic foam compression and slight daily-use creases. No wheels, arms or loose cushion. """ + COMMON,
    },
    {
        "id": "television_console",
        "role": "static",
        "targetSizeMeters": [1.70, 1.25, 0.45],
        "prompt": """One integrated hotel television and low console unit, approximately 1.70 m wide, 0.45 m deep and 1.25 m high overall. Dark walnut low cabinet with two closed doors, one open equipment shelf and short recessed plinth, supporting a thin 43-inch matte black flat-screen television on a stable central stand. Screen is dark, blank and non-reflective. Include realistic panel gaps, ventilation slots and a short concealed cable path. Treat console and television as one attached object. """ + COMMON,
    },
    {
        "id": "wardrobe",
        "role": "static",
        "targetSizeMeters": [1.55, 2.55, 0.72],
        "prompt": """One floor-standing hotel wardrobe, approximately 1.55 m wide, 0.72 m deep and 2.55 m high. Dark walnut veneer carcass, two closed full-height flush doors, narrow black shadow gaps, understated recessed pulls, lower luggage-safe compartment line, top cornice flush to the cabinet, concealed hinges and a durable recessed plinth. Doors remain closed; no mirror, clothing or open interior. """ + COMMON,
    },
    {
        "id": "luggage_bench",
        "role": "static",
        "targetSizeMeters": [1.50, 0.52, 0.62],
        "prompt": """One hotel luggage bench, approximately 1.50 m wide, 0.62 m deep and 0.52 m high. Dark walnut frame with a broad deep teal-gray upholstered top, subtle piping, realistic woven fabric, shallow foam compression, open lower shelf with four evenly spaced black luggage straps and sturdy low feet. No suitcase or loose object. """ + COMMON,
    },
    {
        "id": "curtain_window_module",
        "role": "static",
        "targetSizeMeters": [2.60, 2.50, 0.25],
        "prompt": """One complete hotel window dressing module, approximately 2.60 m wide, 2.50 m high and 0.25 m deep. A slim dark aluminum rectangular window frame with two large clear panes, exactly one warm-gray blackout curtain panel gathered naturally at each side, and one translucent ivory sheer layer across the center, with a concealed track, hem weights and realistic layered fabric folds. Preserve transparent open space through the glass. No exterior scenery, wall, ceiling, floor, backing slab, backboard, side return panel, curtain rod finials or baked sunlight. """ + COMMON,
    },
    {
        "id": "bathroom_vanity",
        "role": "static",
        "targetSizeMeters": [1.20, 0.85, 0.55],
        "prompt": """One hotel bathroom vanity, approximately 1.20 m wide, 0.55 m deep and 0.85 m high. Warm-gray stone countertop with integrated white ceramic basin, single brushed-nickel mixer tap, dark walnut two-door under-cabinet, black shadow gaps, realistic drain, overflow, silicone seams, wall-side backsplash strip and recessed plinth. Countertop is empty. No mirror, wall, plumbing hoses or toiletries. """ + COMMON,
    },
    {
        "id": "toilet",
        "role": "static",
        "targetSizeMeters": [0.42, 0.78, 0.70],
        "prompt": """One contemporary compact floor-mounted hotel toilet, approximately 0.42 m wide, 0.70 m deep and 0.78 m high including tank. Glossy white vitreous ceramic close-coupled pan and cistern, closed slim seat and lid, dual flush button, realistic bowl foot, plumbing connection cover, subtle silicone base seal and accurate ceramic thickness. No bidet hose, wall or floor slab. """ + COMMON,
    },
    {
        "id": "shower_fixture",
        "role": "static",
        "targetSizeMeters": [0.32, 2.10, 0.22],
        "prompt": """One wall-mounted hotel shower fixture set, approximately 0.32 m wide, 0.22 m deep and 2.10 m high. Brushed stainless vertical rail, adjustable handheld shower head and flexible hose, compact thermostatic mixer bar, circular overhead rain shower, lower spout, two small mounting brackets and a narrow wire soap shelf. All parts physically connected and aligned for wall mounting. No wall, glass enclosure, water, towel or toiletries. """ + COMMON,
    },
    {
        "id": "ceiling_light",
        "role": "static",
        "targetSizeMeters": [0.80, 0.10, 0.80],
        "prompt": """One low-profile square hotel ceiling light fixture, approximately 0.80 m wide, 0.80 m deep and 0.10 m high. Slim matte-white powder-coated aluminum perimeter, continuous warm-white frosted diffuser as a distinct unlit material, shallow ceiling mounting tray, subtle manufacturing seams and concealed fasteners. No ceiling, suspension cable, light rays or glow. """ + COMMON,
    },
    {
        "id": "towel",
        "role": "interactive",
        "targetSizeMeters": [0.68, 0.14, 0.45],
        "prompt": """One used but clean white cotton bath towel folded loosely into a compact graspable bundle, approximately 0.68 m wide, 0.45 m deep and 0.14 m thick. Dense terry loops, rounded soft edges, layered folds, slight compression, a few natural rumples and one subtle woven border. It must read clearly from first-person carrying distance. No basket, hanger, hand, stain, label or extra cloth. """ + COMMON,
    },
    {
        "id": "drinking_cup",
        "role": "interactive",
        "targetSizeMeters": [0.11, 0.12, 0.11],
        "prompt": """One small hotel drinking tumbler, approximately 0.11 m wide, 0.11 m deep and 0.12 m high. Clear thick glass with a slightly weighted base, gently tapered cylindrical sides, open top, realistic rim thickness, subtle refraction and a few restrained water spots and fingerprints. Empty interior, easy to grasp around the middle. No saucer, straw, liquid, logo or writing. """ + COMMON,
    },
    {
        "id": "paper_trash",
        "role": "interactive",
        "targetSizeMeters": [0.16, 0.18, 0.16],
        "prompt": """One compact crumpled ball of plain off-white waste paper, approximately 0.16 m wide, 0.16 m deep and 0.18 m high. Irregular but closed graspable silhouette, many believable sharp and soft folds, thin paper edges, subtle fiber roughness and very light gray handling marks. No readable printing, food waste, plastic, floor, hand or extra scraps. """ + COMMON,
    },
    {
        "id": "laundry_basket",
        "role": "target",
        "targetSizeMeters": [0.72, 0.62, 0.72],
        "prompt": """One empty round hotel laundry basket, approximately 0.72 m wide, 0.72 m deep and 0.62 m high. Warm ivory woven synthetic-rattan body with a rigid circular rim, genuinely open top, visible empty interior, dark washable fabric liner folded over the rim, reinforced base ring and two integrated side grip openings. No lid, towel, clothing, floor or solid cap across the opening. """ + COMMON,
    },
    {
        "id": "cleaning_cart",
        "role": "target",
        "targetSizeMeters": [0.95, 1.05, 0.55],
        "prompt": """One compact professional hotel housekeeping cart, approximately 0.95 m wide, 0.55 m deep and 1.05 m high. Brushed stainless tubular frame, dark gray molded shelves, top tray with raised edge, one open receiving tray suitable for a drinking cup, two folded neutral towels on a lower shelf, small covered supply bins, ergonomic push handle and four swivel caster wheels with dark rubber tires. Realistic fasteners and restrained cleaning wear. No readable labels, chemicals, mop, bag, room or person. """ + COMMON,
    },
    {
        "id": "trash_bin",
        "role": "target",
        "targetSizeMeters": [0.54, 0.62, 0.54],
        "prompt": """One empty hotel waste bin, approximately 0.54 m wide, 0.54 m deep and 0.62 m high. Matte charcoal-gray powder-coated metal outer shell with a gently tapered round profile, fully open top, removable black liner folded neatly over the rim, dark empty interior, subtle base ring, realistic sheet-metal thickness and restrained contact scuffs. No lid, paper, logo, floor or solid cap over the opening. """ + COMMON,
    },
)

SURFACES = (
    {
        "id": "guestroom_wood_floor",
        "prompt": "Photorealistic seamless square top-down material scan of warm medium walnut engineered hotel wood flooring. Straight parallel planks, each about 18 cm wide, varied lengths, narrow dark joints, subtle grain and restrained tonal variation. Flat evenly lit orthographic surface only, edge-to-edge tileable texture. No perspective, room, furniture, objects, shadow, highlight, border, text, logo or vignette.",
    },
    {
        "id": "warm_gray_wall",
        "prompt": "Seamless tileable orthographic PBR base-color texture of warm light-gray fine hotel wall coating, very subtle mineral grain and roller variation, clean normal-operation condition with restrained touch marks. Flat evenly lit material scan, square crop, edge-to-edge texture, no perspective, wall corner, trim, objects, stains, shadows, highlights, borders, text or logo.",
    },
    {
        "id": "bathroom_floor_tile",
        "prompt": "Photorealistic seamless square top-down material scan of anti-slip warm light-gray stone-look porcelain bathroom floor tiles. Repeating 60 cm square modules with fine natural aggregate, narrow medium-gray grout and restrained tonal variation in clean hotel condition. Flat evenly lit orthographic surface only, edge-to-edge tileable texture. No perspective, room, drain, fixtures, objects, shadow, highlight, border, text, logo or vignette.",
    },
    {
        "id": "bathroom_wall_tile",
        "prompt": "Seamless tileable orthographic PBR base-color texture of low-contrast warm ivory stone-look porcelain hotel bathroom wall tiles, 60 by 120 cm modules, subtle veining, narrow light-gray grout and clean maintained condition. Flat evenly lit material scan, square crop, edge-to-edge texture, no perspective, wall corner, fixtures, objects, shadows, highlights, borders, text or logo.",
    },
)


def asset_by_id(asset_id):
    for asset in ASSETS:
        if asset["id"] == asset_id:
            return asset
    raise SystemExit(f"Unknown asset: {asset_id}")


def surface_by_id(surface_id):
    for surface in SURFACES:
        if surface["id"] == surface_id:
            return surface
    raise SystemExit(f"Unknown surface: {surface_id}")


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_manifest():
    if BATCH_MANIFEST.exists():
        return json.loads(BATCH_MANIFEST.read_text(encoding="utf-8"))
    return {
        "schemaVersion": 1,
        "level": "rf05",
        "qualityPreset": "high-highpoly",
        "operation": "cardinal_model3d_image",
        "referenceTokenCostPerAsset": 300,
        "tokenCostPerAsset": 5200,
        "surfaceTokenCostPerAsset": 300,
        "authorizedWithoutFurtherCostReports": True,
        "assets": {},
        "surfaces": {},
    }


def write_manifest(manifest):
    MANIFEST_ROOT.mkdir(parents=True, exist_ok=True)
    BATCH_MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def prepare():
    for directory in (REQUEST_ROOT, REFERENCE_ROOT, TEXTURE_ROOT, SOURCE_ROOT, RUNTIME_ROOT, MANIFEST_ROOT, ASSET_ROOT / "review"):
        directory.mkdir(parents=True, exist_ok=True)
    manifest = read_manifest()
    for asset in ASSETS:
        asset_id = asset["id"]
        reference_request = {
            "prompt": f"Create one photorealistic isolated product reference image for single-image 3D reconstruction. {asset['prompt'].replace(COMMON, '').strip()} {REFERENCE_SUFFIX}",
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
            "role": asset["role"],
            "referenceRequestFile": str(reference_path.relative_to(ASSET_ROOT)),
            "targetSizeMeters": asset["targetSizeMeters"],
            "frontAxis": "+Z",
            "pivot": "bottom-center",
            "sourceArtifact": f"models/source/{asset_id}.highpoly.glb",
            "runtimeArtifact": f"models/runtime/{asset_id}.glb",
        })
    for surface in SURFACES:
        surface_id = surface["id"]
        request = {
            "prompt": surface["prompt"],
            "quality": "advanced",
            "resolution": "2k",
            "aspectRatio": "1:1",
            "style": "photorealistic",
            "transparentBackground": False,
        }
        request_path = REQUEST_ROOT / f"{surface_id}.json"
        request_path.write_text(json.dumps(request, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        manifest["surfaces"].setdefault(surface_id, {}).update({
            "requestFile": str(request_path.relative_to(ASSET_ROOT)),
            "artifact": f"textures/source/{surface_id}.png",
        })
    write_manifest(manifest)
    print(json.dumps({"assets": len(ASSETS), "surfaces": len(SURFACES), "manifest": str(BATCH_MANIFEST)}, indent=2))


def record_reference(asset_id, task_id):
    asset_by_id(asset_id)
    manifest = read_manifest()
    reference = manifest["assets"][asset_id].setdefault("reference", {})
    reference.update({"taskId": task_id, "status": "submitted", "artifact": f"references/{asset_id}.png"})
    write_manifest(manifest)


def record_source_image(asset_id, source_image_id):
    asset = asset_by_id(asset_id)
    manifest = read_manifest()
    entry = manifest["assets"][asset_id]
    reference = entry.setdefault("reference", {})
    reference.update({"sourceImageId": source_image_id, "status": "uploaded"})
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


def record_task(asset_id, task_id):
    asset_by_id(asset_id)
    manifest = read_manifest()
    manifest["assets"][asset_id].update({"taskId": task_id, "taskType": "image_to_model", "status": "submitted"})
    write_manifest(manifest)


def record_surface_task(surface_id, task_id):
    surface_by_id(surface_id)
    manifest = read_manifest()
    manifest["surfaces"][surface_id].update({"taskId": task_id, "status": "submitted"})
    write_manifest(manifest)


def record_artifact(item_id, kind):
    manifest = read_manifest()
    if kind == "surface":
        entry = manifest["surfaces"][item_id]
        path = ASSET_ROOT / entry["artifact"]
        entry["status"] = "downloaded"
    else:
        entry = manifest["assets"][item_id]
        path = ASSET_ROOT / entry["sourceArtifact" if kind == "source" else "runtimeArtifact"]
        entry["status"] = "downloaded" if kind == "source" else entry.get("status", "downloaded")
    if not path.exists():
        raise SystemExit(f"Missing artifact: {path}")
    entry[f"{kind}Bytes"] = path.stat().st_size
    entry[f"{kind}Sha256"] = sha256(path)
    write_manifest(manifest)
    print(json.dumps({"id": item_id, "kind": kind, "bytes": path.stat().st_size, "sha256": sha256(path)}, indent=2))


def build_runtime_manifest():
    generation = read_manifest()
    assets = []
    for asset in ASSETS:
        entry = generation["assets"][asset["id"]]
        path = ASSET_ROOT / entry["runtimeArtifact"]
        if not path.exists():
            raise SystemExit(f"Missing runtime artifact: {path}")
        assets.append({
            "id": asset["id"],
            "role": asset["role"],
            "path": f"/local-assets/cardinal/rf05/{entry['runtimeArtifact']}",
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "dimensions": asset["targetSizeMeters"],
            "texturesEmbedded": True,
            "visualReview": "pending",
        })
    surfaces = []
    for surface in SURFACES:
        entry = generation["surfaces"][surface["id"]]
        path = ASSET_ROOT / entry["artifact"]
        if not path.exists():
            raise SystemExit(f"Missing surface artifact: {path}")
        surfaces.append({
            "id": surface["id"],
            "path": f"/local-assets/cardinal/rf05/{entry['artifact']}",
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "visualReview": "pending",
        })
    manifest = {
        "schemaVersion": 1,
        "rfId": "RF-05",
        "productionStatus": "runtime_candidate",
        "visualReview": "pending",
        "referenceMatch": "pending",
        "units": "meters",
        "upAxis": "Y",
        "source": "Cardinal image-to-3D high-highpoly plus Cardinal advanced surface images",
        "layout": {
            "roomMeters": [8.4, 2.8, 10.8],
            "type": "contemporary Chinese midscale business-hotel twin room",
            "operationState": "daily use with restrained local clutter",
        },
        "sharedInstances": {"twin_bed": 2, "ceiling_light": "array"},
        "assets": assets,
        "surfaces": surfaces,
        "totalBytes": sum(item["bytes"] for item in assets + surfaces),
    }
    RUNTIME_MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"manifest": str(RUNTIME_MANIFEST), "assets": len(assets), "surfaces": len(surfaces), "totalBytes": manifest["totalBytes"]}, indent=2))


def mark_runtime_reviewed():
    if not RUNTIME_MANIFEST.exists():
        raise SystemExit(f"Missing runtime manifest: {RUNTIME_MANIFEST}")

    manifest = json.loads(RUNTIME_MANIFEST.read_text(encoding="utf-8"))
    assets = manifest.get("assets", [])
    surfaces = manifest.get("surfaces", [])
    expected_asset_ids = {asset["id"] for asset in ASSETS}
    expected_surface_ids = {surface["id"] for surface in SURFACES}
    actual_asset_ids = {asset.get("id") for asset in assets}
    actual_surface_ids = {surface.get("id") for surface in surfaces}

    if len(assets) != len(ASSETS) or actual_asset_ids != expected_asset_ids:
        raise SystemExit(
            f"Runtime manifest must contain all {len(ASSETS)} RF-05 assets "
            f"(found {len(assets)})"
        )
    if len(surfaces) != len(SURFACES) or actual_surface_ids != expected_surface_ids:
        raise SystemExit(
            f"Runtime manifest must contain all {len(SURFACES)} RF-05 surfaces "
            f"(found {len(surfaces)})"
        )

    for item in assets + surfaces:
        relative_path = item.get("path", "").removeprefix("/local-assets/cardinal/rf05/")
        artifact_path = ASSET_ROOT / relative_path
        if not relative_path or not artifact_path.is_file():
            raise SystemExit(f"Missing reviewed artifact: {artifact_path}")
        item["visualReview"] = "pass"

    manifest.update({
        "productionStatus": "visual_complete",
        "visualReview": "pass",
        "referenceMatch": "pass",
    })
    RUNTIME_MANIFEST.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "manifest": str(RUNTIME_MANIFEST),
        "productionStatus": manifest["productionStatus"],
        "assetsReviewed": len(assets),
        "surfacesReviewed": len(surfaces),
    }, indent=2))


def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("prepare")
    subparsers.add_parser("build-runtime-manifest")
    subparsers.add_parser("mark-runtime-reviewed")
    reference = subparsers.add_parser("record-reference")
    reference.add_argument("asset_id")
    reference.add_argument("task_id")
    source_image = subparsers.add_parser("record-source-image")
    source_image.add_argument("asset_id")
    source_image.add_argument("source_image_id")
    task = subparsers.add_parser("record-task")
    task.add_argument("asset_id")
    task.add_argument("task_id")
    surface_task = subparsers.add_parser("record-surface-task")
    surface_task.add_argument("surface_id")
    surface_task.add_argument("task_id")
    artifact = subparsers.add_parser("record-artifact")
    artifact.add_argument("item_id")
    artifact.add_argument("kind", choices=("source", "runtime", "surface"))
    args = parser.parse_args()
    if args.command == "prepare":
        prepare()
    elif args.command == "build-runtime-manifest":
        build_runtime_manifest()
    elif args.command == "mark-runtime-reviewed":
        mark_runtime_reviewed()
    elif args.command == "record-reference":
        record_reference(args.asset_id, args.task_id)
    elif args.command == "record-source-image":
        record_source_image(args.asset_id, args.source_image_id)
    elif args.command == "record-task":
        record_task(args.asset_id, args.task_id)
    elif args.command == "record-surface-task":
        record_surface_task(args.surface_id, args.task_id)
    else:
        record_artifact(args.item_id, args.kind)


if __name__ == "__main__":
    main()
