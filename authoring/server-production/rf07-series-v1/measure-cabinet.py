import bpy
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='./public/local-assets/cardinal/rf07/models/runtime/medical_refrigerator.glb')
for o in bpy.context.scene.objects:
 if o.type=='MESH':
  v=[o.matrix_world@x.co for x in o.data.vertices];print('BOUNDS',o.name,[min(p[i] for p in v) for i in range(3)],[max(p[i] for p in v) for i in range(3)])
