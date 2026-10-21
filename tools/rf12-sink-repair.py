import bpy
import bmesh
import math
import json
from pathlib import Path
from mathutils import Vector

root = Path('./public/local-assets/cardinal/rf12-v2')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root / 'models/runtime/kitchen_sink.glb'))
bpy.context.view_layer.update()
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    transform = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world.identity()
    obj.data.transform(transform)
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.bisect_plane(mesh, geom=list(mesh.verts) + list(mesh.edges) + list(mesh.faces), plane_co=(0, 0, 0.115), plane_no=(0, 0, 1), clear_inner=True, clear_outer=False)
    mesh.to_mesh(obj.data)
    mesh.free()
steel = bpy.data.materials.new('Satin stainless basin')
steel.diffuse_color = (0.32, 0.36, 0.38, 1)
steel.use_nodes = True
shader = steel.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = (0.32, 0.36, 0.38, 1)
shader.inputs['Metallic'].default_value = 0.88
shader.inputs['Roughness'].default_value = 0.28
vertices = []
faces = []
rings = [(0.77, 0.53, 0.14, 0.07), (0.76, 0.52, 0.125, 0.07), (0.67, 0.42, 0.04, 0.09), (0.63, 0.38, 0.025, 0.095)]
for width, depth, height, radius in rings:
    for corner in range(4):
        angle = corner * math.pi / 2
        center_x = (width / 2 - radius) * (1 if corner in [0, 3] else -1)
        center_y = (depth / 2 - radius) * (1 if corner in [0, 1] else -1)
        for segment in range(13):
            theta = angle + segment * math.pi / 24
            vertices.append((0.025 + center_x + radius * math.cos(theta), -0.045 + center_y + radius * math.sin(theta), height))
count = 52
for ring in range(len(rings) - 1):
    for index in range(count):
        following = (index + 1) % count
        faces.append((ring * count + index, ring * count + following, (ring + 1) * count + following, (ring + 1) * count + index))
faces.append(tuple(range(3 * count, 4 * count)))
mesh = bpy.data.meshes.new('Continuous pressed basin')
mesh.from_pydata(vertices, [], faces)
mesh.update()
obj = bpy.data.objects.new('RF12_SINK_CONTINUOUS_BASIN', mesh)
bpy.context.collection.objects.link(obj)
obj.data.materials.append(steel)
for polygon in mesh.polygons:
    polygon.use_smooth = len(polygon.vertices) == 4
bpy.context.view_layer.objects.active = obj
solidify = obj.modifiers.new('Stainless sheet thickness', 'SOLIDIFY')
solidify.thickness = 0.0012
bpy.ops.object.modifier_apply(modifier=solidify.name)
bpy.ops.mesh.primitive_torus_add(major_radius=0.049, minor_radius=0.003, major_segments=64, minor_segments=12, location=(0.13, -0.04, 0.03))
bpy.context.object.name = 'RF12_SINK_DRAIN_RIM'
bpy.context.object.data.materials.append(steel)
dark = steel.copy()
dark.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (0.035, 0.04, 0.04, 1)
for index in range(8):
    theta = index * math.tau / 8
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.004, depth=0.001, location=(0.13 + 0.03 * math.cos(theta), -0.04 + 0.03 * math.sin(theta), 0.027))
    bpy.context.object.name = f'RF12_SINK_STRAINER_SLOT_{index}'
    bpy.context.object.data.materials.append(dark)
bpy.context.view_layer.update()
checks = []
for horizontal in [-0.2, 0, 0.2]:
    for depth in [-0.12, 0, 0.12]:
        hit = bpy.context.scene.ray_cast(bpy.context.evaluated_depsgraph_get(), Vector((horizontal, depth, 0.11)), Vector((0, 0, -1)))
        assert hit[0], (horizontal, depth)
        checks.append({'x': horizontal, 'depth': depth, 'height': hit[1].z})
bpy.ops.export_scene.gltf(filepath=str(root / 'models/runtime/kitchen_sink_repaired.glb'), export_format='GLB', export_yup=True, export_apply=True)
(root / 'manifests/sink-repair-checks.json').write_text(json.dumps({'provider': 'Cardinal faucet and rim; Blender replacement basin', 'rays': checks, 'review': 'pending'}, indent=2))
print('RF12_SINK_REPAIR_COMPLETE', checks)
