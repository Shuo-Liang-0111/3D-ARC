import argparse
import hashlib
import json
import os
import sys

import bpy

def args():
    parser = argparse.ArgumentParser(); parser.add_argument("--name", required=True); parser.add_argument("--input", required=True); parser.add_argument("--output", required=True); parser.add_argument("--manifest", required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:])

def digest(path):
    value = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""): value.update(chunk)
    return value.hexdigest()

def main():
    values = args(); source = os.path.abspath(values.input); output = os.path.abspath(values.output); os.makedirs(os.path.dirname(output), exist_ok=True)
    image = bpy.data.images.load(source, check_existing=False); source_size = list(image.size); image.scale(2048, 2048); image.filepath_raw = output; image.file_format = "WEBP"; image.save()
    manifest = json.loads(open(values.manifest).read()) if os.path.exists(values.manifest) else {"schemaVersion": 1, "level": "RF-09", "surfaces": {}}
    manifest["surfaces"][values.name] = {"sourceArtifact": values.input, "sourceSha256": digest(values.input), "sourceSizePixels": source_size, "runtimeArtifact": values.output, "runtimeSha256": digest(values.output), "runtimeSizePixels": [2048, 2048], "runtimeBytes": os.path.getsize(values.output), "colorSpace": "sRGB", "wrap": "repeat", "review": {"status": "pending"}}
    os.makedirs(os.path.dirname(values.manifest), exist_ok=True)
    with open(values.manifest, "w") as stream: json.dump(manifest, stream, ensure_ascii=False, indent=2); stream.write("\n")

main()
