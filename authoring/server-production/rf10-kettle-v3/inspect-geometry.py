import bpy,json
from mathutils import Vector
from pathlib import Path
for name,path in [('kettle','./public/local-assets/levels/rf12/kettle-v3/kettle.glb'),('sink','./public/local-assets/levels/rf12/interaction-v2/kitchen_sink_repaired.glb')]:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.gltf(filepath=path);bpy.context.view_layer.update()
 points=[o.matrix_world@v.co for o in bpy.context.scene.objects if o.type=='MESH' for v in o.data.vertices]
 if name=='kettle':
  for z0,z1 in [(.25,.28),(.17,.20),(.20,.23)]:
   pts=[p for p in points if z0<p.z<z1]
   print(name,z0,z1,[[min(p[i] for p in pts),max(p[i] for p in pts)] for i in range(3)])
  for x in [0,.025,.04,.06]:
   hit=bpy.context.scene.ray_cast(bpy.context.evaluated_depsgraph_get(),Vector((x,0,.24)),Vector((0,0,-1)))
   print('top',x,list(hit[1]) if hit[0] else None)
 else:
  pts=[p for p in points if p.z>.28]
  print('outlet',[[min(p[i] for p in pts if p.x>0),max(p[i] for p in pts if p.x>0)] for i in range(3)])
  print(name,'faucet',[[min(p[i] for p in pts),max(p[i] for p in pts)] for i in range(3)])
