import bpy,sys
from pathlib import Path
p=Path(sys.argv[sys.argv.index("--")+1]); bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete(use_global=False); bpy.ops.import_scene.gltf(filepath=str(p))
for o in bpy.context.scene.objects:
 if o.type=="MESH" and any(k in o.name.lower() for k in ["wall","canopy","sheet","skylight","panel","column","seam"]): print(o.name, tuple(round(x,3) for x in o.dimensions), tuple(round(x,3) for x in o.location))
