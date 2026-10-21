import bpy
import json
import math
import pathlib
from mathutils import Matrix, Vector

root = pathlib.Path("./public/local-assets/levels/rf13")
source = root / "realism-v0.3"
output = root / "cardinal-v0.3"
for name, target, yaw in [("exam-bed", [0.75, 0.65, 1.9], math.pi / 2), ("trolley", [0.65, 0.9, 0.55], math.pi / 2)]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source / (name + ".glb")))
    objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    rotation = Matrix.Rotation(yaw, 4, "Z")
    for obj in objects:
        transform = rotation @ obj.matrix_world
        obj.parent = None
        for vertex in obj.data.vertices:
            vertex.co = transform @ vertex.co
        obj.matrix_world.identity()
    points = [vertex.co for obj in objects for vertex in obj.data.vertices]
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    size = maximum - minimum
    limits = [target[0], target[2], target[1]]
    scale = min(limits[axis] / size[axis] for axis in range(3))
    origin = Vector(((minimum.x + maximum.x) / 2, (minimum.y + maximum.y) / 2, minimum.z))
    for obj in objects:
        for vertex in obj.data.vertices:
            vertex.co = (vertex.co - origin) * scale
    bpy.ops.export_scene.gltf(filepath=str(output / (name + ".glb")), export_format="GLB", export_yup=True)
    report = {"rotationRadians": yaw, "uniformScale": scale, "actualSizeMeters": [size.x * scale, size.z * scale, size.y * scale]}
    (output / (name + ".orientation.json")).write_text(json.dumps(report, indent=2))
    print(name, report)
