"""Make the existing lamp diffuser emissive; preserve its mesh and housing."""
import bpy, json, struct, math, sys
from pathlib import Path
from mathutils import Vector

task=Path(sys.argv[sys.argv.index('--')+1])
asset=Path.cwd()/'public/local-assets/cardinal/rf02/models/runtime'
out=asset/'library-lighting-v8/suspended-linear-light.glb'
out.parent.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(asset/'suspended-linear-light.glb'))
records=[]
for obj in list(bpy.context.scene.objects):
    if obj.type!='MESH': continue
    points=[obj.matrix_world@v.co for v in obj.data.vertices]
    before=[list(p) for p in points]
    diffuser=bpy.data.materials.new('RF02 warm white lamp diffuser')
    diffuser.use_nodes=True
    diffuser.use_backface_culling=True
    shader=diffuser.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(.94,.93,.88,1)
    shader.inputs['Roughness'].default_value=.55
    shader.inputs['Emission Color'].default_value=(1,.94,.82,1)
    shader.inputs['Emission Strength'].default_value=3
    obj.data.materials.append(diffuser)
    idx=len(obj.data.materials)-1
    normals=obj.matrix_world.to_3x3().inverted().transposed()
    selected=[]
    for p in obj.data.polygons:
        center=sum((points[i] for i in p.vertices),Vector())/len(p.vertices)
        n=(normals@p.normal).normalized()
        if n.z<-.55 and center.z<.065 and abs(center.x)<1.025 and abs(center.y)<.125:
            p.material_index=idx;selected.append(p.index)
    assert len(selected)>100, 'Lamp diffuser selection failed'
    assert before==[list(obj.matrix_world@v.co) for v in obj.data.vertices]
    records.append({'mesh':obj.name,'vertices':len(points),'faces':len(obj.data.polygons),'emissiveFaces':len(selected),'geometryUnchanged':True,'bounds':[[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]]})
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_image_format='AUTO',export_keep_originals=False,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_yup=True,export_extras=True)
# glTF uses Y-up; -Z rotated -90 degrees about X points down at the floor.
b=out.read_bytes();size=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+size]);binary=b[20+size:]
doc.setdefault('extensionsUsed',[]).append('KHR_lights_punctual')
lights=[]
for i,x in enumerate([-.55,.55]):
    lights.append({'name':f'rf02-tube-downlight-{i+1}','type':'spot','color':[1,.94,.82],'intensity':3.2,'range':6.5,'spot':{'innerConeAngle':.35,'outerConeAngle':1.18},'extras':{'rf02TubeLight':True}})
    node={'name':f'rf02-tube-downlight-{i+1}','translation':[x,-.006,0],'rotation':[-math.sqrt(.5),0,0,math.sqrt(.5)],'extensions':{'KHR_lights_punctual':{'light':i}}}
    index=len(doc['nodes']);doc['nodes'].append(node);doc['scenes'][doc.get('scene',0)]['nodes'].append(index)
doc.setdefault('extensions',{})['KHR_lights_punctual']={'lights':lights}
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
out.write_bytes(struct.pack('<III',0x46546c67,2,20+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+binary)
(task/'lamp-geometry.json').write_text(json.dumps({'meshes':records,'lightsPerFixture':2,'downwardOnly':True,'asset':str(out),'bytes':out.stat().st_size},indent=2))
print(json.dumps(records))
