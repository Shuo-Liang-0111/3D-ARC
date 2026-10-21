import bpy
import json
from pathlib import Path
from collections import Counter

root = Path('./public/local-assets/levels/rf15')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root / 'realism-v0.2.7/rf15_final.glb'))
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH' or not any(label in obj.name for label in ['limewashed', 'canopy', 'polycarbonate']):
        continue
    vertices = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    faces = []
    for polygon in obj.data.polygons:
        coords = [vertices[index] for index in polygon.vertices]
        minimum = [min(vertex[axis] for vertex in coords) for axis in range(3)]
        maximum = [max(vertex[axis] for vertex in coords) for axis in range(3)]
        if polygon.area > .3:
            faces.append({'area': round(polygon.area, 4), 'min': [round(value, 4) for value in minimum], 'max': [round(value, 4) for value in maximum], 'normal': [round(value, 3) for value in polygon.normal]})
    print('AUDIT', obj.name, json.dumps(faces))
    for mat in obj.data.materials:
        shader = mat.node_tree.nodes.get('Principled BSDF')
        print('MAT', mat.name, mat.surface_render_method, [(key, list(shader.inputs[key].default_value) if key == 'Base Color' else shader.inputs[key].default_value) for key in ['Base Color', 'Alpha', 'Roughness', 'Metallic']])
