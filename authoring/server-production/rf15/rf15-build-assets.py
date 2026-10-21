import bpy
from mathutils import Vector
from pathlib import Path
import json
import math
import random
import hashlib

root = Path('.')
production = Path('./authoring/server-production/rf15/v0.2')
output = root / 'public/local-assets/levels/rf15/realism-v0.2.2'
output.mkdir(parents=True, exist_ok=True)
layout = json.loads((production / 'layout.json').read_text())
random.seed(15)
def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
def material(name, color, roughness=0.65, metal=0):
    result = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metal
    return result
def texture_material(name, asset):
    result = material(name, (0.65, 0.66, 0.62))
    directory = root / 'public/local-assets/polyhaven/rf01/textures' / asset
    shader = result.node_tree.nodes.get('Principled BSDF')
    for suffix, socket in [('diff', 'Base Color'), ('rough', 'Roughness'), ('nor_gl', None)]:
        matches = list(directory.glob(f'*_{suffix}_2k.*')) or list(directory.glob(f'*_{suffix}_4k.*'))
        if not matches:
            continue
        image = bpy.data.images.load(str(matches[0]), check_existing=True)
        if max(image.size) > 1024:
            image.scale(1024, 1024)
        image.pack()
        node = result.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = image
        if socket == 'Base Color':
            result.node_tree.links.new(node.outputs['Color'], shader.inputs[socket])
        elif socket:
            image.colorspace_settings.name = 'Non-Color'
            result.node_tree.links.new(node.outputs['Color'], shader.inputs[socket])
        else:
            image.colorspace_settings.name = 'Non-Color'
            normal = result.node_tree.nodes.new('ShaderNodeNormalMap')
            normal.inputs['Strength'].default_value = 0.32
            result.node_tree.links.new(node.outputs['Color'], normal.inputs['Color'])
            result.node_tree.links.new(normal.outputs['Normal'], shader.inputs['Normal'])
    return result
def point(position):
    return (position[0], -position[2], position[1])
def uv_meters(obj, tile=2):
    layer = obj.data.uv_layers.active
    if not layer:
        return
    for polygon in obj.data.polygons:
        axis = max(range(3), key=lambda index: abs(polygon.normal[index]))
        axes = [index for index in range(3) if index != axis]
        for loop in polygon.loop_indices:
            vertex = obj.matrix_world @ obj.data.vertices[obj.data.loops[loop].vertex_index].co
            layer.data[loop].uv = (vertex[axes[0]] / tile, vertex[axes[1]] / tile)
def box(name, size, position, mat, bevel=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=point(position))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    uv_meters(obj)
    if bevel:
        modifier = obj.modifiers.new('manufactured edge', 'BEVEL')
        modifier.width = min(bevel, min(size) / 4)
        modifier.segments = 2
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj
def cylinder(name, radius, depth, position, mat, axis='y', vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=point(position))
    obj = bpy.context.object
    obj.name = name
    if axis == 'x': obj.rotation_euler[1] = math.pi / 2
    if axis == 'z': obj.rotation_euler[0] = math.pi / 2
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons: polygon.use_smooth = len(polygon.vertices) == 4
    return obj
def beam(name, start, end, radius, mat):
    origin = Vector(point(start)); target = Vector(point(end))
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=radius, depth=(target-origin).length, location=(origin+target)/2)
    obj = bpy.context.object; obj.name = name
    obj.rotation_euler = (target-origin).to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(mat)
    return obj
font = bpy.data.fonts.load('/usr/share/fonts/opentype/unifont/unifont.otf')
def text(name, value, position, size, mat, yaw=0):
    curve = bpy.data.curves.new(name, 'FONT'); curve.body = value; curve.size = size; curve.align_x = 'CENTER'; curve.font = font
    curve.extrude = 0.0004
    obj = bpy.data.objects.new(name, curve); bpy.context.collection.objects.link(obj)
    obj.location = point(position); obj.rotation_euler = (math.pi/2, 0, -yaw); obj.data.materials.append(mat)
    return obj
def export(name, merge=False):
    bpy.ops.object.select_all(action='SELECT')
    for obj in list(bpy.context.selected_objects):
        if obj.type == 'FONT':
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target='MESH')
    if merge:
        groups = {}
        for obj in list(bpy.context.scene.objects):
            if obj.type == 'MESH' and len(obj.data.materials) == 1:
                groups.setdefault(obj.data.materials[0].name, []).append(obj)
        for label, objects in groups.items():
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objects: obj.select_set(True)
            bpy.context.view_layer.objects.active = objects[0]
            if len(objects) > 1: bpy.ops.object.join()
            objects[0].name = 'STATIC_' + label
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(output / (name+'.glb')), export_format='GLB', use_selection=True, export_extras=True, export_yup=True, export_animations=False, export_cameras=False, export_lights=False, export_image_format='AUTO')

clear()
cream = material('limewashed warm walls', (0.69, 0.68, 0.55), 0.88)
green = material('cooperative green enamel', (0.09, 0.23, 0.17), 0.42, 0.45)
steel = material('brushed galvanized metal', (0.44, 0.49, 0.49), 0.38, 0.8)
dark = material('rubber and graphite', (0.018, 0.025, 0.026), 0.77)
white = material('refrigerated vehicle white', (0.88, 0.88, 0.80), 0.31, 0.22)
wood = material('packing bench beech', (0.42, 0.25, 0.115), 0.76)
yellow = material('ochre safety paint', (0.91, 0.57, 0.035), 0.7)
brick = material('brick skirting', (0.31, 0.25, 0.19), 0.9)
concrete = texture_material('worn depot concrete', 'hangar_concrete_floor')
asphalt = texture_material('yard asphalt', 'aerial_asphalt_01')
roof = material('ribbed galvanized canopy', (0.38, 0.43, 0.41), 0.43, 0.7)
skylight = material('translucent polycarbonate roof', (0.60, 0.76, 0.73), 0.36, 0.12)
skylight.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value = 0.24
skylight.surface_render_method = 'DITHERED'
glass = material('blue tinted cab glass', (0.1, 0.21, 0.23), 0.16, 0.42)
red = material('rear lamp red', (0.6, 0.025, 0.012), 0.28)
orange = material('indicator amber', (0.95, 0.34, 0.015), 0.26)
soil = material('tilled fields', (0.22, 0.19, 0.10), 1)
foliage = material('orchard foliage', (0.12, 0.23, 0.095), 0.94)

box('yard-ground', [44, 0.16, 40], [0, -0.09, 1], asphalt, 0)
box('packing-shed-slab', [10.7, 0.06, 9.4], [-3.25, -0.03, -2.3], concrete, 0)
for structure in layout['STRUCTURES']:
    if structure['id'] in ['west-wall', 'north-wall']:
        box(structure['id'], structure['size'], structure['position'], cream)
        size = structure['size'].copy(); size[1] = 0.68
        position = structure['position'].copy(); position[1] = 0.34
        box(structure['id']+'-base', size, position, brick)
    if structure['id'].startswith('shed-post'):
        box(structure['id'], structure['size'], structure['position'], green)
        position=structure['position']; box('post-foot', [.33,.12,.33], [position[0],.06,position[2]], steel)
for x in [-8.4, -3.2, 2]:
    box('back-column', [.16,4.6,.16], [x,2.3,-6.5], green)
    beam('canopy-upper-chord', [x,4.58,-6.5], [x,4.2,1.8], .07, green)
    beam('canopy-lower-chord', [x,3.82,-6.5], [x,3.82,1.8], .045, green)
    for z in [-6,-4,-2,0]: beam('truss-diagonal', [x,3.82,z], [x,4.27,z+1.6], .024, steel)
for z in [-6.5,-4.3,-2.1,0,1.8]:
    box('roof-purlin', [10.7,.11,.075], [-3.2,4.26,z], green)
for x in [-7.75,-6.45,-5.15,-3.85,-2.55,-1.25,.05,1.35]:
    box('canopy-rear-sheet', [1.26,.06,3.5], [x,4.49,-5.02], roof)
    box('canopy-front-eave', [1.26,.06,.72], [x,4.21,1.6], roof)
    box('canopy-skylight-panel', [1.26,.025,4.50], [x,4.30,-1.02], skylight, 0)
    for offset in [-.55,-.28,0,.28,.55]:
        box('roof-sheet-rib',[.025,.037,3.5],[x+offset,4.532,-5.02],roof,.008)
        box('skylight-rib',[.015,.027,4.5],[x+offset,4.326,-1.02],skylight,.005)
for x in [-8.4,2]:
    cylinder('rainwater-downpipe', .042, 4.2, [x+.13,2.1,1.9], steel)
box('front-sign', [6.5,.54,.06], [-3.3,3.91,1.86], green)
text('cooperative-name', '乡野合作社 · 冷链装运站', [-3.3,3.79,1.90], .3, white)
text('cooperative-subtitle', 'HARVEST  /  WEIGH  /  PACK  /  LOAD', [-3.3,3.50,1.9], .12, white)
box('intake-board', [3.4,.43,.04], [-5.9,1.98,-5.95], green)
text('intake-caption', '01  收货 · 新鲜农产品', [-5.9,1.87,-5.918], .20, white)
for x,z,width,height,depth in [(-5.9,-4.2,3.4,.82,1.0),(-2.6,-4.2,1.4,.76,1.1),(.6,-3.8,2.1,.84,1.2)]:
    box('bench-top', [width,.065,depth], [x,height-.0325,z], wood if x != -2.6 else steel)
    box('bench-lower-shelf', [width-.12,.035,depth-.12], [x,.23,z], wood)
    for sideX in [-1,1]:
        for sideZ in [-1,1]: box('bench-leg', [.06,height-.06,.06], [x+sideX*(width/2-.09),(height-.06)/2,z+sideZ*(depth/2-.08)], green)
    for offset in [-.4,0,.4]: box('bench-wood-grain', [width-.08,.001,.008], [x,height+.001,z+offset*depth], brick, 0)
for x,title in [(-2.6,'02  电子称重'),(.6,'03  装箱封签')]:
    box('station-sign', [1.4,.3,.035], [x,1.60,-4.84], green)
    text('station-caption',title,[x,1.5,-4.817],.16,white)
for index in range(8):
    box('flat-cardboard', [.65,.018,.47], [1.22,.25+index*.019,-3.8], wood)
cylinder('tape-roll',.095,.054,[-.04,.90,-4.05],yellow,axis='z')
box('tape-dispenser', [.16,.09,.065], [-.04,.884,-4.09], green)
box('label-printer', [.22,.13,.18], [1.15,.905,-4.12], white)
box('printer-slot', [.15,.012,.02], [1.15,.94,-4.018], dark)
for layer in range(3):
    for offset in [-.36,.36]:
        for side in [-1,1]: box('stack-crate-side',[.58,.32,.026],[-7.4+offset,.16+layer*.35,-1.3+side*.22],green)
        for side in [-1,1]: box('stack-crate-end',[.026,.32,.44],[-7.4+offset+side*.29,.16+layer*.35,-1.3],green)
        box('stack-crate-bottom',[.58,.025,.44],[-7.4+offset,.025+layer*.35,-1.3],green)
for z in [-5.5,-3.5,-1.5,.5]:
    box('bay-line', [.07,.008,1.2], [3.6,.005,z], yellow, 0)
    box('bay-line', [.07,.008,1.2], [7,.005,z], yellow, 0)
box('tail-clearance-line',[3.1,.008,.09],[5.3,.005,2.32],yellow,0)
for x in [4,4.5,5,5.5,6,6.5]:
    stripe=box('tail-warning-hatch',[.09,.009,.58],[x,.006,2.01],yellow,0);stripe.rotation_euler[2]=.55
for z in [-6,-3,0,3,6]:
    box('yard-curb',[.16,.18,2.9],[8.75,.06,z],cream)
box('south-curb',[17.5,.18,.16],[0,.06,7.65],cream)
box('dispatch-desk',[1.1,.07,.55],[-6.8,.965,4.9],wood)
for x in [-7.25,-6.35]:box('dispatch-leg',[.08,.93,.47],[x,.465,4.9],green)
box('dispatch-clipboard',[.29,.02,.36],[-6.8,1.012,4.9],white)
box('dispatch-sign',[1.15,.29,.03],[-6.8,1.45,5.1],green)
text('dispatch-caption','出库记录 · 2 箱 / 18 kg',[-6.8,1.35,5.074],.115,white,math.pi)

truckX=5.3
box('truck-chassis',[2.1,.20,5.9],[truckX,.64,-3],dark)
box('cargo-floor',[2.4,.16,4.2],[truckX,.92,-2.06],steel)
for side in [-1,1]:
    box('insulated-side',[.11,2.04,4.2],[truckX+side*1.17,2.02,-2.06],white)
    box('lower-green-band',[.015,.35,4.15],[truckX+side*1.232,1.40,-2.06],green)
    for z in [-4,-2.5,-1,.02]:
        box('truck-side-frame',[.025,2.08,.027],[truckX+side*1.24,2.03,z],steel)
    box('cargo-internal-rail',[.022,.06,4],[truckX+side*1.10,1.45,-2.06],steel)
box('cargo-front',[2.4,2.08,.1],[truckX,2.02,-4.13],white)
box('cargo-roof',[2.4,.10,4.3],[truckX,3.11,-2.06],white)
box('truck-cab',[2.26,1.85,1.63],[truckX,1.495,-5.19],white,.12)
box('cab-windscreen',[1.93,.71,.045],[truckX,1.98,-6.027],glass,.045)
box('cab-front-grille',[1.6,.34,.036],[truckX,1.15,-6.045],dark,.02)
for offset in [-.1,0,.1]:box('grille-slat',[1.55,.025,.04],[truckX,1.15+offset,-6.07],steel)
box('front-bumper',[2.28,.16,.16],[truckX,.82,-6.02],steel,.04)
for side in [-1,1]:
    box('headlight',[.3,.22,.035],[truckX+side*.94,1.14,-6.05],white)
    box('indicator',[.12,.08,.025],[truckX+side*1.04,1.38,-6.05],orange)
    box('cab-side-window',[.035,.66,1.0],[truckX+side*1.137,1.98,-5.29],glass,.035)
    box('door-handle',[.035,.035,.16],[truckX+side*1.16,1.54,-4.9],dark)
    beam('mirror-arm',[truckX+side*1.10,1.8,-5.8],[truckX+side*1.38,1.95,-5.8],.018,dark)
    box('side-mirror',[.08,.24,.16],[truckX+side*1.4,1.98,-5.8],dark)
    for z in [-5.1,-1.3]:
        cylinder('tire',.41,.27,[truckX+side*1.065,.42,z],dark,axis='x',vertices=32)
        cylinder('wheel-hub',.235,.28,[truckX+side*1.075,.42,z],steel,axis='x')
        for angle in range(0,360,60):
            radians=math.radians(angle)
            cylinder('wheel-lug',.025,.018,[truckX+side*1.23,.42+math.sin(radians)*.14,z+math.cos(radians)*.14],dark,axis='x',vertices=8)
    box('rear-lamp',[.29,.09,.035],[truckX+side*.81,.77,.066],red)
    box('folded-rear-door',[.085,2.00,1.07],[truckX+side*1.31,2.02,-.50],white)
    for height in [1.25,2.65]:box('rear-door-hinge',[.13,.1,.13],[truckX+side*1.20,height,.025],steel)
box('rear-underrun-bar',[2.4,.10,.1],[truckX,.43,.08],steel)
box('cooling-unit',[1.28,.50,.50],[truckX,2.77,-4.43],white,.1)
for offset in [-.34,.34]:
    cylinder('condenser-fan',.17,.04,[truckX+offset,2.79,-4.71],dark,axis='z')
    for index in range(5):box('fan-grille',[.29,.012,.025],[truckX+offset,2.69+index*.05,-4.742],steel)
box('rear-header-green',[2.36,.28,.04],[truckX,2.87,.112],green)
text('cold-truck-header','冷 链 鲜 达  ·  02—08°C',[truckX,2.79,.139],.14,white)
for side in [-1,1]:
    beam('tail-hydraulic',[truckX+side*.75,.45,-.10],[truckX+side*.75,.13,1.45],.04,steel)
box('lift-control-post',[.08,1.05,.08],[7.15,.525,1.45],steel)
box('lift-control-box',[.18,.18,.15],[7.15,1.055,1.45],yellow)
cylinder('lift-start-button',.045,.02,[7.15,1.06,1.54],green,axis='z')
for index in range(13):
    box('field-row',[.42,.13,17],[12+index*.75,-.01,-2],soil)
    for plant in range(16):
        for leaf in range(4):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=.24,location=point([12+index*.75,.16,-9+plant*.92]))
            obj=bpy.context.object;obj.scale=(1,.6,.26);obj.rotation_euler=(.5,leaf*.8,leaf*1.57)
            obj.data.materials.append(foliage)
            for polygon in obj.data.polygons:polygon.use_smooth=True
box('background-store',[6,3.3,4],[-4,1.6,-12],cream)
box('background-store-roof',[6.4,.12,4.4],[-4,3.3,-12],roof)
for x,z in [(-9.55,4.0),(-9.55,2.8)]:
    for layer in range(3):
        for slat in range(6):box('wood-pallet-slat',[1.1,.035,.14],[x,.1+layer*.15,z-.45+slat*.18],wood)
        for support in [-.43,0,.43]:box('wood-pallet-block',[.13,.10,.84],[x+support,.055+layer*.15,z],wood)
for x in [-7.7,-.2]:
    cylinder('fire-extinguisher',.085,.42,[x,.65,-6.47],red)
    box('extinguisher-bracket',[.15,.055,.12],[x,.405,-6.52],steel)
    box('extinguisher-label',[.07,.1,.003],[x,.67,-6.38],white)
export('rf15_final', merge=True)

clear()
for structure in layout['STRUCTURES']:
    obj=box('COLLIDER_'+structure['id'],structure['size'],structure['position'],dark,0)
    obj['collision']=True
floor=box('COLLIDER_floor',[17.2,.12,14.3],[0,-.06,.35],dark,0);floor['collision']=True;floor['support']=True
export('rf15_collision')
clear()
box('tail-deck',[2.3,.12,1.85],[0,.06,0],steel,.025)
for stripe in range(18):box('tail-grip',[2.22,.008,.016],[0,.123,-.82+stripe*.095],dark,0)
for side in [-1,1]:box('tail-edge',[.055,.015,1.85],[side*1.12,.128,0],yellow)
export('tail-lift',merge=True)
for identifier in ['tomato','apple']:
    clear()
    carton=material('kraft-'+identifier,(.57,.36,.17),.94)
    tape=material('packing-tape-'+identifier,(.70,.48,.23),.42)
    box('sealed-carton',[.59,.36,.43],[0,.18,0],carton,.008)
    box('box-top-seam',[.004,.002,.427],[0,.361,0],dark,0)
    box('sealing-tape',[.058,.003,.438],[0,.363,0],tape,0)
    box('weight-label',[.35,.16,.003],[0,.22,.217],white,.002)
    text('box-label',('番茄 T01  8.6 kg' if identifier=='tomato' else '苹果 A02  9.4 kg'),[0,.22,.220],.046,green)
    text('box-label-origin','乡野合作社 · 鲜品',[0,.15,.220],.035,dark)
    export(identifier+'-box',merge=True)

raise SystemExit(0)
metrics={}
for name,width in [('tomato-crate',.59),('apple-crate',.59),('platform-scale',.62),('pallet-jack',.70)]:
    source=production/'source'/(name+'.glb')
    if not source.exists():
        continue
    clear()
    bpy.ops.import_scene.gltf(filepath=str(source))
    for obj in list(bpy.context.scene.objects):
        if obj.type=='MESH':
            matrix=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=matrix
    meshes=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
    for obj in list(bpy.context.scene.objects):
        if obj.type!='MESH':bpy.data.objects.remove(obj,do_unlink=True)
    coordinates=[obj.matrix_world@Vector(vertex) for obj in meshes for vertex in obj.bound_box]
    minimum=Vector([min(vertex[axis] for vertex in coordinates) for axis in range(3)])
    maximum=Vector([max(vertex[axis] for vertex in coordinates) for axis in range(3)])
    scale=width/(maximum.x-minimum.x)
    center=Vector([(minimum.x+maximum.x)/2,(minimum.y+maximum.y)/2,minimum.z])
    for obj in meshes:
        obj.location=(obj.location-center)*scale;obj.scale*=scale
        if len(obj.data.polygons)>45000:
            modifier=obj.modifiers.new('runtime-surface-budget','DECIMATE');modifier.ratio=45000/len(obj.data.polygons)
            bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=modifier.name)
    for image in bpy.data.images:
        if image.size[0]>2048 or image.size[1]>2048:image.scale(2048,2048)
        if image.has_data:image.pack()
    size=(maximum-minimum)*scale
    metrics[name]={'size':[size.x,size.z,size.y],'provider':'Cardinal','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'scale':scale,'front':'pending visual inspection'}
    export(name)
(output/'measurements.json').write_text(json.dumps(metrics,indent=2))
print('RF15_ASSETS_EXPORTED', str(output), flush=True)
