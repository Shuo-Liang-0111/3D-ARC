
import bpy, math
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath='./public/local-assets/cardinal/rf05/models/series-v02-opt2/cleaning_cart.glb')
for obj in list(bpy.context.scene.objects):
 if obj.type=='MESH':
  points=[obj.matrix_world@v.co for v in obj.data.vertices]
  print('BOUNDS',obj.name,[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)])
bpy.ops.object.camera_add(location=(1.7,-1.7,1.8))
cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.65))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO';cam.data.ortho_scale=1.6;bpy.context.scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(0,-2,3));bpy.context.object.data.energy=400;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=3
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=12;sc.render.resolution_x=800;sc.render.resolution_y=800;sc.render.resolution_percentage=100
sc.world.color=(.3,.3,.3);sc.render.filepath='./authoring/server-production/rf05-series-v06/repair-r9/cart-native.png'
bpy.ops.wm.save_as_mainfile(filepath='./authoring/server-production/rf05-series-v06/repair-r9/cart-inspect.blend')
bpy.ops.render.render(write_still=True)
