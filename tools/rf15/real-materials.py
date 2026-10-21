import bpy
import bmesh
import hashlib
import json
import math
import shutil
import sys
from pathlib import Path

import numpy as np
from mathutils import Vector

root = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
revision = 'realism-v0.3.2'
source = root / 'public/local-assets/levels/rf15/realism-v0.2.8'
output = source.parent / revision
if output.exists():
    raise RuntimeError('Candidate already exists; select a new revision')
shutil.copytree(source, output)
textures = output / 'textures'
textures.mkdir()
sources = []
texture_cache = {}

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def image_file(relative, label):
    filename = root / relative
    image = bpy.data.images.load(str(filename), check_existing=True)
    if max(image.size) > 1024:
        image.scale(1024, 1024)
    image.pack()
    sources.append({'label': label, 'source': relative, 'sha256': hashlib.sha256(filename.read_bytes()).hexdigest()})
    return image

def data_image(label, rgb):
    height, width, channels = rgb.shape
    image = bpy.data.images.new(label, width=width, height=height)
    image.colorspace_settings.name = 'Non-Color'
    rgba = np.concatenate([rgb, np.ones((height, width, 1))], axis=2).astype(np.float32)
    image.pixels.foreach_set(rgba.reshape(-1))
    image.filepath_raw = str(textures / f'{label}.png')
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image

def material(label, color, rough=.7, metal=0):
    result = bpy.data.materials.new(label)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = rough
    shader.inputs['Metallic'].default_value = metal
    return result

def texture_material(label, relative, rough=.75, metal=0, amplitude=.3):
    result = material(label, (1, 1, 1), rough, metal)
    image = image_file(relative, label)
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    shader = nodes.get('Principled BSDF')
    color = nodes.new('ShaderNodeTexImage')
    color.image = image
    links.new(color.outputs['Color'], shader.inputs['Base Color'])
    pixels = np.array(image.pixels[:]).reshape(image.size[1], image.size[0], 4)
    height = pixels[:, :, :3].mean(axis=2)
    grad_x = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * amplitude
    grad_y = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * amplitude
    normals = np.stack([-grad_x, -grad_y, np.ones_like(height)], axis=2)
    normals /= np.linalg.norm(normals, axis=2, keepdims=True)
    normal_image = data_image(label + '-normal', normals * .5 + .5)
    roughness = np.clip(rough + (height - height.mean()) * .1, .05, .98)
    rough_image = data_image(label + '-roughness', np.repeat(roughness[:, :, None], 3, axis=2))
    normal_texture = nodes.new('ShaderNodeTexImage')
    normal_texture.image = normal_image
    normal = nodes.new('ShaderNodeNormalMap')
    links.new(normal_texture.outputs['Color'], normal.inputs['Color'])
    links.new(normal.outputs['Normal'], shader.inputs['Normal'])
    rough_texture = nodes.new('ShaderNodeTexImage')
    rough_texture.image = rough_image
    links.new(rough_texture.outputs['Color'], shader.inputs['Roughness'])
    return result

def brushed_metal():
    result = material('RF15-brushed-steel-PBR', (1, 1, 1), .34, .78)
    generator = np.random.default_rng(15)
    grain = generator.normal(0, 1, (512, 512))
    for offset in range(5):
        grain = (grain + np.roll(grain, 1, axis=1) + np.roll(grain, -1, axis=1)) / 3
    grain = np.clip(grain, -1, 1)
    color = np.stack([.64 + grain * .016, .66 + grain * .016, .65 + grain * .016], axis=2)
    roughness = np.repeat((.34 + grain * .055)[:, :, None], 3, axis=2)
    normal = np.stack([np.zeros_like(grain), (np.roll(grain, -1, axis=0) - grain) * .015, np.ones_like(grain)], axis=2)
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    shader = result.node_tree.nodes.get('Principled BSDF')
    for label, pixels, socket in [('steel-basecolor',color,'Base Color'),('steel-roughness',roughness,'Roughness'),('steel-normal',normal*.5+.5,'Normal')]:
        node = result.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = data_image(label, pixels)
        if socket == 'Normal':
            normal_map = result.node_tree.nodes.new('ShaderNodeNormalMap')
            result.node_tree.links.new(node.outputs['Color'], normal_map.inputs['Color'])
            result.node_tree.links.new(normal_map.outputs['Normal'], shader.inputs[socket])
        else:
            result.node_tree.links.new(node.outputs['Color'], shader.inputs[socket])
    sources.append({'label':'brushed-steel','source':'Blender/NumPy deterministic brushed micrograin','seed':15,'normal':'baked tangent-space'})
    return result

def uv(obj, tile=1):
    layer = obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
    for polygon in obj.data.polygons:
        normal = obj.matrix_world.to_3x3() @ polygon.normal
        axis = max(range(3), key=lambda index: abs(normal[index]))
        axes = [index for index in range(3) if index != axis]
        for loop in polygon.loop_indices:
            vertex = obj.matrix_world @ obj.data.vertices[obj.data.loops[loop].vertex_index].co
            layer.data[loop].uv = (vertex[axes[0]] / tile, vertex[axes[1]] / tile)

def point(position):
    return (position[0], -position[2], position[1])

def box(label, size, position, mat, bevel=.008, tile=1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=point(position))
    obj = bpy.context.object
    obj.name = label
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    uv(obj, tile)
    if bevel:
        modifier = obj.modifiers.new('rolled-edge', 'BEVEL')
        modifier.width = min(bevel, min(size) / 3)
        modifier.segments = 3
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj

def cylinder(label, radius, depth, position, mat, axis='y', vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=point(position))
    obj = bpy.context.object
    obj.name = label
    if axis == 'x':
        obj.rotation_euler[1] = math.pi / 2
    if axis == 'z':
        obj.rotation_euler[0] = math.pi / 2
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return obj

def tube(label, positions, radius, mat):
    curve = bpy.data.curves.new(label, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new('POLY')
    spline.points.add(len(positions) - 1)
    for vertex, position in zip(spline.points, positions):
        vertex.co = (*point(position), 1)
    obj = bpy.data.objects.new(label, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj

def remove_region(obj, minimum, maximum):
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    faces = [face for face in mesh.faces if all(all(minimum[axis] - .001 <= (obj.matrix_world @ vertex.co)[axis] <= maximum[axis] + .001 for axis in range(3)) for vertex in face.verts)]
    if faces:
        bmesh.ops.delete(mesh, geom=faces, context='FACES')
        mesh.to_mesh(obj.data)
    mesh.free()

def scanned(label, asset, size, position):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(root / f'public/local-assets/polyhaven/rf01/models/{asset}/{asset}_4k.gltf'))
    objects = [obj for obj in set(bpy.context.scene.objects) - before if obj.type == 'MESH']
    coordinates = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
    minimum = Vector([min(vertex[axis] for vertex in coordinates) for axis in range(3)])
    maximum = Vector([max(vertex[axis] for vertex in coordinates) for axis in range(3)])
    scale = Vector((size[0], size[2], size[1]))
    for axis in range(3):
        scale[axis] /= maximum[axis] - minimum[axis]
    offset = Vector(point(position))
    for obj in objects:
        if len(obj.data.polygons) > 40000:
            bpy.context.view_layer.objects.active = obj
            modifier = obj.modifiers.new('browser-mesh-budget', 'DECIMATE')
            modifier.ratio = 40000 / len(obj.data.polygons)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        for vertex in obj.data.vertices:
            value = obj.matrix_world @ vertex.co - minimum
            vertex.co = Vector((value.x * scale.x - size[0] / 2, value.y * scale.y - size[2] / 2, value.z * scale.z)) + offset
        obj.matrix_world.identity()
        obj.name = label
    return objects

def export(filename):
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'CURVE':
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target='MESH')
    groups = {}
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'MESH' and obj.name != 'STATIC_shed-wall-shell':
            key = tuple(mat.name for mat in obj.data.materials if mat)
            groups.setdefault(key, []).append(obj)
    for mats, objects in groups.items():
        if len(objects) > 1:
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objects:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = objects[0]
            bpy.ops.object.join()
    for image in bpy.data.images:
        if image.size[0] and image.size[1]:
            if max(image.size) > 1024:
                image.scale(1024, 1024)
            image.pack()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(output / filename), export_format='GLB', use_selection=True, export_yup=True, export_extras=True, export_animations=False, export_cameras=False, export_lights=False)

clear()
bpy.ops.import_scene.gltf(filepath=str(source / 'rf15_final.glb'))
wood = texture_material('RF15-oak-PBR', 'public/local-assets/cardinal/rf12-v2/textures/oak_cardinal.png', .68, 0, .2)
plaster = texture_material('RF15-plaster-PBR', 'public/local-assets/embodiedgen/rf02/models/runtime/generated_textures/plaster.png', .88, 0, .25)
kraft = texture_material('RF15-kraft-PBR', 'public/local-assets/embodiedgen/rf03/models/runtime/generated_textures/kraft_cardboard.png', .86, 0, .18)
metal = brushed_metal()
concrete = texture_material('RF15-skirting-PBR', 'public/local-assets/polyhaven/rf01/textures/hangar_concrete_floor/hangar_concrete_floor_diff_2k.jpg', .92, 0, .25)
floor = texture_material('RF15-floor-PBR', 'public/local-assets/polyhaven/rf01/textures/hangar_concrete_floor/hangar_concrete_floor_diff_2k.jpg', .82, 0, .3)
asphalt = texture_material('RF15-asphalt-PBR', 'public/local-assets/polyhaven/rf01/textures/aerial_asphalt_01/aerial_asphalt_01_diff_2k.jpg', .92, 0, .4)
green = material('RF15-coated-frame', (.035, .13, .078), .44, .35)
rubber = material('RF15-rubber', (.013, .019, .018), .84)
paper = material('RF15-label-paper', (.85, .83, .75), .9)
tape = material('RF15-packing-tape', (.46, .3, .12), .27)
old_prefixes = ('bench-', 'tubular-bench', 'crate-', 'pallet-board', 'pallet-foot', 'wash-', 'soap-', 'electrical-panel', 'panel-slot', 'hose-', 'door-hinge-cap', 'door-gasket', 'rear-door-hinge', 'rear-door-lock-bar', 'hydraulic-', 'tail-hinge-barrel', 'dock-rubber-bumper', 'stretch-wrap-band', 'folded-carton-edge', 'wall-base-scuff', 'dock-sign', 'dock-label')
for obj in list(bpy.context.scene.objects):
    if obj.name.startswith(old_prefixes):
        bpy.data.objects.remove(obj, do_unlink=True)
        continue
    if obj.type != 'MESH':
        continue
    if obj.name.startswith('STATIC_') and obj.name != 'STATIC_shed-wall-shell':
        for minimum, maximum in [((-7.61,3.69,-.01),(-4.19,4.71,.825)),((-3.31,3.64,-.01),(-1.89,4.76,.765)),((-.46,3.19,-.01),(1.66,4.41,.845)),((-8.08,1.05,-.01),(-6.68,1.56,1.2))]:
            remove_region(obj, minimum, maximum)
    for index, mat in enumerate(obj.data.materials):
        if not mat:
            continue
        if mat.name == 'packing bench beech':
            obj.data.materials[index] = wood
            uv(obj, 1.4)
        elif mat.name == 'limewashed warm walls':
            obj.data.materials[index] = plaster
            uv(obj, 2)
        elif mat.name == 'shed brick skirting':
            obj.data.materials[index] = concrete
            uv(obj, 2)
        elif mat.name == 'yard asphalt':
            obj.data.materials[index] = asphalt
            uv(obj, 4)
        elif mat.name == 'worn depot concrete':
            obj.data.materials[index] = floor
            uv(obj, 3)
        elif mat.name in ('brushed galvanized metal', 'edge trim', 'galvanized edge steel', 'brushed steel'):
            obj.data.materials[index] = metal
            uv(obj, 1.1)
        elif mat.name == 'ribbed galvanized canopy':
            roof = texture_material('RF15-roof-PBR', 'public/local-assets/polyhaven/rf01/textures/box_profile_metal_sheet/box_profile_metal_sheet_diff_2k.jpg', .5, .65, .2)
            obj.data.materials[index] = roof
            uv(obj, 2)

for station, horizontal, depth, width, length, height in [('intake',-5.9,-4.2,3.4,1,.82),('scale',-2.6,-4.2,1.4,1.1,.76),('pack',.6,-3.8,2.1,1.2,.84)]:
    top = metal if station == 'scale' else wood
    box(station+'-solid-worktop', (width,.055,length), (horizontal,height-.0275,depth), top, .012, 1.3)
    for side in (-1,1):
        box(station+'-apron', (width-.12,.09,.035), (horizontal,height-.11,depth+side*(length/2-.06)),green,.005)
        box(station+'-cross-frame', (.035,.06,length-.13), (horizontal+side*(width/2-.1),.27,depth),metal,.003)
        for end in (-1,1):
            position = [horizontal+side*(width/2-.09),0,depth+end*(length/2-.09)]
            box(station+'-square-tube-leg',(.045,height-.09,.045),(position[0],(height-.09)/2+.04,position[2]),metal,.004)
            cylinder(station+'-adjustable-foot',.034,.04,(position[0],.02,position[2]),rubber)
            cylinder(station+'-frame-bolt',.01,.041,(position[0],height-.11,depth+end*(length/2-.06)),metal,'z',12)
    for slat in range(5):
        box(station+'-undershelf-slat',(width-.12,.026,(length-.2)/5-.012),(horizontal,.22,depth+(slat-2)*(length-.2)/5),wood,.004,1.3)

for layer in range(3):
    for horizontal in (-7.72,-7.08):
        scanned('ventilated-harvest-crate', 'plastic_crate_01', (.59,.32,.48), (horizontal,.03+layer*.335,-1.3))
scanned('galvanized-electrical-enclosure', 'power_box_01', (.52,.7,.17), (1.14,1.76,-6.5))

for horizontal, depth in [(-7.5,3.8),(-7.5,4.65)]:
    for row in range(5):
        box('pallet-top-board',(1.05,.025,.115),(horizontal,.14,depth+(row-2)*.145),wood,.004,.85)
    for side in (-.4,0,.4):
        box('pallet-stringer',(.085,.095,.72),(horizontal+side,.0775,depth),wood,.005,.85)
        box('pallet-bottom-board',(.12,.026,.74),(horizontal+side,.016,depth),wood,.004,.85)
        for end in (-.28,.28):
            cylinder('pallet-nail',.004,.003,(horizontal+side,.154,depth+end),metal,vertices=8)

for side in (-1,1):
    horizontal = 5.3+side*1.375
    for height in (1.25,2.0,2.68):
        box('truck-door-hinge-strap',(.015,.075,.25),(horizontal,height,-.15),metal,.007)
        cylinder('truck-door-hinge-pin',.026,.105,(horizontal,height,-.02),metal)
    cylinder('truck-door-locking-rod',.016,1.7,(horizontal,2.0,-.8),metal)
    for height in (1.22,2.78):
        box('truck-door-latch',(.024,.065,.12),(horizontal,height,-.8),metal,.008)
    tube('truck-door-handle',[(horizontal,1.68,-.8),(horizontal+side*.045,1.68,-.8),(horizontal+side*.045,1.68,-.6)],.015,metal)
    for depth in (-5.1,-1.3):
        for index in range(28):
            angle = index*math.tau/28
            tread = box('tire-tread-block',(.22,.009,.04),(5.3+side*1.065,.42+.413*math.cos(angle),depth+.413*math.sin(angle)),rubber,.003)
            tread.rotation_euler[0] = angle

sink_x,sink_z = 2.05,-5.8
ring_count = 48
verts=[]
for width, length, height in [(.83,.49,.93),(.69,.35,.93),(.53,.23,.77)]:
    for index in range(ring_count):
        angle = index*math.tau/ring_count
        horizontal = math.copysign(abs(math.cos(angle))**.35,math.cos(angle))*width/2
        depth = math.copysign(abs(math.sin(angle))**.35,math.sin(angle))*length/2
        verts.append(point((sink_x+horizontal,height,sink_z+depth)))
faces=[]
for layer in range(2):
    for index in range(ring_count):
        after=(index+1)%ring_count
        faces.append((layer*ring_count+index,layer*ring_count+after,(layer+1)*ring_count+after,(layer+1)*ring_count+index))
faces.append(tuple(range(2*ring_count,3*ring_count)))
mesh=bpy.data.meshes.new('pressed-basin')
mesh.from_pydata(verts,[],faces)
mesh.update()
obj=bpy.data.objects.new('stainless-hollow-wash-basin',mesh)
bpy.context.collection.objects.link(obj)
obj.data.materials.append(metal)
mesh_bm=bmesh.new();mesh_bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(mesh_bm,faces=list(mesh_bm.faces));mesh_bm.to_mesh(mesh);mesh_bm.free()
uv(obj,.7)
for polygon in mesh.polygons:
    polygon.use_smooth=True
for side in (-1,1):
    for end in (-1,1):
        cylinder('sink-tube-leg',.022,.9,(sink_x+side*.34,.45,sink_z+end*.17),metal)
tube('sink-gooseneck-faucet',[(sink_x, .93,sink_z-.18),(sink_x,1.15,sink_z-.18),(sink_x,1.25,sink_z-.14),(sink_x,1.25,sink_z+.025),(sink_x,1.16,sink_z+.055)],.018,metal)
cylinder('sink-drain',.031,.005,(sink_x,.775,sink_z),rubber)
tube('sink-drain-trap',[(sink_x,.765,sink_z),(sink_x,.5,sink_z),(sink_x+.07,.43,sink_z),(sink_x+.14,.5,sink_z),(sink_x+.14,.59,sink_z),(sink_x+.14,.59,-6.55)],.022,metal)
box('sink-wall-splashback',(.83,.25,.014),(sink_x,1.055,sink_z-.247),metal,.004)

export('rf15_final.glb')
clear()
for size, position in [((2.3,.12,1.85),(0,.06,0))]:
    box('tail-lift-aluminium-platform',size,position,metal,.014)
for row in range(20):
    for column in range(13):
        raised=box('tail-lift-grip-diamond',(.045,.002,.012),(-1.08+column*.17,.121,-.79+row*.081),metal,.003)
        raised.rotation_euler[2]=(.7 if (row+column)%2 else -.7)
for horizontal in (-1.04,1.04):
    for depth in (-.72,.72):
        cylinder('tail-lift-countersunk-bolt',.012,.003,(horizontal,.122,depth),rubber,vertices=12)
export('tail-lift.glb')
for produce in ('apple','tomato'):
    clear()
    bpy.ops.import_scene.gltf(filepath=str(source / f'{produce}-box.glb'))
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        for index, mat in enumerate(obj.data.materials):
            if mat and any(word in mat.name.lower() for word in ('beech','cardboard','wood','kraft')):
                obj.data.materials[index]=kraft
                uv(obj,.7)
    box('sealed-carton-tape',(.053,.002,.437),(0,.365,0),tape,.0005)
    export(f'{produce}-box.glb')
manifest = {'level':'rf15','revision':revision,'sourceRevision':source.name,'status':'internal-review','changes':['replacement hollow scanned crates','assembled workstations','hollow wash basin and plumbing','scanned electrical enclosure','wood pallet construction','correct truck hardware and treads','dynamic textured tail lift','paper-fibre cartons','embedded PBR texture maps'], 'textureSources':sources,'scannedSources':[{'asset':name,'provider':'Poly Haven','license':'CC0 1.0'} for name in ('plastic_crate_01','power_box_01')], 'assets':[]}
for filename in output.glob('*.glb'):
    payload=filename.read_bytes()
    assert payload[:4]==b'glTF'
    manifest['assets'].append({'id':filename.stem,'runtimePath':str(filename.relative_to(root)),'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest()})
assert (output/'rf15_collision.glb').read_bytes()==(source/'rf15_collision.glb').read_bytes()
(output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('RF15_REAL_MATERIALS_EXPORTED',revision)
