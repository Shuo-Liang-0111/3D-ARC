import bpy
import json
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="./public/local-assets/cardinal/rf02/models/runtime/return-cart.glb")
points = [obj.matrix_world @ vertex.co for obj in bpy.context.scene.objects if obj.type == "MESH" for vertex in obj.data.vertices]
high = [point for point in points if point.y > 1.04]
print(json.dumps({"bounds": [[min(point[axis] for point in points), max(point[axis] for point in points)] for axis in range(3)], "highCount": len(high), "highBounds": [[min(point[axis] for point in high), max(point[axis] for point in high)] for axis in range(3)] if high else []}))
