import copy
import os
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

import mujoco
import numpy as np


def hand_fixture():
    source = ET.parse(os.environ['ARC_RF15_HAND_XML']).getroot()
    meshes = Path(os.environ['ARC_MUJOCO_RUNTIME']) / 'vendor/unitree_mujoco/unitree_robots/g1/meshes'
    root = ET.Element('mujoco', model='rf15-contact-test')
    ET.SubElement(root, 'compiler', angle='radian')
    ET.SubElement(root, 'option', timestep='.002', gravity='0 0 -9.81', cone='elliptic', iterations='80')
    asset = ET.SubElement(root, 'asset')
    for mesh in source.findall('asset/mesh'):
        if mesh.get('name', '').startswith('right_hand_'):
            mesh = copy.deepcopy(mesh)
            mesh.set('file', str(meshes / mesh.get('file')))
            asset.append(mesh)
    world = ET.SubElement(root, 'worldbody')
    ET.SubElement(world, 'geom', name='floor', type='plane', size='1 1 .01')
    ET.SubElement(world, 'body', name='hand-target', pos='0 0 .8', mocap='true')
    palm = ET.SubElement(world, 'body', name='palm', pos='0 0 .8')
    ET.SubElement(palm, 'freejoint', name='palm-free')
    ET.SubElement(palm, 'inertial', pos='.07 0 0', mass='.45', diaginertia='.001 .001 .001')
    wrist = source.find('.//body[@name="right_wrist_yaw_link"]')
    for child in wrist:
        if child.tag == 'body' or child.tag == 'geom' and child.get('mesh', '').startswith('right_hand_'):
            palm.append(copy.deepcopy(child))
    actuators = ET.SubElement(root, 'actuator')
    for joint in palm.iter('joint'):
        joint.set('damping', '.03')
        joint.set('armature', '.0001')
        ET.SubElement(actuators, 'motor', name=joint.get('name'), joint=joint.get('name'), ctrllimited='true', ctrlrange='-1.4 1.4')
    for geom in palm.iter('geom'):
        if geom.get('contype') != '0':
            geom.set('friction', '1 .005 .0001')
            geom.set('condim', '6')
            geom.set('solref', '.004 1')
    item = ET.SubElement(world, 'body', name='item', pos='.14 .04 .8')
    ET.SubElement(item, 'freejoint', name='item-free')
    ET.SubElement(item, 'geom', name='item', type='cylinder', size='.015 .07', mass='.12', friction='.8 .003 .0001', condim='6', solref='.004 1')
    equality = ET.SubElement(root, 'equality')
    ET.SubElement(equality, 'weld', body1='hand-target', body2='palm', solref='.004 1')
    return mujoco.MjModel.from_xml_string(ET.tostring(root, encoding='unicode'))


class FingerContactTest(unittest.TestCase):
    def run_grip(self, released_limit, open_hand=False):
        model = hand_fixture()
        data = mujoco.MjData(model)
        joints = [model.joint(model.actuator(index).name).id for index in range(model.nu)]
        position_addresses = model.jnt_qposadr[joints]
        velocity_addresses = model.jnt_dofadr[joints]
        item_address = model.joint('item-free').qposadr[0]
        targets = np.array([0, -.6, -.8, .6, .8, .6, .8])
        object_id = model.body('item').id
        self.assertNotIn(object_id, model.eq_obj1id)
        self.assertNotIn(object_id, model.eq_obj2id)
        model.opt.gravity[:] = [0, 0, 0]
        lifted = None
        for frame in range(2500):
            limit = .7 if frame < 1000 else released_limit
            target = targets * min(1, frame / 250)
            if open_hand and frame >= 1000:
                target = targets * 0
            data.ctrl[:] = np.clip(8 * (target - data.qpos[position_addresses]) - .15 * data.qvel[velocity_addresses], -limit, limit)
            if frame == 500:
                model.opt.gravity[:] = [0, 0, -9.81]
            if 700 < frame < 1000:
                data.mocap_pos[0, 2] += .0001
            mujoco.mj_step(model, data)
            self.assertTrue(np.isfinite(data.qpos).all())
            if frame == 999:
                lifted = float(data.qpos[item_address + 2])
        return lifted, float(data.qpos[item_address + 2])

    def test_friction_carries_free_object_without_object_constraint(self):
        lifted, final = self.run_grip(.7)
        self.assertGreater(lifted, .825)
        self.assertGreater(final, .81)

    def test_insufficient_motor_torque_drops_the_same_object(self):
        lifted, final = self.run_grip(.02)
        self.assertGreater(lifted, .825)
        self.assertLess(final, .09)

    def test_opening_the_fingers_releases_the_object(self):
        lifted, final = self.run_grip(.7, open_hand=True)
        self.assertGreater(lifted, .825)
        self.assertLess(final, .09)


if __name__ == '__main__':
    unittest.main()
