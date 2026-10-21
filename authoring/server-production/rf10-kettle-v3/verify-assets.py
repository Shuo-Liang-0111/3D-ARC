import bpy,json,hashlib
from mathutils import Vector
from pathlib import Path
r=Path('.');p=Path('./authoring/server-production/rf10-kettle-v3');report={}
for name,asset in [('kettle','kettle.glb'),('sink','sink-r3.glb')]:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 file=r/'public/local-assets/levels/rf12/kettle-v3'/asset
 bpy.ops.import_scene.gltf(filepath=str(file));bpy.context.view_layer.update()
 pts=[o.matrix_world@v.co for o in bpy.context.scene.objects if o.type=='MESH' for v in o.data.vertices]
 lo=[min(v[i] for v in pts) for i in range(3)];hi=[max(v[i] for v in pts) for i in range(3)]
 record={'boundsBlender':[lo,hi],'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'images':len([im for im in bpy.data.images if im.packed_file])}
 if name=='kettle':
  assert abs(hi[2]-.28)<.002 and abs(lo[2])<.002
  grip=Vector((0,-.089,.24));record['gripNearestVertex']=min((v-grip).length for v in pts)
  assert record['gripNearestVertex']<.025
 else:
  rays=[]
  for x in [-.2,0,.2]:
   for y in [-.12,0,.12]:
    hit=bpy.context.scene.ray_cast(bpy.context.evaluated_depsgraph_get(),Vector((x,y,.11)),Vector((0,0,-1)))
    assert hit[0] and .02<hit[1].z<.04
    rays.append([x,y,hit[1].z])
  record['basinRays']=rays
 report[name]=record
(p/'asset-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
