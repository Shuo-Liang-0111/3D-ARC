"""Normalize Cardinal kettle to metres; preserve embedded PBR. Render isolated QA."""
import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector,Matrix
source,out,evidence=map(Path,sys.argv[sys.argv.index('--')+1:])
out.parent.mkdir(parents=True,exist_ok=True);evidence.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in objects:
 m=o.matrix_world.copy();o.parent=None;o.matrix_world=Matrix.Identity(4);o.data.transform(m)
def bounds():
 pts=[v.co for o in objects for v in o.data.vertices]
 return Vector(tuple(min(v[i] for v in pts) for i in range(3))),Vector(tuple(max(v[i] for v in pts) for i in range(3)))
lo,hi=bounds();scale=.28/(hi.z-lo.z)
# Kettle body centre from low cross section, excluding upper spout and handle.
body=[v.co for o in objects for v in o.data.vertices if lo.z+(hi.z-lo.z)*.15<v.co.z<lo.z+(hi.z-lo.z)*.32]
center=Vector(((min(v.x for v in body)+max(v.x for v in body))/2,(min(v.y for v in body)+max(v.y for v in body))/2,lo.z))
for o in objects:
 o.data.transform(Matrix.Scale(scale,4)@Matrix.Translation(-center))
 o.name='RF10_KETTLE_CARDINAL'
 bpy.context.view_layer.objects.active=o
 if len(o.data.polygons)>16000:
  mod=o.modifiers.new('Runtime reduction','DECIMATE');mod.ratio=16000/len(o.data.polygons);bpy.ops.object.modifier_apply(modifier=mod.name)
 for f in o.data.polygons:f.use_smooth=True
for im in bpy.data.images:
 if max(im.size)>1024:im.scale(1024,1024)
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True)
lo,hi=bounds()
data={'source':str(source),'provider':'Cardinal','boundsBlender':[list(lo),list(hi)],'boundsThree':[[lo.x,lo.z,-hi.y],[hi.x,hi.z,-lo.y]],'polygons':sum(len(o.data.polygons) for o in objects),'scale':scale,'textures':len(bpy.data.images),'bytes':out.stat().st_size}
out.with_suffix('.json').write_text(json.dumps(data,indent=2));print(json.dumps(data))
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE_NEXT'
scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world.color=(.35,.35,.35)
for pos,energy in [((1,-2,3),320),((-2,1,2),280)]:
 bpy.ops.object.light_add(type='AREA',location=pos);bpy.context.object.data.energy=energy;bpy.context.object.data.size=3
c=(lo+hi)/2
bpy.ops.object.camera_add(location=c+Vector((.7,-1,.65)))
cam=bpy.context.object;cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=max(hi-lo)*1.35;scene.camera=cam
scene.render.filepath=str(evidence);bpy.ops.render.render(write_still=True)
