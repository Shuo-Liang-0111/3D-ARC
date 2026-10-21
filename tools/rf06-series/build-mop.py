"""Dimensioned domestic flat mop. Local origin on floor; contact grip y=0.82 m."""
import bpy, math, sys
from pathlib import Path
bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
out=Path(sys.argv[sys.argv.index("--")+1]);out.parent.mkdir(parents=True,exist_ok=True)
def mat(name,color,rough,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get("Principled BSDF");b.inputs["Base Color"].default_value=(*color,1);b.inputs["Roughness"].default_value=rough;b.inputs["Metallic"].default_value=metal;return m
cloth=mat("Blue grey microfiber",(.10,.27,.30),.98);fibers=mat("Microfiber rib highlights",(.20,.40,.42),1)
plastic=mat("Matte charcoal polypropylene",(.035,.045,.047),.58);metal=mat("Brushed aluminium shaft",(.52,.56,.59),.3,.78)
def cube(name,loc,scale,material,bevel):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 b=o.modifiers.new("Rounded edges","BEVEL");b.width=bevel;b.segments=4;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name);return o
def cylinder(name,z,r,h,material):
 bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=r,depth=h,location=(0,0,z));o=bpy.context.object;o.name=name;o.data.materials.append(material)
 for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
cube("Microfiber floor pad",(0,0,.011),(.38,.17,.022),cloth,.010)
for i in range(29):
 cube("Microfiber woven rib",(i*.012-.168,0,.022),(.005,.15,.006),fibers,.002)
cube("Hinged flat mop plate",(0,0,.033),(.35,.14,.022),plastic,.010)
cube("Universal pivot foot",(0,0,.064),(.062,.04,.045),plastic,.008)
cylinder("Aluminium handle",.667,.0105,1.15,metal)
cylinder("Lower collar",.115,.016,.060,plastic)
cylinder("Telescopic shaft lock",.58,.014,.048,plastic)
cylinder("Hand grip at interaction height",.82,.018,.16,plastic)
cylinder("Top grip",1.22,.018,.14,plastic)
bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=10,major_radius=.017,minor_radius=.005,location=(0,0,1.31),rotation=(math.pi/2,0,0));bpy.context.object.name="Hanging loop";bpy.context.object.data.materials.append(plastic)
bpy.ops.object.select_all(action="SELECT");bpy.ops.export_scene.gltf(filepath=str(out),export_format="GLB",use_selection=True,export_apply=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
print("FLAT_MOP_EXPORTED",out)
