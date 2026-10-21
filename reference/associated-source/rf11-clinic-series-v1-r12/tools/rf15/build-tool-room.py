import ast
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

root = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
output = root / 'public/local-assets/levels/rf15/tool-room-v1'
if list(output.glob('*.glb')):
    raise RuntimeError('Generated version exists; choose a new revision before rebuilding')
output.mkdir(parents=True, exist_ok=True)
textures = output / 'textures'
textures.mkdir(exist_ok=True)
sources = []
texture_cache = {}
definitions = ast.parse((root / 'tools/rf15/real-materials.py').read_text())
exec(compile(ast.Module(body=[node for node in definitions.body if isinstance(node, ast.FunctionDef)], type_ignores=[]), 'rf15-material-functions', 'exec'))
clear()
source = root / 'public/local-assets/levels/rf15/realism-v0.4.3/rf15_final.glb'
bpy.ops.import_scene.gltf(filepath=str(source))
raw = source.read_bytes()
length = int.from_bytes(raw[12:16], 'little')
document = json.loads(raw[20:20+length])
binary = raw[28+length:]
for record in document.get('images', []):
    view = document['bufferViews'][record['bufferView']]
    path = textures / (record.get('name', 'embedded') + ('.jpg' if record['mimeType'] == 'image/jpeg' else '.png'))
    path.write_bytes(binary[view.get('byteOffset', 0):view.get('byteOffset', 0)+view['byteLength']])
    for image in list(bpy.data.images):
        if image.name == record.get('name') or image.name.startswith(record.get('name', 'NONE')+'.'):
            space = image.colorspace_settings.name
            image.filepath = str(path)
            image.reload()
            image.colorspace_settings.name = space
            image.pack()
wood = bpy.data.materials['RF15-oak-PBR']
plaster = bpy.data.materials['RF15-plaster-PBR']
steel = bpy.data.materials['RF15-brushed-steel-PBR']
concrete = bpy.data.materials['RF15-floor-PBR']
roof = bpy.data.materials['RF15-roof-PBR']
green = bpy.data.materials.get('RF15-equipment-green') or material('tool-green', (.065,.15,.10),.48,.2)
rubber = bpy.data.materials.get('RF15-moulded-rubber') or material('tool-rubber',(.035,.041,.033),.7)
clear()

def export(name):
    bpy.ops.export_scene.gltf(filepath=str(output / (name+'.glb')), export_format='GLB', export_yup=True, export_animations=False)
    clear()

for label, size, position in [
    ('west-wall',(.2,3,4.2),(-7,1.5,-12)),('east-wall',(.2,3,4.2),(-1,1.5,-12)),
    ('back-wall',(6,3,.2),(-4,1.5,-14)),('front-left',(2.15,3,.2),(-5.925,1.5,-10)),
    ('front-right',(2.15,3,.2),(-2.075,1.5,-10)),('lintel',(1.7,.45,.2),(-4,2.775,-10))]:
    box(label,size,position,plaster,.015,1.5)
box('concrete-floor',(6.2,.10,4.4),(-4,-.05,-12),concrete,.008,2)
for horizontal in (-4.92,-3.08):
    box('door-jamb',(.11,2.61,.24),(horizontal,1.305,-10),wood,.012,.6)
box('door-header',(1.96,.12,.24),(-4,2.61,-10),wood,.01,.6)
for horizontal in [-6.85+index*.3 for index in range(20)]:
    panel=box('corrugated-roof',(.315,.065,4.6),(horizontal,3.16,-12),roof,.012,1)
    panel.rotation_euler[0]=.05
    box('roof-rib',(.025,.045,4.6),(horizontal,3.20,-12),steel,.006)
for depth in (-14.25,-9.75):
    box('roof-fascia',(6.4,.18,.065),(-4,3.1,depth),wood,.009,1)
for horizontal in (-6.85,-1.15):
    tube('downpipe',[(horizontal,3.02,-9.75),(horizontal,2.87,-9.58),(horizontal,.18,-9.58),(horizontal,.10,-9.4)],.037,steel)
box('tool-bench-top',(5.1,.07,1),(-4,1.0,-13.15),wood,.014,.8)
box('tool-bench-shelf',(5,.045,.84),(-4,.29,-13.15),wood,.009,.8)
for horizontal in (-6.42,-4,-1.58):
    for depth in (-13.55,-12.77):
        box('bench-upright',(.055,.96,.055),(horizontal,.48,depth),steel,.006)
        cylinder('foot',.055,.025,(horizontal,.012,depth),rubber)
box('pegboard',(3.6,1.30,.06),(-4.7,1.97,-13.84),wood,.008,.8)
for horizontal in (-6.25,-5.45,-4.65):
    for height in (1.6,2.15):
        tube('steel-hook',[(horizontal,height+.10,-13.77),(horizontal,height,-13.68),(horizontal,height,-13.62),(horizontal,height+.045,-13.62)],.012,steel)
for horizontal in (-2.3,-1.7):
    cylinder('hoe-handle',.026,1.55,(horizontal,1.2,-13.65),wood)
    box('hoe-blade',(.25,.16,.018),(horizontal,.47,-13.65),steel,.006)
box('supply-shelf',(1.45,.045,.36),(-2.1,1.8,-13.64),wood,.008)
for horizontal in (-2.6,-2.25,-1.9):
    cylinder('tool-oil-bottle',.07,.22,(horizontal,1.935,-13.65),green)
    cylinder('bottle-cap',.04,.035,(horizontal,2.065,-13.65),rubber)
export('room')

for index in range(8):
    box('vertical-door-board',(.208,2.49,.055),(.106+index*.211,1.26,0),wood,.006,.7)
for height in (.35,1.25,2.1):
    box('door-cross-brace',(1.59,.10,.045),(.85,height,-.049),wood,.008,.7)
for height in (.35,2.1):
    box('hinge-strap',(.37,.062,.018),(.18,height,.04),steel,.006)
    cylinder('hinge-pin',.027,.18,(0,height,0),steel)
    for horizontal in (.10,.27):
        cylinder('hinge-rivet',.013,.025,(horizontal,height,.057),steel,'z',12)
for depth in (-.085,.085):
    box('handle-backplate',(.09,.20,.018),(1.55,1.2,depth),steel,.009)
    tube('lever-handle',[(1.55,1.25,depth),(1.55,1.25,depth*1.6),(1.37,1.25,depth*1.6)],.017,steel)
export('door')

cylinder('knife-wood-grip',.026,.17,(0,.025,-.10),wood,'z',32)
cylinder('knife-ferrule',.029,.035,(0,.025,-.002),steel,'z',32)
vertices=[(-.015,.019,0),(.023,.019,0),(.035,.019,.19),(-.02,.019,.26),(-.045,.019,.16)]
mesh=bpy.data.meshes.new('curved-harvest-blade')
mesh.from_pydata([point(position) for position in vertices],[],[(0,1,2,3,4)])
obj=bpy.data.objects.new('curved-harvest-blade',mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(steel)
modifier=obj.modifiers.new('blade-thickness','SOLIDIFY');modifier.thickness=.004
bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=modifier.name)
uv(obj,.3)
export('harvest-knife')

cylinder('trowel-wood-grip',.028,.15,(0,.026,-.10),wood,'z',32)
tube('trowel-neck',[(0,.026,-.03),(0,.026,.03),(0,.038,.07)],.01,steel)
positions=[]
for along in range(9):
    fraction=along/8
    for across in range(9):
        side=across/8*2-1
        positions.append((side*.072*math.sin(math.pi*(fraction*.85+.10)),.009+side*side*.027,.05+fraction*.19))
mesh=bpy.data.meshes.new('concave-trowel-blade')
mesh.from_pydata([point(position) for position in positions],[],[(along*9+across,along*9+across+1,(along+1)*9+across+1,(along+1)*9+across) for along in range(8) for across in range(8)])
obj=bpy.data.objects.new('concave-trowel-blade',mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(steel)
for face in mesh.polygons: face.use_smooth=True
modifier=obj.modifiers.new('steel-thickness','SOLIDIFY');modifier.thickness=.003
bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=modifier.name)
uv(obj,.3)
export('hand-trowel')

tankmat=material('sprayer-translucent-polyethylene',(.60,.69,.51),.46)
cylinder('sprayer-pressure-tank',.14,.36,(0,.21,0),tankmat,vertices=48)
cylinder('sprayer-bottom-ring',.145,.04,(0,.035,0),green,vertices=48)
cylinder('sprayer-top',.12,.065,(0,.415,0),green,vertices=48)
cylinder('pump-shaft',.012,.15,(0,.50,0),steel)
box('pump-handle',(.18,.032,.043),(0,.58,0),rubber,.009)
tube('hose',[(.10,.41,0),(.23,.34,.02),(.26,.14,.03),(.20,.06,.05),(.11,.09,.12)],.011,rubber)
tube('spray-wand',[(.11,.09,.12),(.36,.10,.12),(.43,.12,.12)],.009,steel)
cylinder('sprayer-nozzle',.022,.05,(.44,.12,.12),green,'x')
export('sprayer')
manifest={'revision':'tool-room-v1','source':'Blender precise reconstruction; existing RF15 embedded PBR texture reuse','files':{path.name:hashlib.sha256(path.read_bytes()).hexdigest() for path in output.glob('*.glb')}}
(output/'manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest))
