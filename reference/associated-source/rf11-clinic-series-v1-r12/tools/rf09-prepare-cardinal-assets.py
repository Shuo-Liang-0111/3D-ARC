import argparse
import hashlib
import json
import math
import os
import sys

import bpy
from mathutils import Vector

CONFIG = {
    "conference_table": ([8.8, 0.78, 2.8], "front", 260000),
    "executive_chair": ([0.62, 1.12, 0.62], "right", 160000),
    "av_podium": ([0.84, 0.18, 0.5], "front", 160000),
    "conference_terminal": ([0.72, 0.18, 0.48], "front", 160000),
    "office_workstation": ([3.4, 1.28, 1.45], "front", 240000),
    "reception_desk": ([5.4, 1.1, 0.95], "front", 220000),
    "supply_cabinet": ([3.1, 2.35, 1.3], "front", 220000),
    "it_equipment_locker": ([3, 2.4, 1.45], "front", 220000),
    "lounge_sofa": ([3.4, 0.88, 1.1], "front", 180000),
    "usb_c_video_adapter": ([0.34, 0.07, 0.2], "front", 120000),
    "wireless_presenter": ([0.13, 0.06, 0.42], "front", 120000),
    "ceiling_light": ([1.2, 0.08, 0.3], "front", 100000),
}
ROTATIONS = {"front": 0, "right": -math.pi / 2, "back": math.pi, "left": math.pi / 2}

def args():
    parser = argparse.ArgumentParser(); parser.add_argument("--asset", choices=CONFIG, required=True); parser.add_argument("--input", required=True); parser.add_argument("--output", required=True); parser.add_argument("--manifest", required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:])

def bounds(meshes):
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    return Vector(tuple(min(p[i] for p in points) for i in range(3))), Vector(tuple(max(p[i] for p in points) for i in range(3)))

def digest(path):
    value = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""): value.update(chunk)
    return value.hexdigest()

def rounded(vector): return [round(value, 5) for value in vector]

def main():
    values = args(); target, front, target_faces = CONFIG[values.asset]
    bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete(use_global=False); bpy.ops.import_scene.gltf(filepath=os.path.abspath(values.input))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes: raise RuntimeError("source contains no meshes")
    source_min, source_max = bounds(meshes)
    orientation = bpy.data.objects.new(f"{values.asset}_orientation", None); bpy.context.collection.objects.link(orientation)
    for obj in meshes:
        if obj.parent is None: obj.parent = orientation
    orientation.rotation_euler.z = ROTATIONS[front]; bpy.context.view_layer.update()
    rotated_min, rotated_max = bounds(meshes)
    for obj in meshes:
        matrix = obj.matrix_world.copy(); obj.parent = None; obj.matrix_world = matrix
    bpy.data.objects.remove(orientation)
    fit = bpy.data.objects.new(f"{values.asset}_meter_fit", None); bpy.context.collection.objects.link(fit)
    for obj in meshes:
        if obj.parent is None: obj.parent = fit
    extent = rotated_max - rotated_min
    fit.scale = (target[0] / extent.x, target[2] / extent.y, target[1] / extent.z); bpy.context.view_layer.update()
    fitted_min, fitted_max = bounds(meshes); center = (fitted_min + fitted_max) * 0.5
    fit.location = (-center.x, -center.y, -fitted_min.z); bpy.context.view_layer.update()
    source_faces = sum(len(obj.data.polygons) for obj in meshes); ratio = min(1, target_faces / max(source_faces, 1))
    if ratio < 0.995:
        for obj in meshes:
            modifier = obj.modifiers.new("RF09 runtime decimation", "DECIMATE"); modifier.ratio = ratio; modifier.use_collapse_triangulate = True
            bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.modifier_apply(modifier=modifier.name); obj.select_set(False)
    for image in bpy.data.images:
        if image.source == "FILE" and max(image.size) > 2048:
            scale = 2048 / max(image.size); image.scale(max(1, round(image.size[0] * scale)), max(1, round(image.size[1] * scale)))
    runtime_min, runtime_max = bounds(meshes); os.makedirs(os.path.dirname(values.output), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes: obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(values.output), export_format="GLB", export_yup=True, export_apply=True, export_cameras=False, export_lights=False, export_animations=False, use_selection=True)
    manifest = json.loads(open(values.manifest).read()) if os.path.exists(values.manifest) else {"assets": {}}
    manifest.update(schemaVersion=1, level="RF-09", productionStatus="runtime_candidate", units="meters", upAxis="Y")
    manifest["assets"][values.asset] = {"sourceArtifact": values.input, "sourceSha256": digest(values.input), "runtimeArtifact": values.output, "runtimeSha256": digest(values.output), "frontCorrection": front, "frontAxis": "+Z", "pivot": "bottom-center", "targetSizeMeters": target, "sourceBoundsBlender": {"min": rounded(source_min), "max": rounded(source_max)}, "runtimeBoundsBlender": {"min": rounded(runtime_min), "max": rounded(runtime_max)}, "sourceFaces": source_faces, "runtimeFaces": sum(len(obj.data.polygons) for obj in meshes), "runtimeBytes": os.path.getsize(values.output), "optimization": {"tool": f"Blender {bpy.app.version_string}", "targetFaces": target_faces, "textureMaxPixels": 2048}, "review": {"status": "pending", "screenshots": [f"public/local-assets/cardinal/rf09/review/source/{values.asset}/{view}.png" for view in ("front", "right", "back", "left")]}}
    os.makedirs(os.path.dirname(values.manifest), exist_ok=True)
    with open(values.manifest, "w") as stream: json.dump(manifest, stream, ensure_ascii=False, indent=2); stream.write("\n")

main()
