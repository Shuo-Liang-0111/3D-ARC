import bpy,math
from pathlib import Path
from mathutils import Vector
OUT=Path('./public/local-assets/levels/rf04/series-v1')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,c,metal=0,rough=.4):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*c,1)
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
white=mat('Warm white microtextured ABS',(.82,.84,.82),.05,.28)
noise=white.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=650
bump=white.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.1;bump.inputs['Distance'].default_value=.00025
white.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);white.node_tree.links.new(bump.outputs['Normal'],white.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
black=mat('Charcoal elastomer',(.018,.025,.027),.05,.6)
glass=mat('Dark infrared polycarbonate',(.016,.033,.044),.4,.12)
silver=mat('Satin aluminium',(.35,.4,.42),.8,.22)
blue=mat('Status blue',(.13,.48,.78),.1,.25)
blue.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(.05,.2,.6,1)
blue.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=.5
def cyl(name,r,depth,z,material,xy=(0,0),bevel=.002,vertices=128):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=(*xy,z))
 o=bpy.context.object;o.name=name;o.data.materials.append(material)
 b=o.modifiers.new('Precision molded bevel','BEVEL');b.width=bevel;b.segments=3
 o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 for p in o.data.polygons:p.use_smooth=True
 return o
def box(name,loc,scale,material,bevel=.002):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 b=o.modifiers.new('Rounded edges','BEVEL');b.width=bevel;b.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
cyl('Underside chassis',.161,.012,.015,black)
cyl('Continuous compliant bumper',.175,.038,.041,black)
cyl('Lower bumper seam',.174,.002,.028,silver,bevel=.0004)
cyl('Upper white chassis',.172,.012,.066,white)
cyl('Circular top cover seam',.156,.0018,.073,black,bevel=.0003)
cyl('Removable white top cover',.154,.003,.075,white)
cyl('Lidar sensor skirt',.044,.010,.083,black,xy=(0,.045))
cyl('Lidar white cap',.044,.006,.091,white,xy=(0,.045))
cyl('Lidar center',.034,.001,.094,silver,xy=(0,.045),bevel=.0004)
for x in [-.024,.024]:
 cyl('Top tactile control',.009,.0015,.078,black,xy=(x,-.078),bevel=.0004,vertices=48)
 cyl('Button indicator',.002,.0006,.079,blue,xy=(x,-.078),bevel=.0001,vertices=24)
for x in [-.103,.103]:
 wheel=cyl('Traction wheel',.027,.024,.027,black,xy=(x,0),vertices=64);wheel.rotation_euler[1]=math.pi/2
 for z in [-.01,0,.01]:box('Wheel tread',(x,-.019,.025+z),(.026,.012,.003),black,.0008)
for i in range(22):
 a=-.55+i*.05
 box('Rear vent',(math.sin(a)*.146,math.cos(a)*.146,.046),(.0025,.007,.013),black,.0005).rotation_euler[2]=-a
for i in range(5):
 a=math.pi+(-.28+i*.14)
 sensor=box('Front infrared sensor',(math.sin(a)*.170,math.cos(a)*.170,.047),(.022,.006,.013),glass,.002);sensor.rotation_euler[2]=-a
for x in [-.046,.046]:
 cyl('Chassis screw',.002,.001,.009,silver,xy=(x,.08),bevel=.0003,vertices=20)
cyl('Side brush hub',.011,.005,.007,black,xy=(.105,-.106),vertices=32)
for i in range(3):
 a=i*math.tau/3
 for j in range(6):
  angle=a+(j-2.5)*.035
  b=box('Flexible side brush bristle',(.105+math.sin(angle)*.023,-.106+math.cos(angle)*.023,.006),(.0009,.044,.0014),black,.0003)
  b.rotation_euler[2]=-angle
bpy.ops.export_scene.gltf(filepath=str(OUT/'vacuum.glb'),export_format='GLB',export_apply=True)
# Isolated reference render: diagnostic only, not a substitute for formal game screenshots.
world=bpy.context.scene.world or bpy.data.worlds.new('Studio');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.68,.70,1)
bpy.ops.object.light_add(type='AREA',location=(.3,-.3,.6));bpy.context.object.data.energy=35;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=.5
bpy.ops.object.camera_add(location=(.43,-.52,.45));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.035))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.5;bpy.context.scene.camera=cam
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=32;s.render.resolution_x=768;s.render.resolution_y=768;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.filepath='./authoring/server-production/rf04-series-v1/evidence/vacuum-isolated.png';bpy.ops.render.render(write_still=True)
