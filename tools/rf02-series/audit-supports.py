import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

root = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
results = []
for name in ["return-sorting-table", "reading-table", "return-cart", "red-book"]:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    source = root / "public/local-assets/cardinal/rf02/models/runtime" / (name + ".glb")
    bpy.ops.import_scene.gltf(filepath=str(source))
    vertices = [obj.matrix_world @ vertex.co for obj in bpy.context.scene.objects if obj.type == "MESH" for vertex in obj.data.vertices]
    minimum = [min(vertex[axis] for vertex in vertices) for axis in range(3)]
    maximum = [max(vertex[axis] for vertex in vertices) for axis in range(3)]
    support_samples = []
    for sample_x in ([-0.82, 0.72] if name == "reading-table" else [-0.62, 0, 0.62] if name == "return-sorting-table" else [0]):
        for offset_x, offset_z in [(0, 0), (-0.07, -0.10), (-0.07, 0.10), (0.07, -0.10), (0.07, 0.10)]:
            sample_z = offset_z + (0.30 if name == "return-sorting-table" else 0)
            ray_origin = Vector((sample_x + offset_x, -sample_z, 5))
            hit, location, normal, _, _, _ = bpy.context.scene.ray_cast(bpy.context.evaluated_depsgraph_get(), ray_origin, Vector((0, 0, -1)))
            support_samples.append({"x": sample_x + offset_x, "z": sample_z, "y": location.z if hit else None})
    results.append({"id": name, "blenderBounds": [minimum, maximum], "supports": support_samples})
output = root.parent / "production/rf02-series-v1/asset-measurements.json"
output.write_text(json.dumps(results, indent=2) + "\n")
print(json.dumps(results))
