import bpy,json
from pathlib import Path
from mathutils import Vector
bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath="./public/local-assets/embodiedgen/rf06/models/runtime/interactables/wrench.glb")
pts=[o.matrix_world@v.co for o in bpy.context.scene.objects if o.type=="MESH" for v in o.data.vertices]
lo=Vector(tuple(min(v[i] for v in pts) for i in range(3)));hi=Vector(tuple(max(v[i] for v in pts) for i in range(3)));center=(lo+hi)/2
print("WRENCH_BOUNDS",list(lo),list(hi))
bpy.ops.object.camera_add(location=center+Vector((0,-.6,.8)));cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat("-Z","Y").to_euler();cam.data.type="ORTHO";cam.data.ortho_scale=.5;bpy.context.scene.camera=cam
bpy.ops.object.light_add(type="AREA",location=center+Vector((-.5,-.3,1)));bpy.context.object.data.energy=100;bpy.context.object.data.shape="DISK";bpy.context.object.data.size=1
s=bpy.context.scene;s.render.engine="CYCLES";s.cycles.samples=24;s.world.color=(.25,.25,.25);s.render.resolution_x=800;s.render.resolution_y=800;s.render.resolution_percentage=100;s.render.filepath="./authoring/server-production/rf06-tools-v2/wrench-before.png";bpy.ops.render.render(write_still=True)
