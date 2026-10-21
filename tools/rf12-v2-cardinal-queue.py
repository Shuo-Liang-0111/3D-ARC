#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

root = Path("public/local-assets/cardinal/rf12-v2")
manifest_path = root / "manifests/generation.json"
manifest = json.loads(manifest_path.read_text())
helper = "/opt/cardinal-aigc-skill/scripts/cardinal_aigc.py"
for asset_id, entry in manifest["assets"].items():
    if entry.get("taskId"):
        continue
    request = root / entry["requestFile"]
    result = subprocess.run(["python3", helper, "submit", "model3d", "--file", str(request)], check=True, capture_output=True, text=True)
    response = json.loads(result.stdout)
    entry["taskId"] = response["taskId"]
    entry["requestId"] = response.get("requestId")
    entry["status"] = response.get("status", "queued")
    print(json.dumps({"asset": asset_id, "taskId": entry["taskId"], "status": entry["status"]}))
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
