import bpy
import hashlib
import json
import pathlib
import sys
from mathutils import Vector

arguments = sys.argv[sys.argv.index("--") + 1:]
source = pathlib.Path(arguments[0])
output = pathlib.Path(arguments[1])
target = [float(value) for value in arguments[2:5]]
if output.exists():
    raise RuntimeError("Runtime output exists; choose a new version instead of overwriting")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
if not objects:
    raise RuntimeError("Source contains no meshes")
for obj in objects:
    transform = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = transform
bpy.context.view_layer.update()
points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
size = maximum - minimum
target_blender = [target[0], target[2], target[1]]
scale = min(target_blender[axis] / size[axis] for axis in range(3) if size[axis] > 0)
center = Vector(((minimum.x + maximum.x) / 2, (minimum.y + maximum.y) / 2, minimum.z))
source_faces = sum(len(obj.data.polygons) for obj in objects)
for obj in objects:
    transform = obj.matrix_world.copy()
    for vertex in obj.data.vertices:
        vertex.co = (transform @ vertex.co - center) * scale
    obj.matrix_world.identity()
    obj.name = source.stem + "-mesh"
    bpy.context.view_layer.objects.active = obj
    if len(obj.data.polygons) > 24000:
        modifier = obj.modifiers.new("runtime-reduction", "DECIMATE")
        modifier.ratio = max(0.06, 24000 / len(obj.data.polygons))
        bpy.ops.object.modifier_apply(modifier=modifier.name)
for image in bpy.data.images:
    if image.size[0] > 2048 or image.size[1] > 2048:
        ratio = 2048 / max(image.size)
        image.scale(max(1, round(image.size[0] * ratio)), max(1, round(image.size[1] * ratio)))
bpy.ops.object.select_all(action="DESELECT")
for obj in objects:
    obj.select_set(True)
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", use_selection=True, export_yup=True, export_apply=True, export_cameras=False, export_lights=False)
points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
actual = [max(point[axis] for point in points) - min(point[axis] for point in points) for axis in range(3)]
report = {"provider": "Cardinal", "processing": "Blender", "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "runtimeSha256": hashlib.sha256(output.read_bytes()).hexdigest(), "scale": scale, "targetEnvelopeMeters": target, "actualSizeMeters": [actual[0], actual[2], actual[1]], "sourceFaces": source_faces, "runtimeFaces": sum(len(obj.data.polygons) for obj in objects), "runtimeBytes": output.stat().st_size, "visualReview": "pending"}
output.with_suffix(".json").write_text(json.dumps(report, indent=2))
print(json.dumps(report))

