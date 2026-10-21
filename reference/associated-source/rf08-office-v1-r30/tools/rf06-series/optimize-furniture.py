import bpy,math,json
from pathlib import Path
from mathutils import Vector
root=Path(".");out=root/"public/local-assets/levels/rf06/series-v1";stats=[]
for name in ["sofa","coffee_table"]:
 bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
 src=root/("public/local-assets/cardinal/rf06/runtime/models/"+name+".glb")
 bpy.ops.import_scene.gltf(filepath=str(src))
 meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
 before=sum(len(o.data.polygons) for o in meshes)
 for o in meshes:
  if len(o.data.polygons)>30000:
   m=o.modifiers.new("Runtime decimation","DECIMATE");m.ratio=30000/len(o.data.polygons);bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
 for image in bpy.data.images:
  if image.size[0]>1024:image.scale(1024,1024)
 bpy.ops.export_scene.gltf(filepath=str(out/(name+".glb")),export_format="GLB",export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
 stats.append({"asset":name,"before":before,"after":sum(len(o.data.polygons) for o in meshes)})
print(json.dumps(stats))
