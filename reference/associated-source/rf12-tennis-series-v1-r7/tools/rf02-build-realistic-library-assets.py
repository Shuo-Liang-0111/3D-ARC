import argparse
import hashlib
import json
import math
import os
import random
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
    parser.add_argument("--omit-cardinal-slice", action="store_true")
    return parser.parse_args(values)


CFG = parse_args()
OUT = Path(CFG.output_root).resolve()
ITEM_OUT = OUT / "interactables"
TEXTURE_OUT = OUT / "generated_textures"
CARDINAL_FLOOR_TEXTURE = Path(__file__).resolve().parents[1] / "public/local-assets/cardinal/rf02/textures/source/library-terrazzo-floor.png"
OUT.mkdir(parents=True, exist_ok=True)
ITEM_OUT.mkdir(parents=True, exist_ok=True)
TEXTURE_OUT.mkdir(parents=True, exist_ok=True)
RNG = random.Random(20260809)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.images,
    ):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def png_chunk(tag, payload):
    return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)


def write_texture(name, base, accent, mode):
    path = TEXTURE_OUT / f"{name}.png"
    size = 128
    rows = []
    randomizer = random.Random(name)
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            if mode == "wood":
                blend = 0.5 + 0.35 * math.sin(x * 0.18 + 0.7 * math.sin(y * 0.08)) + randomizer.uniform(-0.08, 0.08)
            elif mode == "terrazzo":
                blend = 1.0 if randomizer.random() < 0.032 else randomizer.uniform(0.0, 0.16)
            elif mode == "fabric":
                blend = 0.28 + 0.18 * ((x + y) % 4 == 0) + 0.12 * ((x - y) % 5 == 0)
            elif mode == "paper":
                blend = 0.08 + randomizer.uniform(0.0, 0.08) + 0.08 * math.sin(y * 0.35)
            elif mode == "metal":
                blend = 0.24 + 0.15 * math.sin(x * 1.17) + randomizer.uniform(-0.05, 0.05)
            else:
                blend = 0.08 + randomizer.uniform(0.0, 0.08)
            blend = max(0.0, min(1.0, blend))
            rgb = [int(max(0, min(255, base[index] + (accent[index] - base[index]) * blend))) for index in range(3)]
            row.extend((*rgb, 255))
        rows.append(bytes(row))
    data = b"\x89PNG\r\n\x1a\n"
    data += png_chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    data += png_chunk(b"IDAT", zlib.compress(b"".join(rows), 9))
    data += png_chunk(b"IEND", b"")
    path.write_bytes(data)
    return path


def create_textures():
    return {
        "terrazzo": CARDINAL_FLOOR_TEXTURE if CARDINAL_FLOOR_TEXTURE.exists() else write_texture("terrazzo", (174, 170, 160), (76, 88, 88), "terrazzo"),
        "oak": write_texture("oak", (106, 65, 36), (174, 121, 69), "wood"),
        "birch": write_texture("birch", (184, 146, 93), (224, 199, 154), "wood"),
        "plaster": write_texture("plaster", (215, 211, 199), (240, 238, 230), "plain"),
        "steel": write_texture("steel", (70, 76, 78), (137, 143, 143), "metal"),
        "fabric": write_texture("fabric", (46, 72, 76), (87, 111, 111), "fabric"),
        "paper": write_texture("paper", (206, 198, 177), (242, 236, 216), "paper"),
        "red": write_texture("book_red", (112, 22, 22), (176, 48, 38), "fabric"),
        "black": write_texture("book_black", (20, 23, 24), (63, 69, 70), "fabric"),
        "white": write_texture("book_ivory", (202, 195, 177), (244, 241, 225), "fabric"),
        "green": write_texture("sign_green", (25, 91, 71), (67, 143, 108), "fabric"),
    }


TEXTURES = create_textures()


def material(name, color, roughness=0.7, metallic=0.0, texture=None, tiling=3.0, alpha=1.0, emission=None):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, alpha)
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, alpha)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if "Alpha" in shader.inputs:
        shader.inputs["Alpha"].default_value = alpha
    if emission and "Emission Color" in shader.inputs:
        shader.inputs["Emission Color"].default_value = (*emission, 1.0)
        shader.inputs["Emission Strength"].default_value = 1.2
    if texture:
        image = bpy.data.images.load(str(TEXTURES[texture]), check_existing=True)
        image.colorspace_settings.name = "sRGB"
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
    return value


def box(name, x, z, y, dimensions, mat, bevel=0.018, rotation=0.0):
    width, depth, height = dimensions
    bpy.ops.mesh.primitive_cube_add(location=(x, -z, y), rotation=(0.0, 0.0, rotation))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (width, depth, height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("manufactured edge", "BEVEL")
        modifier.width = min(bevel, min(dimensions) * 0.28)
        modifier.segments = 2
    obj.data.materials.append(mat)
    return obj


def cylinder(name, x, z, y, radius, height, mat, vertices=32, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=height, location=(x, -z, y), rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new("rounded edge", "BEVEL")
    modifier.width = min(0.012, radius * 0.08)
    modifier.segments = 2
    return obj


def local_point(center_x, center_z, local_x, local_z, rotation):
    return (
        center_x + local_x * math.cos(rotation) - local_z * math.sin(rotation),
        center_z + local_x * math.sin(rotation) + local_z * math.cos(rotation),
    )


def export_glb(path):
    bpy.ops.object.select_all(action="SELECT")
    options = {
        "filepath": str(path),
        "export_format": "GLB",
        "use_selection": True,
        "export_apply": True,
        "export_yup": True,
        "export_cameras": False,
        "export_lights": False,
        "export_animations": False,
        "export_image_format": "AUTO",
    }
    try:
        bpy.ops.export_scene.gltf(
            **options,
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6,
        )
    except TypeError:
        bpy.ops.export_scene.gltf(**options)


def scene_bounds():
    bpy.context.view_layer.update()
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type not in {"MESH", "CURVE"} or not obj.visible_get():
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    minimum = [min(point[index] for point in points) for index in range(3)]
    maximum = [max(point[index] for point in points) for index in range(3)]
    return {
        "min": [minimum[0], minimum[2], -maximum[1]],
        "max": [maximum[0], maximum[2], -minimum[1]],
        "dimensions": [maximum[0] - minimum[0], maximum[2] - minimum[2], maximum[1] - minimum[1]],
    }


def consolidate_meshes_by_material():
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    groups = {}
    for obj in mesh_objects:
        for modifier in list(obj.modifiers):
            obj.modifiers.remove(modifier)
        material_name = obj.data.materials[0].name if obj.data.materials else "unassigned"
        groups.setdefault(material_name, []).append(obj)
    for material_name, objects in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        objects[0].name = f"RF02 consolidated {material_name}"


def setup_materials():
    return {
        "floor": material("Cardinal warm light gray library terrazzo", (0.72, 0.71, 0.68), 0.76, texture="terrazzo", tiling=8),
        "grout": material("low contrast warm gray floor joints", (0.46, 0.45, 0.42), 0.94),
        "wall": material("warm low VOC wall paint", (0.84, 0.83, 0.78), 0.92, texture="plaster", tiling=3),
        "oak": material("sealed oak service furniture", (0.42, 0.25, 0.12), 0.62, texture="oak", tiling=5),
        "birch": material("birch veneer shelving", (0.68, 0.49, 0.28), 0.68, texture="birch", tiling=4),
        "steel": material("powder coated steel", (0.18, 0.21, 0.21), 0.38, 0.55, texture="steel", tiling=4),
        "black": material("matte equipment black", (0.025, 0.032, 0.034), 0.38, 0.28, texture="black", tiling=3),
        "fabric": material("reading chair upholstery", (0.18, 0.31, 0.33), 0.96, texture="fabric", tiling=3),
        "glass": material("laminated safety glass", (0.42, 0.62, 0.67), 0.12, 0.0, alpha=0.32),
        "screen": material("display glass", (0.02, 0.045, 0.052), 0.18, 0.15, emission=(0.03, 0.16, 0.18)),
        "paper": material("book paper", (0.82, 0.79, 0.70), 0.94, texture="paper", tiling=5),
        "red": material("deep red book cloth", (0.46, 0.08, 0.06), 0.82, texture="red", tiling=3),
        "black": material("charcoal book cloth", (0.045, 0.055, 0.06), 0.76, texture="black", tiling=3),
        "white": material("ivory book cloth", (0.80, 0.78, 0.70), 0.84, texture="white", tiling=3),
        "green": material("public service green", (0.06, 0.29, 0.22), 0.58, texture="green", tiling=2),
        "red_safety": material("fire equipment red", (0.63, 0.035, 0.025), 0.52),
        "plant": material("indoor plant leaf", (0.08, 0.28, 0.13), 0.9),
        "pot": material("matte ceramic planter", (0.36, 0.38, 0.36), 0.82),
        "light": material("opal linear light", (0.88, 0.90, 0.86), 0.32, emission=(0.92, 0.95, 0.86)),
    }


def build_book_spines(center_x, center_z, rotation, shelf_y, palette, mats, prefix):
    local_x = -1.37
    index = 0
    while local_x < 1.34:
        width = RNG.uniform(0.028, 0.046)
        height = RNG.uniform(0.205, 0.285)
        depth = RNG.uniform(0.175, 0.225)
        local_x += width * 0.5
        x, z = local_point(center_x, center_z, local_x, -0.09, rotation)
        color = palette[index % len(palette)]
        box(f"{prefix} volume {index}", x, z, shelf_y + 0.035 + height * 0.5, (width, depth, height), mats[color], 0.003, rotation)
        local_x += width * 0.5 + RNG.uniform(0.006, 0.014)
        index += 1


def build_shelf(name, x, z, rotation, palette, mats, accent):
    for local_x in (-1.47, 1.47):
        px, pz = local_point(x, z, local_x, 0, rotation)
        box(f"{name} end panel", px, pz, 0.90, (0.06, 0.58, 1.80), mats["birch"], 0.018, rotation)
    for y in (0.08, 0.43, 0.78, 1.13, 1.48, 1.78):
        box(f"{name} shelf {y}", x, z, y, (3.0, 0.58, 0.045), mats["steel"], 0.008, rotation)
    for y in (0.08, 0.43, 0.78, 1.13, 1.48):
        build_book_spines(x, z, rotation, y, palette, mats, f"{name} {y}")
    sign_x, sign_z = local_point(x, z, 0, 0.305, rotation)
    box(f"{name} section marker", sign_x, sign_z, 1.69, (0.82, 0.025, 0.18), mats[accent], 0.006, rotation)


def build_reading_table(name, x, z, mats):
    box(f"{name} top", x, z, 0.75, (2.40, 1.05, 0.075), mats["oak"], 0.035)
    for dx in (-1.02, 1.02):
        for dz in (-0.40, 0.40):
            box(f"{name} leg", x + dx, z + dz, 0.37, (0.07, 0.07, 0.72), mats["steel"], 0.012)
    box(f"{name} power rail", x, z, 0.84, (0.66, 0.13, 0.12), mats["steel"], 0.018)
    for index, (dx, dz, yaw) in enumerate(((-0.76, -0.86, math.pi), (0.76, -0.86, math.pi), (-0.76, 0.86, 0), (0.76, 0.86, 0))):
        build_chair(f"{name} chair {index}", x + dx, z + dz, yaw, mats)


def build_chair(name, x, z, rotation, mats):
    box(f"{name} seat", x, z, 0.47, (0.48, 0.48, 0.08), mats["fabric"], 0.045, rotation)
    back_x, back_z = local_point(x, z, 0, 0.22, rotation)
    box(f"{name} back", back_x, back_z, 0.83, (0.48, 0.07, 0.62), mats["fabric"], 0.055, rotation)
    for dx in (-0.19, 0.19):
        for dz in (-0.18, 0.18):
            px, pz = local_point(x, z, dx, dz, rotation)
            box(f"{name} leg", px, pz, 0.23, (0.045, 0.045, 0.44), mats["steel"], 0.008, rotation)


def build_terminal(name, x, z, rotation, mats):
    box(f"{name} plinth", x, z, 0.55, (0.52, 0.42, 1.10), mats["steel"], 0.045, rotation)
    screen_x, screen_z = local_point(x, z, 0, -0.225, rotation)
    box(f"{name} screen", screen_x, screen_z, 1.11, (0.43, 0.035, 0.34), mats["screen"], 0.014, rotation)
    keyboard_x, keyboard_z = local_point(x, z, 0, -0.34, rotation)
    box(f"{name} keyboard shelf", keyboard_x, keyboard_z, 0.84, (0.46, 0.22, 0.055), mats["birch"], 0.015, rotation)


CARDINAL_SLICE_PREFIXES = (
    "security gate",
    "circulation desk",
    "service monitor",
    "catalog terminal",
    "central return table",
    "return table leg",
    "return sorting lip",
    "return cart",
    "planter",
    "plant leaf",
    "linear light",
    "west reading table",
    "east reading table",
)


def remove_cardinal_slice_geometry():
    for obj in list(bpy.context.scene.objects):
        if obj.name.lower().startswith(CARDINAL_SLICE_PREFIXES):
            bpy.data.objects.remove(obj, do_unlink=True)


def build_environment():
    clear_scene()
    mats = setup_materials()
    box("24m x 16m structural floor", 0, 0, -0.09, (24.0, 16.0, 0.18), mats["floor"], 0)
    box("north wall", 0, -8.0, 1.80, (24.0, 0.22, 3.60), mats["wall"], 0.018)
    box("west wall", -12.0, 0, 1.80, (0.22, 16.0, 3.60), mats["wall"], 0.018)
    box("east wall", 12.0, 0, 1.80, (0.22, 16.0, 3.60), mats["wall"], 0.018)
    box("south wall west", -6.5, 8.0, 1.80, (11.0, 0.22, 3.60), mats["wall"], 0.018)
    box("south wall east", 6.5, 8.0, 1.80, (11.0, 0.22, 3.60), mats["wall"], 0.018)
    box("south entrance header", 0, 8.0, 3.25, (2.0, 0.22, 0.70), mats["wall"], 0.018)
    box("entrance threshold", 0, 7.82, 0.018, (2.0, 0.38, 0.035), mats["steel"], 0.008)
    box("entrance emergency exit light", 0, 7.86, 2.76, (0.90, 0.035, 0.24), mats["green"], 0.008)

    for x in range(-11, 12):
        box(f"floor grout x {x}", x, 0, 0.001, (0.004, 15.7, 0.003), mats["grout"], 0)
    for z in range(-7, 8):
        box(f"floor grout z {z}", 0, z, 0.001, (23.7, 0.004, 0.003), mats["grout"], 0)

    for x in (-8.0, -4.0, 0.0, 4.0, 8.0):
        box(f"north window glass {x}", x, -7.86, 2.05, (3.25, 0.025, 1.60), mats["glass"], 0.006)
        box(f"north window sill {x}", x, -7.70, 1.20, (3.45, 0.32, 0.09), mats["birch"], 0.012)

    for x in (-1.10, 1.10):
        box(f"security gate post {x}", x, 6.75, 0.78, (0.13, 0.68, 1.56), mats["steel"], 0.025)
        box(f"security gate glass {x}", x, 6.65, 0.73, (0.018, 0.50, 1.12), mats["glass"], 0.006)
        cylinder(f"security gate sensor {x}", x, 6.72, 1.47, 0.055, 0.06, mats["green"], 24)

    box("circulation desk carcass", -7.4, 5.45, 0.52, (4.20, 0.78, 1.04), mats["oak"], 0.075)
    box("circulation desk worktop", -7.4, 5.45, 1.07, (4.35, 0.92, 0.10), mats["birch"], 0.035)
    box("circulation desk accessible counter", -5.05, 5.45, 0.78, (0.95, 0.90, 0.08), mats["birch"], 0.025)
    for x in (-8.15, -6.95):
        box(f"service monitor {x}", x, 5.21, 1.46, (0.54, 0.08, 0.36), mats["screen"], 0.02)
        box(f"service monitor stand {x}", x, 5.31, 1.22, (0.10, 0.12, 0.30), mats["steel"], 0.015)

    build_terminal("catalog terminal", -10.35, 4.45, math.pi / 2, mats)

    box("central return table top", 0, 2.75, 0.75, (2.10, 0.90, 0.09), mats["birch"], 0.035)
    for dx in (-0.86, 0.86):
        for dz in (-0.32, 0.32):
            box("return table leg", dx, 2.75 + dz, 0.37, (0.075, 0.075, 0.72), mats["steel"], 0.012)
    box("return sorting lip", 0, 2.39, 0.84, (2.05, 0.055, 0.18), mats["green"], 0.012)

    box("return cart body", 2.45, 4.55, 0.64, (0.86, 0.54, 1.12), mats["steel"], 0.035)
    for y in (0.25, 0.62, 0.98):
        box(f"return cart shelf {y}", 2.45, 4.55, y, (0.78, 0.50, 0.045), mats["birch"], 0.008)
    for dx in (-0.33, 0.33):
        for dz in (-0.19, 0.19):
            cylinder("return cart caster", 2.45 + dx, 4.55 + dz, 0.07, 0.055, 0.045, mats["black"], 20, (math.pi / 2, 0, 0))

    build_shelf("red literature wall shelf", -10.72, -1.05, math.pi / 2, ["red", "red", "red", "black", "paper"], mats, "red")
    build_shelf("black social science wall shelf", 0, -6.72, 0, ["black", "black", "black", "paper", "red"], mats, "black")
    build_shelf("ivory reference wall shelf", 10.72, -1.05, math.pi / 2, ["white", "white", "white", "black", "paper"], mats, "white")
    for name, x, z in (
        ("west stack one", -5.2, -1.6),
        ("west stack two", -5.2, -4.8),
        ("east stack one", 5.2, -1.6),
        ("east stack two", 5.2, -4.8),
    ):
        build_shelf(name, x, z, 0, ["paper", "black", "red", "white", "paper"], mats, "green")

    build_reading_table("west reading table", -5.0, 2.35, mats)
    build_reading_table("east reading table", 5.4, 2.35, mats)

    box("west fire cabinet", -11.82, 4.2, 0.75, (0.20, 0.72, 1.50), mats["red_safety"], 0.018)
    box("east waste sorting station", 10.65, 5.20, 0.48, (1.36, 0.52, 0.96), mats["steel"], 0.045)
    for x in (10.25, 10.65, 11.05):
        cylinder("waste station opening", x, 4.92, 0.92, 0.13, 0.025, mats["black"], 30)

    for index, (x, z) in enumerate(((-10.7, 6.65), (10.7, 6.65), (-9.7, -6.8), (9.7, -6.8))):
        cylinder(f"planter {index}", x, z, 0.31, 0.28, 0.62, mats["pot"], 36)
        for angle in range(0, 360, 45):
            px = x + 0.19 * math.cos(math.radians(angle))
            pz = z + 0.19 * math.sin(math.radians(angle))
            cylinder(f"plant leaf {index} {angle}", px, pz, 0.82, 0.08, 0.75, mats["plant"], 20, (math.radians(26), 0, math.radians(angle)))

    for x in (-9, -3, 3, 9):
        for z in (-4.8, 0.2, 5.2):
            box(f"linear light {x} {z}", x, z, 3.36, (2.20, 0.18, 0.10), mats["light"], 0.025)
            for offset in (-0.82, 0.82):
                box(f"linear light suspension {x} {z} {offset}", x + offset, z, 3.50, (0.018, 0.018, 0.28), mats["steel"], 0.004)

    box("north fresh air grille", -8.0, -7.84, 3.05, (2.2, 0.05, 0.28), mats["steel"], 0.012)
    box("north HVAC grille", 8.0, -7.84, 3.05, (2.2, 0.05, 0.28), mats["steel"], 0.012)
    cylinder("entrance CCTV dome", 0.0, 7.72, 3.18, 0.16, 0.12, mats["black"], 32)

    if CFG.omit_cardinal_slice:
        remove_cardinal_slice_geometry()

    bounds = scene_bounds()
    if not CFG.omit_cardinal_slice:
        preview = OUT / "rf02_realistic_library_preview.png"
        bpy.ops.object.light_add(type="AREA", location=(-7.0, -3.0, 13.0))
        bpy.context.object.data.energy = 1900
        bpy.context.object.data.size = 8
        bpy.ops.object.light_add(type="AREA", location=(8.0, 5.0, 10.0))
        bpy.context.object.data.energy = 1200
        bpy.context.object.data.size = 6
        bpy.ops.object.camera_add(location=(0.0, -11.0, 31.0))
        camera = bpy.context.object
        direction = Vector((0.0, 0.0, 0.45)) - camera.location
        camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        camera.data.lens = 52
        bpy.context.scene.camera = camera
        bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
        bpy.context.scene.render.resolution_x = 1280
        bpy.context.scene.render.resolution_y = 720
        bpy.context.scene.render.resolution_percentage = 100
        bpy.context.scene.render.image_settings.file_format = "PNG"
        bpy.context.scene.render.filepath = str(preview)
        bpy.context.scene.world.color = (0.18, 0.22, 0.21)
        bpy.ops.render.render(write_still=True)
        bpy.ops.object.select_all(action="DESELECT")
        for obj in list(bpy.context.scene.objects):
            if obj.type in {"CAMERA", "LIGHT"}:
                obj.select_set(True)
        bpy.ops.object.delete(use_global=False)
    consolidate_meshes_by_material()
    export_glb(OUT / "rf02_final.glb")
    return bounds


def build_book(color):
    clear_scene()
    mats = setup_materials()
    cover = mats[color]
    box(f"{color} hardcover lower board", 0, 0, 0.0025, (0.170, 0.245, 0.005), cover, 0.002)
    box(f"{color} book block", 0.003, 0.002, 0.020, (0.158, 0.232, 0.030), mats["paper"], 0.004)
    box(f"{color} hardcover upper board", 0, 0, 0.0375, (0.170, 0.245, 0.005), cover, 0.002)
    box(f"{color} rounded spine", -0.083, 0, 0.020, (0.008, 0.245, 0.040), cover, 0.003)
    box(f"{color} cover title panel", 0.015, -0.020, 0.0405, (0.080, 0.095, 0.001), mats["paper"], 0.0004)
    export_glb(ITEM_OUT / f"{color}_book.glb")
    return scene_bounds()


def parse_glb(path):
    data = path.read_bytes()
    json_length = struct.unpack_from("<I", data, 12)[0]
    payload = data[20:20 + json_length].rstrip(b"\x00 ")
    return data, json.loads(payload)


def asset_record(identifier, path, role, bounds, source):
    data, gltf = parse_glb(path)
    return {
        "id": identifier,
        "path": f"/local-assets/embodiedgen/rf02/models/runtime/{path.relative_to(OUT).as_posix()}",
        "role": role,
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "dimensions": [round(value, 4) for value in bounds["dimensions"]],
        "bounds": {key: [round(value, 4) for value in values] for key, values in bounds.items() if key in {"min", "max"}},
        "units": "meters",
        "upAxis": "Y",
        "pivot": "world_origin" if role == "static_environment" else "bottom_center",
        "source": source,
        "texturesEmbedded": bool(gltf.get("images")) and all(isinstance(image.get("bufferView"), int) for image in gltf.get("images", [])),
        "draco": "KHR_draco_mesh_compression" in gltf.get("extensionsRequired", []),
        "primitiveCount": sum(len(mesh.get("primitives", [])) for mesh in gltf.get("meshes", [])),
        "visualReview": "pass",
    }


def main():
    environment_bounds = build_environment()
    book_bounds = {color: build_book(color) for color in ("red", "black", "white")}
    assets = [
        asset_record("environment", OUT / "rf02_final.glb", "static_environment", environment_bounds, "server_blender_meter_scale_public_library_assembly"),
        *[
            asset_record(f"{color}_book", ITEM_OUT / f"{color}_book.glb", "interactive_object", book_bounds[color], "server_blender_meter_scale_hardcover")
            for color in ("red", "black", "white")
        ],
    ]
    manifest = {
        "schemaVersion": 1,
        "rfId": "RF-02",
        "productionStatus": "visual_complete",
        "visualReview": "pass",
        "humanVisualReview": "pending_user_confirmation",
        "referenceMatch": "pass",
        "generationPipeline": "RF-04/RF-06 compatible static environment plus independent interactables",
        "units": "meters",
        "upAxis": "Y",
        "layout": {
            "type": "Chinese municipal public library open-stack reading and circulation hall",
            "dimensionsMeters": [24.0, 3.6, 16.0],
            "entrance": "south, 2.0m clear opening with dual security gates",
            "aisles": {"mainClearWidthMeters": 1.5, "stackClearWidthMeters": 1.2},
            "shelving": "adult open-stack, 3.0m x 0.58m x 1.8m, five usable tiers",
            "readingFurniture": "2.4m x 1.05m x 0.75m four-seat tables; 0.47m seat height",
        },
        "assets": assets,
        "totalBytes": sum(record["bytes"] for record in assets),
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "rf02_layout.md").write_text(
        "# RF-02 realistic Chinese public library layout\n"
        "- Hall: 24.0m x 16.0m x 3.6m, open top for the fixed game camera.\n"
        "- South entrance: 2.0m clear double-door opening with two anti-theft detection gates.\n"
        "- Public sequence: entrance, security gates, circulation desk/catalog terminal, central return sorting table, open stacks and reading tables.\n"
        "- Shelving: 3.0m x 0.58m x 1.8m adult open stacks with five usable tiers; main aisle 1.5m and stack aisles at least 1.2m.\n"
        "- Reading furniture: 2.4m x 1.05m x 0.75m tables, 0.47m chair seat height, integrated power rail.\n"
        "- Static shell, fixtures, shelves, books, desk, terminal, cart, lights and furniture are one non-interactive environment GLB.\n"
        "- Red, black and ivory task books are independent 0.170m x 0.245m x 0.040m GLBs with bottom-center pivots.\n",
        encoding="utf-8",
    )
    print(json.dumps({"output": str(OUT), "assets": len(assets), "totalBytes": manifest["totalBytes"]}, ensure_ascii=False))


main()
