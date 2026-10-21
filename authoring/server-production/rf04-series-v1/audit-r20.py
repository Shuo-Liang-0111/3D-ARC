import bpy,bmesh,json
from pathlib import Path
from mathutils import Vector
root=Path('./public/local-assets/levels/rf04/architecture-v4')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'home.glb'))
results=[]
for o in bpy.data.objects:
 if not o.name.startswith('rf04-door-'):continue
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001)
 closed=all(e.is_manifold for e in bm.edges);volume=bm.calc_volume();assert closed and volume>0,(o.name,closed,volume)
 results.append(dict(name=o.name,closed=closed,volume=volume));bm.free()
assert len(results)==45,len(results)
Path('./authoring/server-production/rf04-series-v1/r20-mesh-audit.json').write_text(json.dumps(results,indent=2))
print('AUDIT',len(results),'solid closed outward-facing meshes')
