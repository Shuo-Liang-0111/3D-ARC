import bpy
from pathlib import Path
p=Path("./public/local-assets/levels/rf15/realism-v0.2.5/rf15_final.glb"); bpy.ops.import_scene.gltf(filepath=str(p)); print("COUNT",len(bpy.context.scene.objects))
for o in bpy.context.scene.objects:
 if o.type=="MESH": print(o.name,tuple(round(x,2) for x in o.dimensions))
