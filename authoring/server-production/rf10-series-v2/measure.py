import bpy,json
from mathutils import Vector
from pathlib import Path
root=Path('./public/local-assets/cardinal/rf12-v2/models/runtime')
for filename in ['kitchen_environment_installed.glb','stove_module.glb','range_hood_repaired.glb','gas_knob.glb','gas_valve.glb','wet_cloth.glb']:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.gltf(filepath=str(root/filename))
 out=[]
 for o in bpy.context.scene.objects:
  if o.type!='MESH':continue
  pts=[o.matrix_world@Vector(v) for v in o.bound_box]
  lo=[round(min(v[i] for v in pts),3) for i in range(3)];hi=[round(max(v[i] for v in pts),3) for i in range(3)]
  out.append(dict(name=o.name,lo=lo,hi=hi))
 print('BOUNDS',filename,json.dumps(out))
