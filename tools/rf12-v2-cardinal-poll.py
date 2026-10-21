#!/usr/bin/env python3
import json
import subprocess
import time
from pathlib import Path

root = Path("public/local-assets/cardinal/rf12-v2")
manifest_path = root / "manifests/generation.json"
manifest = json.loads(manifest_path.read_text())
helper = "/opt/cardinal-aigc-skill/scripts/cardinal_aigc.py"
pending = set(manifest["assets"])
for attempt in range(60):
    manifest = json.loads(manifest_path.read_text())
    pending = {asset_id for asset_id, entry in manifest["assets"].items() if entry.get("status") not in {"downloaded", "failed"}}
    if not pending:
        break
    for asset_id in sorted(pending):
        entry = manifest["assets"][asset_id]
        task_id = entry.get("taskId")
        if not task_id:
            continue
        result = subprocess.run(["python3", helper, "task", task_id], check=False, capture_output=True, text=True)
        try:
            response = json.loads(result.stdout)
        except json.JSONDecodeError:
            continue
        status = response.get("status", "unknown")
        entry["status"] = status
        if status == "completed":
            output = root / entry["sourceArtifact"]
            output.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(["python3", helper, "artifact", task_id, "--output", str(output)], check=True, capture_output=True, text=True)
            entry["status"] = "downloaded"
            entry["sourceBytes"] = output.stat().st_size
            print(json.dumps({"asset": asset_id, "status": "downloaded", "bytes": entry["sourceBytes"]}))
        elif status in {"failed", "cancelled"}:
            entry["error"] = response.get("error") or response.get("message") or "Cardinal task failed"
            print(json.dumps({"asset": asset_id, "status": status}))
        else:
            print(json.dumps({"asset": asset_id, "status": status}))
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    if pending:
        time.sleep(15)
manifest = json.loads(manifest_path.read_text())
print(json.dumps({"complete": all(entry.get("status") in {"downloaded", "failed", "cancelled"} for entry in manifest["assets"].values()), "assets": {asset_id: entry.get("status") for asset_id, entry in manifest["assets"].items()}}, indent=2, ensure_ascii=False))
