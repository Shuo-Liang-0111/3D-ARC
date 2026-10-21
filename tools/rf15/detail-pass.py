import bpy, sys, shutil, json, hashlib
from pathlib import Path
from mathutils import Vector
import math
root=Path(sys.argv[sys.argv.index('--')+1]); src=root/'public/local-assets/levels/rf15/realism-v0.2.8'; out=root/'public/local-assets/levels/rf15/realism-v0.2.9'; shutil.copytree(src,out)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False); bpy.ops.import_scene.gltf(filepath=str(src/'rf15_final.glb'))
def mat(name,color,rough=.65,metal=0):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True; s=m.node_tree.nodes.get('Principled BSDF'); s.inputs['Base Color'].default_value=(*color,1); s.inputs['Roughness'].default_value=rough; s.inputs['Metallic'].default_value=metal; return m
def point(p): return (p[0],-p[2],p[1])
steel=mat('stainless hardware',(0.28,.32,.31),.28,.82); dark=mat('rubber tire',(0.018,.021,.02),.86); hub=mat('wheel hub',(0.5,.53,.5),.25,.9); wood=mat('sealed beech grain',(.31,.15,.055),.72); edge=mat('wood end grain',(.18,.07,.025),.82); green=mat('powder coat green',(.035,.16,.09),.48,.55); amber=mat('warning amber',(1,.33,.015),.3,.2); white=mat('cold box enamel',(.78,.81,.76),.3,.2)
def box(name,size,p,m,bev=.02):
 bpy.ops.mesh.primitive_cube_add(size=1,location=point(p)); o=bpy.context.object; o.name=name; o.dimensions=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(m)
 if bev: md=o.modifiers.new('manufactured radius','BEVEL'); md.width=bev; md.segments=3; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=md.name)
 return o
def cyl(name,r,d,p,m,axis='y',verts=32):
 bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d,location=point(p)); o=bpy.context.object; o.name=name; o.data.materials.append(m)
 if axis=='x': o.rotation_euler[1]=math.pi/2
 if axis=='z': o.rotation_euler[0]=math.pi/2
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); return o
# truck wheels with tread and hubs, positioned outside body sides
for x in (4.28,6.32):
 for z in (-4.05,-1.05):
  cyl('cold-truck-tire',.39,.18,[x, .62, z],dark,'x',40)
  cyl('cold-truck-hub',.16,.195,[x, .62, z],hub,'x',24)
  for a in range(8):
   ang=a*math.pi/4; cyl('hub-stud',.018,.21,[x,.62+.12*math.cos(ang),z+.12*math.sin(ang)],steel,'x',12)
# loading dock tactile plate and bolted rails
box('tail-lift-deck',[2.2,.07,1.82],[5.3,.16,1.0],steel,.025)
for x in [4.45,4.9,5.35,5.8,6.25]:
 for z in [.3,1.7]: cyl('tail-deck-bolt',.025,.09,[x,.205,z],dark,'y',16)
# wood bench construction: end grain, front edge, fasteners, slat seams
for x,z,w,d,h in [(-5.9,-4.2,3.4,1,.82),(-2.6,-4.2,1.4,1.1,.76),(.6,-3.8,2.1,1.2,.84)]:
 box('bench-front-apron',[w,.11,.08],[x,h-.075,z-d/2+.05],edge,.018)
 for offset in [-w/2+.18,w/2-.18]:
  cyl('bench-top-fastener',.022,.025,[x+offset,h+.008,z-d/2+.07],steel,'y',16)
 for offset in [-.38,0,.38]:
  box('bench-grain-inlay',[w-.22,.004,.012],[x,h+.006,z+offset*d*.42],edge,.002)
# wall panel attachment rivets and vertical flashing
for x in [-7.85,-6.8,-5.75,-4.7,-3.65,-2.6,-1.55,-.5,.55]:
 for y in [.78,1.48,2.18,2.88,3.48]: cyl('wall-panel-rivet',.018,.025,[x,y,-6.605],steel,'y',16)
# roof gutter end caps and downspout straps
for x in [-8.4,2.0]:
 for z in [-5.8,-3.5,-1.2,1.1]: box('downspout-strap',[.18,.06,.035],[x+.04,2.1,z],steel,.008)
# safety beacon and truck door handles
cyl('dock-warning-beacon',.09,.16,[7.15,1.22,1.45],amber,'y',24)
box('rear-door-handle',[.08,.24,.06],[5.3,.98,-.32],steel,.018)
# export
bpy.ops.object.select_all(action='SELECT'); bpy.ops.export_scene.gltf(filepath=str(out/'rf15_final.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format='AUTO')
manifest=json.loads((out/'manifest.json').read_text()); manifest['revision']='realism-v0.2.9'; manifest['detailPass']={'truckWheels':8,'benchConstruction':True,'wallRivets':45,'dockHardware':True}; (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
for f in out.glob('*.glb'): assert f.read_bytes()[:4]==b'glTF'
print('DETAIL_PASS',out)
