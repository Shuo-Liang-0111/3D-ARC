import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path("public/local-assets/cardinal/rf09")
REQUESTS = ROOT / "requests"
MANIFESTS = ROOT / "manifests"
SOURCE_MODELS = ROOT / "models/source"
SOURCE_TEXTURES = ROOT / "textures/source"
RUNTIME_MODELS = ROOT / "models/runtime"
RUNTIME_TEXTURES = ROOT / "textures/runtime"
HELPER = Path("/opt/cardinal-aigc-skill/scripts/cardinal_aigc.py")
BLENDER = Path("./.tooling/blender-4.5.9-linux-x64/blender")
MODEL_PREPARE = Path("tools/rf09-prepare-cardinal-assets.py")
SURFACE_PREPARE = Path("tools/rf09-prepare-cardinal-surface.py")

COMMON = ("Y axis up, front facing positive Z, metric scale, centered at world origin, bottom-center pivot. "
          "One isolated photorealistic game-ready object only. Real construction, believable thickness, manufactured edge radii, fasteners and physically based materials. "
          "All supporting feet or the flat base must share one ground plane. No floor, wall, room, pedestal, character, robot, hands, floating parts, baked lighting, neon, arrows, UI, readable text, logo, trademark, watermark or extra objects. Export GLB for Three.js.")

ASSETS = {
    "conference_table": ("Executive boardroom conference table, 8.80 m wide x 0.78 m high x 2.80 m deep. Warm walnut veneer boat-shaped top, dark powder-coated steel cable-management base, recessed power wells with blank covers and stable floor-contacting feet. Long participant edge faces positive Z.", [8.80, 0.78, 2.80]),
    "executive_chair": ("Ergonomic executive conference chair, 0.62 m wide x 1.12 m high x 0.62 m deep. Charcoal woven upholstery, breathable back, restrained lumbar contour, armrests, gas lift and five-spoke aluminum caster base. Seated user would face positive Z and every caster touches ground.", [0.62, 1.12, 0.62]),
    "av_podium": ("Compact tabletop audiovisual connection hub, 0.84 m wide x 0.18 m high x 0.50 m deep. One low graphite and walnut enclosure with a gently sloped operator face, two recessed blank connection bays, cable grommets, fine ventilation slots and four integrated non-slip feet. Operator side faces positive Z. The complete flat underside rests on a conference table; no stand, column or floor plinth.", [0.84, 0.18, 0.50]),
    "conference_terminal": ("Compact tabletop conference touch-control panel, 0.72 m wide x 0.18 m high x 0.48 m deep. One low wedge-shaped graphite enclosure with a single dark inset touch display, thin bezel, rear ventilation slots and integrated non-slip base. Display faces positive Z and contains no UI or text. The complete flat underside rests on a conference table; no stand, column or floor cabinet.", [0.72, 0.18, 0.48]),
    "office_workstation": ("Three-person modern office workstation module, 3.40 m wide x 1.28 m high x 1.45 m deep. Oak laminate desk, graphite steel legs, modesty panel, acoustic privacy divider, three dark monitors on stands and tidy cable trays. Primary work side faces positive Z and all legs touch ground.", [3.40, 1.28, 1.45]),
    "reception_desk": ("Corporate reception desk, 5.40 m wide x 1.10 m high x 0.95 m deep. Warm walnut slat visitor face, pale solid-surface transaction top, recessed staff worktop and black toe kick. Visitor-facing front is positive Z and continuous plinth rests on floor.", [5.40, 1.10, 0.95]),
    "supply_cabinet": ("Simple enclosed administrative office supply cabinet bank, 3.10 m wide x 2.35 m high x 1.30 m deep. One rectangular warm-gray powder-coated steel carcass, six closed flush doors, realistic hinges, vertical handles and one continuous recessed toe kick. No open shelves and no contents. Cabinet doors face positive Z and the continuous base rests on one ground plane.", [3.10, 2.35, 1.30]),
    "it_equipment_locker": ("Secure audiovisual and IT equipment locker bank, 3.00 m wide x 2.40 m high x 1.45 m deep. Graphite perforated steel doors, robust handles, ventilation, one shallow open pickup shelf, internal cable management and continuous floor plinth. Doors face positive Z.", [3.00, 2.40, 1.45]),
    "lounge_sofa": ("Simple three-seat corporate lounge bench sofa, 3.40 m wide x 0.88 m high x 1.10 m deep. One continuous muted-sage upholstered seat, one continuous supportive back, two broad upholstered arms and a recessed continuous black plinth. Symmetrical solid furniture with no loose cushions and no thin legs. Seated user faces positive Z and the entire plinth rests on one ground plane.", [3.40, 0.88, 1.10]),
    "usb_c_video_adapter": ("Compact professional USB-C video adapter dock, 0.34 m wide x 0.07 m high x 0.20 m deep. One solid brushed-aluminum rounded rectangular enclosure, recessed HDMI and USB port openings on the positive Z short edge, fine housing seam and four integrated rubber pads. No cable and no detachable pieces. Flat stable bottom.", [0.34, 0.07, 0.20]),
    "wireless_presenter": ("Wireless presentation clicker, 0.13 m wide x 0.06 m high x 0.42 m deep. Matte graphite ABS body, gently tapered silhouette, two tactile blank buttons, subtle status lens, USB receiver dock seam and laser emitter at positive Z end. One solid handheld object with flat stable underside.", [0.13, 0.06, 0.42]),
    "ceiling_light": ("Simple surface-mounted rectangular office LED panel light, 1.20 m wide x 0.08 m high x 0.30 m deep. One white powder-coated rectangular frame, one continuous opal diffuser on the underside and one shallow solid housing. No clips, no cable and no detachable parts. Diffuser faces downward and the entire flat top mounts flush to the ceiling.", [1.20, 0.08, 0.30]),
}

SURFACES = {
    "carpet_floor": "Seamless tileable 2 m by 2 m commercial low-pile carpet tile surface for a modern occupied Chinese corporate office. Medium warm gray, restrained heathered fibers, subtle alternating module direction and realistic seams, clean with slight traffic variation. Orthographic top-down material source, uniform neutral illumination, no perspective, no horizon, no border, no furniture, no objects, no text, no logo, no directional shadow.",
    "painted_wall": "Seamless tileable warm off-white fine-sand interior latex painted wall surface for a modern occupied corporate office. Very subtle roller stipple and restrained maintenance variation, no panels or large stains. Straight-on orthographic material source, uniform neutral illumination, no perspective, no horizon, no border, no furniture, no objects, no text, no logo, no directional shadow.",
}

def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""): digest.update(chunk)
    return digest.hexdigest()

def helper_json(*args):
    result = subprocess.run([sys.executable, str(HELPER), *args], check=True, capture_output=True, text=True)
    return json.loads(result.stdout)

def load_manifest():
    path = MANIFESTS / "generation.json"
    return json.loads(path.read_text()) if path.exists() else {"level": "RF-09", "provider": "Cardinal", "assets": {}}

def save_manifest(manifest):
    MANIFESTS.mkdir(parents=True, exist_ok=True)
    (MANIFESTS / "generation.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

def generate_requests():
    REQUESTS.mkdir(parents=True, exist_ok=True)
    for name, (description, size) in ASSETS.items():
        payload = {"prompt": f"Photorealistic real-world office asset. {description} Target dimensions approximately {size[0]} m x {size[1]} m x {size[2]} m. {COMMON}", "taskType": "text_to_model", "qualityPreset": "high-highpoly", "outputFormat": "glb", "geometryQuality": "detailed", "enablePbr": True, "texture": True, "pivotToCenterBottom": True, "refineAfterGeneration": False}
        (REQUESTS / f"{name}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    for name, prompt in SURFACES.items():
        payload = {"prompt": prompt, "resolution": "4k", "aspectRatio": "1:1", "quality": "advanced", "transparentBackground": False}
        (REQUESTS / f"{name}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"generated {len(ASSETS)} model requests and {len(SURFACES)} surface requests")

def generate_one(name):
    description, size = ASSETS[name]; REQUESTS.mkdir(parents=True, exist_ok=True)
    payload = {"prompt": f"Photorealistic real-world office asset. {description} Target dimensions approximately {size[0]} m x {size[1]} m x {size[2]} m. {COMMON}", "taskType": "text_to_model", "qualityPreset": "high-highpoly", "outputFormat": "glb", "geometryQuality": "detailed", "enablePbr": True, "texture": True, "pivotToCenterBottom": True, "refineAfterGeneration": False}
    (REQUESTS / f"{name}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")

def submit_requests():
    manifest = load_manifest()
    entries = [(name, "model3d") for name in ASSETS] + [(name, "image") for name in SURFACES]
    for name, kind in entries:
        existing = manifest["assets"].get(name, {})
        if existing.get("taskId"):
            print(f"{name}: reuse {existing['taskId']}"); continue
        result = helper_json("submit", kind, "--file", str(REQUESTS / f"{name}.json"))
        manifest["assets"][name] = {"type": kind, "requestFile": str(REQUESTS / f"{name}.json"), "taskId": result["taskId"], "status": result["status"]}
        save_manifest(manifest)
        print(f"{name}: {result['taskId']} {result['status']}")

def retry_failed():
    manifest = load_manifest()
    for name, entry in manifest["assets"].items():
        if entry.get("status") != "failed": continue
        attempts = entry.setdefault("attempts", []); attempts.append({"taskId": entry["taskId"], "status": entry["status"], "error": entry.get("error")})
        result = helper_json("submit", entry["type"], "--file", entry["requestFile"])
        entry.update(taskId=result["taskId"], status=result["status"], progress=0, error=None)
        save_manifest(manifest); print(f"{name}: retry {result['taskId']} {result['status']}")

def resubmit(names):
    manifest = load_manifest()
    for name in names:
        if name not in ASSETS and name not in SURFACES: raise KeyError(name)
        previous = manifest["assets"].get(name, {})
        attempts = list(previous.get("attempts", []))
        if previous.get("taskId"):
            attempts.append({"taskId": previous["taskId"], "status": previous.get("status"), "error": previous.get("error")})
        kind = "model3d" if name in ASSETS else "image"
        request_file = str(REQUESTS / f"{name}.json")
        result = helper_json("submit", kind, "--file", request_file)
        entry = {"type": kind, "requestFile": request_file, "taskId": result["taskId"], "status": result["status"]}
        if attempts: entry["attempts"] = attempts
        manifest["assets"][name] = entry
        save_manifest(manifest)
        print(f"{name}: resubmit {result['taskId']} {result['status']}")

def refresh_status():
    manifest = load_manifest()
    for name, entry in manifest["assets"].items():
        if entry.get("status") in {"completed", "failed", "cancelled"}: continue
        result = helper_json("task", entry["taskId"])
        entry.update(status=result["status"], progress=result.get("progress"), error=result.get("error"))
        print(f"{name}: {entry['status']} {entry.get('progress') or 0}%")
    save_manifest(manifest)

def download_completed():
    manifest = load_manifest(); SOURCE_MODELS.mkdir(parents=True, exist_ok=True); SOURCE_TEXTURES.mkdir(parents=True, exist_ok=True)
    for name, entry in manifest["assets"].items():
        if entry.get("status") != "completed" or entry.get("sourceArtifact"): continue
        output = SOURCE_MODELS / f"{name}.highpoly.glb" if entry["type"] == "model3d" else SOURCE_TEXTURES / f"{name}-basecolor.png"
        helper_json("artifact", entry["taskId"], "--output", str(output), "--force")
        entry.update(sourceArtifact=str(output), sourceSha256=sha256(output), sourceBytes=output.stat().st_size)
        save_manifest(manifest); print(f"{name}: downloaded {output}")

def poll_and_download():
    while True:
        refresh_status(); manifest = load_manifest(); statuses = [entry["status"] for entry in manifest["assets"].values()]
        if statuses and all(status in {"completed", "failed", "cancelled"} for status in statuses): download_completed(); return
        time.sleep(15)

def prepare_runtime():
    RUNTIME_MODELS.mkdir(parents=True, exist_ok=True); RUNTIME_TEXTURES.mkdir(parents=True, exist_ok=True)
    runtime_manifest = MANIFESTS / "runtime.json"; surface_manifest = MANIFESTS / "surfaces.json"
    environment = os.environ.copy(); library_paths = ["/opt/arc-runtime/envs/build_311/lib", "./.tooling/blender-libs/usr/lib/x86_64-linux-gnu"]
    environment["LD_LIBRARY_PATH"] = f"{':'.join(library_paths)}:{environment.get('LD_LIBRARY_PATH', '')}"
    for name in ASSETS:
        subprocess.run([str(BLENDER), "--background", "--python", str(MODEL_PREPARE), "--", "--asset", name, "--input", str(SOURCE_MODELS / f"{name}.highpoly.glb"), "--output", str(RUNTIME_MODELS / f"{name}.glb"), "--manifest", str(runtime_manifest)], check=True, env=environment)
    for name in SURFACES:
        subprocess.run([str(BLENDER), "--background", "--python", str(SURFACE_PREPARE), "--", "--name", name, "--input", str(SOURCE_TEXTURES / f"{name}-basecolor.png"), "--output", str(RUNTIME_TEXTURES / f"{name}-basecolor.webp"), "--manifest", str(surface_manifest)], check=True, env=environment)

def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "generate"
    if action == "generate-one": generate_one(sys.argv[2]); return
    if action == "resubmit": resubmit(sys.argv[2:]); return
    {"generate": generate_requests, "submit": submit_requests, "retry-failed": retry_failed, "status": refresh_status, "download": download_completed, "poll": poll_and_download, "prepare": prepare_runtime}[action]()

if __name__ == "__main__": main()
