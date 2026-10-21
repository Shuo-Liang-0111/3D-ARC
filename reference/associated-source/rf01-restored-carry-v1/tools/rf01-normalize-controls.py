import bpy
import json
import sys
from pathlib import Path
from math import pi
from mathutils import Matrix, Vector

source = Path("./authoring/server-production/rf01-workshop-v2/source")
target = Path("./public/local-assets/cardinal/rf01/models/runtime/workshop-v2-fit")
target.mkdir(parents=True, exist_ok=True)
reports = []
for name, dimensions in [("door-control", (.24, .42, .14)), ("light-switch", (.24, .29, .12))]:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(source / (name + ".glb")))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    orientation = Matrix.Rotation(-pi / 2, 4, "Z")
    for obj in meshes:
        obj.matrix_world = orientation @ obj.matrix_world
    bpy.context.view_layer.update()
    corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    lower = Vector(tuple(min(point[axis] for point in corners) for axis in range(3)))
    upper = Vector(tuple(max(point[axis] for point in corners) for axis in range(3)))
    extent = upper - lower
    center = (upper + lower) / 2
    for obj in meshes:
        transform = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = transform
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        for vertex in obj.data.vertices:
            vertex.co.x = (vertex.co.x - center.x) * dimensions[0] / extent.x
            vertex.co.y = (vertex.co.y - center.y) * dimensions[2] / extent.y
            vertex.co.z = (vertex.co.z - center.z) * dimensions[1] / extent.z
        if len(obj.data.polygons) > 40000:
            modifier = obj.modifiers.new("RuntimeSurface", "DECIMATE")
            modifier.ratio = 40000 / len(obj.data.polygons)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.name = name
        obj.select_set(False)
    for image in bpy.data.images:
        if image.type != "IMAGE" or not image.has_data:
            continue
        if max(image.size) > 2048:
            factor = 2048 / max(image.size)
            image.scale(int(image.size[0] * factor), int(image.size[1] * factor))
        image.pack()
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    output = target / (name + ".glb")
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", use_selection=True, export_yup=True, export_image_format="AUTO")
    reports.append({"name": name, "source_extent_blender": list(extent), "target_xyz": dimensions, "triangles": sum(len(obj.data.polygons) for obj in meshes), "bytes": output.stat().st_size})
(target / "manifest.json").write_text(json.dumps({"revision": "workshop-realism-v2", "assets": reports}, indent=2))
print(json.dumps(reports))
