"""Build RF-08 baseline GLB and a deterministic 48-view RGB-D dataset in Blender."""
import argparse, json, math, os, sys
import bpy
from mathutils import Vector

def args():
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--output-root", default="./external/EmbodiedGen/outputs/rf08_gaussian")
    p.add_argument("--runtime-root", default="./public/local-assets/embodiedgen/rf08/models/runtime")
    p.add_argument("--views", type=int, default=48)
    return p.parse_args(values)

def material(name, base, metallic=0.0, roughness=0.6):
    m = bpy.data.materials.new(name); m.diffuse_color = (*base, 1)
    m.use_nodes = True; bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base, 1)
    metallic_input = bsdf.inputs.get("Metallic IOR Level") or bsdf.inputs.get("Metallic")
    metallic_input.default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    noise = m.node_tree.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 8; noise.inputs["Detail"].default_value = 5; noise.inputs["Roughness"].default_value = 0.72
    bump = m.node_tree.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.16; bump.inputs["Distance"].default_value = 0.04
    m.node_tree.links.new(noise.outputs["Fac"], bump.inputs["Height"]); m.node_tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m

def cube(name, location, scale, mat, bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(location=location); o=bpy.context.object; o.name=name; o.scale=(scale[0]/2,scale[1]/2,scale[2]/2); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel: mod=o.modifiers.new("edge-softening","BEVEL"); mod.width=bevel; mod.segments=3
    return o

def look(camera, target): camera.rotation_euler=(Vector(target)-camera.location).to_track_quat("-Z","Y").to_euler()

def main():
    a=args(); rgb=os.path.join(a.output_root,"source_rgb"); depth=os.path.join(a.output_root,"depth"); normal=os.path.join(a.output_root,"normal")
    for d in [a.output_root,rgb,depth,normal,a.runtime_root]: os.makedirs(d,exist_ok=True)
    bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete(use_global=False)
    concrete=material("aged_concrete",(0.34,0.37,0.35),0.02,0.9); wall=material("painted_concrete",(0.56,0.59,0.56),0.03,0.74); steel=material("oxidized_steel",(0.10,0.15,0.16),0.72,0.34); yellow=material("safety_yellow",(0.65,0.34,0.035),0.44,0.42); rubber=material("rubber",(0.025,0.03,0.028),0.0,0.78)
    cube("floor",(0,0,0),(4,4,0.12),concrete)
    cube("north_wall",(0,1.4,-1.93),(4,0.14,2.8),wall); cube("west_wall",(-1.93,1.4,0),(0.14,4,2.8),wall); cube("east_wall",(1.93,1.4,0),(0.14,4,2.8),wall)
    cube("south_wall_w",(-1.365,1.4,1.82),(1.27,0.14,2.8),wall); cube("south_wall_e",(1.365,1.4,1.82),(1.27,0.14,2.8),wall)
    cube("battery_rack",(-1.08,0.775,-1.08),(0.78,0.34,1.55),steel); cube("power_cabinet",(1.08,0.675,-1.08),(0.74,0.36,1.35),steel)
    cube("terminal",(1.12,0.54,0.68),(0.34,0.28,1.08),steel); cube("door",(0,0.975,1.76),(1.44,0.12,1.95),steel)
    cube("energy_module",(-1.08,1.05,-0.96),(0.42,0.28,0.22),yellow)
    for x in (-1.55,-0.55,0.55,1.55): cube(f"cable_tray_{x}",(x,2.45,-1.82),(0.05,0.08,3.1),steel,0.01)
    for x in (-1.62,1.62):
        bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.055,depth=3.4,location=(x,1.95,0),rotation=(math.pi/2,0,0)); bpy.context.object.data.materials.append(steel)
    for x,z in [(-1.55,1.5),(1.55,1.5),(-1.55,-1.5),(1.55,-1.5)]:
        cube("bollard",(x,.3,z),(.16,.16,.6),yellow); cube("bollard_base",(x,.04,z),(.28,.28,.08),rubber)
    bpy.ops.object.light_add(type="AREA",location=(0,0,2.65)); bpy.context.object.data.energy=480; bpy.context.object.data.shape="RECTANGLE"; bpy.context.object.data.size=3.2; bpy.context.object.data.size_y=2.5
    bpy.ops.object.light_add(type="AREA",location=(-1.65,0.2,1.5)); bpy.context.object.data.energy=220; bpy.context.object.data.color=(0.72,0.84,1); bpy.context.object.data.size=1.2; bpy.context.object.rotation_euler=(0,math.pi/2,0)
    scene=bpy.context.scene; scene.render.engine="BLENDER_EEVEE_NEXT"; scene.render.resolution_x=768; scene.render.resolution_y=768; scene.render.resolution_percentage=100; scene.render.image_settings.file_format="PNG"; scene.render.film_transparent=False; scene.world.color=(0.035,0.045,0.045)
    view_layer=scene.view_layers[0]; view_layer.use_pass_z=True; view_layer.use_pass_normal=True
    scene.use_nodes=True; nodes=scene.node_tree.nodes; links=scene.node_tree.links; nodes.clear(); rl=nodes.new("CompositorNodeRLayers"); comp=nodes.new("CompositorNodeComposite"); links.new(rl.outputs["Image"],comp.inputs["Image"])
    depth_out=nodes.new("CompositorNodeOutputFile"); depth_out.base_path=depth; depth_out.format.file_format="OPEN_EXR"; links.new(rl.outputs["Depth"],depth_out.inputs[0])
    normal_out=nodes.new("CompositorNodeOutputFile"); normal_out.base_path=normal; normal_out.format.file_format="OPEN_EXR"; links.new(rl.outputs["Normal"],normal_out.inputs[0])
    bpy.ops.object.camera_add(); cam=bpy.context.object; scene.camera=cam; cam.data.lens=38; cam.data.sensor_width=36
    frames=[]
    for i in range(a.views):
        ring=i%24; tier=i//24; angle=2*math.pi*ring/24; radius=2.55 if tier==0 else 1.65; height=1.45 if tier==0 else 2.15
        cam.location=(radius*math.sin(angle),radius*math.cos(angle),height); target=(0,0,0.82 if tier==0 else .58); look(cam,target)
        name=f"{i:03d}"; scene.render.filepath=os.path.join(rgb,name+".png"); depth_out.file_slots[0].path=name+"_"; normal_out.file_slots[0].path=name+"_"; bpy.ops.render.render(write_still=True)
        frames.append({"file_path":f"source_rgb/{name}.png","transform_matrix":[list(row) for row in cam.matrix_world],"depth_path":f"depth/{name}_0001.exr","normal_path":f"normal/{name}_0001.exr"})
    meta={"camera_angle_x":2*math.atan(scene.render.resolution_x/(2*(cam.data.lens*scene.render.resolution_x/cam.data.sensor_width))),"w":768,"h":768,"coordinate_system":"Blender/OpenGL camera-to-world, meters, Z-up source","frames":frames}
    with open(os.path.join(a.output_root,"transforms.json"),"w") as f: json.dump(meta,f,indent=2)
    export_objects=[o for o in bpy.context.scene.objects if o.type=="MESH"]; bpy.ops.object.select_all(action="DESELECT"); [o.select_set(True) for o in export_objects]; bpy.context.view_layer.objects.active=export_objects[0]
    bpy.ops.export_scene.gltf(filepath=os.path.join(a.runtime_root,"rf08_baseline.glb"),export_format="GLB",use_selection=True,export_yup=True)
    with open(os.path.join(a.output_root,"dataset_manifest.json"),"w") as f: json.dump({"views":a.views,"rgb":"source_rgb/*.png","depth":"depth/*.exr","normal":"normal/*.exr","baselineGlb":os.path.join(a.runtime_root,"rf08_baseline.glb")},f,indent=2)

main()
