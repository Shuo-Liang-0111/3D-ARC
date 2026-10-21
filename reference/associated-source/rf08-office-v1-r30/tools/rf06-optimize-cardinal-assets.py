import argparse
import hashlib
import json
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def bounds(objects):
    points = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        points.extend((obj.matrix_world @ Vector(corner) for corner in obj.bound_box))
    if not points:
        return None
    mins = Vector((min(p[i] for p in points) for i in range(3)))
    maxs = Vector((max(p[i] for p in points) for i in range(3)))
    return mins, maxs


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def compact_material_images(max_size):
    for image in list(bpy.data.images):
        if image.type == "RENDER_RESULT" or image.size[0] == 0:
            continue
        longest = max(image.size)
        if longest > max_size:
            ratio = max_size / longest
            image.scale(max(1, round(image.size[0] * ratio)), max(1, round(image.size[1] * ratio)))


def simplify_meshes(face_limit):
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH" or len(obj.data.polygons) <= face_limit:
            continue
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        modifier = obj.modifiers.new("rf06_runtime_simplify", "DECIMATE")
        modifier.ratio = max(0.12, face_limit / len(obj.data.polygons))
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--asset-id", required=True)
    parser.add_argument("--target", required=True, help="JSON array [x,y,z] in meters")
    parser.add_argument("--mount", default="floor")
    parser.add_argument("--front-correction", type=float, default=0.0)
    parser.add_argument("--max-texture", type=int, default=1024)
    parser.add_argument("--face-limit", type=int, default=180000)
    parser.add_argument("--manifest", required=True)
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    args = parser.parse_args(argv)

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    target = Vector(json.loads(args.target))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(input_path))
    roots = [obj for obj in bpy.context.scene.objects if obj.parent is None]
    for obj in list(bpy.context.scene.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("no mesh objects in generated GLB")

    root = bpy.data.objects.new(f"RF06_{args.asset_id}", None)
    bpy.context.collection.objects.link(root)
    for obj in list(bpy.context.scene.objects):
        if obj.type not in {"MESH", "EMPTY"} or obj == root:
            continue
        if obj.parent is None:
            obj.parent = root
    root.rotation_euler[1] = math.radians(args.front_correction)
    bpy.context.view_layer.update()

    before = bounds(meshes)
    if before is None:
        raise RuntimeError("generated GLB has no renderable bounds")
    mins, maxs = before
    current = maxs - mins
    if min(current) <= 1e-6:
        raise RuntimeError(f"degenerate bounds: {tuple(current)}")
    root.scale = Vector((target.x / current.x, target.y / current.y, target.z / current.z))
    bpy.context.view_layer.update()
    scaled = bounds(meshes)
    mins, maxs = scaled
    root.location.x -= (mins.x + maxs.x) * 0.5
    root.location.z -= (mins.z + maxs.z) * 0.5
    root.location.y -= mins.y
    bpy.context.view_layer.update()

    simplify_meshes(args.face_limit)
    compact_material_images(args.max_texture)
    for obj in bpy.context.scene.objects:
        obj.select_set(obj.type in {"MESH", "EMPTY"})
    bpy.context.view_layer.objects.active = root
    bpy.ops.wm.save_as_mainfile(filepath="/tmp/rf06-cardinal-normalized.blend")
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_keep_originals=False,
        export_cameras=False,
        export_lights=False,
    )

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(output_path))
    final_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    final_bounds = bounds(final_meshes)
    if final_bounds is None:
        raise RuntimeError("runtime GLB has no mesh bounds")
    final_min, final_max = final_bounds
    final_size = final_max - final_min
    record = {
        "assetId": args.asset_id,
        "source": str(input_path),
        "runtime": str(output_path),
        "sourceSha256": sha256(input_path),
        "runtimeSha256": sha256(output_path),
        "targetSizeMeters": list(target),
        "finalSizeMeters": list(final_size),
        "finalMin": list(final_min),
        "finalMax": list(final_max),
        "bottomContactError": abs(final_min.y),
        "frontCorrectionDegrees": args.front_correction,
        "mount": args.mount,
        "meshCount": len(final_meshes),
        "polygonCount": sum(len(obj.data.polygons) for obj in final_meshes),
        "review": "pass" if max([abs(final_min.y)] + [abs(final_size[i] - target[i]) for i in range(3)]) < 0.02 else "review",
    }
    manifest_path = Path(args.manifest)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest = []
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
    manifest = [entry for entry in manifest if entry.get("assetId") != args.asset_id]
    manifest.append(record)
    manifest_path.write_text(json.dumps(sorted(manifest, key=lambda entry: entry["assetId"]), indent=2) + "\n")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
