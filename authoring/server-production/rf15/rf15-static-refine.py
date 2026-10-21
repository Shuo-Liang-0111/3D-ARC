import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
source = Path(args[0])
output = Path(args[1])
font_path = args[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))

def point(position):
    return (position[0], -position[2], position[1])

def mat(name, color, rough=.7, metal=0):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = rough
    shader.inputs['Metallic'].default_value = metal
    return material

green = mat('weathered cooperative green', (.055, .18, .12), .55, .25)
dark = mat('rubber and oxidized steel', (.035, .045, .042), .8, .35)
steel = mat('galvanized edge steel', (.42, .46, .44), .4, .72)
yellow = mat('faded safety yellow', (.78, .48, .025), .7)
rust = mat('subtle rust', (.28, .095, .035), .86)
concrete = mat('concrete variation', (.25, .27, .25), .95)
white = mat('painted truck white', (.82, .83, .78), .46, .15)

def box(name, size, position, material, bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1, location=point(position))
    obj = bpy.context.object; obj.name = name
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new('worn edge', 'BEVEL'); modifier.width = bevel; modifier.segments = 2
        bpy.context.view_layer.objects.active = obj; bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj

def cylinder(name, radius, depth, position, material, axis='y', vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=point(position))
    obj = bpy.context.object; obj.name = name; obj.data.materials.append(material)
    if axis == 'x': obj.rotation_euler[1] = math.pi / 2
    if axis == 'z': obj.rotation_euler[0] = math.pi / 2
    return obj

def text(name, value, position, size, material):
    curve = bpy.data.curves.new(name, 'FONT'); curve.body = value; curve.size = size; curve.align_x = 'CENTER'; curve.font = bpy.data.fonts.load(font_path); curve.extrude = .0005
    obj = bpy.data.objects.new(name, curve); bpy.context.collection.objects.link(obj); obj.location = point(position); obj.rotation_euler = (math.pi / 2, 0, 0); obj.data.materials.append(material); bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.convert(target='MESH'); obj.select_set(False)
    return obj

# Wall panel seams and base scuffing make the shed read as assembled metal and masonry.
for x in [-7.85, -6.8, -5.75, -4.7, -3.65, -2.6, -1.55, -.5, .55]:
    box('wall-panel-seam', [.018, 2.85, .03], [x, 2.0, -6.58], steel, .002)
for x in [-8.2, -7.4, -6.6, -5.8, -5.0, -4.2, -3.4, -2.6, -1.8, -1.0, -.2, .6, 1.4]:
    box('wall-base-scuff', [.34, .025, .025], [x, .18, -6.46], rust, .002)

# Service trays and fasteners on the three packing benches.
for x, z, width, depth in [(-5.9, -4.2, 3.4, 1.0), (-2.6, -4.2, 1.4, 1.1), (.6, -3.8, 2.1, 1.2)]:
    for side in [-1, 1]:
        box('bench-cross-brace', [.035, .035, depth - .14], [x + side * (width / 2 - .08), .42, z], steel, .004)
    for offset in [-width / 2 + .16, width / 2 - .16]:
        for dz in [-depth / 2 + .13, depth / 2 - .13]: cylinder('bench-fastener', .018, .012, [x + offset, .855, z + dz], dark, axis='y', vertices=12)

# Practical consumables and a drain line in the working aisle.
for x in [-1.2, -.85, 1.4, 1.72]:
    box('folded-carton-edge', [.52, .035, .018], [x, .275, -3.8], rust, .002)
for z in [-1.9, -.8, .3, 1.4]:
    box('floor-drain-channel', [2.8, .018, .045], [-2.1, .012, z], dark, .003)
    for x in [-3.3, -2.8, -2.3, -1.8, -1.3, -.8]: box('drain-grate', [.018, .024, .21], [x, .026, z], steel, .002)

# Truck rear hardware, hinges, locking cams, and reflective chevrons.
for side in [-1, 1]:
    x = 5.3 + side * 1.17
    for z in [.2, .55, .9, 1.25, 1.6, 1.95, 2.3]: cylinder('rear-door-hinge', .032, .12, [x, 2.0, z - 2.0], rust, axis='x', vertices=12)
    for z in [-.05, .45]: box('rear-door-lock-bar', [.04, 1.5, .05], [x - side * .08, 1.42, z], dark, .004)
for x in [4.35, 4.85, 5.35, 5.85, 6.35]:
    stripe = box('tail-reflective-chevron', [.12, .03, .22], [x, .58, .16], yellow, .002); stripe.rotation_euler[1] = .55
for x in [4.4, 6.2]: cylinder('tail-stop-lamp', .08, .025, [x, .78, .12], rust, axis='y', vertices=20)

# Safety equipment that belongs at a loading dock.
for x, z in [(3.9, 2.8), (6.8, 2.8)]:
    cylinder('safety-bollard', .07, .82, [x, .41, z], yellow, vertices=16)
    box('bollard-black-band', [.145, .09, .06], [x, .66, z], dark, .003)
for x in [3.65, 6.95]:
    box('wheel-chock', [.32, .16, .20], [x, .08, 2.55], dark, .025)
box('hose-reel-body', [.38, .38, .16], [7.85, 1.35, -5.55], green, .05)
cylinder('hose-reel', .16, .08, [7.85, 1.35, -5.45], dark, axis='z', vertices=24)

# Small natural variation on the slab: patches and pallet labels.
for x, z, sx, sz in [(-7.2, 1.1, .55, .18), (-4.4, 2.7, .34, .12), (1.8, 1.9, .7, .16), (6.7, -5.8, .46, .13)]:
    box('oil-stain', [sx, .006, sz], [x, .006, z], concrete, .03)
text('dock-sign', '尾板作业区  ·  注意脚下', [5.3, 1.98, 2.36], .16, yellow)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True, export_yup=True, export_extras=True, export_animations=False, export_cameras=False, export_lights=False, export_image_format='AUTO')
print('RF15_STATIC_REFINED', output)
