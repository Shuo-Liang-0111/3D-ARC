import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path('./public/local-assets'); report={}
for name,rel,points in [
 ('sample','cardinal/rf07/models/runtime/receiving_bench_equipment_bank.glb',[(x+dx,.33+dz) for x in [-1.9,0,1.9] for dx in [-.085,.085] for dz in [-.05,.05]]),
 ('case','levels/rf07/realism-v2/cold_chain_packing_island.glb',[(-.8+dx,.5+dz) for dx in [-.30,.30] for dz in [-.245,.245]]),
 ('module','levels/rf07/realism-v2/cold_chain_packing_island.glb',[(1.65+dx,.6+dz) for dx in [-.09,.09] for dz in [-.06,.06]]),
 ('container','cardinal/rf07/models/runtime/specimen_transfer_cart.glb',[(dx,-.13+dz) for dx in [-.145,.145] for dz in [-.086,.086]])]:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(root/rel));deps=bpy.context.evaluated_depsgraph_get();rows=[]
 for x,z in points:
  hit,loc,n,*_=bpy.context.scene.ray_cast(deps,Vector((x,-z,1.3 if name=='module' or name=='case' else 1.15)),Vector((0,0,-1)),distance=1.2)
  rows.append({'xz':[x,z],'hit':hit,'height':loc.z if hit else None,'up':n.z if hit else None})
 report[name]=rows
Path('./authoring/server-production/rf07-realism-v2/footprint.json').write_text(json.dumps(report,indent=2));
expected={'sample':.9553,'case':.921,'module':.921,'container':1.068}
for name,rows in report.items():
 for row in rows:assert row['hit'] and row['up']>.99 and abs(row['height']-expected[name])<.0011,(name,row)
print('PASS: 24 footprint probes supported within 1.1 mm')
