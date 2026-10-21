"""Embed new RF-02 wall/ceiling materials while preserving scene geometry."""
import bpy
import json
import sys
from pathlib import Path

task = Path(sys.argv[sys.argv.index("--") + 1])
project = Path.cwd()
asset = project / "public/local-assets/cardinal/rf02/models/runtime"
output = asset / "library-surfaces-v7"
output.mkdir(exist_ok=True)


def geometry():
    result = {}
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        positions = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
        result[obj.name] = {
            "vertices": len(positions),
            "bounds": [[round(min(p[i] for p in positions), 5) for i in range(3)],
                       [round(max(p[i] for p in positions), 5) for i in range(3)]],
        }
    return result


def texture_material(name):
    material = bpy.data.materials.new("Cardinal RF02 " + name + " PBR v7")
    material.use_nodes = True
    material.use_backface_culling = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Metallic"].default_value = 0
    for kind, target in [("albedo", "Base Color"), ("roughness", "Roughness"), ("normal", "Normal")]:
        node = nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(str(task / "textures" / (name + "-" + kind + ".png")))
        node.image.colorspace_settings.name = "sRGB" if kind == "albedo" else "Non-Color"
        node.extension = "REPEAT"
        if kind == "normal":
            normal = nodes.new("ShaderNodeNormalMap")
            links.new(node.outputs["Color"], normal.inputs["Color"])
            links.new(normal.outputs["Normal"], shader.inputs[target])
        else:
            links.new(node.outputs["Color"], shader.inputs[target])
    return material


records = []
for name, source, target in [
    ("wall", asset / "rf02-static-shell.glb", output / "wall-shell.glb"),
    ("ceiling", asset / "library-operations-v5/ceiling-fixtures.glb", output / "ceiling-fixtures.glb"),
]:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(source))
    before = geometry()
    material = texture_material(name)
    changed = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        eligible = "warm low VOC wall paint" in obj.name if name == "wall" else obj.name == "library-ceiling-interior-face"
        if not eligible:
            continue
        changed.append(obj.name)
        obj.data.materials.clear()
        obj.data.materials.append(material)
        uv = obj.data.uv_layers.active or obj.data.uv_layers.new()
        meters = 1.2 if name == "wall" else 0.6
        for polygon in obj.data.polygons:
            normal = obj.matrix_world.to_3x3() @ polygon.normal
            drop = max(range(3), key=lambda i: abs(normal[i]))
            # Blender is Z-up. Vertical wall faces use horizontal coordinate / Z.
            axes = [i for i in range(3) if i != drop]
            for loop_id in polygon.loop_indices:
                point = obj.matrix_world @ obj.data.vertices[obj.data.loops[loop_id].vertex_index].co
                uv.data[loop_id].uv = (point[axes[0]] / meters, point[axes[1]] / meters)
        obj.data.update()
    assert changed, name
    assert before == geometry(), "Texture update changed geometry"
    bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLB", export_image_format="AUTO", export_keep_originals=False, export_texcoords=True, export_normals=True, export_materials="EXPORT", export_yup=True, export_extras=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(target))
    after = geometry()
    assert before.keys() == after.keys(), "Export changed scene nodes"
    for key in before:
        error = max(abs(a - b) for ar, br in zip(before[key]["bounds"], after[key]["bounds"]) for a, b in zip(ar, br))
        assert error < 0.0001, (key, error, "geometry bounds changed")
    records.append({"source": str(source), "output": str(target), "changedNodes": changed, "geometryBoundsPreserved": True, "nodes": len(after), "bytes": target.stat().st_size})
(task / "geometry-check.json").write_text(json.dumps(records, indent=2))
print(json.dumps(records))
