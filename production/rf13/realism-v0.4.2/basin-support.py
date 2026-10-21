from pathlib import Path
import bpy
import json
import numpy as np

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='./public/local-assets/levels/rf13/realism-v0.4.1/clinical-basin-fitted.glb')
points = np.array([tuple(obj.matrix_world @ vertex.co) for obj in bpy.context.scene.objects if obj.type == 'MESH' for vertex in obj.data.vertices])
rows = []
for height in np.arange(0, 0.31, 0.01):
    selected = points[(points[:, 2] >= height) & (points[:, 2] < height + 0.01)]
    if len(selected):
        rows.append({'height': round(float(height), 3), 'xRange': [round(float(value), 3) for value in [selected[:, 0].min(), selected[:, 0].max()]], 'depth': round(float(np.ptp(selected[:, 1])), 3)})
print('BASIN_CROSS_SECTIONS ' + json.dumps(rows))
