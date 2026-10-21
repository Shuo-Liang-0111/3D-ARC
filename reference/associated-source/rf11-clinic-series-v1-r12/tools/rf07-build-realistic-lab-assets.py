import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-root", required=True)
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(values)


CFG = parse_args()
OUTPUT = os.path.abspath(CFG.output_root)
INTERACTABLES = os.path.join(OUTPUT, "interactables")
os.makedirs(INTERACTABLES, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def material(name, color, roughness=0.65, metallic=0.0, alpha=1.0, emission=None):
    entry = bpy.data.materials.new(name)
    entry.diffuse_color = (*color, alpha)
    entry.use_nodes = True
    shader = entry.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, alpha)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if alpha < 1:
        shader.inputs["Alpha"].default_value = alpha
        entry.surface_render_method = "DITHERED"
    if emission:
        shader.inputs["Emission Color"].default_value = (*emission, 1)
        shader.inputs["Emission Strength"].default_value = 2.5
    return entry


def cube(name, location, dimensions, entry_material, bevel=0.02, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(entry_material)
    if bevel:
        modifier = obj.modifiers.new("Manufactured edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    return obj


def cylinder(name, location, radius, depth, entry_material, vertices=32, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(entry_material)
    modifier = obj.modifiers.new("Manufactured edge", "BEVEL")
    modifier.width = min(0.008, radius * 0.08)
    modifier.segments = 2
    return obj


def torus(name, location, major_radius, minor_radius, entry_material, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=40,
        minor_segments=10,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(entry_material)
    return obj


def tube(name, points, radius, entry_material):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for control, point in zip(spline.points, points):
        control.co = (*point, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(entry_material)
    return obj


def text_mesh(name, body, location, size, depth, entry_material, rotation=(math.pi / 2, 0, 0)):
    bpy.ops.object.text_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = depth
    obj.data.bevel_depth = min(depth * 0.2, 0.002)
    obj.data.materials.append(entry_material)
    bpy.ops.object.convert(target="MESH")
    return obj


def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )


def convert_to_runtime_coordinates():
    for obj in bpy.context.scene.objects:
        obj.location.y *= -1


def browser_bounds():
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type not in {"MESH", "CURVE"}:
            continue
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            points.append(Vector((point.x, point.z, -point.y)))
    return {
        "min": [round(min(point[index] for point in points), 4) for index in range(3)],
        "max": [round(max(point[index] for point in points), 4) for index in range(3)],
    }


def add_bench(name, center_x, center_y, width, depth, steel, worktop, dark):
    cube(f"{name}_Worktop", (center_x, center_y, 0.91), (width, depth, 0.08), worktop, 0.025)
    cube(f"{name}_Splashback", (center_x, center_y - depth / 2 + 0.025, 1.12), (width, 0.05, 0.38), steel, 0.015)
    modules = max(2, round(width / 0.8))
    cell = width / modules
    for index in range(modules):
        x = center_x - width / 2 + cell * (index + 0.5)
        cube(f"{name}_Cabinet_{index}", (x, center_y, 0.43), (cell - 0.025, depth - 0.12, 0.80), steel, 0.018)
        cube(f"{name}_Handle_{index}", (x, center_y + depth / 2 - 0.055, 0.58), (cell * 0.34, 0.025, 0.025), dark, 0.006)
    for x in (center_x - width / 2 + 0.12, center_x + width / 2 - 0.12):
        cylinder(f"{name}_Foot_{x}", (x, center_y, 0.045), 0.035, 0.09, dark, 20)


def add_biosafety_cabinet(name, center_x, center_y, steel, white, glass, dark, blue):
    cube(f"{name}_Body", (center_x, center_y, 1.10), (1.50, 0.78, 2.18), white, 0.035)
    cube(f"{name}_WorkSurface", (center_x, center_y + 0.18, 0.92), (1.32, 0.52, 0.06), steel, 0.018)
    cube(f"{name}_Opening", (center_x, center_y + 0.405, 1.38), (1.24, 0.025, 0.70), dark, 0.012)
    cube(f"{name}_Sash", (center_x, center_y + 0.425, 1.58), (1.20, 0.018, 0.52), glass, 0.006)
    cube(f"{name}_Header", (center_x, center_y + 0.40, 1.98), (1.32, 0.08, 0.24), white, 0.025)
    cube(f"{name}_Control", (center_x + 0.45, center_y + 0.445, 1.98), (0.25, 0.025, 0.10), blue, 0.008)
    for x in (-0.42, 0, 0.42):
        cube(f"{name}_Intake_{x}", (center_x + x, center_y + 0.43, 0.88), (0.25, 0.025, 0.025), dark, 0.004)


def add_centrifuge(center_x, center_y, white, dark, glass, blue):
    cube("Benchtop_Centrifuge", (center_x, center_y, 1.10), (0.48, 0.58, 0.32), white, 0.055)
    cylinder("Centrifuge_Lid", (center_x, center_y, 1.29), 0.19, 0.045, dark, 40)
    cube("Centrifuge_Display", (center_x, center_y + 0.30, 1.07), (0.19, 0.025, 0.08), glass, 0.008)
    cube("Centrifuge_Status", (center_x + 0.14, center_y + 0.315, 1.00), (0.035, 0.012, 0.018), blue, 0.004)


def add_analyzer(center_x, center_y, white, dark, glass, blue):
    cube("Compact_PCR_Analyzer", (center_x, center_y, 1.13), (0.62, 0.50, 0.38), white, 0.045)
    cube("Analyzer_Lid", (center_x, center_y - 0.08, 1.34), (0.54, 0.34, 0.07), dark, 0.028)
    cube("Analyzer_Screen", (center_x, center_y + 0.265, 1.14), (0.23, 0.025, 0.12), glass, 0.008)
    cube("Analyzer_Status", (center_x + 0.20, center_y + 0.28, 1.05), (0.04, 0.012, 0.018), blue, 0.004)


def add_barcode_station(center_x, center_y, white, dark, glass, blue):
    cube("LIMS_Monitor", (center_x, center_y, 1.55), (0.62, 0.08, 0.40), dark, 0.035)
    cube("LIMS_Screen", (center_x, center_y + 0.045, 1.55), (0.54, 0.012, 0.32), glass, 0.008)
    cube("LIMS_Stand", (center_x, center_y, 1.22), (0.06, 0.08, 0.28), dark, 0.012)
    cube("Barcode_Printer", (center_x + 0.52, center_y, 1.08), (0.36, 0.32, 0.24), white, 0.035)
    cube("Barcode_Output", (center_x + 0.52, center_y + 0.17, 1.05), (0.22, 0.025, 0.07), dark, 0.008)
    cube("Printer_Status", (center_x + 0.62, center_y + 0.18, 1.17), (0.035, 0.012, 0.016), blue, 0.004)


def add_sink(center_x, center_y, steel, ceramic, dark):
    cube("Handwash_Bench", (center_x, center_y, 0.84), (1.35, 2.55, 0.80), steel, 0.035)
    cube("Handwash_Worktop", (center_x, center_y, 1.27), (1.42, 2.65, 0.08), ceramic, 0.028)
    cube("Handsfree_Sink_Basin", (center_x, center_y - 0.25, 1.29), (0.75, 0.68, 0.09), dark, 0.09)
    tube("Gooseneck_Faucet", [(center_x, center_y - 0.50, 1.32), (center_x, center_y - 0.50, 1.72), (center_x, center_y - 0.15, 1.72), (center_x, center_y - 0.15, 1.52)], 0.025, steel)
    cube("Knee_Operated_Panel", (center_x + 0.69, center_y, 0.72), (0.035, 0.52, 0.28), dark, 0.018)
    cube("Soap_Dispenser", (center_x + 0.62, center_y - 0.55, 1.65), (0.12, 0.14, 0.28), ceramic, 0.022)


def add_waste_bin(name, center_x, center_y, yellow, dark):
    cube(f"{name}_Body", (center_x, center_y, 0.36), (0.42, 0.36, 0.72), yellow, 0.045)
    cube(f"{name}_Lid", (center_x, center_y, 0.75), (0.44, 0.38, 0.08), dark, 0.035)
    cube(f"{name}_Pedal", (center_x, center_y + 0.23, 0.08), (0.18, 0.12, 0.04), dark, 0.012)
    text_mesh(f"{name}_Mark", "BIO", (center_x, center_y + 0.185, 0.45), 0.09, 0.006, dark, (math.pi / 2, 0, 0))


def add_mobile_cart(name, center_x, center_y, steel, white, dark, blue):
    for level in (0.30, 0.72, 1.12):
        cube(f"{name}_Shelf_{level}", (center_x, center_y, level), (1.05, 0.58, 0.055), steel, 0.018)
    for x in (-0.47, 0.47):
        for y in (-0.235, 0.235):
            cylinder(f"{name}_Post", (center_x + x, center_y + y, 0.70), 0.018, 0.82, steel, 20)
            cylinder(f"{name}_Caster", (center_x + x, center_y + y, 0.09), 0.055, 0.035, dark, 20, (math.pi / 2, 0, 0))
    cube(f"{name}_Lidded_Box", (center_x - 0.22, center_y, 0.88), (0.42, 0.34, 0.28), white, 0.035)
    cube(f"{name}_Tube_Rack", (center_x + 0.27, center_y, 0.82), (0.32, 0.26, 0.12), blue, 0.018)
    for x in (-0.10, 0, 0.10):
        cylinder(f"{name}_Rack_Tube", (center_x + 0.27 + x, center_y, 0.93), 0.018, 0.16, white, 18)


def build_environment():
    epoxy = material("Seamless_Laboratory_Epoxy", (0.54, 0.60, 0.60), 0.62)
    wall = material("Washable_Cleanroom_Wall", (0.82, 0.85, 0.82), 0.86)
    cove = material("Coved_Skirting", (0.36, 0.50, 0.53), 0.58)
    steel = material("Brushed_Stainless_Steel_304", (0.46, 0.50, 0.51), 0.25, 0.78)
    white = material("Powder_Coated_Lab_White", (0.79, 0.82, 0.80), 0.52, 0.06)
    worktop = material("Black_Phenolic_Resin_Worktop", (0.045, 0.065, 0.068), 0.38, 0.10)
    dark = material("Charcoal_ABS", (0.025, 0.035, 0.038), 0.76)
    blue = material("Laboratory_Blue", (0.025, 0.34, 0.52), 0.40, 0.12)
    yellow = material("Medical_Waste_Yellow", (0.88, 0.58, 0.02), 0.52)
    red = material("Fire_Safety_Red", (0.66, 0.035, 0.025), 0.42, 0.16)
    glass = material("Safety_Glass", (0.08, 0.27, 0.32), 0.16, 0.14, 0.44)
    ceramic = material("White_Ceramic", (0.90, 0.91, 0.87), 0.28)

    cube("Epoxy_Floor_24x16m", (0, 0, -0.08), (24, 16, 0.16), epoxy, 0)
    cube("North_Wall", (0, -8.0, 1.65), (24, 0.24, 3.3), wall, 0.015)
    cube("West_Wall", (-12.0, 0, 1.65), (0.24, 16, 3.3), wall, 0.015)
    cube("East_Wall", (12.0, 0, 1.65), (0.24, 16, 3.3), wall, 0.015)
    cube("South_Wall_West", (-6.55, 8.0, 1.65), (10.9, 0.24, 3.3), wall, 0.015)
    cube("South_Wall_East", (6.55, 8.0, 1.65), (10.9, 0.24, 3.3), wall, 0.015)
    for x in (-11.84, 11.84):
        cube("Vertical_Coved_Skirting", (x, 0, 0.12), (0.12, 15.72, 0.24), cove, 0.04)
    for y in (-7.84, 7.84):
        cube("Horizontal_Coved_Skirting", (0, y, 0.12), (23.72, 0.12, 0.24), cove, 0.04)
    for x in range(-10, 11, 2):
        cube(f"Floor_Seam_{x}", (x, 0, 0.008), (0.012, 15.7, 0.012), cove, 0)
    for y in (-4, 0, 4):
        cube(f"Floor_Seam_{y}", (0, y, 0.009), (23.7, 0.012, 0.012), cove, 0)
    add_bench("Specimen_Receiving_Bench", -7.35, -7.10, 7.9, 1.0, steel, worktop, dark)
    add_centrifuge(-9.8, -6.88, white, dark, glass, blue)
    add_analyzer(-8.15, -6.88, white, dark, glass, blue)
    add_barcode_station(-5.2, -6.88, white, dark, glass, blue)
    for index, x in enumerate((-9.25, -7.35, -5.45)):
        cube(f"Specimen_Position_{index}", (x, -6.62, 0.965), (0.38, 0.28, 0.025), blue, 0.008)

    add_biosafety_cabinet("Class_II_A2_BSC_01", -2.0, -7.12, steel, white, glass, dark, blue)
    add_biosafety_cabinet("Class_II_A2_BSC_02", 0.0, -7.12, steel, white, glass, dark, blue)
    add_biosafety_cabinet("Class_II_A2_BSC_03", 2.0, -7.12, steel, white, glass, dark, blue)
    add_waste_bin("Biohazard_Waste_01", -3.65, -5.75, yellow, dark)
    add_waste_bin("Biohazard_Waste_02", 3.65, -5.75, yellow, dark)
    add_mobile_cart("Specimen_Transfer_Cart_01", -6.65, -2.35, steel, white, dark, blue)
    add_mobile_cart("Specimen_Transfer_Cart_02", -3.95, -2.35, steel, white, dark, blue)

    cube("Dry_Reagent_Cabinet", (7.75, -7.18, 1.10), (2.20, 0.78, 2.20), white, 0.035)
    for x in (7.22, 8.28):
        cube("Dry_Reagent_Glass_Door", (x, -6.775, 1.15), (0.94, 0.025, 1.70), glass, 0.025)
        cube("Dry_Reagent_Handle", (x + (0.36 if x < 7.75 else -0.36), -6.74, 1.15), (0.035, 0.035, 0.52), steel, 0.012)
    for level in (0.62, 1.02, 1.42, 1.82):
        cube("Dry_Reagent_Shelf", (7.75, -6.75, level), (1.95, 0.025, 0.025), steel, 0.004)

    add_bench("Cold_Chain_Packing_Island", 2.0, 1.1, 4.8, 1.6, steel, worktop, dark)
    cube("Packing_Consumables_Rack", (3.85, 1.1, 1.40), (0.68, 0.52, 0.82), white, 0.035)
    for level in (1.20, 1.43, 1.66):
        cube(f"Packing_Rack_Shelf_{level}", (3.85, 1.37, level), (0.58, 0.025, 0.025), steel, 0.004)
    for x in (0.0, 4.0):
        cylinder(f"Island_Bumper_{x}", (x, 1.1, 0.45), 0.045, 0.75, dark, 20)

    add_sink(-10.9, 4.1, steel, ceramic, dark)
    cube("Eyewash_Station", (-10.96, 2.95, 1.75), (0.74, 0.16, 0.48), white, 0.035)
    for x in (-11.12, -10.80):
        cylinder("Eyewash_Nozzle", (x, 2.82, 1.74), 0.055, 0.12, steel, 24, (math.pi / 2, 0, 0))

    cube("Anteroom_Left_Partition", (-1.60, 6.54, 1.65), (0.24, 2.92, 3.3), wall, 0.015)
    cube("Anteroom_Right_Partition", (1.60, 6.54, 1.65), (0.24, 2.92, 3.3), wall, 0.015)
    cube("Anteroom_Threshold", (0, 5.10, 0.025), (3.18, 0.08, 0.05), blue, 0)
    for index, x in enumerate((2.75, 3.45, 4.15, 4.85)):
        cube(f"PPE_Locker_{index}", (x, 7.23, 1.05), (0.62, 0.82, 2.10), white, 0.025)
        cube(f"PPE_Locker_Handle_{index}", (x + 0.19, 6.805, 1.08), (0.035, 0.025, 0.32), steel, 0.008)
        cube(f"PPE_Locker_Vent_{index}", (x, 6.79, 1.76), (0.28, 0.018, 0.10), dark, 0.006)
    cube("Shoe_Change_Bench", (-3.9, 7.25, 0.32), (3.2, 0.55, 0.64), steel, 0.04)
    for x in (-5.1, -4.3, -3.5, -2.7):
        cube("Shoe_Bench_Cubby", (x, 7.10, 0.20), (0.65, 0.28, 0.30), dark, 0.012)

    cube("Wall_Task_Board", (-11.80, -1.60, 1.62), (0.08, 1.70, 1.25), steel, 0.025)
    cube("Task_Board_Glass", (-11.75, -1.60, 1.62), (0.025, 1.55, 1.10), glass, 0.012)
    for z in (1.33, 1.62, 1.91):
        cube("Task_Board_Line", (-11.72, -1.60, z), (0.015, 1.20, 0.035), blue, 0.004)

    cube("Cold_Storage_Service_Plinth", (11.10, 0, 0.12), (1.55, 6.7, 0.24), dark, 0.025)
    cube("Cold_Storage_Power_Duct", (11.58, 0, 2.78), (0.24, 6.7, 0.30), steel, 0.018)
    for y in (-3.05, -1.05, 0.95, 2.95):
        cube("Cold_Storage_Socket", (11.42, y, 2.62), (0.08, 0.28, 0.20), dark, 0.012)

    cylinder("Fire_Extinguisher", (10.95, 6.70, 0.48), 0.13, 0.78, red, 32)
    tube("Fire_Extinguisher_Hose", [(10.95, 6.70, 0.82), (11.18, 6.70, 0.95), (11.20, 6.70, 0.60)], 0.018, dark)
    cube("Emergency_Exit_Mat", (0, 7.45, 0.012), (2.0, 0.65, 0.024), blue, 0.03)


def build_sample(code, color):
    shell = material(f"{code}_Impact_Resistant_PP", color, 0.48, 0.03)
    lid = material("Transparent_Specimen_Lid", (0.68, 0.80, 0.81), 0.18, 0.03, 0.46)
    foam = material("Closed_Cell_Foam_Insert", (0.07, 0.085, 0.085), 0.92)
    white = material("Medical_Label_White", (0.91, 0.92, 0.88), 0.52)
    red = material("Biohazard_Red", (0.65, 0.035, 0.025), 0.44)
    cube("Secondary_Specimen_Carrier", (0, 0, 0.045), (0.18, 0.11, 0.09), shell, 0.018)
    cube("Absorbent_Foam_Insert", (0, 0, 0.096), (0.155, 0.085, 0.018), foam, 0.008)
    for x in (-0.05, 0, 0.05):
        cylinder("Cryovial_Body", (x, 0, 0.116), 0.012, 0.065, white, 20)
        cylinder("Cryovial_Cap", (x, 0, 0.153), 0.014, 0.012, shell, 20)
    cube("Sealed_Transparent_Lid", (0, 0, 0.143), (0.175, 0.105, 0.018), lid, 0.012)
    cube("Specimen_Label_Plate", (0, 0.057, 0.070), (0.135, 0.012, 0.052), white, 0.004)
    text_mesh("Specimen_Identifier", code, (0, 0.064, 0.070), 0.040, 0.004, foam, (math.pi / 2, 0, 0))
    cube("UN3373_Diamond", (-0.068, -0.057, 0.064), (0.030, 0.008, 0.030), red, 0.002, (0, 0, math.pi / 4))


def build_transport_case():
    body = material("P650_Insulated_Case_Body", (0.065, 0.10, 0.11), 0.45, 0.16)
    edge = material("Anodized_Aluminium_Edge", (0.42, 0.46, 0.46), 0.24, 0.80)
    blue = material("Cold_Chain_Blue", (0.02, 0.31, 0.50), 0.40, 0.12)
    glass = material("Temperature_Logger_Display", (0.02, 0.10, 0.13), 0.15, 0.18)
    white = material("UN3373_Label", (0.91, 0.92, 0.88), 0.50)
    amber = material("Logger_Status", (0.93, 0.43, 0.03), 0.34, 0.08, emission=(0.93, 0.30, 0.02))
    cube("P650_Transport_Case_Base", (0, 0, 0.16), (0.62, 0.42, 0.32), body, 0.045)
    for x in (-0.275, 0.275):
        for y in (-0.175, 0.175):
            cube("Case_Protective_Corner", (x, y, 0.17), (0.07, 0.07, 0.30), edge, 0.018)
    for x in (-0.18, 0.18):
        cube("Case_Latch", (x, 0.216, 0.25), (0.10, 0.035, 0.13), edge, 0.018)
    cube("Case_Logger_Bezel", (0, 0.219, 0.15), (0.28, 0.028, 0.14), blue, 0.018)
    cube("Case_Logger_LCD", (0, 0.236, 0.17), (0.16, 0.012, 0.065), glass, 0.006)
    cube("Case_Logger_LED", (0.10, 0.241, 0.115), (0.025, 0.010, 0.012), amber, 0.003)
    cube("UN3373_Label_Plate", (-0.225, -0.216, 0.14), (0.11, 0.012, 0.11), white, 0.006, (0, 0, math.pi / 4))
    text_mesh("UN3373_Marking", "3373", (-0.225, -0.224, 0.14), 0.028, 0.003, body, (math.pi / 2, 0, 0))
    cylinder("Carry_Handle_Left", (-0.16, 0, 0.385), 0.018, 0.13, edge, 24)
    cylinder("Carry_Handle_Right", (0.16, 0, 0.385), 0.018, 0.13, edge, 24)
    cylinder("Carry_Handle_Grip", (0, 0, 0.45), 0.018, 0.32, edge, 24, (0, math.pi / 2, 0))


def build_cooling_module():
    blue = material("PCM_Cold_Plate_Blue", (0.02, 0.36, 0.58), 0.48, 0.04)
    white = material("PCM_Plate_Label", (0.90, 0.91, 0.87), 0.52)
    dark = material("PCM_Plate_Gasket", (0.03, 0.04, 0.04), 0.78)
    cube("PCM_Cold_Plate", (0, 0, 0.018), (0.19, 0.13, 0.036), blue, 0.018)
    cube("PCM_Cold_Plate_Label", (0, 0, 0.038), (0.13, 0.085, 0.008), white, 0.005)
    text_mesh("PCM_2_8C_Marking", "PCM 2-8C", (0, 0, 0.044), 0.022, 0.002, dark, (0, 0, 0))


def build_cold_cabinet(code, target=False):
    white = material("Medical_Refrigerator_White", (0.80, 0.83, 0.82), 0.42, 0.16)
    steel = material("Medical_Refrigerator_Stainless", (0.44, 0.48, 0.49), 0.24, 0.78)
    dark = material("Insulated_Door_Gasket", (0.025, 0.035, 0.038), 0.78)
    glass = material("Triple_Glazed_Door", (0.05, 0.18, 0.22), 0.14, 0.12, 0.42)
    blue = material("Target_Cabinet_Blue" if target else "Cabinet_Slate", (0.02, 0.40, 0.64) if target else (0.20, 0.34, 0.38), 0.38, 0.12)
    green = material("Temperature_Status_Green", (0.15, 0.78, 0.38), 0.28, 0.08, emission=(0.04, 0.80, 0.18))
    white_label = material("Cabinet_Label_White", (0.92, 0.93, 0.89), 0.50)
    cube("Medical_Refrigerator_Cabinet", (0, 0, 0.99), (0.76, 0.82, 1.98), white, 0.045)
    cube("Door_Gasket", (0, 0.423, 1.08), (0.66, 0.026, 1.46), dark, 0.025)
    cube("Insulated_Glass_Door", (0, 0.440, 1.08), (0.59, 0.018, 1.38), glass, 0.025)
    for level in (0.68, 1.02, 1.36):
        cube("Wire_Shelf", (0, 0.453, level), (0.56, 0.016, 0.025), steel, 0.003)
    cube("Controller_Header", (0, 0.424, 1.82), (0.68, 0.055, 0.20), blue, 0.022)
    cube("Temperature_Display", (-0.12, 0.458, 1.82), (0.24, 0.014, 0.085), dark, 0.005)
    text_mesh("Cabinet_Identifier", code, (0.18, 0.461, 1.82), 0.075, 0.004, white_label, (math.pi / 2, 0, math.pi))
    cube("Temperature_OK_LED", (-0.26, 0.462, 1.78), (0.025, 0.010, 0.018), green, 0.003)
    cube("Vertical_Door_Handle", (0.31, 0.490, 1.08), (0.045, 0.055, 0.62), steel, 0.018)
    cube("Compressor_Grille", (0, 0.422, 0.17), (0.56, 0.025, 0.16), dark, 0.016)
    for x in (-0.21, -0.105, 0, 0.105, 0.21):
        cube("Compressor_Grille_Slot", (x, 0.439, 0.17), (0.030, 0.010, 0.11), steel, 0.003)
    for x in (-0.30, 0.30):
        for y in (-0.32, 0.32):
            cylinder("Leveling_Foot", (x, y, 0.032), 0.035, 0.064, dark, 20)


def render_preview(path):
    bpy.ops.object.light_add(type="AREA", location=(-8, 4, 13))
    bpy.context.object.data.energy = 1800
    bpy.context.object.data.shape = "DISK"
    bpy.context.object.data.size = 8
    bpy.ops.object.light_add(type="AREA", location=(10, -5, 9))
    bpy.context.object.data.energy = 1100
    bpy.context.object.data.size = 7
    bpy.ops.object.light_add(type="AREA", location=(0, 9, 7))
    bpy.context.object.data.energy = 800
    bpy.context.object.data.size = 6
    bpy.ops.object.camera_add(location=(0, -5.0, 31.0))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0, 0, 0.25)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 38
    bpy.context.scene.camera = camera
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    scene.world.color = (0.12, 0.15, 0.16)
    bpy.ops.render.render(write_still=True)


def main():
    manifest = {
        "level": "RF-07",
        "standard": "Chinese BSL-2 biological laboratory cold-chain transfer room",
        "units": "meters",
        "upAxis": "Y",
        "room": {"width": 24, "depth": 16, "clearHeight": 3.3, "mainAisle": 1.5, "secondaryAisle": 1.2},
        "environment": None,
        "interactables": {},
    }
    clear_scene()
    build_environment()
    convert_to_runtime_coordinates()
    manifest["environment"] = browser_bounds()
    export_glb(os.path.join(OUTPUT, "rf07_realistic_bsl2_lab.glb"))
    render_preview(os.path.join(OUTPUT, "rf07_realistic_bsl2_lab_preview.png"))

    builders = {
        "sample_a17": lambda: build_sample("A-17", (0.78, 0.34, 0.05)),
        "sample_b12": lambda: build_sample("B-12", (0.04, 0.31, 0.64)),
        "sample_c04": lambda: build_sample("C-04", (0.04, 0.46, 0.24)),
        "transport_case": build_transport_case,
        "cooling_module": build_cooling_module,
        "cold_01": lambda: build_cold_cabinet("01"),
        "cold_02": lambda: build_cold_cabinet("02", True),
        "cold_03": lambda: build_cold_cabinet("03"),
    }
    for name, builder in builders.items():
        clear_scene()
        builder()
        convert_to_runtime_coordinates()
        manifest["interactables"][name] = browser_bounds()
        export_glb(os.path.join(INTERACTABLES, f"{name}.glb"))
    for key, value in manifest["interactables"].items():
        value["fileBytes"] = os.path.getsize(os.path.join(INTERACTABLES, f"{key}.glb"))
    manifest["environment"]["fileBytes"] = os.path.getsize(os.path.join(OUTPUT, "rf07_realistic_bsl2_lab.glb"))
    with open(os.path.join(OUTPUT, "manifest.json"), "w", encoding="utf-8") as stream:
        json.dump(manifest, stream, ensure_ascii=False, indent=2)


main()
