import bpy, math, json, random, os, sys
from pathlib import Path
from mathutils import Vector,Matrix
random.seed(6)
ROOT=Path("."); ASSET_VERSION=sys.argv[sys.argv.index("--")+1] if "--" in sys.argv else "home-v4"
OUT=ROOT/"public/local-assets/levels/rf06"/ASSET_VERSION
OUT.mkdir(parents=True,exist_ok=True)
DATA=json.loads(Path("./authoring/server-production/rf06-home-v3/layout.json").read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def v(p):return Vector((p[0],-p[2],p[1]))
def mat(name,color,rough=.6,metal=0,texture=None):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
 if texture:
  im=bpy.data.images.load(str(ROOT/texture),check_existing=True)
  if max(im.size)>1024:im.scale(1024,1024)
  im.pack();t=m.node_tree.nodes.new("ShaderNodeTexImage");t.image=im;m.node_tree.links.new(t.outputs["Color"],bs.inputs["Base Color"])
 return m
plaster=mat("Warm mineral plaster",(.84,.825,.79),.9,texture="public/local-assets/cardinal/rf04/textures/realistic-warm-plaster-wall.png")
oak=mat("Natural oak",(.57,.37,.20),.55,texture="public/local-assets/cardinal/rf04/textures/warm-oak-floor.png")
tile=mat("Porcelain limestone",(.69,.68,.62),.44,texture="public/local-assets/cardinal/rf05/textures/source/bathroom_floor_tile.png")
white=mat("Warm white satin cabinetry",(.83,.82,.76),.42)
stone=mat("Ivory quartz worktop",(.81,.80,.75),.28)
steel=mat("Brushed stainless steel",(.48,.53,.55),.25,.82)
chrome=mat("Chrome plumbing",(.65,.69,.71),.13,.95)
copper=mat("Copper supply pipe",(.40,.19,.085),.3,.78)
black=mat("Black rubber and appliance glass",(.015,.020,.022),.24)
dark=mat("Charcoal handles",(.055,.065,.069),.38,.65)
fabric=mat("Linen upholstery",(.46,.49,.44),.92)
# A packed fine weave image is visible in GLB without unsupported procedural nodes.
im=bpy.data.images.new("Linen weave",width=128,height=128)
pixels=[]
for y in range(128):
 for x in range(128):
  n=(random.random()-.5)*.025+(.018 if x%3==0 else 0)-(.018 if y%3==0 else 0)
  pixels.extend([.51+n,.53+n,.48+n,1])
im.pixels=pixels;im.pack();tx=fabric.node_tree.nodes.new("ShaderNodeTexImage");tx.image=im;fabric.node_tree.links.new(tx.outputs['Color'],fabric.node_tree.nodes.get("Principled BSDF").inputs['Base Color'])
rug=mat("Flat woven neutral rug",(.40,.36,.29),.98)
glass=mat("Window pale glass",(.55,.69,.72),.14,.05);glass.diffuse_color=(.55,.69,.72,.30)
bs=glass.node_tree.nodes.get("Principled BSDF");bs.inputs["Alpha"].default_value=.30;glass.surface_render_method='DITHERED'
green=mat("Leaf green",(.08,.20,.075),.72);ceramic=mat("Ceramic",(.67,.69,.64),.25)
def uv(obj):
 me=obj.data
 if not me.uv_layers:me.uv_layers.new()
 for face in me.polygons:
  axis=max(range(3),key=lambda i:abs(face.normal[i]));axes=[i for i in range(3) if i!=axis]
  for li in face.loop_indices:
   co=me.vertices[me.loops[li].vertex_index].co
   if obj.name.startswith("Oak plank"):
    me.uv_layers.active.data[li].uv=(.007+(co.y/.241+.5)*.086,.015+(co.x/max(.1,obj.dimensions.x)+.5)*.46)
   else:me.uv_layers.active.data[li].uv=(co[axes[0]],co[axes[1]])
def box(name,p,size,m,bevel=.008):
 bpy.ops.mesh.primitive_cube_add(size=1,location=v(p));o=bpy.context.object;o.name=name;o.dimensions=(size[0],size[2],size[1])
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);uv(o)
 if bevel:
  mod=o.modifiers.new("Soft manufactured edge","BEVEL");mod.width=bevel;mod.segments=3
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 for f in o.data.polygons:f.use_smooth=False
 return o
def cyl(name,p,r,depth,m,axis=(0,1,0),verts=32):
 bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=v(p));o=bpy.context.object;o.name=name
 o.rotation_quaternion=Vector((0,0,1)).rotation_difference(v(axis));o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector((0,0,1)).rotation_difference(v(axis))
 o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
 return o
def tube(name,points,r,m):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=12;c.bevel_depth=r;c.bevel_resolution=3
 sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for b,p in zip(sp.bezier_points,points):b.co=v(p);b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(m);return o
def ring(name,p,major,minor,m,axis=(0,1,0)):
 bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=8,major_radius=major,minor_radius=minor,location=v(p))
 o=bpy.context.object;o.name=name;o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector((0,0,1)).rotation_difference(v(axis));o.data.materials.append(m);return o
# Floor: room-specific surfaces with believable transitions and joints.
box("Subfloor",(0,-.04,0),(10.8,.14,8),stone)
for xmin,xmax,zmin,zmax in [(-5.28,-1.47,.68,3.88),(2.74,5.28,1.16,3.88)]:
 for ix in range(math.ceil((xmax-xmin)/.6)):
  for iz in range(math.ceil((zmax-zmin)/.6)):
   l=xmin+ix*.6;rr=min(xmax,l+.6);low=zmin+iz*.6;high=min(zmax,low+.6)
   box("Porcelain tile",((l+rr)/2,.019,(low+high)/2),(rr-l-.003,.022,high-low-.003),tile,.001)
# Wood planks outside wet service rooms.
for row in range(32):
 z=-3.87+row*.245
 for col in range(-1,10):
  x=-4.8+col*1.2+(.6 if row%2 else 0)
  l=max(-5.28,x-.598);rr=min(5.28,x+.598)
  if rr<=l:continue
  if z>.62 and l< -1.4: l=max(l,-1.34)
  if z>1.10 and rr>2.62:rr=min(rr,2.62)
  if rr>l:box("Oak plank",((l+rr)/2,.02,z),(rr-l,.02,.241),oak,.001)
# Walls with genuine window openings.
def wall(name,x,z,sx,sz,y=1.415,sy=2.77):return box(name,(x,y,z),(sx,sy,sz),plaster,.003)
wall("South living below window",-2.65,-3.94,5.3,.12,.43,.80)
wall("South living above window",-2.65,-3.94,5.3,.12,2.53,.57)
wall("South window left pier",-4.77,-3.94,1.06,.12,1.54,1.42)
wall("South window right pier",- .53,-3.94,1.06,.12,1.54,1.42)
wall("South entry west",1.775,-3.94,3.55,.12);wall("South entry east",4.975,-3.94,.85,.12)
wall("West exterior",-5.34,0,.12,8);wall("East exterior",5.34,0,.12,8)
# North wall kitchen window + wall outside.
wall("North kitchen below window",-3.39,3.94,3.9,.12,.64,1.22)
wall("North kitchen above window",-3.39,3.94,3.9,.12,2.65,.30)
wall("North kitchen left pier",-4.75,3.94,1.18,.12,1.88,1.25)
wall("North kitchen right pier",-1.93,3.94,.98,.12,1.88,1.25)
wall("North hall utility",1.97,3.94,6.62,.12)
# Interior partitions from shared authoritative footprints.
for r in DATA['LEVEL']['staticColliders']:
 if any(k in r['id'] for k in ['kitchen-east-wall','kitchen-south-wall','utility-west-wall','utility-south-wall','washroom-west-wall']):
  wall(r['id'],(r['minX']+r['maxX'])/2,(r['minZ']+r['maxZ'])/2,r['maxX']-r['minX'],r['maxZ']-r['minZ'])
  box("Skirting",((r['minX']+r['maxX'])/2,.08,(r['minZ']+r['maxZ'])/2),(r['maxX']-r['minX']+.01,.1,r['maxZ']-r['minZ']+.012),white,.002)
# Ceiling and flush lighting; semantic names retained through export.
box("CEILING_slab",(0,2.825,0),(10.56,.10,7.76),white,.002)
for x,z in [(-3.1,2.3),(-2.8,-1.8),(.7,-1.4),(3.95,2.6),(2.4,.3)]:
 cyl("CEILING_flush_fixture",(x,2.737,z),.18,.045,white)
 cyl("CEILING_diffuser",(x,2.71,z),.148,.011,stone)
def window(name,x,z,width,height,cy):
 box(name+" glazing",(x,cy,z),(width,.99*height,.018),glass,.001)
 for dx in [-width/2,width/2]:box(name+" jamb",(x+dx,cy,z),(.045,height+.06,.09),white)
 for dy in [-height/2,height/2]:box(name+" rail",(x,cy+dy,z),(width,.045,.09),white)
 box(name+" mullion",(x,cy,z),(.035,height,.075),white)
 box(name+" stone sill",(x,cy-height/2-.025,z-.045),(width+.12,.045,.2),stone)
window("Living window",-2.65,-3.94,3.18,1.42,1.54)
window("Kitchen window",-3.2,3.94,1.92,1.25,1.88)
# Open cased doorways: header and trim leave the actual path clear.
box("Kitchen doorway header",(-1.41,2.48,1.76),(.14,.60,1.08),white)
for z in [1.22,2.30]:box("Kitchen jamb",(-1.41,1.12,z),(.17,2.18,.035),white)
box("Utility doorway header",(3.95,2.48,1.10),(1.2,.6,.15),white)
for x in [3.35,4.55]:box("Utility jamb",(x,1.12,1.10),(.035,2.18,.17),white)
# Kitchen: lower cabinets and actual recessed sink.
for x,width in [(-4.25,.96),(-2.15,1.02)]:
 box("Base carcass",(x,.46,3.53),(width,.84,.68),white)
 box("Quartz worktop",(x,.909,3.50),(width+.03,.045,.80),stone)
 for dx in [-width/4,width/4]:
  box("Inset shaker door",(x+dx,.47,3.178),(width/2-.014,.69,.025),white)
  tube("Door pull",[(x+dx-.10,.74,3.153),(x+dx+.10,.74,3.153)],.007,dark)
 box("Toe kick",(x,.087,3.62),(width-.08,.11,.5),dark)
# Open service cavity under sink; no blocking decorative front door.
for x in [-3.64,-2.66]:box("Sink cabinet side",(x,.48,3.48),(.03,.82,.76),white)
box("Sink cabinet bottom",(-3.15,.14,3.48),(1.01,.025,.75),white)
box("Sink cabinet back",(-3.15,.48,3.86),(1.01,.8,.02),white)
for x in [-3.605,-2.695]:box("Sink side countertop",(x,.909,3.48),(.16,.045,.80),stone)
for z,d in [(3.075,.15),(3.76,.16)]:box("Sink countertop rail",(-3.15,.909,z),(.76,.045,d),stone)
# Bowl made from continuous rounded-rectangle rings with a real cavity.
def rectring(wx,wz,y,cx=-3.15,cz=3.35):
 pts=[]
 for i in range(64):
  a=i*2*math.pi/64;c=math.cos(a);s=math.sin(a);pts.append((cx+wx/2*math.copysign(abs(c)**.33,c),y,cz+wz/2*math.copysign(abs(s)**.33,s)))
 return pts
rings=[rectring(.73,.50,.936),rectring(.67,.44,.929),rectring(.61,.38,.73),rectring(.48,.29,.71)]
verts=[v(p) for rr in rings for p in rr];faces=[]
for j in range(3):
 for i in range(64):faces.append((j*64+i,j*64+(i+1)%64,(j+1)*64+(i+1)%64,(j+1)*64+i))
faces.append(tuple(range(192,256)))
me=bpy.data.meshes.new("Sink bowl mesh");me.from_pydata(verts,[],faces);me.materials.append(steel);ob=bpy.data.objects.new("Recessed stainless sink",me);bpy.context.collection.objects.link(ob)
cyl("Drain basket",(-3.15,.716,3.35),.037,.009,dark)
# Arched faucet starts at counter and ends exactly at HOME.faucet.
tube("Faucet gooseneck",[(-3.15,.93,3.72),(-3.15,1.27,3.72),(-3.15,1.31,3.50),(-3.15,1.185,3.34)],.018,chrome)
cyl("Faucet base",(-3.15,.953,3.72),.037,.045,chrome)
cyl("Aerator",(-3.15,1.185,3.34),.021,.025,chrome)
tube("Mixer lever",[(-3.075,.96,3.70),(-3.075,1.07,3.69)],.009,chrome)
# Visible plumbing and shutoff valve support, not a floating wheel.
tube("Supply copper",[(-3.15,.20,3.82),(-3.15,.57,3.82),(-3.15,.57,3.17)],.012,copper)
tube("Braided faucet feed",[(-3.15,.57,3.17),(-2.86,.63,3.40),(-3.11,.85,3.72)],.008,steel)
tube("Sink waste trap",[(-3.15,.71,3.35),(-3.15,.43,3.35),(-3.15,.34,3.61),(-3.15,.44,3.81)],.031,white)
for z in [3.64,3.80]:cyl("Pipe collar",(-3.15,.57,z),.022,.021,steel,(0,0,1))
# Small overflow guide beneath front rim, supported by apron.
box("Sink front apron",(-3.15,.858,3.055),(1.0,.10,.035),steel)
# West worktop: refrigerator + range, both aligned with usable fronts.
fridge_before=set(bpy.context.scene.objects)
box("Fridge body",(-4.77,.97,1.14),(.78,1.88,.65),white,.025)
box("Fridge lower door",(-4.77,.45,.799),(.74,.75,.035),steel,.013)
box("Fridge upper door",(-4.77,1.35,.799),(.74,1.0,.035),steel,.013)
tube("Fridge handle",[(-4.47,1.04,.763),(-4.47,1.67,.763)],.011,dark)
fridge_transform=Matrix.Translation(Vector((-4.90,-1.17,0))) @ Matrix.Rotation(-math.pi/2,4,'Z') @ Matrix.Translation(Vector((4.77,1.14,0)))
for o in set(bpy.context.scene.objects)-fridge_before:o.matrix_world=fridge_transform @ o.matrix_world
box("West base cabinet",(-4.93,.46,2.60),(.64,.85,1.83),white)
box("West quartz top",(-4.93,.91,2.6),(.69,.045,1.86),stone)
box("Induction hob",(-4.91,.941,2.67),(.50,.016,.64),black,.018)
for z in [2.47,2.85]:ring("Hob burner",(-4.91,.952,z),.095,.002,steel)
box("Range hood canopy",(-4.91,1.83,2.67),(.58,.10,.80),steel)
box("Range hood chimney",(-5.10,2.24,2.67),(.27,.72,.40),steel)
box("Oven front",(-4.593,.48,2.67),(.026,.64,.65),steel,.01)
box("Oven window",(-4.575,.44,2.67),(.012,.39,.48),black,.016)
tube("Oven door handle",[(-4.546,.72,2.42),(-4.546,.72,2.92)],.012,dark)
for z in [2.48,2.66,2.84]:cyl("Oven dial",(-4.563,.77,z),.021,.028,dark,(1,0,0))
# Utility room: washing machine under a countertop, shallow wall storage.
box("Washer cabinet",(3.19,.47,3.48),(.70,.88,.68),white,.028)
cyl("Washer rubber surround",(3.19,.48,3.129),.245,.042,dark,(0,0,1))
cyl("Washer glass door",(3.19,.48,3.105),.192,.042,black,(0,0,1))
ring("Washer chrome rim",(3.19,.48,3.085),.215,.011,steel,(0,0,1))
box("Washer controls",(3.19,.81,3.125),(.63,.11,.015),stone)
cyl("Wash programme dial",(3.38,.81,3.101),.035,.026,steel,(0,0,1))
box("Utility worktop",(3.72,.94,3.47),(1.75,.048,.76),oak)
box("Utility tall cabinet",(4.90,1.20,3.36),(.60,2.34,.88),white)
for z in [3.13,3.59]:tube("Utility cabinet handle",[(4.581,1.0,z),(4.581,1.25,z)],.009,dark)
# Tool shelf and pegboard; wrench rests on top, mop held by clips.
box("Tool pegboard",(5.05,1.12,1.95),(.035,1.22,.72),oak)
box("Wrench shelf",(4.79,.805,1.72),(.48,.03,.26),oak)
for z in [1.63,1.82]:tube("Shelf bracket",[(5.0,.65,z),(4.65,.79,z),(5.0,.79,z)],.007,steel)
box("Pesticide shelf",(4.95,.8225,1.43),(.60,.035,.28),oak)
for z in [1.33,1.53]:tube("Pesticide shelf bracket",[(5.19,.67,z),(4.75,.80,z),(5.19,.80,z)],.007,steel)
box("Mop clip wall backplate",(5.025,.95,2.22),(.016,.095,.07),dark,.004)
box("Mop clip support",(5.003,.95,2.22),(.04,.038,.045),dark,.004)
tube("Mop rubber spring clip",[(4.971,.95,2.202),(4.993,.95,2.202),(4.999,.95,2.22),(4.993,.95,2.238),(4.971,.95,2.238)],.005,black)
box("Bucket tray",(3.85,.045,2.55),(.44,.026,.44),stone,.015)
# Living room: coherent seated relationship; sofa faces the TV.
for x in [-3.79,-1.91]:
 for z in [-3.3,-2.70]:cyl("Sofa oak foot",(x,.115,z),.042,.17,oak)
box("Sofa base",(-2.85,.31,-3.0),(2.35,.28,.92),fabric,.065)
box("Sofa back",(-2.85,.70,-3.37),(2.33,.64,.20),fabric,.07)
for x in [-3.92,-1.78]:box("Sofa arm",(x,.56,-3.0),(.22,.58,.96),fabric,.075)
for x in [-3.47,-2.85,-2.23]:
 box("Seat cushion",(x,.49,-2.95),(.60,.19,.71),fabric,.06)
 o=box("Back cushion",(x,.77,-3.25),(.60,.48,.16),fabric,.055);o.rotation_euler.x=-.07
 tube("Seat piping",[(x-.26,.573,-2.62),(x,.579,-2.60),(x+.26,.573,-2.62)],.003,white)
box("Living woven rug",(-2.85,.038,-1.97),(2.8,.01,2.3),rug,.012)
box("Coffee tabletop",(-2.85,.44,-1.75),(1.10,.045,.58),oak,.035)
for x in [-3.27,-2.43]:
 for z in [-1.96,-1.54]:box("Coffee leg",(x,.235,z),(.04,.37,.04),dark,.005)
box("TV console",(-2.8,.285,-.31),(1.84,.47,.42),oak,.02)
for x in [-3.4,-2.8,-2.2]:box("TV console door",(x,.29,-.531),(.58,.39,.025),white,.006)
box("Television frame",(-2.8,1.08,-.30),(1.43,.83,.055),dark,.012)
box("Television screen",(-2.8,1.08,-.334),(1.37,.76,.008),black,.003)
for x in [-3.29,-2.31]:tube("TV feet",[(x,.665,-.31),(x-.06,.534,-.40),(x+.07,.534,-.40)],.012,dark)
# Four tucked chairs; all seats face the table.
box("Dining tabletop",(.75,.77,-1.25),(1.5,.045,.80),oak,.045)
for x in [.13,1.37]:
 for z in [-1.54,-.96]:box("Dining leg",(x,.405,z),(.055,.69,.055),oak)
def chair(x,z,front):
 box("Chair upholstered seat",(x,.46,z),(.40,.06,.40),fabric,.04)
 for dx in [-.16,.16]:
  for dz in [-.16,.16]:box("Chair leg",(x+dx,.235,z+dz),(.035,.41,.035),oak,.004)
 box("Chair back",(x,.71,z-front*.18),(.40,.43,.045),oak,.025)
for x in [.30,1.20]:
 chair(x,-1.99,1);chair(x,-.51,-1)
# Entry bench and cabinet are against wall, no floating panels.
box("Shoe cabinet",(5.04,.60,-2.62),(.38,1.14,1.26),white)
for z in [-2.94,-2.33]:box("Shoe cabinet front",(4.836,.60,z),(.025,1.08,.59),oak)
box("Entry bench",(4.24,.47,-2.78),(.82,.06,.35),oak,.018)
for x in [3.91,4.57]:box("Bench side",(x,.25,-2.78),(.045,.40,.31),dark)
# Closed repair case raises the wrench to a supported, reachable service height.
box("Entry repair case",(4.22,.645,-2.76),(.38,.29,.25),dark,.018)
box("Repair case lid",(4.22,.805,-2.76),(.40,.040,.27),dark,.010)
for x in [4.08,4.36]:box("Repair case latch",(x,.78,-2.618),(.037,.048,.014),steel,.003)
tube("Repair case folding handle",[(4.12,.65,-2.623),(4.12,.70,-2.599),(4.32,.70,-2.599),(4.32,.65,-2.623)],.008,black)
# Small supported domestic objects, deliberately uncluttered.
cyl("Fruit bowl",(.75,.815,-1.25),.13,.045,ceramic)
for x,z in [(.70,-1.25),(.82,-1.26),(.76,-1.17)]:
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.035,location=v((x,.866,z)));bpy.context.object.data.materials.append(mat("Fruit "+str(x),(.52,.20,.08),.4))
box("Cookbook",(-4.22,.956,3.55),(.24,.034,.18),fabric)
cyl("Dish soap",(-2.58,1.025,3.55),.036,.19,ceramic)
cyl("Dish soap pump",(-2.58,1.135,3.55),.022,.036,dark)
# Merge by material but retain cutaway ceiling classification. Curves converted first.
def export(path):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
def merge_static():
 groups={}
 for o in list(bpy.context.scene.objects):
  if o.type=='CURVE':
   bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
  if o.type=='MESH':
   k=("CEILING_" if o.name.startswith("CEILING") else "INTERIOR_")+o.data.materials[0].name
   groups.setdefault(k,[]).append(o)
 for name,objects in groups.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
merge_static()
export(OUT/"home.glb")
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
# Valve head is a compact hex stop in a connected plumbing assembly.
cyl("Stop valve brass body",(0,0,0),.025,.085,copper,(0,0,1),16)
cyl("Stop valve nut",(0,0,-.044),.029,.018,steel,(0,0,1),6)
cyl("Stop valve stem",(0,0,-.065),.012,.024,chrome,(0,0,1))
box("Stop valve handle",(0,0,-.082),(.09,.025,.015),dark,.006)
export(OUT/"valve.glb")
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for r in DATA['LEVEL']['staticColliders']:
 height=2.8 if 'wall' in r['id'] else .91
 o=box("COLLIDER_"+r['id'],((r['minX']+r['maxX'])/2,height/2,(r['minZ']+r['maxZ'])/2),(r['maxX']-r['minX'],height,r['maxZ']-r['minZ']),white,0)
 o['collision']=True
export(OUT/"collision.glb")
print("HOME_V3_EXPORTED",OUT)
