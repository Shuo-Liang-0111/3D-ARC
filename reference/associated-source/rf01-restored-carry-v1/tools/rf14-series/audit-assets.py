import bpy,json,sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
report={}
for filename in ['shelter','collision']:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.gltf(filepath=str(root/'public/local-assets/levels/rf14/series-v1'/f'{filename}.glb'))
 record={}
 for o in bpy.context.scene.objects:
  if o.type!='MESH':continue
  points=[o.matrix_world@v.co for v in o.data.vertices];pts=[(p.x,p.z,-p.y) for p in points]
  lo=[min(p[i] for p in pts) for i in range(3)];hi=[max(p[i] for p in pts) for i in range(3)]
  record[o.name]={'min':lo,'max':hi,'collision':o.get('collision',False)}
 report[filename]=record
for i,(x,z) in enumerate([(6.85,-4.8),(9.75,-4.8),(6.85,.8),(9.75,.8)]):
 r=report['collision']['COLLIDER_shelter-post-'+str(i)]
 assert r['collision']
 assert all(abs(a-b)<.005 for a,b in zip(r['min'],[x-.06,0,z-.06]))
 assert all(abs(a-b)<.005 for a,b in zip(r['max'],[x+.06,2.8,z+.06]))
roof=[r for k,r in report['shelter'].items() if k.startswith('polycarbonate')]
assert len(roof)==12
assert min(r['min'][1] for r in roof)>2.8
assert abs(min(r['min'][0] for r in roof)-6.65)<.005
assert abs(max(r['max'][0] for r in roof)-9.95)<.005
Path('./authoring/server-production/rf12-tennis-series-v1/asset-audit.json').write_text(json.dumps(report,indent=2))
print('ACTUAL_GLB_DIMENSIONS_PASSED')
