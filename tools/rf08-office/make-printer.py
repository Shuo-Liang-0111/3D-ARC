import bpy, math, sys, os, json, hashlib
from pathlib import Path
from mathutils import Vector
out=Path(sys.argv[sys.argv.index('--')+1]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,rough=.5,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
white=mat('Warm ABS shell',(0.68,.70,.67),.48);dark=mat('Graphite tray',(.042,.055,.06),.50);rubber=mat('Rubber feet',(.015,.018,.018),.90);silver=mat('Roller steel',(.34,.38,.4),.29,.78);blue=mat('Status blue',(.08,.3,.39),.25)
# Embedded fine surface roughness, preserved in GLB.
img=bpy.data.images.new('ABS_micro_roughness',width=128,height=128)
img.pixels=[v for y in range(128) for x in range(128) for v in [(.47+.07*math.sin(x*17+y*31))]*3+[1.0]];img.pack()
n=white.node_tree.nodes.new('ShaderNodeTexImage');n.image=img;white.node_tree.links.new(n.outputs['Color'],white.node_tree.nodes['Principled BSDF'].inputs['Roughness'])
def box(name,p,size,m,bevel=.003):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:
  b=o.modifiers.new('Manufactured edge radius','BEVEL');b.width=bevel;b.segments=3;b.affect='EDGES';o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
 return o
# Blender +Y is the front (-Z in the game). Open output cavity is actual geometry.
box('bottom chassis',(0,0,.033),(.62,.46,.05),dark,.008)
box('left shell',(-.289,0,.152),(.04,.46,.20),white,.009)
box('right shell',(.289,0,.152),(.04,.46,.20),white,.009)
box('rear cover',(0,-.211,.156),(.55,.035,.20),white,.007)
box('front lower face',(0,.226,.09),(.55,.022,.075),white,.005)
box('paper cassette inset',(0,.239,.088),(.44,.01,.055),dark,.002)
box('cassette drawer',(0,.247,.085),(.428,.018,.042),white,.003)
box('drawer grip',(0,.261,.091),(.11,.012,.009),dark,.002)
box('output cavity floor',(0,.10,.15),(.53,.24,.012),dark)
box('output cavity back',(0,-.022,.194),(.53,.012,.08),dark)
box('scanner lower rim',(0,-.005,.267),(.61,.46,.028),dark,.009)
box('scanner lid',(0,-.012,.29),(.595,.45,.023),white,.01)
box('lid inset',(0,-.025,.306),(.51,.35,.010),white,.006)
for x in [-.225,.225]:box('lid hinge',(x,-.218,.273),(.058,.041,.038),dark)
# Input paper tray and extended upper output support match authoritative interaction points.
box('open input tray',(0,.403,.065),(.32,.34,.012),dark,.002)
for x in [-.16,.16]:box('input paper guide',(x,.39,.082),(.009,.22,.038),white,.001)
box('upper output tray',(0,.327,.294),(.43,.23,.012),dark,.002)
for x in [-.213,.213]:box('output retaining rail',(x,.33,.31),(.008,.225,.026),dark,.001)
box('control console',(-.24,.367,.288),(.15,.14,.033),white,.008)
box('LCD bezel',(-.24,.389,.307),(.122,.08,.009),dark,.002)
box('LCD face',(-.24,.389,.313),(.11,.068,.003),blue,.001)
for x in [-.282,-.247,-.212]:box('push button',(x,.334,.31),(.022,.018,.006),dark,.003)
for side in [-1,1]:
 for i in range(12):box('recessed side vent',(side*.311,-.13+i*.018,.178),(.004,.009,.062),dark,.001)
 for y in [-.16,.17]:
  box('elastomer foot',(side*.25,y,.005),(.045,.043,.01),rubber,.003)
for x in [-.20,-.10,0,.10,.20]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.009,depth=.065,location=(x,.125,.173),rotation=(0,math.pi/2,0));bpy.context.object.data.materials.append(rubber)
for x in [-.28,.28]:
 for y in [-.195,.20]:
  bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.003,location=(x,y,.253));bpy.context.object.scale.z=.3;bpy.context.object.data.materials.append(silver)
for o in bpy.context.scene.objects:
 if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'office-printer.glb'),export_format='GLB',export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
manifest={'source':'precise authored Blender geometry; Cardinal submission returned connection error without task ID, not resubmitted','units':'m','supportY':.72,'interactionPoints':{'load':[6.5,.79,4.90],'button':[6.28,1.02,4.95],'output':[6.5,1.02,5.03]},'pbrTexturesEmbedded':len([i for i in bpy.data.images if i.has_data]),'runtimeBytes':(out/'office-printer.glb').stat().st_size,'sha256':hashlib.sha256((out/'office-printer.glb').read_bytes()).hexdigest()}
(out/'printer-manifest.json').write_text(json.dumps(manifest,indent=2))
