import bpy, sys, math
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
source,output,font_path=map(Path,args)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
def point(p): return (p[0],-p[2],p[1])
def mat(name,color,rough=.7,metal=0):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True; s=m.node_tree.nodes.get('Principled BSDF'); s.inputs['Base Color'].default_value=(*color,1); s.inputs['Roughness'].default_value=rough; s.inputs['Metallic'].default_value=metal; return m
steel=mat('edge trim',(0.38,.42,.4),.34,.8); rubber=mat('rubber seals',(.018,.022,.02),.8); orange=mat('safety orange',(.9,.22,.025),.55); blue=mat('crate blue',(.03,.2,.38),.65); wood=mat('beech edge',(.36,.2,.08),.75)
def box(n,s,p,m,bev=.02):
 bpy.ops.mesh.primitive_cube_add(size=1,location=point(p)); o=bpy.context.object; o.name=n; o.dimensions=(s[0],s[2],s[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(m)
 if bev: md=o.modifiers.new('rounded manufactured edge','BEVEL'); md.width=bev; md.segments=3; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=md.name)
 return o
def cyl(n,r,d,p,m,axis='y'):
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=d,location=point(p)); o=bpy.context.object; o.name=n; o.data.materials.append(m)
 if axis=='x': o.rotation_euler[1]=math.pi/2
 if axis=='z': o.rotation_euler[0]=math.pi/2
 return o
# Bevel imported static meshes where geometry is box-like, leaving plants/text untouched.
for o in list(bpy.context.scene.objects):
 if o.type!='MESH' or o.name.startswith(('Sphere','leaf','plane-tree')): continue
 if len(o.data.vertices)>20000: continue
 dims=o.dimensions; width=min(max(min(dims)*.035,.008),.055)
 if width<=.009: continue
 try:
  md=o.modifiers.new('production edge radius','BEVEL'); md.width=width; md.segments=2; md.limit_method='ANGLE'; bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.modifier_apply(modifier=md.name); o.select_set(False)
 except: pass
# Rounded cold-truck hardware and gasket layers.
for side in (-1,1):
 x=5.3+side*1.205
 for z in (-.35,-1.0,-1.65,-2.3,-2.95,-3.6): cyl('door-hinge-cap',.055,.16,[x,2.0,z],steel,'x')
 box('door-gasket',[.035,1.85,.06],[x-side*.04,2.0,-1.95],rubber,.025)
for x in (4.15,6.45):
 box('rear-corner-bumper',[.16,.55,.18],[x,.56,.12],rubber,.07)
# Workbench tubular legs and rounded edge rails.
for x,z,w,d,h in [(-5.9,-4.2,3.4,1,.82),(-2.6,-4.2,1.4,1.1,.76),(.6,-3.8,2.1,1.2,.84)]:
 for sx in (-1,1):
  for sz in (-1,1): cyl('tubular-bench-leg',.035,h-.08,[x+sx*(w/2-.1), (h-.08)/2, z+sz*(d/2-.09)],green if 'green' in bpy.data.materials else steel)
 box('bench-rounded-front',[w-.12,.08,.05],[x,h-.015,z-d/2+.035],wood,.025)
# Tail lift hinge barrels and hydraulic ram.
for x in (4.55,6.05): cyl('tail-hinge-barrel',.07,1.45,[x,.16,1.05],steel,'x')
cyl('hydraulic-cylinder',.065,1.4,[5.3,.42,1.28],steel,'z'); cyl('hydraulic-rod',.035,1.25,[5.3,.86,1.28],rubber,'z')
# Dock bumpers, wheel chocks and flexible hose.
for x in (4.15,6.45): cyl('dock-rubber-bumper',.13,.28,[x,.5,1.05],rubber,'x')
for i in range(8):
 a=i*math.pi/7; cyl('hose-segment',.035,.18,[7.7+.13*math.cos(a),.75+.13*math.sin(a),-5.45],rubber,'z')
# Rounded crate stack corners.
for layer in range(3):
 for x in (-7.7,-7.0):
  box('crate-rounded-body',[.58,.28,.44],[x,.22+layer*.33,-1.25],blue,.045)
  for side in (-1,1): box('crate-rim-round',[.62,.035,.03],[x,.38+layer*.33,-1.25+side*.21],steel,.012)
# Roof gutter and downspout elbows.
for x in (-8.4,2.0):
 cyl('gutter',.065,10.2,[x,4.12,-2.35],steel,'z')
 cyl('downspout-elbow',.07,.35,[x,3.75,1.8],steel,'y')
# Export with all existing plus refinement geometry.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format='AUTO')
print('ROUND_PASS',output)
