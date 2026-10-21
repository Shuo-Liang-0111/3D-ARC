import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
out=root/'public/local-assets/levels/rf14/series-v1'
work=Path('./authoring/server-production/rf12-tennis-series-v1')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=0,rough=.5):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
 p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 return m
steel=mat('Powder coated dark green steel',(.045,.085,.072),.65,.32)
silver=mat('Galvanized hardware',(.37,.42,.4),.8,.28)
roof=mat('Smoke polycarbonate roof',(.21,.31,.32),.05,.24)
p=roof.node_tree.nodes.get('Principled BSDF');p.inputs['Alpha'].default_value=.7
roof.surface_render_method='DITHERED'
concrete=mat('Concrete anchors',(.3,.31,.29),0,.95)
# Embedded subtle brushed finish. Geometry stays dimensionally precise.
img=bpy.data.images.new('PowderCoatMicrotexture',width=128,height=128)
import random
r=random.Random(12);pix=[]
for i in range(128*128):
 v=.92+r.random()*.08;pix.extend([v,v,v,1])
img.pixels=pix;img.pack()
for m in [steel,silver]:
 n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=img
 bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.08;bump.inputs['Distance'].default_value=.001
 m.node_tree.links.new(n.outputs['Color'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],m.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
def box(name,size,pos,material,bevel=.008):
 x,y,z=pos;w,h,d=size;bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.dimensions=(w,d,h)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if material:o.data.materials.append(material)
 if bevel:
  mod=o.modifiers.new('Manufactured edge radius','BEVEL');mod.width=bevel;mod.segments=3
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
posts=[(6.85,-4.8),(9.75,-4.8),(6.85,.8),(9.75,.8)]
for i,(x,z) in enumerate(posts):
 box('shelter-post-'+str(i),(.12,2.8,.12),(x,1.4,z),steel)
 box('post-footplate-'+str(i),(.24,.014,.24),(x,.007,z),silver,.004)
 for dx in [-.08,.08]:
  for dz in [-.08,.08]:box('anchor-bolt',(.022,.023,.022),(x+dx,.025,z+dz),silver,.003)
for x in [6.85,9.75]:box('longitudinal-roof-beam',(.09,.16,6),(x,2.73,-2),steel)
for z in [-4.8,-3.4,-2,-.6,.8]:box('roof-crossbar',(3.2,.08,.07),(8.3,2.81,z),silver)
for i in range(12):
 z=-5+(i+.5)*.5
 o=box('polycarbonate-panel-'+str(i),(3.3,.035,.496),(8.3,2.87,z),roof,.005)
 o['roof']=True
for x in [6.69,9.91]:
 box('roof-edge-and-gutter',(.08,.13,6.04),(x,2.83,-2),steel)
for z in [-5,1]:box('roof-end-cap',(3.3,.08,.055),(8.3,2.86,z),steel)
visual=list(bpy.context.scene.objects)
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(work/'shelter-source.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'shelter.glb'),export_format='GLB',export_extras=True,export_yup=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
records=[]
for i,(x,z) in enumerate(posts):
 o=box('COLLIDER_shelter-post-'+str(i),(.12,2.8,.12),(x,1.4,z),None,0);o['collision']=True
 records.append({'id':'shelter-post-'+str(i),'size':[.12,2.8,.12],'position':[x,1.4,z]})
o=box('COLLIDER_orange-cart',(.65,.95,.65),(8.2,.475,10),None,0);o['collision']=True
bpy.ops.export_scene.gltf(filepath=str(out/'collision.glb'),export_format='GLB',export_extras=True,export_yup=True)
(work/'shelter-measurements.json').write_text(json.dumps({'roof':{'min':[6.65,2.8,-5],'max':[9.95,2.91,1]},'columns':records,'units':'metres','axis':'Y-up'},indent=2))
print('SHELTER_EXPORTED')
