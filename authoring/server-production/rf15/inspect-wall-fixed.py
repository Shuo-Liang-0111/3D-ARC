import bpy
from pathlib import Path
p=Path('./public/local-assets/levels/rf15/realism-v0.2.5/rf15_final.glb')
bpy.ops.import_scene.gltf(filepath=str(p))
for o in bpy.context.scene.objects:
 if o.type=='MESH' and any(k in o.name.lower() for k in ['wall','canopy','sheet','skylight','panel','column','seam']): print(o.name, tuple(round(x,3) for x in o.dimensions), tuple(round(x,3) for x in o.location))
