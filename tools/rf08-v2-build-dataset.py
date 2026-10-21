"""Build a review-only, fully Z-up RF-08 interior RGB-D dataset in Blender."""
import argparse, json, math, os, sys
import bpy
from mathutils import Vector


def cli():
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--output-root", required=True)
    p.add_argument("--views", type=int, default=48)
    return p.parse_args(values)


def material(name, color, metallic=0.0, roughness=0.65, noise_scale=7, bump=0.1):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    (bsdf.inputs.get("Metallic IOR Level") or bsdf.inputs.get("Metallic")).default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    noise = m.node_tree.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = noise_scale; noise.inputs["Detail"].default_value = 5
    ramp = m.node_tree.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*[max(0, c * .55) for c in color], 1)
    ramp.color_ramp.elements[1].color = (*[min(1, c * 1.22) for c in color], 1)
    bump_node = m.node_tree.nodes.new("ShaderNodeBump")
    bump_node.inputs["Strength"].default_value = bump; bump_node.inputs["Distance"].default_value = .035
    m.node_tree.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    m.node_tree.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    m.node_tree.links.new(noise.outputs["Fac"], bump_node.inputs["Height"])
    m.node_tree.links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def cube(name, xyz, dims, mat, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(location=xyz)
    obj = bpy.context.object; obj.name = name; obj.scale = tuple(v / 2 for v in dims)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("edge_softening", "BEVEL"); mod.width = bevel; mod.segments = 2
    return obj


def cylinder(name, xyz, radius, depth, mat, rotation=(0, 0, 0), vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=xyz, rotation=rotation)
    obj = bpy.context.object; obj.name = name; obj.data.materials.append(mat); return obj


def look(cam, target):
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()


def build_scene():
    bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete(use_global=False)
    concrete = material("aged sealed concrete", (.31, .33, .31), roughness=.9, noise_scale=4, bump=.18)
    wall = material("dirty warm gray painted wall", (.58, .57, .52), roughness=.82, noise_scale=3, bump=.08)
    steel = material("dark galvanized steel", (.095, .12, .13), metallic=.72, roughness=.34, noise_scale=10, bump=.08)
    galvanized = material("galvanized conduit", (.34, .39, .39), metallic=.82, roughness=.28, noise_scale=18, bump=.04)
    yellow = material("worn safety yellow", (.68, .39, .035), metallic=.22, roughness=.48, noise_scale=14, bump=.08)
    red = material("emergency red", (.55, .025, .018), metallic=.1, roughness=.44, noise_scale=9, bump=.04)
    black = material("rubber black", (.018, .022, .021), roughness=.86, noise_scale=12, bump=.06)
    glass = material("dirty fluorescent diffuser", (.84, .89, .81), roughness=.34, noise_scale=5, bump=.025)

    cube("floor", (0, 0, -.06), (4, 4, .12), concrete)
    cube("north_wall", (0, -1.93, 1.4), (4, .14, 2.8), wall)
    cube("west_wall", (-1.93, 0, 1.4), (.14, 4, 2.8), wall)
    cube("east_wall", (1.93, 0, 1.4), (.14, 4, 2.8), wall)
    cube("south_w", (-1.38, 1.93, 1.4), (1.24, .14, 2.8), wall)
    cube("south_e", (1.38, 1.93, 1.4), (1.24, .14, 2.8), wall)
    cube("ceiling", (0, 0, 2.82), (4, 4, .08), wall)

    # Dense, recognizable electrical-room dressing.
    cube("battery_rack", (-1.25, -1.45, .78), (.86, .42, 1.56), steel)
    for z in (.28, .75, 1.22): cube("rack_shelf", (-1.25, -1.2, z), (.88, .12, .06), galvanized)
    for x in (-1.54, -1.25, -.96):
        cube("battery_cell", (x, -1.18, .51), (.22, .26, .32), black, .025)
        cube("battery_label", (x, -1.035, .51), (.13, .015, .11), yellow, .005)
    cube("power_cabinet", (1.2, -1.55, .86), (.82, .42, 1.72), steel)
    cube("cabinet_door", (1.2, -1.32, .9), (.7, .055, 1.48), galvanized)
    for z, mat in ((1.35, red), (1.16, yellow), (.97, black)):
        cylinder("control_button", (1.2, -1.275, z), .055, .04, mat, (math.pi / 2, 0, 0))
    cube("warning_plate", (1.2, -1.275, .58), (.42, .025, .25), yellow, .004)
    cube("terminal", (1.5, .65, .62), (.38, .3, 1.24), steel)
    cube("terminal_screen", (1.495, .485, .82), (.25, .025, .31), black, .004)
    cube("door", (0, 1.86, 1.03), (1.42, .11, 2.06), steel)
    cube("door_window", (0, 1.79, 1.42), (.68, .035, .45), glass, .004)
    cube("energy_module", (-.88, -1.05, .26), (.46, .34, .28), yellow, .035)
    cube("module_handle", (-.88, -1.05, .48), (.25, .08, .12), black, .025)

    # Conduits, trays, junction boxes, skirting and safety markings.
    for x in (-1.64, -1.46, 1.46, 1.64):
        cylinder("vertical_conduit", (x, -1.82, 1.55), .025, 2.3, galvanized)
        cube("junction_box", (x, -1.78, 2.18), (.18, .09, .22), galvanized, .012)
    for y in (-1.65, -.55, .55):
        cylinder("overhead_pipe", (0, y, 2.57), .035, 3.5, galvanized, (0, math.pi / 2, 0))
    cube("cable_tray", (0, -1.63, 2.38), (3.25, .25, .09), galvanized)
    for x in (-1.72, 1.72): cube("baseboard", (x, 0, .11), (.08, 3.6, .22), steel)
    for x in (-1.55, 1.55):
        cylinder("bollard", (x, 1.42, .34), .07, .68, yellow)
        cylinder("bollard_base", (x, 1.42, .04), .14, .08, black)
    for x in (-1.25, -.75, -.25, .25, .75, 1.25):
        cube("hazard_stripe", (x, 1.64, .012), (.28, .55, .024), yellow if int((x + 2) * 4) % 2 else black, .002)

    # Three visible fluorescent fixtures and a cooler cabinet-side fill.
    for y in (-1.05, .35, 1.25):
        cube("luminaire", (0, y, 2.72), (1.45, .22, .055), glass, .01)
        bpy.ops.object.light_add(type="AREA", location=(0, y, 2.65))
        lamp = bpy.context.object; lamp.data.energy = 180; lamp.data.shape = "RECTANGLE"; lamp.data.size = 1.35; lamp.data.size_y = .16
    bpy.ops.object.light_add(type="AREA", location=(1.72, -1.1, 1.45))
    fill = bpy.context.object; fill.rotation_euler = (0, math.pi / 2, 0); fill.data.energy = 95; fill.data.color = (.62, .75, 1); fill.data.size = 1.4


def camera_path(count):
    anchors = [
        ((0, 1.35, 1.48), (0, -.55, 1.05)),
        ((-.72, 1.12, 1.42), (-1.12, -1.2, .88)),
        ((.72, 1.12, 1.42), (1.14, -1.25, .95)),
        ((-1.35, .58, 1.36), (.65, -.9, 1.0)),
        ((1.35, .58, 1.36), (-.65, -.95, .9)),
        ((-1.25, -.25, 1.3), (1.05, -1.35, .9)),
        ((1.25, -.25, 1.3), (-1.05, -1.28, .82)),
        ((-.8, -.75, 1.25), (.95, .45, .85)),
        ((.8, -.75, 1.25), (-.95, .3, .82)),
        ((0, -.95, 1.38), (0, 1.55, 1.0)),
        ((-1.3, 1.0, 1.58), (1.05, -.45, 1.0)),
        ((1.3, 1.0, 1.58), (-1.05, -.45, 1.0)),
    ]
    poses = []
    variants = max(1, math.ceil(count / len(anchors)))
    for v in range(variants):
        for idx, (pos, target) in enumerate(anchors):
            if len(poses) >= count: break
            phase = (v - (variants - 1) / 2) * .075
            px, py, pz = pos; tx, ty, tz = target
            poses.append(((px + phase * math.sin(idx), py + phase * math.cos(idx), pz + (v % 2) * .08), (tx, ty, tz + (v - 1) * .04)))
    return poses


def main():
    a = cli(); dirs = {k: os.path.join(a.output_root, k) for k in ("source_rgb", "depth", "normal")}
    for path in [a.output_root, *dirs.values()]: os.makedirs(path, exist_ok=True)
    build_scene()
    scene = bpy.context.scene; scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 768; scene.render.resolution_y = 768; scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"; scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGB"; scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (.018, .022, .021)
    layer = scene.view_layers[0]; layer.use_pass_z = True; layer.use_pass_normal = True
    scene.use_nodes = True; nodes = scene.node_tree.nodes; links = scene.node_tree.links; nodes.clear()
    rl = nodes.new("CompositorNodeRLayers"); comp = nodes.new("CompositorNodeComposite"); links.new(rl.outputs["Image"], comp.inputs["Image"])
    depth_out = nodes.new("CompositorNodeOutputFile"); depth_out.base_path = dirs["depth"]; depth_out.format.file_format = "OPEN_EXR"; links.new(rl.outputs["Depth"], depth_out.inputs[0])
    normal_out = nodes.new("CompositorNodeOutputFile"); normal_out.base_path = dirs["normal"]; normal_out.format.file_format = "OPEN_EXR"; links.new(rl.outputs["Normal"], normal_out.inputs[0])
    bpy.ops.object.camera_add(); cam = bpy.context.object; scene.camera = cam; cam.data.lens = 30; cam.data.sensor_width = 36; cam.data.clip_start = .05
    frames = []
    for i, (pos, target) in enumerate(camera_path(a.views)):
        cam.location = pos; look(cam, target); name = f"{i:03d}"
        scene.render.filepath = os.path.join(dirs["source_rgb"], name + ".png")
        depth_out.file_slots[0].path = name + "_"; normal_out.file_slots[0].path = name + "_"
        bpy.ops.render.render(write_still=True)
        frames.append({"file_path": f"source_rgb/{name}.png", "transform_matrix": [list(row) for row in cam.matrix_world], "depth_path": f"depth/{name}_0001.exr", "normal_path": f"normal/{name}_0001.exr"})
    angle = 2 * math.atan(cam.data.sensor_width / (2 * cam.data.lens))
    meta = {"camera_angle_x": angle, "w": 768, "h": 768, "coordinate_system": "Blender Z-up/OpenGL c2w/meters", "review_gate": "Do not train 3DGS before approval", "frames": frames}
    with open(os.path.join(a.output_root, "transforms.json"), "w") as f: json.dump(meta, f, indent=2)
    with open(os.path.join(a.output_root, "dataset_manifest.json"), "w") as f: json.dump({"version": 2, "views": a.views, "status": "awaiting_source_review"}, f, indent=2)


main()
