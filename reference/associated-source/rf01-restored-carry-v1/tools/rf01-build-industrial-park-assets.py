import argparse
import hashlib
import json
import math
import os
import sys

import bpy
from mathutils import Vector


def args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-root", required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])


CFG = args()\nOUTPUT = os.path.abspath(CFG.output_root)
INTERACTABLES = os.path.join(OUTPUT, "interactables")
os.makedirs(INTERACTABLES, exist_ok=True)


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.fonts):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def mat(name, color, roughness=.65, metallic=0, alpha=1, emission=None):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, alpha)
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, alpha)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if alpha < 1:
        shader.inputs["Alpha"].default_value = alpha
        value.surface_render_method = "DITHERED"
    if emission:
        shader.inputs["Emission Color"].default_value = (*emission, 1)
        shader.inputs["Emission Strength"].default_value = 2.2
    return value


def cube(name, loc, dims, material, bevel=.02, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new("Manufactured edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return obj


def cylinder(name, loc, radius, depth, material, vertices=24, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    modifier = obj.modifiers.new("Manufactured edge", "BEVEL")
    modifier.width = min(.008, radius * .08)
    modifier.segments = 2
    return obj


def tube(name, points, radius, material):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for control, point in zip(spline.points, points):
        control.co = (*point, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)


def label(name, body, loc, size, material):
    bpy.ops.object.text_add(location=loc, rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = .018
    obj.data.bevel_depth = .003
    obj.data.materials.append(material)
    bpy.ops.object.convert(target="MESH")


def fence(name, start, end, steel, concrete):
    x1, z1 = start
    x2, z2 = end
    length = math.hypot(x2 - x1, z2 - z1)
    angle = math.atan2(z2 - z1, x2 - x1)
    center = ((x1 + x2) / 2, (z1 + z2) / 2)
    cube(name + "_Curb", (*center, .18), (length, .28, .36), concrete, .015, (0, 0, angle))
    for height in (.72, 1.35, 1.92, 2.12):
        cube(name + "_Rail", (*center, height), (length, .045, .045), steel, .006, (0, 0, angle))
    count = max(1, round(length / 2.4))
    for index in range(count + 1):
        ratio = index / count
        cube(name + "_Post", (x1 + (x2 - x1) * ratio, z1 + (z2 - z1) * ratio, 1.18), (.09, .09, 2), steel, .01)


def bollard(name, x, z, yellow, dark):
    cylinder(name, (x, z, .48), .09, .96, yellow, 20)
    cube(name + "_Band", (x, z - .091, .54), (.19, .012, .12), dark, .002)


def streetlight(name, x, z, steel, lamp):
    cylinder(name + "_Pole", (x, z, 3.35), .065, 6.7, steel, 20)
    tube(name + "_Arm", [(x, z, 6.5), (x + .75, z, 6.5)], .045, steel)
    cube(name + "_Head", (x + .82, z, 6.43), (.55, .24, .12), lamp, .025)


def tree(name, x, z, trunk, leaves):
    cylinder(name + "_Trunk", (x, z, 1.2), .16, 2.4, trunk, 18)
    for index, offset in enumerate(((0, 0, 3.2), (.35, .1, 3), (-.25, -.2, 3.1))):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.05, location=(x + offset[0], z + offset[1], offset[2]))
        crown = bpy.context.object
        crown.name = name + "_Crown"
        crown.scale = (1, .9, 1.15)
        crown.data.materials.append(leaves)


def build_environment():
    asphalt = mat("Weathered_Asphalt", (.105, .12, .12), .94)
    concrete = mat("Precast_Concrete", (.48, .50, .48), .88)
    apron = mat("Loading_Apron_Concrete", (.41, .43, .42), .90)
    blue = mat("Industrial_Park_Blue_Steel", (.12, .29, .36), .50, .32)
    panel = mat("Insulated_Wall_Panel", (.48, .60, .62), .58, .18)
    dark = mat("Charcoal_Steel", (.035, .045, .045), .58, .62)
    steel = mat("Hot_Dip_Galvanized_Steel", (.38, .42, .42), .34, .78)
    glass = mat("Industrial_Window_Glass", (.045, .16, .19), .14, .12, .48)
    white = mat("Road_Marking_White", (.78, .80, .75), .78)
    yellow = mat("Safety_Yellow", (.88, .58, .025), .52)
    red = mat("Fire_Safety_Red", (.67, .035, .025), .46, .12)
    green = mat("Landscaping_Green", (.10, .28, .12), .92)
    trunk = mat("Tree_Bark", (.18, .10, .055), .96)
    brick = mat("Utility_Building_Brick", (.43, .25, .18), .88)
    lamp = mat("LED_Diffuser", (.82, .86, .80), .34, emission=(.5, .58, .52))

    cube("Site_Asphalt_48x32m", (0, 0, -.1), (48, 32, .2), asphalt, 0)
    cube("Loading_Apron", (-4.5, -2, .015), (31, 10, .03), apron, 0)
    cube("South_Access_Road", (9, 12.4, .018), (8, 7.2, .036), asphalt, 0)
    for x in (-22.8, 22.8):
        cube("Landscape_Strip", (x, -1.5, .05), (1.5, 20.5, .1), green)
    cube("South_Landscape_Strip", (-7.5, 12.9, .05), (28.5, 2.2, .1), green)
    for name, start, end in (
        ("North_Fence", (-24, -16), (24, -16)), ("West_Fence", (-24, -16), (-24, 9)),
        ("East_Fence", (24, -16), (24, 9)), ("South_Fence_West", (-24, 9), (6.3, 9)),
        ("South_Fence_East", (11.7, 9), (24, 9)),
    ):
        fence(name, start, end, steel, concrete)

    # Standard 26 x 9 m single-storey light-industrial workshop with 7.2 m eaves.
    cube("Workshop_Main_Volume", (-5, -11.45, 3.55), (26, 8.7, 7.1), panel, .05)
    cube("Workshop_Parapet", (-5, -7.02, 6.85), (26.2, .18, .7), blue)
    for x in [value / 2 for value in range(-35, 16)]:
        cube("Workshop_Panel_Rib", (x, -7, 3.8), (.025, .06, 5.8), steel, .002)
    for x in (-14, -9, -4, 1, 6):
        cube("Workshop_Window", (x, -6.955, 5.1), (3.1, .035, .85), glass, .012)
        cube("Workshop_Window_Sill", (x, -6.92, 4.63), (3.3, .12, .1), steel, .01)
    for x in (-11.5, 1.5):
        cube("Roller_Shutter", (x, -6.91, 2.35), (5, .12, 4.55), steel)
        for level in [0.45 + index * .31 for index in range(13)]:
            cube("Shutter_Slat", (x, -6.84, level), (4.78, .035, .025), dark, .002)
        for side in (-2.62, 2.62):
            cube("Shutter_Guide", (x + side, -6.86, 2.35), (.16, .18, 4.75), blue, .012)
    cube("Loading_Dock", (-5, -5.9, .55), (26, 1.9, 1.1), concrete)
    for x in (-14, -9, -4, 1, 6):
        cube("Dock_Bumper", (x, -4.91, .5), (.26, .16, .62), dark)
    label("Workshop_Sign", "A01  PRECISION ASSEMBLY", (-5, -6.88, 6.08), .56, white)
    # Standing-seam metal roof, daylight strips and extract fans are visible from the game camera.
    cube("Workshop_Metal_Roof", (-5, -11.45, 7.14), (26.4, 9.05, .12), blue, .015)
    for x in [value / 2 for value in range(-36, 17)]:
        cube("Roof_Standing_Seam", (x, -11.45, 7.225), (.025, 8.85, .05), steel, .002)
    for x in (-12, -5, 2):
        cube("Roof_Daylight_Strip", (x, -11.45, 7.24), (3.3, 1.15, .035), glass, .008)
    for x in (-14, -8, -2, 4):
        cylinder("Roof_Extract_Fan_Base", (x, -10.0, 7.42), .34, .42, steel, 24)
        cylinder("Roof_Extract_Fan_Cowl", (x, -10.0, 7.66), .42, .12, dark, 24)
    cube("Workshop_Eaves_Gutter", (-5, -6.93, 6.86), (26.4, .18, .18), steel, .025)
    for x in (-17.8, 7.8):
        cylinder("Workshop_Downpipe", (x, -6.86, 3.2), .065, 6.4, steel, 20)
    # Two 3.5 m truck reversing bays and continuous dock-edge warning markings.
    for center in (-11.5, 1.5):
        for side in (-2.55, 2.55):
            cube("Truck_Bay_Side_Line", (center + side, -1.75, .045), (.10, 6.15, .045), white, .002)
        cube("Truck_Bay_Stop_Line", (center, 1.28, .045), (5.2, .10, .045), white, .002)
    for index in range(43):
        cube("Dock_Hazard_Marking", (-17.6 + index * .60, -4.88, 1.12), (.31, .035, .16), yellow if index % 2 == 0 else dark, .002)

    cube("Maintenance_Room", (-20.1, -3.2, 2.25), (6.1, 6.2, 4.5), brick, .035)
    cube("Maintenance_Roof", (-20.1, -3.2, 4.58), (6.45, 6.55, .16), blue)
    cube("Maintenance_Door", (-17.01, -3.2, 1.18), (.1, 1.65, 2.36), dark)
    cube("Maintenance_Window", (-17, -5.25, 2.6), (.08, 1.15, .85), glass)
    cube("Battery_Rack_Back", (-16.35, -.15, .75), (1.75, .12, 1.5), steel)
    for x in (-17.12, -15.58):
        cube("Battery_Rack_Post", (x, -.75, .75), (.08, 1.25, 1.5), steel)
    cube("Battery_Rack_Shelf", (-16.35, -.75, .62), (1.72, 1.25, .1), steel)

    # Independent 10 kV distribution enclosure with equipment clearances.
    for name, start, end in (
        ("Substation_West", (11.5, -14.8), (11.5, -5.2)),
        ("Substation_South", (11.5, -5.2), (21.8, -5.2)),
        ("Substation_East", (21.8, -5.2), (21.8, -14.8)),
    ):
        fence(name, start, end, steel, concrete)
    cube("Substation_Pad", (16.65, -10, .11), (9.8, 9, .22), concrete)
    for index, x in enumerate((14.1, 17)):
        cube("Transformer_Tank", (x, -10.8, 1.35), (2.05, 1.45, 2.5), steel, .08)
        for rib in (-.72, -.36, 0, .36, .72):
            cube("Transformer_Fin", (x + rib, -10.02, 1.35), (.09, .16, 2), dark, .008)
        for bushing in (-.48, 0, .48):
            cylinder("Transformer_Bushing", (x + bushing, -10.8, 2.92), .1, .55, dark, 20)
    for x in (19.1, 20.25):
        cube("Switchgear", (x, -10.7, 1.15), (.95, .85, 2.3), panel, .035)
        cube("Switchgear_Handle", (x, -10.25, 1.2), (.25, .04, .05), dark, .008)
        cube("Switchgear_Indicator", (x, -10.24, 1.65), (.06, .025, .06), red, .01)
    label("Substation_Warning", "10kV  DANGER", (16.65, -5.12, 1.55), .34, yellow)

    cube("Gatehouse", (16.8, 6.35, 1.55), (4.4, 4.2, 3.1), concrete, .04)
    cube("Gatehouse_Roof", (16.8, 6.35, 3.18), (4.75, 4.55, .16), blue)
    cube("Gatehouse_West_Window", (14.57, 6.35, 1.75), (.06, 2.5, 1.2), glass)
    cube("Gatehouse_South_Window", (16.8, 4.22, 1.75), (2.5, .06, 1.2), glass)
    cube("Gatehouse_Door", (18.12, 4.2, 1.08), (.88, .08, 2.16), dark)
    cube("Gate_Post_West", (6.05, 9, 1.65), (.52, .62, 3.3), concrete)
    cube("Gate_Post_East", (11.95, 9, 1.65), (.52, .62, 3.3), concrete)
    cube("Sliding_Gate_Rail", (9, 9, .035), (11.6, .16, .07), steel)
    for x in (5.3, 12.7):
        for z in (7.9, 9.8):
            bollard("Gate_Bollard", x, z, yellow, dark)
    for index in range(8):
        cube("Lane_Dash", (9, 10 + index * .75, .035), (.12, .48, .035), white, .002)
    for index in range(6):
        cube("Crosswalk", (6.7 + index * .9, 8, .038), (.52, 1.7, .038), white, .002)
    for index, x in enumerate((-19.5, -12.5, -5.5, 2, 21.5)):
        streetlight("Streetlight_" + str(index), x, 5.5 if x < 10 else 1, steel, lamp)
    for index, z in enumerate((-12.5, -6.5, 0, 6)):
        tree("Tree_" + str(index), -22.7, z, trunk, green)
    cylinder("Fire_Hydrant_Body", (8.8, -3.6, .48), .15, .96, red)
    cylinder("Fire_Hydrant_Cap", (8.8, -3.6, 1), .22, .12, red)
    cube("Fire_Equipment_Cabinet", (9.5, -4, .75), (.8, .35, 1.5), red)
    for x in (-12, -2, 8, 18):
        cylinder("Storm_Drain", (x, 3.4, .018), .34, .025, dark, 28)


def build_battery():
    shell = mat("Energy_Module_Graphite", (.055, .07, .072), .48, .28)
    steel = mat("Energy_Module_Steel", (.35, .39, .39), .30, .78)
    yellow = mat("Energy_Module_Safety_Yellow", (.88, .55, .02), .48)
    dark = mat("Connector_Rubber", (.018, .022, .022), .82)
    cube("Portable_Energy_Module_550x340x250mm", (0, 0, .145), (.55, .34, .25), shell, .045)
    for x in (-.245, .245):
        cube("Steel_Corner_Guard", (x, 0, .145), (.055, .35, .26), steel, .016)
    for x in (-.15, .15):
        tube("Folding_Handle", [(x - .07, -.08, .28), (x - .07, .04, .38), (x + .07, .04, .38), (x + .07, -.08, .28)], .018, steel)
    cube("High_Current_Connector", (0, .175, .145), (.20, .025, .10), dark, .012)
    for x in (-.19, -.095, 0, .095, .19):
        cube("Vent_Slot", (x, -.171, .15), (.035, .012, .11), dark, .004)
    cube("Identification_Band", (0, -.176, .08), (.36, .012, .045), yellow, .004)


def build_power_slot():
    body = mat("Emergency_Power_Cabinet", (.42, .48, .47), .48, .42)
    dark = mat("Power_Slot_Cavity", (.025, .032, .032), .72, .25)
    steel = mat("Power_Slot_Rail", (.36, .40, .40), .28, .78)
    amber = mat("Power_Status_Amber", (.82, .36, .015), .30, .08, emission=(.72, .24, .01))
    cube("Emergency_Access_Power_Cabinet", (0, 0, .60), (.70, .55, 1.20), body, .045)
    cube("Battery_Receiving_Cavity", (0, .286, .64), (.58, .025, .38), dark, .012)
    for x in (-.24, .24):
        cube("Alignment_Rail", (x, .302, .64), (.035, .035, .34), steel, .008)
    cube("Service_Door_Seam", (0, -.281, .78), (.58, .012, .62), dark, .008)
    cube("Status_Display", (0, .302, 1.02), (.24, .022, .09), amber, .008)
    cube("Cable_Plinth", (0, 0, .08), (.48, .45, .16), dark, .025)


def build_sliding_gate():
    steel = mat("Galvanized_Sliding_Gate", (.36, .40, .40), .34, .76)
    dark = mat("Gate_Roller_Rubber", (.025, .032, .032), .78)
    yellow = mat("Gate_Safety_Yellow", (.88, .57, .02), .50)
    cube("Gate_Top_Rail", (0, 0, 2.16), (5.20, .12, .12), steel, .015)
    cube("Gate_Bottom_Rail", (0, 0, .12), (5.20, .12, .18), steel, .015)
    for x in (-2.54, -1.7, -.85, 0, .85, 1.7, 2.54):
        cube("Gate_Vertical", (x, 0, 1.14), (.08, .10, 2.08), steel, .012)
    for x in (-1.75, 1.75):
        cylinder("Gate_Roller", (x, 0, .075), .09, .10, dark, 20, (math.pi / 2, 0, 0))
    for index in range(8):
        cube("Gate_Warning", (-2.25 + index * .64, -.065, .52), (.34, .018, .12), yellow if index % 2 == 0 else dark, .003)


def build_terminal():
    body = mat("Gate_Terminal_Powdercoat", (.30, .36, .36), .52, .38)
    dark = mat("Terminal_Bezel", (.025, .035, .036), .68)
    glass = mat("Terminal_Display", (.025, .16, .18), .20, .08, emission=(.01, .28, .30))
    red = mat("Emergency_Stop_Red", (.72, .025, .018), .38)
    cube("Maintenance_Terminal_Pedestal", (0, 0, .56), (.34, .28, 1.12), body, .035)
    cube("Terminal_Head", (0, -.015, 1.18), (.48, .34, .36), body, .045, (math.radians(-8), 0, 0))
    cube("Terminal_Screen_Bezel", (0, -.197, 1.22), (.38, .035, .22), dark, .018, (math.radians(-8), 0, 0))
    cube("Terminal_Screen", (0, -.219, 1.22), (.31, .015, .15), glass, .008, (math.radians(-8), 0, 0))
    cylinder("Emergency_Stop", (.15, -.205, 1.04), .045, .05, red, 24, (math.pi / 2, 0, 0))
    cube("Terminal_Base", (0, 0, .06), (.48, .42, .12), dark, .025)


def runtime_coords():
    for obj in bpy.context.scene.objects:
        obj.location.y *= -1


def bounds():
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type not in {"MESH", "CURVE", "FONT"}:
            continue
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            points.append(Vector((point.x, point.z, -point.y)))
    return {"min": [round(min(p[i] for p in points), 4) for i in range(3)], "max": [round(max(p[i] for p in points), 4) for i in range(3)]}


def export(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_apply=True, export_cameras=False, export_lights=False, export_animations=False)


def record(path, model_bounds):
    with open(path, "rb") as stream:
        digest = hashlib.sha256(stream.read()).hexdigest()
    return {**model_bounds, "fileBytes": os.path.getsize(path), "sha256": digest}


def preview(path):
    bpy.ops.object.light_add(type="SUN", location=(-12, 8, 22))
    bpy.context.object.data.energy = 2
    bpy.context.object.rotation_euler = (math.radians(28), math.radians(-18), math.radians(-32))
    bpy.ops.object.light_add(type="AREA", location=(15, 12, 18))
    bpy.context.object.data.energy = 1600
    bpy.context.object.data.size = 16
    bpy.ops.object.camera_add(location=(0, -30, 52))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0, 0, .3)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 48
    bpy.context.scene.camera = camera
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    scene.world.color = (.48, .58, .66)
    bpy.ops.render.render(write_still=True)


def main():
    manifest = {
        "level": "RF-01",
        "standard": "contemporary Chinese light-industrial park service yard",
        "units": "meters",
        "upAxis": "Y",
        "site": {"width": 48, "depth": 32, "workshop": [26, 9, 7.2], "mainRoadWidth": 7, "slidingGateClearWidth": 5},
        "assetBoundary": {"environment": "static architecture, utilities, road furniture and landscaping", "interactables": ["battery", "power_slot", "sliding_gate", "terminal"]},
        "environment": None,
        "interactables": {},
    }
    clear()
    build_environment()
    runtime_coords()
    environment_path = os.path.join(OUTPUT, "rf01_industrial_park.glb")
    environment_bounds = bounds()
    export(environment_path)
    if CFG.preview_output:\n        preview(os.path.abspath(CFG.preview_output))
    manifest["environment"] = record(environment_path, environment_bounds)
    for name, builder in {"battery": build_battery, "power_slot": build_power_slot, "sliding_gate": build_sliding_gate, "terminal": build_terminal}.items():
        clear()
        builder()
        runtime_coords()
        path = os.path.join(INTERACTABLES, name + ".glb")
        model_bounds = bounds()
        export(path)
        manifest["interactables"][name] = record(path, model_bounds)
    with open(os.path.join(OUTPUT, "manifest.json"), "w", encoding="utf-8") as stream:
        json.dump(manifest, stream, ensure_ascii=False, indent=2)


main()
