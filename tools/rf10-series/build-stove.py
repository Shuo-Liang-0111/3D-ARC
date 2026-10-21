import bpy,math
from pathlib import Path
from mathutils import Vector
OUT=Path('./public/local-assets/levels/rf12/interaction-v2')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=.0,rough=.35):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
glass=mat('Black ceramic glass',(.018,.022,.025),.35,.18)
steel=mat('Brushed stainless steel',(.42,.45,.46),.8,.30)
iron=mat('Cast iron burner supports',(.04,.045,.048),.45,.58)
brass=mat('Machined brass flame distributor',(.46,.3,.09),.75,.36)
ink=mat('White dial index',(.8,.82,.78),0,.5)
def cube(name,location,scale,material,bevel=.005):
 bpy.ops.mesh.primitive_cube_add(size=1,location=location);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 if bevel:mod=o.modifiers.new('Manufactured rounded edges','BEVEL');mod.width=bevel;mod.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def cyl(name,loc,radius,depth,material):
 bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=radius,depth=depth,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(material);mod=o.modifiers.new('Machined bevel','BEVEL');mod.width=.002;mod.segments=2;o.modifiers.new('Normals','WEIGHTED_NORMAL');return o
cube('Hob stainless perimeter',(0,0,.018),(.90,.65,.035),steel,.015)
cube('Black glass hob plate',(0,0,.04),(.884,.634,.023),glass,.012)
for i,(x,y) in enumerate([(0,-.15),(0,.16)]):
 cyl('Burner well '+str(i),(x,y,.056),.16,.014,steel)
 cyl('Brass injector '+str(i),(x,y,.075),.097,.024,brass)
 cyl('Matte burner cap '+str(i),(x,y,.092),.079,.014,iron)
 for j in range(32):
  a=j*math.tau/32;slot=cube('Gas port',(x+math.cos(a)*.094,y+math.sin(a)*.094,.078),(.006,.011,.006),iron,.001);slot.rotation_euler.z=a
 for j in range(4):
  a=j*math.pi/2
  grate=cube('Pot support',(x+math.cos(a)*.118,y+math.sin(a)*.118,.112),(.12,.018,.02),iron,.004);grate.rotation_euler.z=a
  cube('Grate foot',(x+math.cos(a)*.161,y+math.sin(a)*.161,.082),(.018,.022,.067),iron,.003)
for x in [-.31,.31]:
 cyl('Control base',(x,-.235,.061),.035,.012,steel)
 cyl('Rotary knob',(x,-.235,.082),.027,.035,iron)
 cube('Dial index',(x,-.225,.102),(.005,.018,.002),ink,.0005)
bpy.ops.export_scene.gltf(filepath=str(OUT/'stove-precision.glb'),export_format='GLB',export_apply=True)

# Separate operational rotary control with a clean, calibrated grasp surface.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
cyl('Knob escutcheon',(0,0,.008),.038,.016,steel)
cyl('Rotating dial',(0,0,.028),.028,.026,iron)
cube('Pointer',(0,-.01,.042),(.005,.021,.003),ink,.001)
bpy.ops.export_scene.gltf(filepath=str(OUT/'gas-knob-precision.glb'),export_format='GLB',export_apply=True)
