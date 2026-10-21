"""Compose the RF-01 runtime package from EmbodiedGen outputs.

The building and task props come from the server-side EmbodiedGen
Kolors -> SAM3D pipeline. Blender is only used here for meter calibration,
collision-friendly pivots, and the small fixed yard pieces that are not
interactive.
"""

import hashlib
import json
import math
import os

import bpy
from mathutils import Vector


ROOT = "./external/EmbodiedGen/outputs/rf01_v2"
ENV_SOURCE = os.path.join(ROOT, "static_environment_v2/result/rf01_service_yard_reference.glb")
INTERACTABLE_SOURCE = os.path.join(ROOT, "interactables_3d")
OUT = "./public/local-assets/embodiedgen/rf01/models/runtime"
ITEM_OUT = os.path.join(OUT, "interactables")


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for item in list(collection):
            collection.remove(item)


def mat(name, color, metallic=0.0, roughness=0.7):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, 1.0)
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return material


def point_to_blender(point):
    return (point[0], -point[2], point[1])


def dimensions_to_blender(dimensions):
    return (dimensions[0], dimensions[2], dimensions[1])


def cube(name, location, dimensions, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=point_to_blender(location))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions_to_blender(dimensions)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new("edge_round", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    return obj


def cylinder(name, location, radius, depth, material, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=point_to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return obj


def import_meshes(path):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [obj for obj in bpy.context.scene.objects if obj not in before and obj.type == "MESH"]


def brighten_imported_materials(objects, value=1.35):
    materials = {material for obj in objects for material in obj.data.materials if material}
    for material in materials:
        if not material.use_nodes:
            continue
        shader = material.node_tree.nodes.get("Principled BSDF")
        if not shader:
            continue
        base_color = shader.inputs.get("Base Color")
        if base_color.is_linked:
            source = base_color.links[0].from_socket
            material.node_tree.links.remove(base_color.links[0])
            adjustment = material.node_tree.nodes.new("ShaderNodeHueSaturation")
            adjustment.inputs["Value"].default_value = value
            material.node_tree.links.new(source, adjustment.inputs["Color"])
            material.node_tree.links.new(adjustment.outputs["Color"], base_color)
        else:
            color = base_color.default_value
            base_color.default_value = tuple(min(channel * value, 1.0) for channel in color[:3]) + (color[3],)


def bounds(objects):
    points = []
    for obj in objects:
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return minimum, maximum


def make_root(name, objects):
    minimum, maximum = bounds(objects)
    origin = Vector((
        (minimum.x + maximum.x) / 2,
        (minimum.y + maximum.y) / 2,
        minimum.z,
    ))
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for obj in objects:
        world = obj.matrix_world.copy()
        world.translation -= origin
        obj.parent = root
        obj.matrix_world = world
    return root, maximum - minimum


def export_selected(path):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next((obj for obj in bpy.context.scene.objects if obj.select_get()), None)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )


def normalize_interactable(source, destination, target_dimensions):
    clear()
    meshes = import_meshes(source)
    brighten_imported_materials(meshes)
    root, extents = make_root(os.path.basename(destination), meshes)
    root.scale = (
        target_dimensions[0] / extents.x,
        target_dimensions[2] / extents.y,
        target_dimensions[1] / extents.z,
    )
    root.location = (0, 0, 0)
    export_selected(destination)


def fence_line(name, start, end, steel, mesh):
    sx, sz = start
    ex, ez = end
    length = ((ex - sx) ** 2 + (ez - sz) ** 2) ** 0.5
    horizontal = abs(ex - sx) >= abs(ez - sz)
    for index in range(int(length / 1.5) + 1):
        ratio = min(1.0, index * 1.5 / max(length, 0.01))
        x, z = sx + (ex - sx) * ratio, sz + (ez - sz) * ratio
        cylinder(f"{name}_post_{index}", (x, 1.15, z), 0.045, 2.3, steel, 16)
    rail_size = (length, 0.055, 0.055) if horizontal else (0.055, 0.055, length)
    for y in (0.55, 1.45, 2.05):
        cube(f"{name}_rail_{y}", ((sx + ex) / 2, y, (sz + ez) / 2), rail_size, steel, 0.012)
    for index in range(int(length / 0.42) + 1):
        ratio = min(1.0, index * 0.42 / max(length, 0.01))
        x, z = sx + (ex - sx) * ratio, sz + (ez - sz) * ratio
        cube(f"{name}_mesh_{index}", (x, 1.28, z), (0.018, 1.55, 0.018), mesh)


def build_environment(destination):
    clear()
    concrete = mat("yard concrete", (0.42, 0.45, 0.44), roughness=0.86)
    road = mat("road asphalt", (0.12, 0.14, 0.14), roughness=0.93)
    white = mat("lane marking", (0.82, 0.84, 0.79), roughness=0.74)
    safety = mat("safety yellow", (0.92, 0.64, 0.06), roughness=0.58)
    steel = mat("galvanized steel", (0.24, 0.29, 0.29), metallic=0.72, roughness=0.42)
    mesh = mat("fence mesh", (0.31, 0.36, 0.35), metallic=0.62, roughness=0.46)
    kiosk_wall = mat("guard kiosk wall", (0.78, 0.8, 0.77), roughness=0.82)
    kiosk_roof = mat("guard kiosk roof", (0.22, 0.29, 0.3), metallic=0.48, roughness=0.48)
    red = mat("fire equipment", (0.64, 0.055, 0.03), roughness=0.5)
    green = mat("hedge", (0.08, 0.21, 0.08), roughness=0.95)

    cube("ConcreteYard", (0, -0.08, 0), (20, 0.16, 16), concrete)
    cube("SouthServiceRoad", (0, -0.015, 6.1), (20, 0.04, 3.7), road)
    for x in (-6.3, -2.1, 2.1, 6.3):
        cube(f"ParkingStripe_{x}", (x, 0.012, 4.72), (0.075, 0.02, 2.25), white)
    cube("GateLaneMarking", (0, 0.014, 5.95), (4.4, 0.02, 0.09), safety)
    cube("GateLaneMarkingFar", (0, 0.014, 7.0), (4.4, 0.02, 0.09), safety)

    building = import_meshes(ENV_SOURCE)
    brighten_imported_materials(building, 1.42)
    building_root, extents = make_root("EmbodiedGenWorkshop", building)
    building_root.scale = (6.0 / extents.x, 10.4 / extents.y, 4.6 / extents.z)
    building_root.rotation_euler.z = -math.pi / 2
    building_root.location = point_to_blender((0, 0, -4.0))

    fence_line("FenceWest", (-9.8, -7.7), (-9.8, 6.8), steel, mesh)
    fence_line("FenceEast", (9.8, -7.7), (9.8, 6.8), steel, mesh)
    fence_line("FenceSouthWest", (-9.8, 6.8), (-2.45, 6.8), steel, mesh)
    fence_line("FenceSouthEast", (2.45, 6.8), (9.8, 6.8), steel, mesh)
    for x in (-2.45, 2.45):
        cylinder(f"GatePost_{x}", (x, 1.2, 6.8), 0.14, 2.4, steel, 24)
        cube(f"GateHead_{x}", (x, 2.35, 6.8), (0.26, 0.22, 0.34), steel, 0.04)
    cube("GateHeader", (0, 2.22, 6.8), (4.9, 0.22, 0.34), steel, 0.04)

    cube("GuardKiosk", (6.5, 1.1, 5.0), (2.1, 2.2, 1.8), kiosk_wall, 0.06)
    cube("GuardKioskRoof", (6.5, 2.28, 5.0), (2.3, 0.16, 2.0), kiosk_roof, 0.04)
    cube("GuardWindow", (6.5, 1.45, 4.05), (1.3, 0.75, 0.025), steel, 0.02)
    for x in (5.3, 7.7):
        cylinder(f"KioskBollard_{x}", (x, 0.45, 4.0), 0.06, 0.9, safety, 16)

    cube("ElectricalPad", (6.6, 0.025, -1.8), (2.7, 0.05, 1.8), concrete, 0.02)
    fence_line("ElectricalFence", (5.15, -2.75), (8.05, -2.75), steel, mesh)
    fence_line("ElectricalFenceSide", (8.05, -2.75), (8.05, -0.85), steel, mesh)
    cube("FireCabinet", (8.85, 0.72, -0.9), (0.42, 1.35, 0.22), red, 0.035)
    for x in (-7.9, -6.9):
        cube(f"WorkshopHedge_{x}", (x, 0.3, -0.85), (0.75, 0.6, 0.32), green, 0.08)

    export_selected(destination)


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_manifest():
    dimensions = {
        "environment": [20.0, 4.76, 16.0],
        "battery": [0.70, 0.28, 0.42],
        "power_slot": [1.25, 0.36, 0.90],
        "sliding_gate": [4.0, 2.0, 0.15],
        "terminal": [0.55, 1.25, 0.45],
    }
    assets = {}
    for key, dims in dimensions.items():
        path = os.path.join(OUT, "rf01_industrial_park.glb" if key == "environment" else f"interactables/{key}.glb")
        assets[key] = {"fileBytes": os.path.getsize(path), "sha256": sha256(path), "dimensions": dims}
    manifest = {
        "level": "RF-01",
        "standard": "compact Chinese light-industrial park service yard",
        "production": "EmbodiedGen Kolors + SAM3D, Blender meter normalization",
        "units": "meters",
        "upAxis": "Y",
        "site": {"width": 20, "depth": 16, "workshop": [10.4, 4.6, 6.0], "mainRoadWidth": 3.7, "slidingGateClearWidth": 4.0},
        "assetBoundary": {"environment": "EmbodiedGen workshop plus fixed yard, fence, kiosk and fire equipment", "interactables": ["battery", "power_slot", "sliding_gate", "terminal"]},
        "source": {"referenceImage": os.path.join(ROOT, "rf01_service_yard_reference.png"), "staticGlb": ENV_SOURCE, "interactableRoot": INTERACTABLE_SOURCE, "seeds": {"conditioning": 60101, "interactables": 60102}},
        "assets": assets,
    }
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")


def main():
    os.makedirs(ITEM_OUT, exist_ok=True)
    build_environment(os.path.join(OUT, "rf01_industrial_park.glb"))
    for key, target in {
        "battery": (0.70, 0.28, 0.42),
        "power_slot": (1.25, 0.36, 0.90),
        "sliding_gate": (4.0, 2.0, 0.15),
        "terminal": (0.55, 1.25, 0.45),
    }.items():
        source = os.path.join(INTERACTABLE_SOURCE, key, "result", f"{key}.glb")
        normalize_interactable(source, os.path.join(ITEM_OUT, f"{key}.glb"), target)
    write_manifest()


if __name__ == "__main__":
    main()
