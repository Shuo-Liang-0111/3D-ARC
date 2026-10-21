import bpy
from mathutils import Vector
from pathlib import Path
for name in ['gloves','gauze','empty-box','opening-terminal','chair','trolley']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(Path('./public/local-assets/levels/rf13/realism-v0.4.3')/(name+'.glb')))
 vs=[o.matrix_world@Vector(v) for o in bpy.data.objects if o.type=='MESH' for v in o.bound_box]
 print('METRIC',name,[(min(v[i] for v in vs),max(v[i] for v in vs)) for i in range(3)])
