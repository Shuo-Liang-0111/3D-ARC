import bpy,json
from mathutils import Vector
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='./public/local-assets/embodiedgen/rf04/models/runtime/rf04_final.glb')
out=[]
for o in bpy.data.objects:
 if o.type!='MESH':continue
 pts=[o.matrix_world@Vector(c) for c in o.bound_box]
 lo=[min(p[i] for p in pts) for i in range(3)];hi=[max(p[i] for p in pts) for i in range(3)]
 out.append(dict(name=o.name,tri=sum(len(p.vertices)-2 for p in o.data.polygons),min=[lo[0],lo[2],-hi[1]],max=[hi[0],hi[2],-lo[1]],materials=[m.name for m in o.data.materials if m]))
Path('./authoring/server-production/rf04-series-v1/home-audit.json').write_text(json.dumps(out,indent=2))
print('objects',len(out),'triangles',sum(o['tri'] for o in out))
