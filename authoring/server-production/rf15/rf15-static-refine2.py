import bpy
import math
import sys
from pathlib import Path

args = sys.argv[sys.argv.index('--') + 1:]
source, output, font_path = map(Path, args)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
def point(p): return (p[0], -p[2], p[1])
def mat(name, color, rough=.7, metal=0):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True; s=m.node_tree.nodes.get('Principled BSDF'); s.inputs['Base Color'].default_value=(*color,1); s.inputs['Roughness'].default_value=rough; s.inputs['Metallic'].default_value=metal; return m
green=mat('painted facility green',(.05,.19,.13),.6,.2); blue=mat('reusable blue plastic',(.04,.22,.38),.62,.05); yellow=mat('safety yellow',(.84,.56,.04),.64); steel=mat('brushed steel',(.43,.47,.45),.34,.78); dark=mat('rubber',(.025,.03,.028),.82); glass=mat('fluorescent diffuser',(.8,.9,.82),.25,.1); white=mat('wash basin enamel',(.82,.84,.79),.32,.15); red=mat('fire equipment red',(.58,.035,.02),.48)
def box(name,size,pos,material,bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1,location=point(pos)); o=bpy.context.object; o.name=name; o.dimensions=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(material)
    if bevel: mod=o.modifiers.new('edge','BEVEL'); mod.width=bevel; mod.segments=2; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def cyl(name,r,d,pos,material,axis='y'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=d,location=point(pos)); o=bpy.context.object; o.name=name; o.data.materials.append(material)
    if axis=='x': o.rotation_euler[1]=math.pi/2
    if axis=='z': o.rotation_euler[0]=math.pi/2
    return o
def label(name,value,pos,size,material):
    c=bpy.data.curves.new(name,'FONT'); c.body=value; c.size=size; c.align_x='CENTER'; c.font=bpy.data.fonts.load(str(font_path)); c.extrude=.0005; o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); o.location=point(pos); o.rotation_euler=(math.pi/2,0,0); o.data.materials.append(material); bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
# Hanging fluorescent fixtures and their suspension rods.
for x in [-6.2,-3.1,0.0]:
    box('fluorescent-housing',[1.65,.10,.18],[x,3.58,-1.0],steel,.018)
    box('fluorescent-diffuser',[1.45,.028,.13],[x,3.52,-1.0],glass,.01)
    for side in [-1,1]: cyl('light-suspension',.012,.52,[x+side*.58,3.82,-1.0],steel)
# Wall electrical distribution and conduits.
box('electrical-panel',[.72,.82,.12],[1.65,2.1,-6.52],green,.04)
for y in [1.92,2.14,2.36]: box('panel-slot',[.36,.018,.02],[1.65,y,-6.59],dark,.002)
box('conduit-horizontal',[4.4,.045,.045],[-2.0,2.72,-6.45],steel,.006)
for x in [-4.0,-1.0,1.0]: box('conduit-vertical',[.045,1.15,.045],[x,2.15,-6.45],steel,.006)
# Hand-wash and packing hygiene corner.
box('wash-stand',[.85,.05,.48],[2.05,.92,-5.8],steel,.015)
box('wash-basin',[.68,.16,.38],[2.05,1.04,-5.8],white,.06)
cyl('wash-faucet',.025,.24,[2.05,1.25,-5.83],steel)
box('soap-dispenser',[.16,.25,.08],[2.05,1.38,-6.02],blue,.02)
label('wash-label','洗手 / 消毒',[2.05,1.65,-6.0],.11,green)
# More convincing reusable crate stacks with rims and labels.
for layer in range(3):
    for x in [-7.7,-7.0]:
        box('crate-body',[.58,.28,.44],[x,.22+layer*.33,-1.25],blue,.025)
        for edge in [-1,1]: box('crate-rim',[.62,.035,.025],[x,.37+layer*.33,-1.25+edge*.21],steel,.004)
        label('crate-label','周转筐',[x,.39+layer*.33,-1.48],.07,white)
# Pallet construction details and stretch-wrap bands.
for z in [3.8,4.55]:
    for x in [-8.0,-7.5,-7.0]: box('pallet-board',[.12,.04,1.0],[x,.15,z],steel,.004)
    for x in [-8.0,-7.5,-7.0]: box('pallet-foot',[.10,.12,.16],[x,.07,z],dark,.008)
for y in [.32,.72,1.12]: box('stretch-wrap-band',[.72,.025,.015],[-7.55,y,4.2],glass,.002)
# Fire and first-aid wall cabinet details.
box('fire-cabinet',[.72,.82,.11],[-7.72,1.7,-6.51],red,.04)
box('fire-window',[.42,.38,.015],[-7.72,1.78,-6.575],glass,.01)
label('fire-label','消防栓',[-7.72,2.2,-6.58],.12,white)
# Loading-zone marker boards and wheel-stop hardware.
for x in [3.85,6.75]:
    box('dock-marker',[.08,.55,.08],[x,.28,2.48],yellow,.012)
    box('dock-marker-cap',[.12,.04,.12],[x,.58,2.48],dark,.01)
box('dock-floor-plate',[2.3,.012,.08],[5.3,.015,2.3],yellow,.002)
label('dock-label','尾板作业区',[5.3,.20,2.37],.12,dark)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format='AUTO')
print('RF15_STATIC_REFINED_2',output)
