import bpy,json,hashlib,sys
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else ["home-v5"]
root=Path("./public/local-assets/levels/rf06")/args[0]
expected=json.loads(Path("./authoring/server-production/rf06-home-v3/layout.json").read_text())["LEVEL"]["staticColliders"]
report={}
for name in ["home","collision","valve"]:
 bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.gltf(filepath=str(root/(name+".glb")))
 bounds={};triangles=0
 for obj in bpy.context.scene.objects:
  if obj.type!="MESH":continue
  pts=[obj.matrix_world@vert.co for vert in obj.data.vertices];p=[(q.x,q.z,-q.y) for q in pts]
  bounds[obj.name]={"min":[min(q[i] for q in p) for i in range(3)],"max":[max(q[i] for q in p) for i in range(3)]}
  obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
 if name=="collision":
  for r in expected:
   b=bounds["COLLIDER_"+r["id"]]
   for i,lo,hi in [(0,r["minX"],r["maxX"]),(2,r["minZ"],r["maxZ"])]:
    assert abs(b["min"][i]-lo)<.005 and abs(b["max"][i]-hi)<.005,(r,b)
 report[name]={"sha256":hashlib.sha256((root/(name+".glb")).read_bytes()).hexdigest(),"bytes":(root/(name+".glb")).stat().st_size,"triangles":triangles,"bounds":bounds}
Path(args[1] if len(args)>1 else "./authoring/server-production/rf06-home-v3/measurements.json").write_text(json.dumps(report,indent=2))
print("EXPORT_CHECK_PASS",len(expected),"colliders",report["home"]["triangles"],"visual triangles")
