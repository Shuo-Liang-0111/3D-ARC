import bpy
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='./public/local-assets/cardinal/rf02/models/runtime/suspended-linear-light.glb')
for o in bpy.context.scene.objects:
 if o.type=='MESH': print('MESH',o.name,'bounds',[list(o.matrix_world@Vector(c)) for c in o.bound_box])
world=bpy.data.worlds.new('studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(0.3,0.3,0.3,1);world.node_tree.nodes['Background'].inputs[1].default_value=0.8;bpy.context.scene.world=world
bpy.ops.object.light_add(type='AREA',location=(0,-2,3));bpy.context.object.data.energy=400;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
for label,pos in [('under',(1.3,-2.6,-2.4)),('side',(1,-3,1.2))]:
 bpy.ops.object.camera_add(location=pos);cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.12))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.7;bpy.context.scene.camera=cam
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1000;scene.render.resolution_y=600;scene.render.resolution_percentage=100;scene.render.filepath='./authoring/server-production/rf02-lighting-v8/evidence/lamp-'+label+'.png';bpy.ops.render.render(write_still=True)
