import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path('.')
OUT=ROOT/'public/local-assets/levels/rf04/series-v1'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=0,rough=.6):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 return m
oak=mat('Warm oak joinery',(.48,.30,.15),0,.58)
image=bpy.data.images.load(str(ROOT/'public/local-assets/cardinal/rf04/textures/realistic-walnut-oak-floor.png'));image.pack()
n=oak.node_tree.nodes.new('ShaderNodeTexImage');n.image=image
oak.node_tree.links.new(n.outputs['Color'],oak.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
cream=mat('Linen backing',(.79,.76,.68),0,.85)
metal=mat('Brushed warm steel',(.27,.29,.29),.8,.28)
dark=mat('Charcoal docking ABS',(.035,.045,.05),.05,.4)
white=mat('Ivory molded shell',(.8,.82,.8),.05,.3)
gold=mat('Charging contacts',(.6,.44,.19),.85,.25)
def cube(name,loc,size,material,bevel=.008):
 # Three world to Blender.
 bpy.ops.mesh.primitive_cube_add(size=1,location=(loc[0],-loc[2],loc[1]))
 o=bpy.context.object;o.name=name;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(material)
 if bevel:
  b=o.modifiers.new('Soft manufactured edge','BEVEL');b.width=bevel;b.segments=3
  o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
 return o
x,z=-1.95,6.55
cube('Storage back',(x,.70,z+.25),(2.7,1.10,.032),cream)
for dx in [-1.35,-.45,.45,1.35]:cube('Storage vertical divider',(x+dx,.70,z),(.035,1.10,.55),oak)
for y in [.17,.75,1.25]:cube('Solid oak shelf',(x,y,z),(2.735,.038,.57),oak)
for dx in [-1.2,1.2]:
 for dz in [-.2,.2]:cube('Steel furniture foot',(x+dx,.08,z+dz),(.035,.16,.035),metal,.005)
for dx in [-.9,0,.9]:
 cube('Recessed lower drawer',(x+dx,.43,z),(.83,.48,.49),oak)
 cube('Drawer handle',(x+dx,.56,z-.265),(.28,.022,.027),metal,.008)
# Open bays at .77m; runtime adds garment examples on the top board.
dx,dz=-8.55,6.50
cube('Dock charging tower',(dx,.14,dz+.20),(.42,.28,.16),dark,.025)
cube('Dock recessed front',(dx,.12,dz+.112),(.34,.15,.009),white,.01)
cube('Dock ramp',(dx,.006,dz-.015),(.43,.012,.43),dark,.008)
for ox in [-.065,.065]:cube('Copper charging contact',(dx+ox,.017,dz+.06),(.033,.007,.057),gold,.002)
cube('Dock indicator',(dx,.22,dz+.105),(.04,.009,.006),white,.002)
bpy.ops.export_scene.gltf(filepath=str(OUT/'furnishings.glb'),export_format='GLB',export_apply=True)
# Collision mesh comes from the same authoritative runtime layout.
layout=json.loads(Path('./authoring/server-production/rf04-series-v1/collision-layout.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for c in layout:
 cube('COLLIDER_'+c['id'],((c['minX']+c['maxX'])/2,1.25,(c['minZ']+c['maxZ'])/2),(c['maxX']-c['minX'],2.5,c['maxZ']-c['minZ']),dark,0)
bpy.ops.export_scene.gltf(filepath=str(OUT/'collision.glb'),export_format='GLB',export_apply=True)
