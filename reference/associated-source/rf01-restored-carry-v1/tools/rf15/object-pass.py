import ast
import hashlib
import json
import math
import random
import shutil
import sys
from pathlib import Path

import bpy
import bmesh
import numpy as np
from mathutils import Vector

root = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
revision = sys.argv[sys.argv.index('--') + 2]
source = root / 'public/local-assets/levels/rf15/realism-v0.3.2'
output = source.parent / revision
if output.exists():
    raise RuntimeError('Output revision already exists')
shutil.copytree(source, output)
textures = output / 'textures'
sources = []
definitions = ast.parse((root / 'tools/rf15/real-materials.py').read_text())
functions = ast.Module(body=[node for node in definitions.body if isinstance(node, ast.FunctionDef)], type_ignores=[])
exec(compile(functions, 'real-materials-functions', 'exec'))
clear()
bpy.ops.import_scene.gltf(filepath=str(source / 'rf15_final.glb'))
embedded = output / 'embedded-source'
embedded.mkdir()
payload = (source / 'rf15_final.glb').read_bytes()
json_length = int.from_bytes(payload[12:16], 'little')
document = json.loads(payload[20:20+json_length])
binary = payload[28+json_length:]
image_files = {}
for index, image_record in enumerate(document.get('images', [])):
    view = document['bufferViews'][image_record['bufferView']]
    suffix = '.jpg' if image_record['mimeType'] == 'image/jpeg' else '.png'
    filename = embedded / f'source-{index}{suffix}'
    filename.write_bytes(binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])
    image_files[image_record.get('name', f'Image_{index}')] = filename
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    for node in mat.node_tree.nodes:
        if node.type != 'TEX_IMAGE' or not node.image:
            continue
        candidates = [name for name in image_files if node.image.name == name or node.image.name.startswith(name+'.')]
        if candidates:
            color_space = node.image.colorspace_settings.name
            node.image = bpy.data.images.load(str(image_files[max(candidates,key=len)]),check_existing=True)
            node.image.colorspace_settings.name = color_space
            node.image.pack()
generator = np.random.default_rng(1504)
random.seed(1504)
wood = bpy.data.materials['RF15-oak-PBR']
steel = bpy.data.materials['RF15-brushed-steel-PBR']
kraft = bpy.data.materials.get('RF15-kraft-PBR') or texture_material('RF15-kraft-PBR', 'public/local-assets/embodiedgen/rf03/models/runtime/generated_textures/kraft_cardboard.png')

def surface(label, color, roughness, metallic=0, strength=.035):
    result = material(label, color, roughness, metallic)
    grain = generator.normal(0, 1, (256, 256))
    pixels = np.clip(np.array(color)[None, None, :] + grain[:, :, None] * strength, .001, .99)
    nodes = result.node_tree.nodes
    shader = nodes.get('Principled BSDF')
    for suffix, data, socket in [('basecolor', pixels, 'Base Color'), ('roughness', np.repeat(np.clip(roughness + grain*.018,.08,.98)[:,:,None],3,axis=2), 'Roughness')]:
        node = nodes.new('ShaderNodeTexImage')
        node.image = data_image(label+'-'+suffix, data)
        result.node_tree.links.new(node.outputs['Color'], shader.inputs[socket])
    return result

paint = surface('RF15-truck-enamel',(.76,.79,.77),.31,.18,.009)
rubber = surface('RF15-moulded-rubber',(.022,.029,.027),.78,0,.006)
graphite = surface('RF15-equipment-ABS',(.047,.058,.057),.48,0,.008)
paper = surface('RF15-paper-form',(.89,.89,.85),.85,0,.015)
red = surface('RF15-fire-red',(.55,.027,.018),.36,.15,.01)
amber = material('RF15-amber-lens',(1,.27,.009),.22)
yellow = surface('RF15-safety-yellow',(.74,.49,.02),.5,.15,.01)
glass = material('RF15-reflective-cab-glass',(.05,.10,.115),.11,.48)
chrome = material('RF15-polished-trim',(.47,.51,.53),.18,.92)
green = surface('RF15-equipment-green',(.035,.14,.083),.43,.3,.008)
soil = surface('RF15-loose-soil',(.28,.18,.09),.94,0,.035)

def erase_region(obj, minimum, maximum):
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    doomed=[]
    for face in mesh.faces:
        center = obj.matrix_world @ face.calc_center_median()
        coordinates = (center.x,center.z,-center.y)
        if all(minimum[axis] <= coordinates[axis] <= maximum[axis] for axis in range(3)):
            doomed.append(face)
    bmesh.ops.delete(mesh, geom=doomed, context='FACES')
    mesh.to_mesh(obj.data)
    mesh.free()

for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH' or obj.name == 'STATIC_shed-wall-shell':
        continue
    if obj.name in ['STATIC_orchard foliage','STATIC_tilled fields','fire-cabinet','fire-label','dock-marker','dock-marker-cap']:
        bpy.data.objects.remove(obj, do_unlink=True)
        continue
    for minimum,maximum in [((3.7,-.01,-6.4),(6.9,3.06,-4.175)), ((1.015,.839,-4.24),(1.29,1.04,-3.99)), ((-.15,.847,-4.2),(.1,1.04,-3.92)), ((-7.4,-.01,4.59),(-6.18,1.07,5.2)), ((-7.83,.38,-6.59),(-7.56,.95,-6.30)), ((-.33,.38,-6.59),(-.07,.95,-6.3))]:
        erase_region(obj,minimum,maximum)
    erase_region(obj,(-8.10,-.01,4.23),(-6.15,.18,5.24))
    erase_region(obj,(-3.6,.005,-2.05),(-.6,.08,1.55))

def mesh_object(label, positions, faces, mat):
    mesh = bpy.data.meshes.new(label)
    mesh.from_pydata([point(position) for position in positions],[],faces)
    mesh.update()
    obj=bpy.data.objects.new(label,mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    mesh_bm=bmesh.new()
    mesh_bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(mesh_bm,faces=list(mesh_bm.faces))
    mesh_bm.to_mesh(mesh)
    mesh_bm.free()
    uv(obj,.6)
    return obj

def torus(label, major, minor, position, mat, axis='y'):
    bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=12,location=point(position),major_radius=major,minor_radius=minor)
    obj=bpy.context.object
    obj.name=label
    if axis=='x': obj.rotation_euler[1]=math.pi/2
    if axis=='z': obj.rotation_euler[0]=math.pi/2
    obj.data.materials.append(mat)
    for face in obj.data.polygons: face.use_smooth=True
    return obj

def plate(label, positions, mat):
    obj=mesh_object(label,positions,[tuple(range(len(positions)))],mat)
    modifier=obj.modifiers.new('sheet-thickness','SOLIDIFY')
    modifier.thickness=.006
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj

def tape_ring(label, outer, inner, depth, position, mat):
    positions=[]
    for radius,offset in [(outer,-depth/2),(outer,depth/2),(inner,-depth/2),(inner,depth/2)]:
        for index in range(48):
            angle=index*math.tau/48
            positions.append((position[0]+radius*math.cos(angle),position[1]+radius*math.sin(angle),position[2]+offset))
    faces=[]
    for first,second in [(0,1),(1,3),(3,2),(2,0)]:
        for index in range(48):
            following=(index+1)%48
            faces.append((first*48+index,first*48+following,second*48+following,second*48+index))
    obj=mesh_object(label,positions,faces,mat)
    for index,polygon in enumerate(obj.data.polygons): polygon.use_smooth=index//48 in (0,2)
    return obj

profile=[(-6.03,.72),(-6.03,1.53),(-5.84,2.31),(-5.68,2.44),(-4.44,2.44),(-4.39,.72)]
positions=[(5.3+side*1.09,height,depth) for side in (-1,1) for depth,height in profile]
count=len(profile)
faces=[tuple(range(count)),tuple(range(count,2*count))]+[(index,(index+1)%count,(index+1)%count+count,index+count) for index in range(count)]
cab=mesh_object('REFINED_truck-cab',positions,faces,paint)
cutter=cylinder('wheel-arch-cut',.505,2.5,(5.3,.42,-5.10),rubber,'x',64)
modifier=cab.modifiers.new('real-wheel-arch','BOOLEAN')
modifier.operation='DIFFERENCE'
modifier.object=cutter
bpy.context.view_layer.objects.active=cab
bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.data.objects.remove(cutter,do_unlink=True)
modifier=cab.modifiers.new('pressed-cab-edges','BEVEL')
modifier.width=.038
modifier.segments=4
bpy.ops.object.modifier_apply(modifier=modifier.name)
box('REFINED_truck-front-bulkhead',(2.32,2,.06),(5.3,2.02,-4.19),paint,.02)
plate('REFINED_windscreen-seal',[(4.31,1.60,-6.022),(6.29,1.60,-6.022),(6.23,2.28,-5.858),(4.37,2.28,-5.858)],rubber)
plate('REFINED_windscreen',[(4.37,1.65,-6.019),(6.23,1.65,-6.019),(6.17,2.22,-5.881),(4.43,2.22,-5.881)],glass)
for side in (-1,1):
    horizontal=5.3+side*1.095
    plate('REFINED_side-window-seal',[(horizontal,1.57,-5.95),(horizontal,2.28,-5.76),(horizontal,2.28,-4.61),(horizontal,1.57,-4.61)],rubber)
    plate('REFINED_side-window',[(horizontal+side*.008,1.62,-5.89),(horizontal+side*.008,2.23,-5.72),(horizontal+side*.008,2.23,-4.68),(horizontal+side*.008,1.62,-4.68)],glass)
    tube('REFINED_door-seam',[(horizontal+side*.01,.94,-4.52),(horizontal+side*.01,2.31,-4.52),(horizontal+side*.01,2.34,-5.67)],.006,rubber)
    tube('REFINED_quarter-glass-divider',[(horizontal+side*.02,1.59,-5.65),(horizontal+side*.02,2.29,-5.65)],.012,rubber)
    box('REFINED_recessed-door-handle',(.025,.075,.21),(horizontal+side*.014,1.38,-4.75),rubber,.018)
    box('REFINED_door-handle-grip',(.04,.025,.14),(horizontal+side*.027,1.393,-4.75),chrome,.01)
    tube('REFINED_mirror-arm',[(horizontal,1.54,-5.73),(horizontal+side*.20,1.64,-5.86),(horizontal+side*.20,2.02,-5.86)],.017,rubber)
    box('REFINED_mirror-housing',(.12,.32,.19),(horizontal+side*.22,1.98,-5.87),graphite,.04)
    box('REFINED_mirror-glass',(.112,.28,.012),(horizontal+side*.22,1.98,-5.762),chrome,.025)
    torus('REFINED_front-tire',.30,.113,(5.3+side*1.07,.42,-5.1),rubber,'x')
    cylinder('REFINED_front-rim',.224,.25,(5.3+side*1.07,.42,-5.1),steel,'x',48)
    cylinder('REFINED_front-hub',.088,.265,(5.3+side*1.073,.42,-5.1),chrome,'x',32)
    for bolt in range(6):
        angle=bolt*math.tau/6
        cylinder('REFINED_wheel-lug',.016,.014,(5.3+side*1.21,.42+math.sin(angle)*.124,-5.1+math.cos(angle)*.124),chrome,'x',12)
    for tread in range(40):
        angle=tread*math.tau/40
        block=box('REFINED_tire-tread',(.15,.009,.024),(5.3+side*1.07,.42+.412*math.cos(angle),-5.1+.412*math.sin(angle)),rubber,.002)
        block.rotation_euler[0]=angle
    box('REFINED_headlight-bezel',(.39,.24,.045),(5.3+side*.79,1.12,-6.055),graphite,.035)
    box('REFINED_headlight-reflector',(.335,.18,.055),(5.3+side*.79,1.125,-6.076),chrome,.028)
    for rib in range(12): box('REFINED_headlight-lens-rib',(.012,.15,.008),(5.3+side*.79+(rib-5.5)*.025,1.125,-6.109),paper,.004)
    box('REFINED_indicator-lens',(.13,.08,.036),(5.3+side*.94,1.35,-6.055),amber,.012)
    box('REFINED_cab-step',(.2,.07,.48),(5.3+side*1.06,.60,-4.66),graphite,.02)
box('REFINED_front-bumper',(2.23,.2,.15),(5.3,.79,-6.09),graphite,.045)
box('REFINED_grille-recess',(1.2,.28,.034),(5.3,1.20,-6.055),rubber,.025)
for rib in range(6): box('REFINED_grille-slats',(1.12,.018,.02),(5.3,1.08+rib*.045,-6.08),steel,.005)
for offset in (-.52,.40):
    tube('REFINED_wiper-arm',[(5.3+offset,1.55,-6.045),(5.3+offset+.2,1.80,-6.00)],.009,graphite)
    tube('REFINED_wiper-blade',[(5.3+offset-.10,1.81,-6.015),(5.3+offset+.44,1.81,-6.015)],.014,rubber)
box('REFINED_refrigeration-case',(1.30,.48,.47),(5.3,2.79,-4.43),paint,.08)
for offset in (-.33,.33):
    cylinder('REFINED_condenser-cavity',.175,.018,(5.3+offset,2.8,-4.674),rubber,'z',48)
    for ring in (.06,.10,.14,.17): torus('REFINED_fan-guard',ring,.005,(5.3+offset,2.8,-4.692),steel,'z')
    for angle in range(0,360,45):
        radians=math.radians(angle)
        tube('REFINED_fan-spoke',[(5.3+offset,2.8,-4.70),(5.3+offset+.174*math.cos(radians),2.8+.174*math.sin(radians),-4.70)],.004,steel)

box('REFINED_label-printer-base',(.23,.055,.19),(1.15,.869,-4.12),graphite,.018)
box('REFINED_label-printer-lid',(.218,.108,.18),(1.15,.945,-4.125),paint,.028)
box('REFINED_printer-lid-seam',(.223,.009,.18),(1.15,.918,-4.126),rubber,.003)
box('REFINED_printer-output-slot',(.158,.019,.018),(1.15,.901,-4.020),rubber,.004)
box('REFINED_printed-label',(.13,.001,.10),(1.15,.887,-3.967),paper,.0003)
for index in range(28):
    box('REFINED_label-barcode',(.0015+(index%3)*.001,.0004,.034),(1.10+index*.0037,.888,-3.966),graphite,0)
cylinder('REFINED_printer-status-led',.006,.003,(1.213,1.001,-4.12),green)
for index in range(6): box('REFINED_printer-vent',(.003,.031,.055),(1.261,.943,-4.12+(index-2.5)*.009),rubber,.001)
tape_ring('REFINED_tape-roll',.077,.045,.054,(-.035,.935,-4.035),kraft)
tape_ring('REFINED_tape-core',.045,.040,.055,(-.035,.935,-4.035),paper)
box('REFINED_tape-dispenser-base',(.20,.028,.075),(-.005,.861,-4.037),green,.009)
for side in (-1,1):
    box('REFINED_tape-dispenser-cheek',(.012,.072,.065),(-.035+side*.075,.895,-4.035),green,.009)
box('REFINED_tape-cutter',(.022,.018,.075),(.09,.90,-4.035),steel,.002)
for index in range(10): cylinder('REFINED_cutter-tooth',.002,.005,(.088,.909,-4.067+index*.007),steel,vertices=6)

box('REFINED_dispatch-top',(1.1,.055,.55),(-6.8,.9725,4.9),wood,.014)
for side in (-1,1):
    for end in (-1,1):
        box('REFINED_dispatch-tube-leg',(.045,.92,.045),(-6.8+side*.48,.47,4.9+end*.20),steel,.004)
        cylinder('REFINED_dispatch-foot',.032,.035,(-6.8+side*.48,.018,4.9+end*.20),rubber)
    box('REFINED_dispatch-lower-rail',(.035,.04,.45),(-6.8+side*.48,.24,4.9),green,.005)
box('REFINED_dispatch-back-rail',(.98,.05,.03),(-6.8,.24,5.10),green,.005)
box('REFINED_clipboard',(.30,.009,.38),(-6.8,1.005,4.9),kraft,.007)
box('REFINED_dispatch-form',(.27,.001,.33),(-6.8,1.010,4.91),paper,.0001)
box('REFINED_clipboard-clip',(.10,.014,.028),(-6.8,1.02,4.73),chrome,.008)
for index in range(10):
    box('REFINED_form-row',(.235,.0004,.001),(-6.8,1.011,4.78+index*.025),graphite,0)
for horizontal in (-6.91,-6.83,-6.74,-6.68): box('REFINED_form-column',(.001,.0004,.255),(horizontal,1.011,4.895),graphite,0)
cylinder('REFINED_pen',.004,.14,(-6.58,1.01,4.91),graphite,'z',16)

for horizontal in (-7.7,-.2):
    cylinder('REFINED_fire-extinguisher',.083,.36,(horizontal,.63,-6.45),red,vertices=48)
    torus('REFINED_extinguisher-base',.069,.013,(horizontal,.45,-6.45),rubber)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1,location=point((horizontal,.81,-6.45)))
    obj=bpy.context.object;obj.name='REFINED_extinguisher-shoulder';obj.scale=(.083,.083,.054);obj.data.materials.append(red)
    cylinder('REFINED_extinguisher-valve',.023,.06,(horizontal,.859,-6.45),chrome)
    box('REFINED_extinguisher-handle',(.12,.016,.031),(horizontal,.892,-6.45),graphite,.005)
    cylinder('REFINED_pressure-gauge',.023,.015,(horizontal,.864,-6.408),chrome,'z',24)
    cylinder('REFINED_gauge-face',.018,.017,(horizontal,.864,-6.407),paper,'z',24)
    tube('REFINED_extinguisher-hose',[(horizontal+.035,.86,-6.45),(horizontal+.115,.82,-6.45),(horizontal+.12,.52,-6.45),(horizontal+.09,.47,-6.42)],.012,rubber)
    box('REFINED_fire-instructions',(.09,.18,.003),(horizontal,.637,-6.365),paper,.003)
    for index in range(6): box('REFINED_fire-label-line',(.067,.004,.001),(horizontal,.69-index*.019,-6.362),graphite,0)

for horizontal in (3.9,6.7):
    cylinder('REFINED_safety-post',.065,.56,(horizontal,.28,2.48),yellow,vertices=32)
    cylinder('REFINED_safety-post-cap',.068,.03,(horizontal,.574,2.48),rubber)
    box('REFINED_post-base',(.22,.022,.20),(horizontal,.012,2.48),steel,.012)
    for height in (.18,.40): cylinder('REFINED_post-reflective-band',.066,.055,(horizontal,height,2.48),paper,vertices=32)
    for side in (-1,1):
        for end in (-1,1): cylinder('REFINED_post-anchor',.009,.018,(horizontal+side*.077,.03,2.48+end*.069),chrome,vertices=8)

leaf_material=surface('RF15-cabbage-leaf',(.10,.22,.045),.77,0,.01)
leaf_grid=np.linspace(0,1,256)
horizontal_grid,vertical_grid=np.meshgrid(leaf_grid,leaf_grid)
veins=np.exp(-((horizontal_grid-.5)*75)**2)+.35*np.exp(-(np.sin((vertical_grid+abs(horizontal_grid-.5)*.8)*math.pi*12)*13)**2)
leaf_pixels=np.stack([.18+veins*.06,.36+veins*.08,.08+veins*.035],axis=2)
shader=leaf_material.node_tree.nodes.get('Principled BSDF')
node=leaf_material.node_tree.nodes.new('ShaderNodeTexImage');node.image=data_image('leaf-vein-basecolor',leaf_pixels)
leaf_material.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
box('REFINED_field-earth',(10,.036,17.1),(16.5,-.006,-2),soil,.015,.5)
for row in range(13):
    horizontal=12+row*.75
    box('REFINED_earth-bed',(.60,.075,16.9),(horizontal,.005,-2),soil,.035,.4)
    for plant in range(16):
        depth=-9+plant*.92+random.uniform(-.10,.10)
        for leaf_index in range(8):
            angle=leaf_index*2.4+random.uniform(-.15,.15)
            length=random.uniform(.20,.33)
            positions=[]
            coords=[]
            for along in range(9):
                fraction=along/8
                width=math.sin(math.pi*fraction)**.65*length*.48
                for across in range(5):
                    side=across/4*2-1
                    radial=fraction*length
                    sideways=side*width
                    height=.08+math.sin(fraction*math.pi*.82)*(.10 if leaf_index<5 else .23)+side**2*.023
                    positions.append((horizontal+random.uniform(-.002,.002)+radial*math.cos(angle)+sideways*math.sin(angle),height,depth+radial*math.sin(angle)-sideways*math.cos(angle)))
                    coords.append((across/4,fraction))
            faces=[(along*5+across,(along+1)*5+across,(along+1)*5+across+1,along*5+across+1) for along in range(8) for across in range(4)]
            obj=mesh_object('REFINED_cabbage-leaf',positions,faces,leaf_material)
            for polygon in obj.data.polygons:
                polygon.use_smooth=True
                for loop in polygon.loop_indices: obj.data.uv_layers.active.data[loop].uv=coords[obj.data.loops[loop].vertex_index]

box('REFINED_drain-channel',(7.5,.004,.24),(-3.3,.003,1.4),rubber,.001)
for depth in (1.28,1.52): box('REFINED_drain-frame',(7.52,.007,.018),(-3.3,.004,depth),steel,.001)
for index in range(126): box('REFINED_drain-grating',(.014,.008,.224),(-7.05+index*.06,.004,1.4),steel,.001)
box('REFINED_warehouse-roller-door',(.025,2.7,2.3),(-.981,1.39,-12),steel,.012)
for depth in (-13.20,-10.80): box('REFINED_warehouse-door-guide',(.07,2.8,.07),(-.95,1.4,depth),green,.008)
for index in range(28): box('REFINED_roller-door-seam',(.029,.012,2.3),(-.961,.1+index*.095,-12),graphite,.002)
box('REFINED_warehouse-door-header',(.09,.17,2.5),(-.945,2.81,-12),green,.009)
box('REFINED_warehouse-service-door',(.94,2.1,.026),(-5.5,1.06,-9.98),green,.018)
box('REFINED_service-door-handle',(.11,.025,.065),(-5.17,1.02,-9.94),chrome,.008)
box('REFINED_warehouse-window-frame',(1.5,.8,.045),(-2.6,2.06,-9.97),steel,.012)
box('REFINED_warehouse-window',(1.41,.71,.018),(-2.6,2.06,-9.94),glass,.005)
box('REFINED_window-mullion',(.036,.73,.024),(-2.6,2.06,-9.922),steel,.004)
box('REFINED_rear-vent-frame',(.9,.55,.03),(-4.8,2.1,-14.02),steel,.009)
for index in range(9): box('REFINED_rear-vent-louvre',(.85,.025,.05),(-4.8,1.87+index*.055,-14.041),graphite,.005)
for horizontal in (-7.035,-.965): box('REFINED_warehouse-corner-flashing',(.035,3.24,4),(horizontal,1.62,-12),steel,.002)
for depth in (-14.10,-9.90): box('REFINED_warehouse-eaves',(6.3,.08,.09),(-4,3.24,depth),steel,.012)

cardinal_fire = root / 'public/local-assets/levels/rf15/cardinal-reuse/fire-safety-decoded.glb'
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=str(cardinal_fire))
fire_objects = [obj for obj in set(bpy.context.scene.objects)-before if obj.type == 'MESH']
for obj in fire_objects:
    if len(obj.data.polygons)>24000:
        bpy.context.view_layer.objects.active=obj
        modifier=obj.modifiers.new('cabinet-browser-budget','DECIMATE')
        modifier.ratio=24000/len(obj.data.polygons)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    coordinates = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    minimum = Vector([min(vertex[axis] for vertex in coordinates) for axis in range(3)])
    maximum = Vector([max(vertex[axis] for vertex in coordinates) for axis in range(3)])
    mesh=bmesh.new();mesh.from_mesh(obj.data)
    cutoff=minimum.z+(maximum.z-minimum.z)*.10
    doomed=[face for face in mesh.faces if max((obj.matrix_world@vertex.co).z for vertex in face.verts)<cutoff]
    bmesh.ops.delete(mesh,geom=doomed,context='FACES');mesh.to_mesh(obj.data);mesh.free()
    coordinates=[obj.matrix_world@vertex.co for vertex in obj.data.vertices]
    minimum.z=min(vertex.z for vertex in coordinates)
    scale = .78/(maximum.z-minimum.z)
    placement=(-8.38+(maximum.x-minimum.x)*scale/2,1.2,-3.0)
    for vertex, value in zip(obj.data.vertices,coordinates):
        centered = value - Vector(((minimum.x+maximum.x)/2,(minimum.y+maximum.y)/2,minimum.z))
        vertex.co = centered*scale+Vector(point(placement))
    obj.matrix_world.identity()
    obj.name='CARDINAL_fire-cabinet'
export('rf15_final.glb')
manifest=json.loads((source/'manifest.json').read_text())
manifest.update(revision=revision,sourceRevision=source.name,status='internal-review',cardinalService='unreachable; no new task submitted',objectPass=['truck cabin and cooler','label printer','hollow tape roll','dispatch desk and form','fire extinguishers','safety bollards','leaf geometry and soil'])
manifest['reusedCardinal']=[{'source':'public/local-assets/cardinal/rf01/models/runtime/rf01_fire_safety_station.glb','sha256':hashlib.sha256((root/'public/local-assets/cardinal/rf01/models/runtime/rf01_fire_safety_station.glb').read_bytes()).hexdigest(),'target':'wall fire cabinet','method':'meshopt decode, uniform scale and orientation fit'}]
manifest['assets']=[]
for filename in sorted(output.glob('*.glb')):
    payload=filename.read_bytes()
    manifest['assets'].append({'id':filename.stem,'runtimePath':str(filename.relative_to(root)),'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest()})
(output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
wall=json.loads((output/'wall-validation.json').read_text())
wall.update(revision=revision,source=source.name,requiredAssetHashes={entry['id']:entry['sha256'] for entry in manifest['assets']})
(output/'wall-validation.json').write_text(json.dumps(wall,indent=2)+'\n')
assert (output/'rf15_collision.glb').read_bytes()==(source/'rf15_collision.glb').read_bytes()
print('RF15_OBJECT_PASS',revision)
