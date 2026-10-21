#!/usr/bin/env python3
import hashlib
import json
import subprocess
from pathlib import Path

root = Path("public/local-assets/cardinal/rf12-v2")
manifest_path = root / "manifests/generation.json"
manifest = json.loads(manifest_path.read_text())
def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
for asset_id, entry in manifest["assets"].items():
    if entry.get("status") != "downloaded":
        continue
    source = root / entry["sourceArtifact"]
    runtime = root / entry["runtimeArtifact"]
    runtime.parent.mkdir(parents=True, exist_ok=True)
    normalized = runtime.with_suffix(".normalized.glb")
    subprocess.run(["node", "tools/rf03-normalize-cardinal-glb.mjs", "--input", str(source), "--output", str(normalized), "--tool-root", "node_modules", "--target", *[str(value) for value in entry["targetSizeMeters"]]], check=True)
    subprocess.run(["node_modules/.bin/gltf-transform", "optimize", str(normalized), str(runtime), "--compress", "draco", "--texture-compress", "webp", "--texture-size", "1024", "--simplify", "true", "--simplify-ratio", "0.35", "--join", "false", "--flatten", "false", "--instance", "false", "--palette", "false", "--prune-solid-textures", "false"], check=True, capture_output=True, text=True)
    normalized.unlink(missing_ok=True)
    entry["sourceBytes"] = source.stat().st_size
    entry["sourceSha256"] = sha(source)
    entry["runtimeBytes"] = runtime.stat().st_size
    entry["runtimeSha256"] = sha(runtime)
    entry["status"] = "runtime-ready"
    print(json.dumps({"asset": asset_id, "sourceBytes": entry["sourceBytes"], "runtimeBytes": entry["runtimeBytes"]}))
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
