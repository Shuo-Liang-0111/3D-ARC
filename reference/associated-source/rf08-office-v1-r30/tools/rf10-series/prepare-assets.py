import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector,Matrix
P=Path('./authoring/server-production/rf10-series-v2')
R=Path('.')
OUT=R/'public/local-assets/levels/rf12/interaction-v2';OUT.mkdir(parents=True,exist_ok=True)
name=sys.argv[sys.argv.index('--')+1]
source=(P/'source'/(name+'.glb')) if name in ['oil_bottle','frying_pan','extinguisher'] else R/'public/local-assets/cardinal/rf12-v2/models/runtime'/(name+'.glb')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in objects:
 matrix=o.matrix_world.copy()
 o.parent=None;o.matrix_world=Matrix.Identity(4)
 o.data.transform(matrix)
def bounds():
 pts=[v.co for o in objects for v in o.data.vertices]
 return Vector(tuple(min(v[i] for v in pts) for i in range(3))),Vector(tuple(max(v[i] for v in pts) for i in range(3)))
lo,hi=bounds()
if name in ['oil_bottle','frying_pan','extinguisher']:
 if name=='frying_pan':
  # Align the thinnest axis with vertical before placing an upright generated pan.
  dims=hi-lo;thin=min(range(3),key=lambda i:dims[i])
  rotation=Matrix.Rotation(-math.pi/2,4,'X') if thin==1 else Matrix.Rotation(math.pi/2,4,'Y') if thin==0 else Matrix.Identity(4)
  for o in objects:o.data.transform(Matrix.Rotation(math.pi,4,'X')@rotation)
  lo,hi=bounds()
  # Align the handle toward +Z in Three.js.
  major=0 if hi.x-lo.x>hi.y-lo.y else 1
  pts=[v.co for o in objects for v in o.data.vertices]
  center=sum((v for v in pts),Vector())/len(pts)
  direction=1 if hi[major]-center[major]>center[major]-lo[major] else -1
  rotation=(-math.pi/2 if direction==1 else math.pi/2) if major==0 else (math.pi if direction==1 else 0)
  for o in objects:o.data.transform(Matrix.Rotation(rotation,4,'Z'))
  lo,hi=bounds();scale=.51/max(hi.x-lo.x,hi.y-lo.y)
  # Circular bowl is at the opposite end to the handle (-Y).
  diameter=hi.x-lo.x
  center=Vector(((hi.x+lo.x)/2,hi.y-diameter/2,lo.z))
 else:
  scale=({'oil_bottle':.31,'extinguisher':.52}[name])/(hi.z-lo.z)
  center=Vector(((hi.x+lo.x)/2,(hi.y+lo.y)/2,lo.z))
 for o in objects:o.data.transform(Matrix.Scale(scale,4)@Matrix.Translation(-center))
for o in objects:
 o.select_set(True);bpy.context.view_layer.objects.active=o
 limit=16000 if name in ['stove_module','refrigerator','kitchen_sink_repaired'] else 10000
 if len(o.data.polygons)>limit:
  mod=o.modifiers.new('Web runtime reduction','DECIMATE');mod.ratio=limit/len(o.data.polygons);bpy.ops.object.modifier_apply(modifier=mod.name)
 for face in o.data.polygons:face.use_smooth=True
 o.select_set(False)
for image in bpy.data.images:
 if image.size[0]>1024 or image.size[1]>1024:image.scale(1024,1024)
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_image_format='AUTO',export_draco_mesh_compression_enable=False)
lo,hi=bounds();data={'name':name,'bounds':[list(lo),list(hi)],'polygons':sum(len(o.data.polygons) for o in objects),'bytes':(OUT/(name+'.glb')).stat().st_size}
(OUT/(name+'.json')).write_text(json.dumps(data,indent=2))
if name in ['oil_bottle','frying_pan','extinguisher']:
 scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE_NEXT'
 scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
 scene.world.color=(.3,.3,.3)
 for pos,energy in [((2,-3,4),450),((-2,1,3),300)]:
  bpy.ops.object.light_add(type='AREA',location=pos);bpy.context.object.data.energy=energy;bpy.context.object.data.size=3
 center=(lo+hi)/2
 bpy.ops.object.camera_add(location=center+Vector((.8,-1.1,.8)))
 cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=max(hi-lo)*1.5;scene.camera=cam
 scene.render.filepath=str(P/'evidence'/(name+'-asset.png'));bpy.ops.render.render(write_still=True)
print('ASSET',json.dumps(data))
