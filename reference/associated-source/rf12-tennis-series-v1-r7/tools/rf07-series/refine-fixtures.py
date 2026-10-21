"""Refine existing textured RF-07 assets with surface-mounted controls, never free-floating props."""
import bpy,bmesh,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path('.');SOURCE=ROOT/'public/local-assets/cardinal/rf07/models/runtime';OUT=ROOT/'public/local-assets/levels/rf07/realism-v2';OUT.mkdir(parents=True,exist_ok=True)
report={}
def material(name,color,metal=0,rough=.4):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
def load(path,scale=1):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path));bpy.ops.object.select_all(action='DESELECT')
 for o in list(bpy.context.scene.objects):
  if o.type=='MESH':
   bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.select_set(False)
   for v in o.data.vertices:v.co*=scale
 bpy.context.view_layer.update()
def ray(x,h):
 hit,p,n,_,ob,_=bpy.context.scene.ray_cast(bpy.context.evaluated_depsgraph_get(),Vector((x,-3,h)),Vector((0,1,0)),distance=6)
 if not hit:raise RuntimeError(f'No mounting surface {x,h}')
 if n.y>0:n=-n
 return p,n.normalized()
def disc(name,p,n,r,depth,m,offset):
 bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=r,depth=depth,location=p+n*offset);o=bpy.context.object;o.name=name;o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector((0,0,1)).rotation_difference(n);o.data.materials.append(m)
 bevel=o.modifiers.new('machined-edge','BEVEL');bevel.width=.0007;bevel.segments=3
 for f in o.data.polygons:f.use_smooth=True
 return o
def control(name,x,h,r=.012,kind='lamp'):
 p,n=ray(x,h);steel=material(name+'_bezel',(.32,.36,.38),.75,.26);seal=material(name+'_gasket',(.018,.022,.024),0,.8);face=material(name+'_lens' if kind=='lamp' else name+'_switch',(.15,.016,.012) if kind=='lamp' else (.033,.041,.045),.05,.23)
 disc(name+'_GASKET',p,n,r+.003,.0015,seal,.0003)
 disc(name+'_BEZEL',p,n,r+.0017,.003,steel,.0017)
 obj=disc(name,p,n,r,.003,face,.0034)
 obj['mounting']='surface-raycast; gasket recessed into original chassis';obj['diameter_m']=r*2
 if kind=='switch':
  # Engraved-style power mark, lying on the switch face instead of a boxed UI panel.
  tangent=Vector((1,0,0));tangent=(tangent-n*tangent.dot(n)).normalized();up=n.cross(tangent).normalized()
  bpy.ops.mesh.primitive_torus_add(major_radius=r*.50,minor_radius=.00055,major_segments=32,minor_segments=8,location=p+n*.0051);mark=bpy.context.object;mark.name=name+'_POWER_MARK';mark.rotation_mode='QUATERNION';mark.rotation_quaternion=Vector((0,0,1)).rotation_difference(n);mark.data.materials.append(material('power-mark',(.7,.76,.73),.2,.5))
 anchor=p+n*.005;return {'point':[anchor.x,anchor.z,-anchor.y],'normal':[n.x,n.z,-n.y],'radius':r,'surfaceGap':.0003}
def export(name):
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',export_yup=True,export_extras=True)
load(SOURCE/'class_ii_a2_bsc.glb')
report['bsc']={'alarm':control('RF07_ALARM_LENS',.30,1.85,.013),'power':control('RF07_POWER_SWITCH',-.68,1.12,.014,'switch'),'outlet':control('RF07_LEAK_OUTLET',-.68,1.02,.006,'port')};export('class_ii_a2_bsc')
load(ROOT/'public/local-assets/levels/rf07/series-v1/medical_refrigerator.glb')
report['cabinet']={'power':control('RF07_POWER_SWITCH',.35,1.20,.010,'switch'),'status':control('RF07_POWER_LENS',.35,1.265,.010)};export('medical_refrigerator')
load(SOURCE/'secondary_specimen_carrier.glb',1.65)
report['container']={'passive':True};export('specimen_container')
load(SOURCE/'cold_chain_packing_island.glb')
# Correct the excessively high generated worktop to a 0.92 m lab packing surface.
old=1.21553;new=.92
for o in bpy.context.scene.objects:
 if o.type=='MESH':
  for v in o.data.vertices:v.co.z=v.co.z*new/old if v.co.z<=old else v.co.z-(old-new)
report['packing']={'originalWorktop':old,'worktop':new,'method':'lower cabinet base and retain upper rack dimensions'};export('cold_chain_packing_island')
load(SOURCE/'p650_transport_case.glb')
body=next(o for o in bpy.context.scene.objects if o.type=='MESH');lid=body.copy();lid.data=body.data.copy();bpy.context.collection.objects.link(lid)
for ob,upper in [(body,False),(lid,True)]:
 bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if (f.calc_center_median().z>.34)!=upper],context='FACES');bm.to_mesh(ob.data);bm.free()
pivot=bpy.data.objects.new('RF07_CASE_LID',None);bpy.context.collection.objects.link(pivot);pivot.location=(0,.22,.34);bpy.context.view_layer.update();lid.parent=pivot;lid.matrix_parent_inverse=pivot.matrix_world.inverted()
for m in lid.data.materials:
 m.use_backface_culling=False
lining=material('case-interior',(.04,.052,.057),0,.75)
def cube(name,p,dimensions,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name=name;o.scale=dimensions;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);bevel=o.modifiers.new('edge-radius','BEVEL');bevel.width=.002;bevel.segments=3;return o
inner=cube('RF07_CASE_LID_LINER',(0,0,.349),(.558,.405,.012),lining);inner.parent=pivot;inner.matrix_parent_inverse=pivot.matrix_world.inverted()
cube('RF07_CASE_INNER_FLOOR',(0,0,.035),(.56,.41,.018),lining)
for x in [-.28,.28]:cube('case-inner-side',(x,0,.18),(.012,.41,.30),lining)
for y in [-.205,.205]:cube('case-inner-side',(0,y,.18),(.56,.012,.30),lining)
steel=material('case-handle-steel',(.32,.37,.39),.75,.26);rubber=material('case-handle-grip',(.035,.044,.045),0,.6)
p,n=ray(0,.205);zfront=-p.y
for x in [-.09,.09]:cube('RF07_HANDLE_MOUNT',(x,p.y-.008,.205),(.025,.020,.035),steel)
cube('RF07_CASE_HANDLE',(0,p.y-.024,.205),(.185,.020,.022),rubber)
report['case']={'workContact':[0,.205,zfront+.024],'linerHeight':.044,'hingedLid':True};export('p650_transport_case')
(OUT/'mounts.json').write_text(json.dumps(report,indent=2));print('MOUNTS',json.dumps(report))
