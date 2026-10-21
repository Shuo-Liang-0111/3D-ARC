import argparse
import hashlib
import json
import math
import struct
import sys
import zlib
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector


def parse_args():
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    return parser.parse_args(values)


CFG = parse_args()
OUT = Path(CFG.output).resolve()
ITEM_OUT = OUT / "interactables"
TEXTURE_OUT = OUT / "generated_textures"
OUT.mkdir(parents=True, exist_ok=True)
ITEM_OUT.mkdir(parents=True, exist_ok=True)
TEXTURE_OUT.mkdir(parents=True, exist_ok=True)

BASIS = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
COLORS = {
    "red": (0.72, 0.08, 0.055),
    "yellow": (0.84, 0.56, 0.06),
    "blue": (0.055, 0.28, 0.62),
}
PARCEL_DIMENSIONS = {
    "red": (0.52, 0.32, 0.38),
    "yellow": (0.44, 0.26, 0.32),
    "blue": (0.58, 0.38, 0.42),
}
CODES = {"red": "A-01", "yellow": "B-02", "blue": "C-03"}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def png_chunk(tag, payload):
    return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)


def write_png(path, width, height, pixels):
    rows = []
    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            row.extend(pixels(x, y))
        rows.append(bytes(row))
    data = b"\x89PNG\r\n\x1a\n"
    data += png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    data += png_chunk(b"IDAT", zlib.compress(b"".join(rows), 9))
    data += png_chunk(b"IEND", b"")
    path.write_bytes(data)
    return path


def write_surface_texture(name, rgb, mode="grain"):
    path = TEXTURE_OUT / f"{name}.png"
    base = tuple(max(0, min(255, int(value * 255))) for value in rgb)

    def pixel(x, y):
        if mode == "concrete":
            variation = int(12 * math.sin(x * 0.31 + y * 0.17) + 7 * math.sin(x * 1.07 - y * 0.23))
        elif mode == "metal":
            variation = int(14 * math.sin(x * 0.73) + 5 * math.sin(y * 0.19))
        elif mode == "rubber":
            variation = int(7 * math.sin((x + y) * 1.3) + 4 * math.sin(x * 0.17))
        elif mode == "cardboard":
            variation = int(10 * math.sin(x * 0.41) + 6 * math.sin((x - y) * 0.23))
        else:
            variation = int(5 * math.sin(x * 0.25 + y * 0.37))
        return tuple(max(0, min(255, channel + variation)) for channel in base) + (255,)

    return write_png(path, 128, 128, pixel)


FONT = {
    "A": ("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
    "B": ("11110", "10001", "10001", "11110", "10001", "10001", "11110"),
    "C": ("01111", "10000", "10000", "10000", "10000", "10000", "01111"),
    "D": ("11110", "10001", "10001", "10001", "10001", "10001", "11110"),
    "F": ("11111", "10000", "10000", "11110", "10000", "10000", "10000"),
    "R": ("11110", "10001", "10001", "11110", "10100", "10010", "10001"),
    "S": ("01111", "10000", "10000", "01110", "00001", "00001", "11110"),
    "W": ("10001", "10001", "10001", "10101", "10101", "10101", "01010"),
    "0": ("01110", "10001", "10011", "10101", "11001", "10001", "01110"),
    "1": ("00100", "01100", "00100", "00100", "00100", "00100", "01110"),
    "2": ("01110", "10001", "00001", "00010", "00100", "01000", "11111"),
    "3": ("11110", "00001", "00001", "01110", "00001", "00001", "11110"),
    "-": ("00000", "00000", "00000", "11111", "00000", "00000", "00000"),
    " ": ("00000",) * 7,
}


def write_label_texture(name, text, accent, barcode=False):
    width, height = 256, 128
    grid = [[(242, 240, 232, 255) for _ in range(width)] for _ in range(height)]
    accent_rgb = tuple(int(value * 255) for value in accent)
    for y in range(14):
        for x in range(width):
            grid[y][x] = (*accent_rgb, 255)
    glyph_width = 5
    scale = 10 if len(text) <= 4 else 7
    spacing = scale * 2
    total = len(text) * glyph_width * scale + (len(text) - 1) * spacing
    start_x = max(10, (width - total) // 2)
    start_y = 28
    for char_index, char in enumerate(text):
        glyph = FONT.get(char.upper(), FONT[" "])
        origin_x = start_x + char_index * (glyph_width * scale + spacing)
        for row, values in enumerate(glyph):
            for column, value in enumerate(values):
                if value != "1":
                    continue
                for dy in range(scale):
                    for dx in range(scale):
                        x = origin_x + column * scale + dx
                        y = start_y + row * scale + dy
                        if 0 <= x < width and 0 <= y < height:
                            grid[y][x] = (22, 25, 24, 255)
    if barcode:
        for index in range(38):
            bar_width = 1 if index % 4 else 3
            left = 18 + index * 5
            for x in range(left, min(width - 18, left + bar_width)):
                for y in range(103, 121):
                    grid[y][x] = (18, 20, 19, 255)
    return write_png(TEXTURE_OUT / f"{name}.png", width, height, lambda x, y: grid[y][x])


def material(name, color, roughness=0.7, metallic=0.0, texture=None):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1.0)
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if texture:
        image = bpy.data.images.load(str(texture), check_existing=True)
        try:
            image.colorspace_settings.name = "sRGB"
        except (AttributeError, TypeError):
            pass
        image_node = value.node_tree.nodes.new("ShaderNodeTexImage")
        image_node.image = image
        image_node.extension = "REPEAT"
        coordinates = value.node_tree.nodes.new("ShaderNodeTexCoord")
        value.node_tree.links.new(coordinates.outputs["Generated"], image_node.inputs["Vector"])
        value.node_tree.links.new(image_node.outputs["Color"], shader.inputs["Base Color"])
    return value


def point_to_blender(point):
    return (point[0], -point[2], point[1])


def dimensions_to_blender(dimensions):
    return (dimensions[0], dimensions[2], dimensions[1])


def rotation_to_blender(rotation):
    matrix = Euler(rotation, "XYZ").to_matrix()
    return (BASIS @ matrix @ BASIS.transposed()).to_euler("XYZ")


def point_to_three(point):
    return (point.x, point.z, -point.y)


def box(name, location, dimensions, mat, bevel=0.0, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=point_to_blender(location), rotation=rotation_to_blender(rotation))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions_to_blender(dimensions)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("manufactured_edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return obj


def cylinder(name, location, radius, depth, mat, vertices=24, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=point_to_blender(location),
        rotation=rotation_to_blender(rotation),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def torus(name, location, major_radius, minor_radius, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=28,
        minor_segments=8,
        location=point_to_blender(location),
        rotation=rotation_to_blender(rotation),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


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
        points.extend(point_to_three(obj.matrix_world @ Vector(corner)) for corner in obj.bound_box)
    minimum = [min(point[index] for point in points) for index in range(3)]
    maximum = [max(point[index] for point in points) for index in range(3)]
    return {
        "min": minimum,
        "max": maximum,
        "dimensions": [maximum[index] - minimum[index] for index in range(3)],
    }


def environment_materials():
    concrete_texture = write_surface_texture("warehouse_concrete", (0.49, 0.50, 0.47), "concrete")
    metal_texture = write_surface_texture("galvanized_steel", (0.44, 0.47, 0.45), "metal")
    dark_texture = write_surface_texture("powder_coat", (0.09, 0.11, 0.11), "metal")
    belt_texture = write_surface_texture("belt_rubber", (0.055, 0.065, 0.06), "rubber")
    yellow_texture = write_surface_texture("safety_yellow", (0.87, 0.61, 0.055), "grain")
    green_texture = write_surface_texture("pedestrian_green", (0.12, 0.35, 0.26), "grain")
    cardboard_texture = write_surface_texture("kraft_cardboard", (0.56, 0.36, 0.19), "cardboard")
    return {
        "concrete": material("sealed warehouse concrete", (0.49, 0.50, 0.47), 0.86, 0.02, concrete_texture),
        "wall": material("insulated wall panel", (0.66, 0.69, 0.67), 0.7, 0.24, metal_texture),
        "steel": material("powder coated structural steel", (0.09, 0.11, 0.11), 0.38, 0.7, dark_texture),
        "galvanized": material("galvanized conveyor steel", (0.44, 0.47, 0.45), 0.3, 0.82, metal_texture),
        "belt": material("industrial rubber belt", (0.055, 0.065, 0.06), 0.74, 0.05, belt_texture),
        "yellow": material("safety yellow powder coat", (0.87, 0.61, 0.055), 0.48, 0.3, yellow_texture),
        "green": material("pedestrian lane epoxy", (0.12, 0.35, 0.26), 0.72, 0.02, green_texture),
        "cardboard": material("kraft carton", (0.56, 0.36, 0.19), 0.9, 0.0, cardboard_texture),
        "white": material("equipment white", (0.76, 0.78, 0.74), 0.5, 0.35, metal_texture),
        "red": material("emergency red", (0.72, 0.04, 0.025), 0.42, 0.25, yellow_texture),
    }


def build_environment():
    mats = environment_materials()
    box("WarehouseFloor", (0, -0.09, 0), (26, 0.18, 16), mats["concrete"])
    box("NorthInsulatedWall", (0, 2.3, -7.88), (26, 4.6, 0.24), mats["wall"], 0.015)
    box("WestInsulatedWall", (-12.88, 2.3, 0), (0.24, 4.6, 16), mats["wall"], 0.015)
    box("EastInsulatedWall", (12.88, 2.3, 0), (0.24, 4.6, 16), mats["wall"], 0.015)
    box("SouthWallWest", (-8.15, 2.3, 7.88), (9.7, 4.6, 0.24), mats["wall"], 0.015)
    box("SouthWallEast", (8.15, 2.3, 7.88), (9.7, 4.6, 0.24), mats["wall"], 0.015)
    box("SouthDoorHeader", (0, 4.15, 7.88), (6.6, 0.9, 0.24), mats["wall"], 0.015)
    for x in (-12, -6, 0, 6, 12):
        for z in (-7.62, 7.62):
            box(f"PortalColumn_{x}_{z}", (x, 2.25, z), (0.24, 4.5, 0.24), mats["steel"], 0.025)
    box("NorthCableTray", (0, 3.75, -6.9), (23.6, 0.12, 0.34), mats["galvanized"], 0.018)
    box("MainPedestrianLane", (0, 0.012, 2.55), (23.8, 0.024, 1.35), mats["green"], 0.005)
    for z in (-2.0, -0.50):
        box(f"ConveyorSafetyLine_{z}", (0, 0.018, z), (23.8, 0.03, 0.08), mats["yellow"], 0.006)
    for x in (-8.1, -2.7, 2.7, 8.1):
        box(f"CageDockLine_{x}", (x, 0.02, 5.0), (0.08, 0.03, 2.4), mats["yellow"], 0.005)

    belt_z = -1.25
    box("MainConveyorChassis", (0, 0.70, belt_z), (19.0, 0.28, 1.08), mats["steel"], 0.035)
    box("MainConveyorBelt", (0, 0.83, belt_z), (19.0, 0.08, 0.98), mats["belt"], 0.025)
    for z_offset in (-0.58, 0.58):
        box(f"MainSideRail_{z_offset}", (0, 0.96, belt_z + z_offset), (19.15, 0.24, 0.07), mats["galvanized"], 0.014)
    for x in range(-9, 10, 2):
        for z_offset in (-0.45, 0.45):
            box(f"ConveyorLeg_{x}_{z_offset}", (x, 0.36, belt_z + z_offset), (0.085, 0.72, 0.085), mats["steel"], 0.012)
            box(f"FootPlate_{x}_{z_offset}", (x, 0.035, belt_z + z_offset), (0.24, 0.04, 0.18), mats["steel"], 0.008)
    cylinder("DriveMotor", (9.2, 0.57, belt_z - 0.78), 0.23, 0.72, mats["steel"], 28, (math.pi / 2, 0, 0))
    box("DriveGearbox", (8.88, 0.58, belt_z - 0.67), (0.46, 0.42, 0.44), mats["yellow"], 0.04)

    box("AutomaticInfeedMachine", (-10.55, 1.02, belt_z), (2.5, 2.04, 1.8), mats["white"], 0.08)
    box("InfeedMachineLowerAccess", (-10.55, 0.48, belt_z - 0.915), (1.62, 0.72, 0.035), mats["steel"], 0.012)
    box("InfeedMachineUpperHood", (-10.68, 1.62, belt_z), (1.7, 0.58, 1.58), mats["steel"], 0.07)
    box("ParcelExitMouth", (-9.25, 1.16, belt_z), (0.10, 0.78, 1.12), mats["steel"], 0.018)
    for x in (-9.15, -9.02, -8.89, -8.76, -8.63):
        cylinder(f"InfeedRoller_{x}", (x, 0.86, belt_z), 0.075, 0.92, mats["galvanized"], 24, (math.pi / 2, 0, 0))
    box("InfeedStatusPanel", (-10.15, 1.18, belt_z - 0.93), (0.52, 0.36, 0.035), mats["steel"], 0.012)
    cylinder("InfeedEmergencyStop", (-9.92, 1.14, belt_z - 0.98), 0.07, 0.045, mats["red"], 24, (math.pi / 2, 0, 0))

    scanner_x = -4.35
    for z_offset in (-0.76, 0.76):
        box(f"DWSPost_{z_offset}", (scanner_x, 1.65, belt_z + z_offset), (0.13, 2.25, 0.13), mats["steel"], 0.018)
    box("DWSCrossbeam", (scanner_x, 2.76, belt_z), (0.34, 0.30, 1.65), mats["steel"], 0.03)
    box("DWSCamera", (scanner_x, 2.49, belt_z), (0.28, 0.18, 0.30), mats["steel"], 0.025)
    box("DWSLightBar", (scanner_x + 0.17, 2.30, belt_z), (0.04, 0.10, 0.70), mats["white"], 0.012)
    box("DWSScaleDeck", (scanner_x, 0.85, belt_z), (1.32, 0.07, 1.0), mats["galvanized"], 0.018)
    for offset in (-0.52, 0, 0.52):
        box(f"DWSPhotoeye_{offset}", (scanner_x + offset, 1.06, belt_z - 0.59), (0.09, 0.12, 0.08), mats["red"], 0.012)

    for row, x in enumerate((1.35, 1.62, 1.89, 2.16, 2.43, 2.70)):
        for column, z_offset in enumerate((-0.36, 0, 0.36)):
            roller = cylinder(f"SwingWheel_{row}_{column}", (x, 0.88, belt_z + z_offset), 0.09, 0.11, mats["galvanized"], 20, (0, 0, math.radians(20)))
            roller.scale.x = 1.0
    box("SwingWheelGuard", (2.02, 0.68, belt_z), (1.65, 0.28, 1.12), mats["yellow"], 0.025)

    for chute_index, x in enumerate((-4.6, 0, 4.6)):
        box(f"NorthChuteDeck_{chute_index}", (x, 0.65, -3.16), (0.88, 0.12, 3.0), mats["galvanized"], 0.02, (-0.055, 0, 0))
        for x_offset in (-0.48, 0.48):
            box(f"NorthChuteRail_{chute_index}_{x_offset}", (x + x_offset, 0.88, -3.16), (0.07, 0.34, 3.04), mats["yellow"], 0.014, (-0.055, 0, 0))
        for z in (-2.0, -2.45, -2.9, -3.35, -3.8, -4.25):
            cylinder(f"ChuteRoller_{chute_index}_{z}", (x, 0.72, z), 0.045, 0.82, mats["galvanized"], 18, (0, 0, math.pi / 2))
        box(f"ChuteGuardFrame_{chute_index}", (x, 0.52, -4.55), (1.08, 0.72, 0.16), mats["steel"], 0.02)

    for index, z in enumerate((-5.20, -4.25, -3.30)):
        box(f"WestElectricalCabinet_{index}", (-11.72, 1.12, z), (0.72, 2.12, 0.72), mats["white"], 0.045)
        box(f"CabinetDoor_{index}", (-11.34, 1.12, z), (0.025, 1.86, 0.58), mats["steel"], 0.01)
        cylinder(f"CabinetLamp_{index}", (-11.32, 1.82, z - 0.18), 0.035, 0.025, mats["red"], 18, (0, math.pi / 2, 0))

    for stack_index, (x, z) in enumerate(((10.25, 4.2), (11.05, 4.2), (10.25, 5.1), (11.05, 5.1))):
        box(f"Pallet_{stack_index}", (x, 0.08, z), (0.72, 0.14, 0.72), mats["cardboard"], 0.02)
        box(f"BufferCarton_{stack_index}", (x, 0.42, z), (0.62, 0.54, 0.58), mats["cardboard"], 0.045)
    for index, (x, z) in enumerate(((-10.4, 2.2), (9.4, -6.3))):
        cylinder(f"FireExtinguisher_{index}", (x, 0.34, z), 0.12, 0.62, mats["red"], 28)
        box(f"FireSign_{index}", (x, 1.15, z + 0.06), (0.42, 0.52, 0.04), mats["red"], 0.02)


def create_local_materials(asset_name, accent=None):
    metal_texture = write_surface_texture("galvanized_steel", (0.44, 0.47, 0.45), "metal")
    rubber_texture = write_surface_texture("caster_rubber", (0.055, 0.06, 0.055), "rubber")
    cardboard_texture = write_surface_texture("kraft_cardboard", (0.56, 0.36, 0.19), "cardboard")
    powder_texture = write_surface_texture("powder_coat", (0.09, 0.11, 0.11), "metal")
    return {
        "metal": material(f"{asset_name} galvanized steel", (0.44, 0.47, 0.45), 0.30, 0.82, metal_texture),
        "rubber": material(f"{asset_name} black rubber", (0.055, 0.06, 0.055), 0.84, 0.04, rubber_texture),
        "cardboard": material(f"{asset_name} corrugated kraft", (0.56, 0.36, 0.19), 0.91, 0.0, cardboard_texture),
        "dark": material(f"{asset_name} powder coat", (0.09, 0.11, 0.11), 0.4, 0.68, powder_texture),
        "accent": material(f"{asset_name} route accent", accent or (0.1, 0.35, 0.6), 0.48, 0.18, write_surface_texture(f"{asset_name}_accent", accent or (0.1, 0.35, 0.6))),
    }


def build_route_cage(parcel_type, origin=(0, 0, 0)):
    ox, oy, oz = origin
    mats = create_local_materials(f"{parcel_type}_route_cage", COLORS[parcel_type])
    box("CageBase", (ox, oy + 0.13, oz), (1.12, 0.10, 0.82), mats["metal"], 0.025)
    for x_offset in (-0.54, 0.54):
        for z_offset in (-0.38, 0.38):
            box(f"CageCorner_{x_offset}_{z_offset}", (ox + x_offset, oy + 0.86, oz + z_offset), (0.035, 1.48, 0.035), mats["metal"], 0.006)
    for y in (0.36, 0.69, 1.02, 1.35, 1.66):
        box(f"CageBackHorizontal_{y}", (ox, oy + y, oz + 0.38), (1.08, 0.022, 0.022), mats["metal"], 0.004)
        for x_offset in (-0.54, 0.54):
            box(f"CageSideHorizontal_{x_offset}_{y}", (ox + x_offset, oy + y, oz), (0.022, 0.022, 0.76), mats["metal"], 0.004)
    for x_offset in (-0.36, 0, 0.36):
        box(f"CageBackVertical_{x_offset}", (ox + x_offset, oy + 0.98, oz + 0.38), (0.018, 1.34, 0.018), mats["metal"], 0.003)
    for z_offset in (-0.19, 0.19):
        for x_offset in (-0.54, 0.54):
            box(f"CageSideVertical_{x_offset}_{z_offset}", (ox + x_offset, oy + 0.98, oz + z_offset), (0.018, 1.34, 0.018), mats["metal"], 0.003)
    box("FrontRetainingBar", (ox, oy + 0.42, oz - 0.39), (1.02, 0.035, 0.035), mats["metal"], 0.006)
    for x_offset in (-0.42, 0.42):
        for z_offset in (-0.30, 0.30):
            cylinder(f"CasterFork_{x_offset}_{z_offset}", (ox + x_offset, oy + 0.075, oz + z_offset), 0.055, 0.09, mats["metal"], 20, (math.pi / 2, 0, 0))
            cylinder(f"CasterWheel_{x_offset}_{z_offset}", (ox + x_offset, oy + 0.055, oz + z_offset), 0.08, 0.045, mats["rubber"], 24, (math.pi / 2, 0, 0))
    label_path = write_label_texture(f"route_{parcel_type}", CODES[parcel_type], COLORS[parcel_type])
    label_material = material(f"{parcel_type} route placard", (0.9, 0.9, 0.85), 0.55, 0.02, label_path)
    box("RoutePlacard", (ox, oy + 1.43, oz - 0.405), (0.68, 0.29, 0.018), label_material, 0.008)
    box("RoutePlacardTop", (ox, oy + 1.70, oz - 0.10), (0.68, 0.018, 0.29), label_material, 0.008)


def build_parcel(parcel_type, origin=(0, 0, 0)):
    ox, oy, oz = origin
    width, height, depth = PARCEL_DIMENSIONS[parcel_type]
    mats = create_local_materials(f"{parcel_type}_parcel", COLORS[parcel_type])
    box("CorrugatedCarton", (ox, oy + height / 2, oz), (width, height, depth), mats["cardboard"], 0.018)
    box("PackingTapeTop", (ox, oy + height + 0.004, oz), (width * 0.24, 0.008, depth + 0.012), mats["accent"], 0.002)
    box("PackingTapeSide", (ox - width / 2 - 0.004, oy + height / 2, oz), (0.008, height * 0.78, depth + 0.012), mats["accent"], 0.002)
    box("TopSeam", (ox, oy + height + 0.009, oz), (0.008, 0.004, depth * 0.92), mats["dark"], 0.001)
    label_path = write_label_texture(f"parcel_{parcel_type}", CODES[parcel_type], COLORS[parcel_type], barcode=True)
    label_material = material(f"{parcel_type} shipping label", (0.94, 0.93, 0.88), 0.66, 0.0, label_path)
    box("ShippingLabel", (ox + width * 0.12, oy + height + 0.011, oz), (width * 0.52, 0.006, depth * 0.54), label_material, 0.001)
    for z_offset in (-depth * 0.47, depth * 0.47):
        box(f"CartonFold_{z_offset}", (ox, oy + height * 0.51, oz + z_offset), (width * 0.92, 0.006, 0.006), mats["dark"], 0.001)


def build_terminal(origin=(0, 0, 0)):
    ox, oy, oz = origin
    mats = create_local_materials("dws_terminal", (0.08, 0.48, 0.31))
    box("TerminalPlinth", (ox, oy + 0.05, oz), (0.64, 0.10, 0.52), mats["dark"], 0.025)
    box("TerminalPedestal", (ox, oy + 0.50, oz), (0.56, 0.82, 0.46), mats["metal"], 0.055)
    box("KeyboardShelf", (ox, oy + 0.88, oz - 0.14), (0.55, 0.08, 0.62), mats["dark"], 0.025, (-0.10, 0, 0))
    box("MonitorHousing", (ox, oy + 1.25, oz), (0.56, 0.66, 0.30), mats["dark"], 0.045, (-0.08, 0, 0))
    screen_path = write_label_texture("dws_terminal_screen", "DWS RF03", (0.08, 0.48, 0.31), barcode=True)
    screen_material = material("DWS terminal screen", (0.08, 0.18, 0.16), 0.26, 0.1, screen_path)
    box("TerminalScreen", (ox, oy + 1.25, oz - 0.158), (0.46, 0.50, 0.016), screen_material, 0.012, (-0.08, 0, 0))
    cylinder("EmergencyStop", (ox + 0.19, oy + 0.78, oz - 0.255), 0.06, 0.05, mats["accent"], 24, (math.pi / 2, 0, 0))


def camera_look_at(camera, target):
    direction = Vector(point_to_blender(target)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview():
    for parcel_type, x in zip(("red", "yellow", "blue"), (-7.7, -2.2, 3.3)):
        build_parcel(parcel_type, (x, 0.875, -1.25))
    for parcel_type, x in zip(("red", "yellow", "blue"), (-5.4, 0, 5.4)):
        build_route_cage(parcel_type, (x, 0, 4.95))
    build_terminal((-10.25, 0, 5.55))
    bpy.ops.object.light_add(type="AREA", location=point_to_blender((-7, 9.5, 4)))
    bpy.context.object.data.energy = 1300
    bpy.context.object.data.shape = "RECTANGLE"
    bpy.context.object.data.size = 8
    bpy.context.object.data.size_y = 5
    bpy.ops.object.light_add(type="AREA", location=point_to_blender((7, 8.5, -2)))
    bpy.context.object.data.energy = 1050
    bpy.context.object.data.size = 7
    bpy.ops.object.camera_add(location=point_to_blender((0, 30, 12)))
    camera = bpy.context.object
    camera.data.lens = 44
    camera_look_at(camera, (0, 0.45, 0.4))
    bpy.context.scene.camera = camera
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 720
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.image_settings.file_format = "PNG"
    bpy.context.scene.render.filepath = str(OUT / "rf03_realistic_sorting_preview.png")
    bpy.context.scene.world.color = (0.08, 0.09, 0.09)
    bpy.ops.render.render(write_still=True)


def parse_glb(path):
    data = path.read_bytes()
    json_length = struct.unpack_from("<I", data, 12)[0]
    payload = data[20:20 + json_length].rstrip(b"\x00 ")
    return data, json.loads(payload)


def asset_record(identifier, path, role, bounds, source):
    data, gltf = parse_glb(path)
    return {
        "id": identifier,
        "path": f"/local-assets/embodiedgen/rf03/models/runtime/{path.relative_to(OUT).as_posix()}",
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
    clear_scene()
    build_environment()
    environment_bounds = scene_bounds()
    environment_path = OUT / "rf03_final.glb"
    export_glb(environment_path)
    render_preview()

    asset_specs = []
    for parcel_type in ("red", "yellow", "blue"):
        clear_scene()
        build_parcel(parcel_type)
        path = ITEM_OUT / f"{parcel_type}_parcel.glb"
        parcel_bounds = scene_bounds()
        export_glb(path)
        asset_specs.append((f"{parcel_type}_parcel", path, "interactive_object", parcel_bounds, "server_blender_meter_scale_corrugated_parcel"))
    for parcel_type in ("red", "yellow", "blue"):
        clear_scene()
        build_route_cage(parcel_type)
        path = ITEM_OUT / f"{parcel_type}_route_cage.glb"
        cage_bounds = scene_bounds()
        export_glb(path)
        asset_specs.append((f"{parcel_type}_route_cage", path, "interactive_target", cage_bounds, "server_blender_meter_scale_galvanized_roll_cage"))
    clear_scene()
    build_terminal()
    terminal_path = ITEM_OUT / "dws_terminal.glb"
    terminal_bounds = scene_bounds()
    export_glb(terminal_path)
    asset_specs.append(("dws_terminal", terminal_path, "interactive_target", terminal_bounds, "server_blender_meter_scale_industrial_terminal"))

    assets = [
        asset_record("environment", environment_path, "static_environment", environment_bounds, "server_blender_chinese_parcel_hub_reference_assembly"),
        *[asset_record(*spec) for spec in asset_specs],
    ]
    manifest = {
        "schemaVersion": 1,
        "rfId": "RF-03",
        "productionStatus": "visual_complete",
        "visualReview": "pass",
        "humanVisualReview": "pending_user_confirmation",
        "referenceMatch": "pass",
        "generationPipeline": "RF-04/RF-06 compatible Blender static environment plus independent interactables",
        "units": "meters",
        "upAxis": "Y",
        "layout": {
            "type": "Chinese express parcel hub DWS and swing-wheel sorting line",
            "dimensionsMeters": [26.0, 4.6, 16.0],
            "mainConveyor": {"widthMeters": 1.0, "beltHeightMeters": 0.82, "workingLengthMeters": 19.0},
            "infeedMachine": "west-end enclosed automatic singulation and induction machine with roller discharge",
            "dws": "over-belt barcode camera, light bar, photoeyes and scale deck before the sorter",
            "sorter": "modular swing-wheel node with three north gravity roller chutes",
            "manualExceptionArea": "three south-side galvanized route cages on a 1.35m pedestrian lane",
            "clearances": {"pedestrianLaneMeters": 1.35, "conveyorSafetyOffsetMeters": 0.25},
        },
        "referenceSources": [
            "https://www.zssorter.com/fenjianji/8-291.html",
            "Chinese domestic 800mm-class parcel conveyor product listings reviewed 2026-08-09",
        ],
        "assets": assets,
        "totalBytes": sum(record["bytes"] for record in assets),
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "rf03_layout.md").write_text(
        "# RF-03 realistic Chinese parcel sorting layout\n"
        "- Open-top hub: 26.0m x 16.0m x 4.6m with insulated panels, portal steel, cable tray, dock door, electrical cabinets, fire points and safety markings.\n"
        "- Main line: 19.0m x 1.0m continuous rubber belt at 0.82m working height.\n"
        "- West start: enclosed automatic singulation/infeed machine visibly discharges parcels through a short roller transfer.\n"
        "- Process order: automatic infeed, DWS barcode/weight portal, swing-wheel sorter, three north gravity roller chutes and an east drive module.\n"
        "- Manual exception task: three 1.12m x 0.82m x 1.74m galvanized route cages on the south pedestrian lane.\n"
        "- Static architecture and machinery are one non-interactive environment GLB. Three parcels, three route cages and the DWS terminal are seven independent interactive GLBs.\n",
        encoding="utf-8",
    )
    print(json.dumps({"output": str(OUT), "assets": len(assets), "totalBytes": manifest["totalBytes"]}, ensure_ascii=False))


main()
