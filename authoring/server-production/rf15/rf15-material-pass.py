import bpy, sys
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]
source,output=map(Path,args)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))

def setup(material, base, roughness, scale, bump_strength=.12, metallic=0):
    material.use_nodes=True
    nodes=material.node_tree.nodes; links=material.node_tree.links
    shader=nodes.get('Principled BSDF')
    if not shader: return
    shader.inputs['Base Color'].default_value=(*base,1)
    shader.inputs['Roughness'].default_value=roughness
    shader.inputs['Metallic'].default_value=metallic
    noise=nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=scale; noise.inputs['Detail'].default_value=3.2; noise.inputs['Roughness'].default_value=.72
    ramp=nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color=(*[min(1,c*.72) for c in base],1); ramp.color_ramp.elements[1].color=(*[min(1,c*1.16) for c in base],1)
    bump=nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=bump_strength; bump.inputs['Distance'].default_value=.06
    links.new(noise.outputs['Fac'],ramp.inputs['Fac']); links.new(ramp.outputs['Color'],shader.inputs['Base Color']); links.new(noise.outputs['Fac'],bump.inputs['Height']); links.new(bump.outputs['Normal'],shader.inputs['Normal'])

for material in bpy.data.materials:
    name=material.name.lower()
    if 'concrete' in name or 'asphalt' in name or 'floor' in name:
        setup(material,(.25,.26,.24),.92,5.5,.22)
    elif 'wood' in name or 'beech' in name or 'carton' in name or 'cardboard' in name:
        setup(material,(.42,.25,.11),.78,7.0,.16)
    elif 'galvan' in name or 'steel' in name or 'metal' in name or 'edge' in name:
        setup(material,(.40,.44,.42),.38,18,.10,.78)
    elif 'green' in name or 'paint' in name or 'cooperative' in name:
        setup(material,(.055,.18,.12),.62,9,.10,.18)
    elif 'plastic' in name or 'crate' in name or 'blue' in name:
        setup(material,(.035,.20,.38),.58,24,.13,.03)
    elif 'rubber' in name or 'graphite' in name:
        setup(material,(.018,.022,.020),.86,32,.08)
    elif 'white' in name or 'enamel' in name:
        setup(material,(.82,.83,.77),.42,10,.08,.12)
    elif 'glass' in name or 'diffuser' in name:
        material.use_nodes=True; shader=material.node_tree.nodes.get('Principled BSDF'); shader.inputs['Roughness'].default_value=.18; shader.inputs['Metallic'].default_value=.08; shader.inputs['Transmission Weight'].default_value=.12
    elif 'yellow' in name or 'orange' in name:
        setup(material,(.84,.52,.025),.64,13,.09)
    elif 'rust' in name:
        setup(material,(.30,.09,.025),.82,26,.18)

# Add tiny variation to all meshes without changing transforms or collision geometry.
for obj in bpy.context.scene.objects:
    if obj.type=='MESH':
        obj.data.materials.update()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format='AUTO')
print('RF15_MATERIAL_PASS',output)
