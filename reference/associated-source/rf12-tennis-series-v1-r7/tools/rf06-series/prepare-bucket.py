import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
root=Path(".")
out=root/"public/local-assets/levels/rf06/series-v1"
out.mkdir(parents=True,exist_ok=True)
source=Path("./authoring/server-production/rf06-series-v1/source/bucket.glb")
bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
coords=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
lo=Vector(tuple(min(v[i] for v in coords) for i in range(3)));hi=Vector(tuple(max(v[i] for v in coords) for i in range(3)))
scale=.45/(hi.z-lo.z);center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
for o in meshes:
 o.location=(o.location-center)*scale;o.scale*=scale
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.select_set(False)
 if len(o.data.polygons)>24000:
  m=o.modifiers.new("Runtime decimation","DECIMATE");m.ratio=24000/len(o.data.polygons);bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
for image in bpy.data.images:
 if image.size[0]>1024:image.scale(1024,1024)
for o in meshes:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/"bucket.glb"),export_format="GLB",use_selection=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
# Orthographic source inspection.
scene=bpy.context.scene;scene.render.engine="BLENDER_EEVEE_NEXT";scene.render.resolution_x=700;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.world.color=(.3,.3,.3)
bpy.ops.object.light_add(type="AREA",location=(1,-1,2));bpy.context.object.data.energy=130;bpy.context.object.data.shape="DISK";bpy.context.object.data.size=2
bpy.ops.object.camera_add(location=(.8,-.85,1))
cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.22))-cam.location).to_track_quat("-Z","Y").to_euler();cam.data.type="ORTHO";cam.data.ortho_scale=.8;scene.camera=cam
scene.render.filepath="./authoring/server-production/rf06-series-v1/evidence/bucket-review.png";bpy.ops.render.render(write_still=True)
print("BUCKET",json.dumps({"sourceBounds":[list(lo),list(hi)],"scale":scale,"faces":sum(len(o.data.polygons) for o in meshes)}))
