import copy
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import mujoco
import numpy as np

root = Path(sys.argv[1])
production = root.parent / 'production/rf15-contact-v1'
source = ET.parse(production / 'official-with-hand.xml').getroot()
mesh_directory = root.parent / 'arc-mujoco-runtime/vendor/unitree_mujoco/unitree_robots/g1/meshes'


def make_model():
    document = ET.Element('mujoco', model='rf15-contact-probe')
    ET.SubElement(document, 'compiler', angle='radian')
    ET.SubElement(document, 'option', timestep='0.002', gravity='0 0 -9.81', cone='elliptic', iterations='80')
    assets = ET.SubElement(document, 'asset')
    for mesh in source.findall('asset/mesh'):
        if mesh.get('name', '').startswith('right_hand_'):
            copied = copy.deepcopy(mesh)
            copied.set('file', str(mesh_directory / copied.get('file')))
            assets.append(copied)
    world = ET.SubElement(document, 'worldbody')
    ET.SubElement(world, 'geom', name='floor', type='plane', size='1 1 .01')
    ET.SubElement(world, 'body', name='hand-target', pos='0 0 .8', mocap='true')
    palm = ET.SubElement(world, 'body', name='palm', pos='0 0 .8')
    ET.SubElement(palm, 'freejoint', name='palm-free')
    ET.SubElement(palm, 'inertial', pos='.07 0 0', mass='.45', diaginertia='.001 .001 .001')
    wrist = source.find('.//body[@name="right_wrist_yaw_link"]')
    for child in wrist:
        if child.tag == 'body' or child.tag == 'geom' and child.get('mesh', '').startswith('right_hand_'):
            palm.append(copy.deepcopy(child))
    actuators = ET.SubElement(document, 'actuator')
    for joint in palm.iter('joint'):
        joint.set('damping', '.03')
        joint.set('armature', '.0001')
        ET.SubElement(actuators, 'motor', name=joint.get('name'), joint=joint.get('name'), ctrllimited='true', ctrlrange='-1.4 1.4')
    for geom in palm.iter('geom'):
        if geom.get('contype') != '0':
            geom.set('friction', '1.0 .005 .0001')
            geom.set('condim', '6')
            geom.set('solref', '.004 1')
    item = ET.SubElement(world, 'body', name='item', pos='.145 .045 .8')
    ET.SubElement(item, 'freejoint', name='item-free')
    ET.SubElement(item, 'geom', name='item', type='cylinder', size='.015 .07', mass='.12', friction='.8 .003 .0001', condim='6', solref='.004 1')
    equality = ET.SubElement(document, 'equality')
    ET.SubElement(equality, 'weld', body1='hand-target', body2='palm', solref='.004 1')
    model = mujoco.MjModel.from_xml_string(ET.tostring(document, encoding='unicode'))
    return model


model = make_model()
data = mujoco.MjData(model)
finger_joints = [mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_ACTUATOR, index)) for index in range(model.nu)]
addresses = model.jnt_qposadr[finger_joints]
dofs = model.jnt_dofadr[finger_joints]
item_address = model.jnt_qposadr[model.joint('item-free').id]
targets = np.array([0, -.6, -.8, .6, .8, .6, .8])
results = []
for center_x in [.125, .14, .155, .17]:
    for center_y in [.025, .04, .055]:
        mujoco.mj_resetData(model, data)
        data.qpos[item_address:item_address + 3] = [center_x, center_y, .8]
        model.opt.gravity[:] = [0, 0, 0]
        for frame in range(2000):
            amount = min(1, frame / 250)
            data.ctrl[:] = np.clip(8 * (targets * amount - data.qpos[addresses]) - .15 * data.qvel[dofs], -.7, .7)
            if frame == 500:
                model.opt.gravity[:] = [0, 0, -9.81]
            mujoco.mj_step(model, data)
        results.append({'x': center_x, 'y': center_y, 'height': round(float(data.qpos[item_address + 2]), 4), 'contacts': int(data.ncon), 'position': data.qpos[item_address:item_address + 3].tolist()})
print(json.dumps(results, indent=2))
for force_limit in [.7, .02, 0]:
    mujoco.mj_resetData(model, data)
    data.qpos[item_address:item_address + 3] = [.14, .04, .8]
    model.opt.gravity[:] = [0, 0, 0]
    for frame in range(2500):
        amount = min(1, frame / 250)
        limit = .7 if frame < 1000 else force_limit
        data.ctrl[:] = np.clip(8 * (targets * amount - data.qpos[addresses]) - .15 * data.qvel[dofs], -limit, limit)
        if frame == 500:
            model.opt.gravity[:] = [0, 0, -9.81]
        if frame > 700 and frame < 1000:
            data.mocap_pos[0, 2] += .0001
        mujoco.mj_step(model, data)
        if frame in [499, 699, 999, 1200]:
            print(json.dumps({'frame': frame, 'limit': force_limit, 'position': data.qpos[item_address:item_address + 3].tolist()}))
    print(json.dumps({'forceLimit': force_limit, 'palmHeight': float(data.mocap_pos[0, 2]), 'objectHeight': float(data.qpos[item_address + 2]), 'constraintCount': model.neq}))
