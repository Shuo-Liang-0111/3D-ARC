import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path("./production/rf13/realism-v0.3")
HELPER = "/opt/cardinal-aigc-skill/scripts/cardinal_aigc.py"
ASSETS = {
    "floor": ("image", {"prompt": "Seamlessly tileable orthographic flat scan of pale warm grey hospital homogeneous vinyl flooring with very fine subtle mineral flecks, clean contemporary Chinese community clinic, matte disinfectable surface. Uniform diffuse neutral lighting, no shadows, no perspective, no grout, no text, no objects. Real photographic surface detail at 1 meter square scale.", "resolution": "2k", "aspectRatio": "1:1"}),
    "oak": ("image", {"prompt": "Seamlessly tileable orthographic flat scan of light natural oak laminate furniture surface. Fine straight subtle warm beige wood grain, clean contemporary medical reception cabinetry, restrained low contrast. Uniform diffuse neutral lighting, no perspective, no objects, no text, no shadows.", "resolution": "2k", "aspectRatio": "1:1"}),
    "exam-bed": ("model3d", {"prompt": "One realistic compact examination couch for a contemporary Chinese community clinic, isolated object. 0.75 meters wide, 1.90 meters long, 0.65 meters total height. Thin sage green medical vinyl padded mattress, gently raised head cushion at rear, four stainless steel legs and cross braces, small white paper roll holder under head end, intact clean usable equipment with fine seams and rubber feet. Long axis along Z, head at rear minus Z. No surrounding room, no floor slab, no person, no text, no additional objects."}),
    "chair": ("model3d", {"prompt": "One realistic modern community clinic waiting chair, isolated single chair, 0.60 meters wide, 0.90 meters high, 0.65 meters deep. Teal molded padded vinyl seat and backrest, brushed stainless steel four legs and two slim arms, rubber foot caps, clean commercial healthcare furniture. Front faces positive Z, backrest at negative Z. No floor slab, no room, no people, no text."}),
    "trolley": ("model3d", {"prompt": "One realistic compact stainless steel clinical supply trolley, isolated object, width 0.65 meters, depth 0.55 meters, total height 0.90 meters. Two shallow rectangular trays with raised lips, four slim tubular upright legs, four small rubber swivel casters, U shaped push handle attached to one end. Clean lightly brushed stainless steel with realistic joints. Empty trays, no additional objects, no floor slab, no room, no text."})
}
for name, (kind, request) in ASSETS.items():
    if kind == "model3d":
        request.update(taskType="text_to_model", qualityPreset="high-highpoly", outputFormat="glb", enablePbr=True, texture=True, pivotToCenterBottom=True)

parser = argparse.ArgumentParser()
parser.add_argument("--submit", action="store_true")
args = parser.parse_args()
ROOT.mkdir(parents=True, exist_ok=True)
(ROOT / "requests").mkdir(exist_ok=True)
(ROOT / "source").mkdir(exist_ok=True)
ledger_path = ROOT / "tasks.json"
ledger = json.loads(ledger_path.read_text()) if ledger_path.exists() else {}
def save():
    temporary = ledger_path.with_suffix(".tmp")
    temporary.write_text(json.dumps(ledger, indent=2) + "\n")
    temporary.replace(ledger_path)
def call(*arguments):
    result = subprocess.run([sys.executable, HELPER, *arguments], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-600:] or result.stdout[-600:])
    return json.loads(result.stdout)
for name, (kind, request) in ASSETS.items():
    request_path = ROOT / "requests" / (name + ".json")
    if not request_path.exists():
        request_path.write_text(json.dumps(request, indent=2))
    record = ledger.get(name)
    if record is None and args.submit:
        ledger[name] = {"status": "submission-pending", "kind": kind}
        save()
        response = call("submit", kind, "--file", str(request_path))
        record = ledger[name] = {"taskId": response["taskId"], "status": response["status"], "kind": kind}
        save()
    if not record:
        continue
    if not record.get("taskId"):
        raise RuntimeError(name + ": uncertain submission; reconcile before retry")
    task = call("task", record["taskId"])
    record.update({key: task.get(key) for key in ("status", "progress", "retryAfterSeconds", "errorCode")})
    if task["status"] == "completed":
        output = ROOT / "source" / (name + (".png" if kind == "image" else ".glb"))
        if not output.exists():
            partial = output.with_suffix(output.suffix + ".partial")
            result = subprocess.run([sys.executable, HELPER, "artifact", record["taskId"], "--output", str(partial)], capture_output=True, text=True)
            if result.returncode:
                raise RuntimeError(name + ": download failed")
            if partial.stat().st_size < 1000:
                raise RuntimeError(name + ": invalid artifact")
            if kind == "model3d" and partial.read_bytes()[:4] != b"glTF":
                raise RuntimeError(name + ": invalid GLB header")
            partial.replace(output)
        record.update(sourceSha256=hashlib.sha256(output.read_bytes()).hexdigest(), bytes=output.stat().st_size, path=str(output))
    save()
    print(name, record["status"], record.get("progress"), flush=True)
