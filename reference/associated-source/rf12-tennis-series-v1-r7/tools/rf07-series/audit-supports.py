import bpy,json
from mathutils import Vector
from pathlib import Path
root=Path('./public/local-assets/cardinal/rf07/models/runtime')
report={}
for name,points in {'class_ii_a2_bsc':[(.30,1.85),(-.68,1.12),(.68,1.12)],'medical_refrigerator':[(-.345,1.20),(0,1.85)],'receiving_bench_equipment_bank':[(-1.9,.48),(0,.48),(1.9,.48)],'cold_chain_packing_island':[(-.8,.68),(1.65,.76),(-.8,.52),(1.65,.52)],'specimen_transfer_cart':[(0,0),(0,.15),(0,-.15)]}.items():
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(root/(name+'.glb')))
 deps=bpy.context.evaluated_depsgraph_get();rows=[]
 for x,v in points:
  is_front=name in ['class_ii_a2_bsc','medical_refrigerator'];origin=Vector((x,-3,v)) if is_front else Vector((x,-v,3));direction=Vector((0,1,0)) if is_front else Vector((0,0,-1))
  hit,loc,normal,face,obj,matrix=bpy.context.scene.ray_cast(deps,origin,direction,distance=6)
  rows.append({'probe':[x,v],'hit':hit,'pointThree':[loc.x,loc.z,-loc.y] if hit else None,'normalThree':[normal.x,normal.z,-normal.y] if hit else None})
 report[name]=rows
Path('./authoring/server-production/rf07-realism-v2/support-audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
