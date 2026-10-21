import bpy
import json
from collections import defaultdict
from pathlib import Path

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath='./public/local-assets/levels/rf15/realism-v0.2.2/platform-scale.glb')
heights = defaultdict(float)
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    for face in obj.data.polygons:
        if face.normal.z > .85:
            center = obj.matrix_world @ face.center
            heights[round(center.z, 2)] += face.area
print('SUPPORT_SURFACES', sorted(heights.items(), key=lambda item: item[1], reverse=True)[:12])
points = []
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            if point.z > .66:
                points.append(point)
print('DISPLAY_BOUNDS', [[min(point[axis] for point in points), max(point[axis] for point in points)] for axis in range(3)])
