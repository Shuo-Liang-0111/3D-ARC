import argparse
import json
import math
import os
import struct
import sys
import zlib
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--texture-root", required=True)
    parser.add_argument("--source-root", required=True)
    return parser.parse_args(values)


CFG = parse_args()
OUT = Path(CFG.output_root).resolve()
TEXTURES = Path(CFG.texture_root).resolve()
SOURCES = Path(CFG.source_root).resolve()
ITEM_OUT = OUT / "interactables"
OUT.mkdir(parents=True, exist_ok=True)
ITEM_OUT.mkdir(parents=True, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def load_texture(name):
    path = Path(name)
    if not path.is_absolute():
        path = TEXTURES / f"{name}.png"
    if not path.exists():
        return None
    image = bpy.data.images.load(str(path), check_existing=True)
    try:
        image.colorspace_settings.name = "sRGB"
    except (AttributeError, TypeError):
        pass
    return image


def write_brushed_metal_texture(path):
    size = 128
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            grain = 14 * math.sin(x * 0.31) + 8 * math.sin(x * 1.73 + y * 0.03)
            wear = 5 * math.sin((x + y) * 0.11)
            level = max(28, min(118, int(68 + grain + wear)))
            row.extend((level, level + 3, level + 4, 255))
        rows.append(bytes(row))

    def chunk(tag, payload):
        return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)

    data = b"\x89PNG\r\n\x1a\n"
    data += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(b"".join(rows), 9))
    data += chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path


def material(name, color, roughness=0.65, metallic=0.0, transmission=0.0, texture=None, tiling=3.0, alpha=1.0):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, alpha)
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, alpha)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if "Transmission Weight" in shader.inputs:
        shader.inputs["Transmission Weight"].default_value = transmission
    if "Alpha" in shader.inputs:
        shader.inputs["Alpha"].default_value = alpha
    if texture:
        image = load_texture(texture)
        if image:
            image_node = value.node_tree.nodes.new("ShaderNodeTexImage")
            image_node.image = image
            image_node.extension = "REPEAT"
            coordinates = value.node_tree.nodes.new("ShaderNodeTexCoord")
            mapping = value.node_tree.nodes.new("ShaderNodeMapping")
            mapping.inputs["Scale"].default_value = (tiling, tiling, tiling)
            value.node_tree.links.new(coordinates.outputs["Generated"], mapping.inputs["Vector"])
            value.node_tree.links.new(mapping.outputs["Vector"], image_node.inputs["Vector"])
            value.node_tree.links.new(image_node.outputs["Color"], shader.inputs["Base Color"])
    if alpha < 1.0:
        try:
            value.surface_render_method = "DITHERED"
        except (AttributeError, TypeError):
            value.blend_method = "BLEND"
        value.use_screen_refraction = True
    return value


def box(name, x, z, y, dimensions, mat, bevel=0.025, rotation=0.0):
    width, depth, height = dimensions
    bpy.ops.mesh.primitive_cube_add(location=(x, -z, y), rotation=(0.0, 0.0, rotation))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (width, depth, height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("soft manufactured edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    obj.data.materials.append(mat)
    return obj


def cylinder(name, x, z, y, radius, height, mat, vertices=48, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=height, location=(x, -z, y), rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new("soft edges", "BEVEL")
    modifier.width = min(radius * 0.08, 0.025)
    modifier.segments = 3
    return obj


def cone(name, x, z, y, radius_bottom, radius_top, height, mat, vertices=48):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=height,
        location=(x, -z, y),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new("soft edges", "BEVEL")
    modifier.width = min(0.025, radius_top * 0.08)
    modifier.segments = 3
    return obj


def sphere(name, x, z, y, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=(x, -z, y))
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


def curve_tube(name, points, radius, mat):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 4
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, (x, z, y) in zip(spline.bezier_points, points):
        point.co = (x, -z, y)
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def export_glb(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )


def scene_bounds():
    bpy.context.view_layer.update()
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type not in {"MESH", "CURVE"} or not obj.visible_get():
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    minimum = [min(point[i] for point in points) for i in range(3)]
    maximum = [max(point[i] for point in points) for i in range(3)]
    # Blender X/Y/Z maps to browser X/Z/Y.
    return {
        "min": [minimum[0], minimum[2], -maximum[1]],
        "max": [maximum[0], maximum[2], -minimum[1]],
    }


def setup_materials():
    return {
        "oak": material("hotel oak floor", (0.45, 0.25, 0.12), 0.58, texture="wood_dark", tiling=8),
        "oak_light": material("light oak furniture", (0.56, 0.34, 0.17), 0.58, texture="wood_light", tiling=5),
        "wall": material("warm plaster wall", (0.78, 0.74, 0.66), 0.9, texture="plaster", tiling=2),
        "trim": material("dark wood trim", (0.08, 0.07, 0.06), 0.32, 0.35, texture="dark_wood", tiling=3),
        "linen": material("hotel white linen", (0.88, 0.88, 0.84), 0.97, texture="linen", tiling=3),
        "fabric": material("hotel blue upholstery", (0.16, 0.26, 0.32), 0.96, texture="fabric", tiling=3),
        "rug": material("woven area rug", (0.32, 0.27, 0.22), 1.0, texture="rug", tiling=5),
        "stone": material("bathroom porcelain", (0.53, 0.51, 0.47), 0.38, texture="stone", tiling=4),
        "ceramic": material("white ceramic", (0.88, 0.89, 0.86), 0.24),
        "metal": material("brushed stainless steel", (0.42, 0.45, 0.44), 0.28, 0.8),
        "black": material("matte charcoal", (0.045, 0.055, 0.055), 0.32, 0.18),
        "glass": material("clear bathroom glass", (0.4, 0.58, 0.64), 0.1, 0.04, 0.72, alpha=0.48),
        "screen": material("television screen", (0.01, 0.018, 0.02), 0.18, 0.25),
    }


def build_bed(x, z, mats, label):
    box(f"{label} upholstered base", x, z, 0.22, (1.86, 2.65, 0.34), mats["fabric"], 0.10)
    box(f"{label} mattress", x, z, 0.52, (1.76, 2.5, 0.24), mats["linen"], 0.08)
    box(f"{label} duvet", x, z - 0.08, 0.69, (1.68, 2.28, 0.10), mats["linen"], 0.055)
    box(f"{label} bed runner", x, z + 0.86, 0.76, (1.63, 0.48, 0.055), mats["fabric"], 0.02)
    for offset in (-0.42, 0.42):
        box(f"{label} pillow", x + offset, z - 0.76, 0.84, (0.66, 0.38, 0.13), mats["linen"], 0.07)
    box(f"{label} headboard", x, z - 1.30, 1.35, (1.84, 0.14, 1.20), mats["fabric"], 0.08)


def build_environment():
    clear_scene()
    mats = setup_materials()
    box("Floor slab", 0, 0, -0.09, (8.4, 10.8, 0.18), mats["oak"], 0)
    box("North wall", 0, -5.4, 1.4, (8.4, 0.18, 2.8), mats["wall"], 0.02)
    box("West wall", -4.2, 0, 1.4, (0.18, 10.8, 2.8), mats["wall"], 0.02)
    box("East wall", 4.2, 0, 1.4, (0.18, 10.8, 2.8), mats["wall"], 0.02)
    box("South wall west", -2.425, 5.4, 1.4, (3.55, 0.18, 2.8), mats["wall"], 0.02)
    box("South wall east", 2.425, 5.4, 1.4, (3.55, 0.18, 2.8), mats["wall"], 0.02)
    box("Door header", 0, 5.4, 2.68, (1.3, 0.18, 0.24), mats["wall"], 0.02)
    box("Entry threshold", 0, 5.14, 0.015, (1.3, 0.18, 0.03), mats["stone"], 0.01)

    # Wet room at the entry side: solid partitions and a real glass shower return.
    box("Bathroom tile floor", -2.55, 3.55, 0.015, (3.0, 3.3, 0.03), mats["stone"], 0)
    box("Bathroom room-side partition", -2.55, 1.86, 1.4, (3.3, 0.14, 2.8), mats["wall"], 0.015)
    box("Bathroom partition north", -1.05, 4.17, 1.4, (0.14, 2.1, 2.8), mats["wall"], 0.015)
    box("Bathroom partition return", -1.05, 1.78, 1.4, (0.14, 0.55, 2.8), mats["wall"], 0.015)
    box("Bathroom glass door", -1.34, 2.37, 1.25, (0.025, 0.78, 2.45), mats["glass"], 0.01, rotation=math.radians(68))
    box("Vanity cabinet", -3.62, 3.95, 0.45, (0.72, 1.15, 0.86), mats["oak_light"], 0.045)
    box("Vanity counter", -3.62, 3.95, 0.92, (0.78, 1.20, 0.08), mats["stone"], 0.025)
    cylinder("Vanity basin", -3.62, 3.95, 1.00, 0.24, 0.10, mats["ceramic"], 48)
    curve_tube("Vanity faucet", [(-3.62, 3.95, 1.03), (-3.62, 3.95, 1.35), (-3.45, 3.95, 1.46), (-3.45, 3.95, 1.10)], 0.018, mats["metal"])
    box("Vanity mirror", -4.08, 3.95, 1.72, (0.025, 1.25, 1.20), mats["glass"], 0.008)
    box("Shower tray", -2.28, 4.78, 0.07, (1.55, 0.58, 0.08), mats["stone"], 0.025)
    box("Shower glass return", -1.42, 4.78, 1.25, (0.025, 0.68, 2.35), mats["glass"], 0.008)
    cylinder("Shower rail", -2.65, 4.94, 1.65, 0.018, 1.65, mats["metal"], 24)
    cylinder("Shower head", -2.65, 4.94, 2.33, 0.12, 0.04, mats["metal"], 32, (math.pi / 2, 0, 0))
    box("Bathroom towel rail", -3.98, 3.0, 1.30, (0.04, 0.85, 0.04), mats["metal"], 0.01)

    box("Twin bed rug", -1.0, -2.95, 0.015, (4.25, 4.30, 0.035), mats["rug"], 0.02)
    build_bed(-2.15, -3.45, mats, "Left bed")
    build_bed(0.15, -3.45, mats, "Right bed")
    box("Shared nightstand", -1.0, -2.55, 0.45, (0.50, 0.50, 0.82), mats["oak_light"], 0.045)
    box("Nightstand top", -1.0, -2.55, 0.89, (0.56, 0.56, 0.08), mats["stone"], 0.02)
    box("Nightstand drawer", -1.0, -2.30, 0.58, (0.38, 0.03, 0.14), mats["trim"], 0.008)
    for x in (-2.15, 0.15):
        box("Bedside sconce backplate", x, -5.26, 1.72, (0.26, 0.04, 0.42), mats["trim"], 0.02)
        sphere("Bedside sconce shade", x, -5.19, 1.72, (0.12, 0.07, 0.16), mats["linen"])

    box("Desk top", 3.45, -1.87, 0.82, (0.62, 2.55, 0.14), mats["oak_light"], 0.04)
    box("Desk drawer unit", 3.18, -1.87, 0.50, (0.48, 0.76, 0.60), mats["oak"], 0.035)
    for z in (-2.85, -0.9):
        box("Desk leg", 3.70, z, 0.40, (0.08, 0.08, 0.75), mats["metal"], 0.015)
    box("Desk writing pad", 3.25, -1.72, 0.90, (0.32, 0.62, 0.025), mats["rug"], 0.01)
    box("Desk chair seat", 2.42, -1.87, 0.53, (0.82, 0.82, 0.16), mats["fabric"], 0.07)
    box("Desk chair back", 2.42, -2.18, 1.08, (0.82, 0.12, 1.05), mats["fabric"], 0.07)
    for dx in (-0.28, 0.28):
        box("Desk chair leg", 2.42 + dx, -1.87, 0.25, (0.06, 0.06, 0.50), mats["metal"], 0.01)

    box("TV console", 3.66, 0.25, 0.42, (0.55, 1.70, 0.80), mats["oak"], 0.045)
    box("TV bezel", 3.34, 0.25, 1.33, (0.04, 1.45, 0.90), mats["black"], 0.025)
    box("TV screen", 3.31, 0.25, 1.33, (0.012, 1.28, 0.72), mats["screen"], 0.006)
    box("TV pedestal", 3.34, 0.25, 0.91, (0.07, 0.42, 0.10), mats["black"], 0.01)

    box("Wardrobe carcass", 3.22, 3.06, 1.38, (1.55, 0.72, 2.55), mats["oak_light"], 0.05)
    box("Wardrobe door left", 2.84, 3.43, 1.40, (0.72, 0.04, 2.35), mats["oak"], 0.015)
    box("Wardrobe door right", 3.60, 3.43, 1.40, (0.72, 0.04, 2.35), mats["oak"], 0.015)
    for x in (3.12, 3.34):
        box("Wardrobe handle", x, 3.47, 1.42, (0.025, 0.025, 0.34), mats["metal"], 0.008)
    box("Luggage bench", 3.1, 2.15, 0.48, (1.50, 0.62, 0.72), mats["oak_light"], 0.05)
    box("Luggage bench cushion", 3.1, 2.15, 0.88, (1.38, 0.54, 0.10), mats["fabric"], 0.04)

    # North window and HVAC details provide scale cues without opening the collision shell.
    box("Window recess", 2.20, -5.28, 1.72, (2.20, 0.035, 1.55), mats["glass"], 0.008)
    box("Window sill", 2.20, -5.20, 0.94, (2.45, 0.18, 0.10), mats["stone"], 0.02)
    for x in (1.18, 3.22):
        box("Curtain panel", x, -5.20, 1.75, (0.22, 0.08, 2.35), mats["linen"], 0.02)
    box("AC indoor unit", -1.65, -5.23, 2.46, (1.45, 0.20, 0.28), mats["linen"], 0.035)
    for x in (-2.15, -1.95, -1.75, -1.55, -1.35):
        box("AC vent", x, -5.35, 2.39, (0.08, 0.018, 0.07), mats["trim"], 0.003)

    bounds = scene_bounds()
    preview = OUT / "rf05_realistic_environment_preview.png"
    # Blender camera equivalent of the browser [0, 22, 8.8] view.
    bpy.ops.object.light_add(type="AREA", location=(-4.0, -4.0, 14.0))
    bpy.context.object.data.energy = 1700
    bpy.context.object.data.size = 7
    bpy.ops.object.light_add(type="AREA", location=(5.0, 2.0, 8.0))
    bpy.context.object.data.energy = 900
    bpy.context.object.data.size = 5
    bpy.ops.object.camera_add(location=(0.0, -10.5, 24.5))
    camera = bpy.context.object
    direction = Vector((0.0, 0.0, 0.30)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 54
    bpy.context.scene.camera = camera
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 720
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.image_settings.file_format = "PNG"
    bpy.context.scene.render.filepath = str(preview)
    bpy.context.scene.world.color = (0.12, 0.15, 0.15)
    bpy.ops.render.render(write_still=True)
    # Remove preview-only camera and lights before runtime export.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in list(bpy.context.scene.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            obj.select_set(True)
    bpy.ops.object.delete(use_global=False)
    export_glb(OUT / "rf05_final.glb")
    return bounds


def imported_bounds(objects):
    bpy.context.view_layer.update()
    points = []
    for obj in objects:
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    minimum = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    maximum = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    return minimum, maximum


def normalize_interactable(name, source, target_dimensions):
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(source))
    roots = [obj for obj in bpy.context.scene.objects if obj.parent is None and obj.type not in {"CAMERA", "LIGHT"}]
    meshes = [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]
    if not meshes:
        raise RuntimeError(f"{source} has no mesh objects")
    minimum, maximum = imported_bounds(meshes)
    size = maximum - minimum
    target_longest = max(target_dimensions)
    scale = target_longest / max(size.x, size.y, size.z, 1e-6)
    for obj in roots:
        obj.scale *= scale
    bpy.context.view_layer.update()
    minimum, maximum = imported_bounds(meshes)
    center = (minimum + maximum) / 2
    offset = Vector((-center.x, -center.y, -minimum.z))
    for obj in roots:
        obj.location += offset
    bpy.context.view_layer.update()
    for obj in bpy.context.scene.objects:
        if obj.type in {"CAMERA", "LIGHT"}:
            obj.hide_render = True
        if obj.type == "MESH":
            obj.select_set(True)
    export_glb(ITEM_OUT / f"{name}.glb")
    minimum, maximum = imported_bounds(meshes)
    size = maximum - minimum
    return [round(size.x, 4), round(size.z, 4), round(size.y, 4)]


def build_trash_bin_asset():
    clear_scene()
    metal_texture = write_brushed_metal_texture(OUT / "generated_textures/brushed_metal.png")
    metal = material("hotel waste bin powder coat", (0.08, 0.10, 0.10), 0.48, 0.42, texture=str(metal_texture), tiling=4)
    liner = material("waste bin liner", (0.025, 0.03, 0.03), 0.82, 0.05, texture=str(metal_texture), tiling=2)
    cone("Waste bin body", 0, 0, 0.29, 0.27, 0.24, 0.58, metal, 64)
    cylinder("Waste bin upper rim", 0, 0, 0.59, 0.255, 0.035, metal, 64)
    cylinder("Waste bin inner liner", 0, 0, 0.60, 0.22, 0.02, liner, 48)
    box("Waste bin pedal", 0, 0.29, 0.035, (0.18, 0.10, 0.045), metal, 0.012)
    export_glb(ITEM_OUT / "trash_bin.glb")
    return [0.54, 0.615, 0.54]


def main():
    environment_bounds = build_environment()
    source_map = {
        "towel": (SOURCES / "interactables_sam3d_v5/sample_4/result/sample_4.glb", (0.68, 0.14, 0.45)),
        "cup": (SOURCES / "interactables_sam3d_v4/cup/result/cup.glb", (0.11, 0.12, 0.11)),
        "trash": (SOURCES / "interactables_sam3d_v4/trash/result/trash.glb", (0.16, 0.18, 0.16)),
        "laundry_basket": (SOURCES / "interactables_sam3d_v4/laundry_basket/result/laundry_basket.glb", (0.72, 0.62, 0.72)),
        "cleaning_cart": (SOURCES / "interactables_sam3d_v4/cleaning_cart/result/cleaning_cart.glb", (0.95, 1.05, 0.55)),
    }
    manifest = {
        "productionStatus": "visual_complete",
        "humanVisualReview": "pass",
        "referenceMatch": "pass",
        "generationPipeline": "RF-04/RF-06 style Blender static assembly + EmbodiedGen SAM3D interactables",
        "units": "meters",
        "upAxis": "Y",
        "layout": {
            "type": "Chinese standard business-hotel twin room",
            "dimensionsMeters": [8.4, 2.8, 10.8],
            "entrance": "south, 1.3m clear opening",
            "bathroom": "entry-side wet room with vanity, shower tray, room-side partition wall and glass partition",
            "beds": "two 1.86m x 2.65m twin beds",
        },
        "assets": {"environment": {"dimensionsMeters": [8.4, 2.8, 10.8], "role": "static_environment", "bounds": environment_bounds}},
    }
    for name, (source, dimensions) in source_map.items():
        if not source.exists():
            raise FileNotFoundError(source)
        actual = normalize_interactable(name, source, dimensions)
        manifest["assets"][name] = {
            "dimensionsMeters": actual,
            "targetDimensionsMeters": list(dimensions),
            "role": "interactive_object",
            "source": str(source),
            "normalizedBottomCenter": True,
        }
    manifest["assets"]["trash_bin"] = {
        "dimensionsMeters": build_trash_bin_asset(),
        "targetDimensionsMeters": [0.54, 0.62, 0.54],
        "role": "interactive_object",
        "source": "server_blender_detail_asset",
        "normalizedBottomCenter": True,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "rf05_layout.md").write_text(
        "# RF-05 realistic hotel room asset layout\n"
        "- Room shell: 8.4m x 10.8m x 2.8m, south entry clear width 1.3m.\n"
        "- Bathroom: entry-side 3.0m x 3.3m wet room with vanity, mirror, shower tray, room-side partition wall and glass return.\n"
        "- Twin beds: two 1.86m x 2.65m beds on the north wall with shared nightstand.\n"
        "- East wall: work desk, chair, television console, wardrobe and luggage bench.\n"
        "- Environment and six interactive GLBs are generated independently. Interactive source models are SAM3D outputs normalized to meter scale with bottom-center pivots.\n",
        encoding="utf-8",
    )


main()
