from __future__ import annotations

import copy
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path

import mujoco
import numpy as np

from g1_simulation import CONTROL_MODE_JOINT_POSITION, GAME_FROM_MUJOCO, G1Simulation, finite_list
from rf15_balance import StandingBalance
from rf15_reach import plan_reach


HAND_TARGETS = {
    'right': np.array([0, -.6, -.8, .6, .8, .6, .8]),
    'left': np.array([0, .6, .8, -.6, -.8, -.6, -.8]),
}
HAND_PARTS = ('thumb_0', 'thumb_1', 'thumb_2', 'middle_0', 'middle_1', 'index_0', 'index_1')


def xml_values(values):
    return ' '.join(str(float(value)) for value in values)


def build_contact_resources(base, hand_xml, layout_file):
    scene_path = base.paths.model
    scene = ET.parse(scene_path).getroot()
    include = scene.find('include')
    robot_path = scene_path.parent / include.get('file') if include is not None else scene_path
    root = ET.parse(robot_path).getroot()
    compiler = root.find('compiler')
    mesh_directory = (robot_path.parent / compiler.get('meshdir', '.')).resolve()
    compiler.set('meshdir', str(mesh_directory))
    option = root.find('option')
    if option is None:
        option = ET.SubElement(root, 'option')
    option.set('timestep', '.002')
    option.set('cone', 'elliptic')
    option.set('iterations', '80')
    official = ET.parse(hand_xml).getroot()
    assets = root.find('asset')
    for mesh in official.findall('asset/mesh'):
        if '_hand_' in mesh.get('name', ''):
            mesh = copy.deepcopy(mesh)
            mesh.set('file', str(mesh_directory / mesh.get('file')))
            assets.append(mesh)
    actuator = root.find('actuator')
    for side in ('left', 'right'):
        wrist = root.find(f'.//body[@name="{side}_wrist_yaw_link"]')
        for geom in list(wrist.findall('geom')):
            if 'rubber_hand' in geom.get('mesh', ''):
                wrist.remove(geom)
        source = official.find(f'.//body[@name="{side}_wrist_yaw_link"]')
        for element in source:
            if element.tag == 'body' or element.tag == 'geom' and '_hand_' in element.get('mesh', ''):
                wrist.append(copy.deepcopy(element))
        for body in wrist.iter('body'):
            if '_hand_' not in body.get('name', ''):
                continue
            for geom in body.findall('geom'):
                if geom.get('contype') != '0':
                    geom.set('friction', '1.0 .005 .0001')
                    geom.set('condim', '6')
                    geom.set('solref', '.004 1')
            for joint in body.findall('joint'):
                joint.set('damping', '.03')
                joint.set('armature', '.0001')
                ET.SubElement(actuator, 'motor', name=joint.get('name'), joint=joint.get('name'), ctrllimited='true', ctrlrange='-1.4 1.4')
        ET.SubElement(wrist, 'site', name=f'{side}-grasp', pos=xml_values([.14, .04 if side == 'right' else -.04, 0]), size='.005')
    world = root.find('worldbody')
    ET.SubElement(world, 'geom', name='floor', type='plane', size='40 40 .01', friction='.8 .003 .0001')
    layout = json.loads(Path(layout_file).read_text())
    for structure in layout['structures']:
        center = GAME_FROM_MUJOCO.T @ structure['position']
        size = GAME_FROM_MUJOCO.T @ structure['size']
        ET.SubElement(world, 'geom', name='rf15-' + structure['id'], type='box', pos=xml_values(center), size=xml_values(size / 2))
    equality = root.find('equality')
    if equality is None:
        equality = ET.SubElement(root, 'equality')
    objects = layout['objects']
    for item in objects:
        body = ET.SubElement(world, 'body', name='object-' + item['id'], pos=xml_values(GAME_FROM_MUJOCO.T @ item['position']), quat=xml_values(item.get('quat', [1, 0, 0, 0])))
        ET.SubElement(body, 'freejoint', name='free-' + item['id'])
        for index, shape in enumerate(item['shapes']):
            attributes = {'name': f"object-{item['id']}-{index}", 'type': shape['type'], 'size': xml_values(shape['size']), 'pos': xml_values(shape.get('pos', [0, 0, 0])), 'mass': str(shape['mass']), 'friction': '.8 .003 .0001', 'condim': '6', 'solref': '.004 1'}
            if 'quat' in shape:
                attributes['quat'] = xml_values(shape['quat'])
            ET.SubElement(body, 'geom', **attributes)
        if item.get('rooted'):
            ET.SubElement(equality, 'weld', name='root-' + item['id'], body1='object-' + item['id'], solref='.004 1')
    door = ET.SubElement(world, 'body', name='tool-door', pos=xml_values(GAME_FROM_MUJOCO.T @ [-4.85, 0, -9.98]), mocap='true')
    ET.SubElement(door, 'geom', name='tool-door', type='box', pos='0 .85 1.1', size='.065 .85 1.1')
    for key in list(root.findall('keyframe')):
        root.remove(key)
    resources = copy.copy(base)
    resources.model = mujoco.MjModel.from_xml_string(ET.tostring(root, encoding='unicode'))
    robot_joints = [resources.model.joint(name).id for name in base.joint_names]
    resources.robot_qpos = resources.model.jnt_qposadr[robot_joints]
    resources.robot_dofs = resources.model.jnt_dofadr[robot_joints]
    resources.robot_actuators = np.arange(29, dtype=np.int32)
    resources.contact_layout = layout
    resources.physics_steps_per_policy = round(.02 / resources.model.opt.timestep)
    return resources


class RF15ContactSimulation(G1Simulation):
    def __init__(self, resources):
        self.balance = None
        self.hands = {}
        self.object_specs = {item['id']: item for item in resources.contact_layout['objects']}
        self.objects = {}
        model = resources.model
        for name, item in self.object_specs.items():
            joint = model.joint('free-' + name).id
            self.objects[name] = {'body': model.body('object-' + name).id, 'qpos': model.jnt_qposadr[joint], 'dof': model.jnt_dofadr[joint], 'root': model.equality('root-' + name).id if item.get('rooted') else None}
        for side in ('left', 'right'):
            joints = [model.joint(f'{side}_hand_{part}_joint').id for part in HAND_PARTS]
            arm_names = [f'{side}_{part}_joint' for part in ('shoulder_pitch', 'shoulder_roll', 'shoulder_yaw', 'elbow', 'wrist_roll', 'wrist_pitch', 'wrist_yaw')]
            arm_joints = [model.joint(name).id for name in arm_names]
            self.hands[side] = {'qpos': model.jnt_qposadr[joints], 'dofs': model.jnt_dofadr[joints], 'actuators': np.array([model.actuator(f'{side}_hand_{part}_joint').id for part in HAND_PARTS]), 'site': model.site(f'{side}-grasp').id, 'wrist': model.body(f'{side}_wrist_yaw_link').id, 'arm_qpos': model.jnt_qposadr[arm_joints], 'arm_dofs': model.jnt_dofadr[arm_joints], 'arm_indices': np.array([resources.joint_names.index(name) for name in arm_names]), 'limits': model.jnt_range[arm_joints]}
        self.ik_data = mujoco.MjData(model)
        super().__init__(resources)

    def reset(self, spawn=None):
        self.balance = None
        super().reset(spawn)
        self.last_contact_event = 'ready'
        self.harvested = []
        self.cut = []
        for side, hand in self.hands.items():
            hand.update(target=None, phase='idle', closure=0.0, strength=.9, elapsed=0.0, contacts=[], held=None, stable=0.0, arm_target=None, cartesian_target=None, route=[])
        mujoco.mj_forward(self.resources.model, self.data)

    def request_grasp(self, name, side='right'):
        if side not in self.hands or name not in self.objects:
            raise ValueError('Unknown hand or object')
        hand = self.hands[side]
        if hand['held']:
            raise ValueError('This hand is already occupied')
        item = self.objects[name]
        target = self.grasp_point(name)
        shoulder = self.data.xpos[self.resources.model.body(f'{side}_shoulder_pitch_link').id]
        if np.linalg.norm(target - shoulder) > .78:
            raise ValueError('Object out of arm reach; move closer')
        orientation = self.data.xmat[1].reshape(3, 3) @ np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]])
        route = plan_reach(self, side, target + np.array([0, 0, .13]), orientation)
        if item['root'] is not None and name not in self.cut:
            if not any(other['held'] == 'harvest-knife' for other in self.hands.values()):
                raise ValueError('Harvest knife required before cutting')
            self.data.eq_active[item['root']] = False
            self.cut.append(name)
        self.set_control_mode(CONTROL_MODE_JOINT_POSITION)
        if self.balance is None:
            self.balance = StandingBalance(self.resources, self.data)
        hand.update(target=name, phase='planned', elapsed=0.0, closure=0.0, held=None, stable=0.0, route=route[1:], orientation=orientation, arm_target=route[0], motor_target=self.data.qpos[hand['arm_qpos']].copy())
        self.last_contact_event = 'reaching'

    def set_grip(self, side, strength, closed):
        if side not in self.hands or not math.isfinite(strength) or not 0 <= strength <= 1:
            raise ValueError('Grip requires a hand and finite strength within 0..1')
        hand = self.hands[side]
        hand['strength'] = strength
        hand['closure'] = 1.0 if closed else 0.0
        if not closed:
            hand.update(phase='release', held=None, target=None)
            self.last_contact_event = 'released'

    def grasp_point(self, name):
        item = self.objects[name]
        offset = np.asarray(self.object_specs[name]['grasp'])
        return self.data.xpos[item['body']] + self.data.xmat[item['body']].reshape(3, 3) @ offset

    def solve_arm(self, side, target, orientation=None):
        hand = self.hands[side]
        model = self.resources.model
        trial = self.ik_data
        trial.qpos[:] = self.data.qpos
        if hand['arm_target'] is not None:
            trial.qpos[hand['arm_qpos']] = hand['arm_target']
        jacobian = np.zeros((3, model.nv))
        rotational = np.zeros((3, model.nv))
        for iteration in range(25):
            mujoco.mj_kinematics(model, trial)
            mujoco.mj_comPos(model, trial)
            difference = target - trial.site_xpos[hand['site']]
            mujoco.mj_jacSite(model, trial, jacobian, rotational, hand['site'])
            system = jacobian[:, hand['arm_dofs']]
            residual = difference
            if orientation is not None:
                current = trial.site_xmat[hand['site']].reshape(3, 3)
                rotation_error = sum(np.cross(current[:, index], orientation[:, index]) for index in range(3)) / 2
                system = np.vstack([system, rotational[:, hand['arm_dofs']] * .18])
                residual = np.concatenate([difference, rotation_error * .18])
            delta = system.T @ np.linalg.solve(system @ system.T + np.eye(len(residual)) * .002, residual)
            trial.qpos[hand['arm_qpos']] = np.clip(trial.qpos[hand['arm_qpos']] + np.clip(delta, -.15, .15), hand['limits'][:, 0], hand['limits'][:, 1])
            if np.linalg.norm(difference) < .005:
                break
        hand['arm_target'] = trial.qpos[hand['arm_qpos']].copy()
        return float(np.linalg.norm(target - trial.site_xpos[hand['site']]))

    def _step_physics(self):
        for side, hand in self.hands.items():
            if hand['arm_target'] is not None:
                previous = hand.get('motor_target', self.data.qpos[hand['arm_qpos']])
                difference = hand['arm_target'] - previous
                hand['motor_target'] = previous + difference * min(1.0, .0015 / max(float(np.max(np.abs(difference))), 1e-9))
                self.target_joint_pos[hand['arm_indices']] = hand['motor_target']
            target = HAND_TARGETS[side] * hand['closure']
            torque = 8 * (target - self.data.qpos[hand['qpos']]) - .15 * self.data.qvel[hand['dofs']]
            limit = hand['strength'] * 1.4
            self.data.ctrl[hand['actuators']] = np.clip(torque, -limit, limit)
        if self.balance is None:
            super()._step_physics()
        else:
            self.data.ctrl[self.resources.robot_actuators] = self.balance.update(self.data, self.target_joint_pos, self.hands.values())
            self.data.xfrc_applied[1] = 0
            mujoco.mj_step(self.resources.model, self.data)

    def step(self):
        for side, hand in self.hands.items():
            hand['elapsed'] += .02
            if hand['phase'] == 'planned':
                if np.max(np.abs(self.data.qpos[hand['arm_qpos']] - hand['arm_target'])) < .15:
                    if hand['route']:
                        hand.update(arm_target=hand['route'].pop(0), elapsed=0)
                    else:
                        hand.update(phase='reach', elapsed=0)
                if hand['elapsed'] > 15:
                    hand.update(phase='idle', target=None, closure=0.0)
                    self.last_contact_event = 'reach_failed'
            elif hand['phase'] in ('approach', 'reach', 'close') and hand['target']:
                target = hand['close_target'] if hand['phase'] == 'close' else self.grasp_point(hand['target'])
                orientation = hand['orientation']
                if hand['phase'] == 'approach':
                    target = target + np.array([0, 0, .15])
                hand.update(cartesian_target=target.copy(), orientation=orientation)
                self.solve_arm(side, target, orientation)
                error = np.linalg.norm(self.data.site_xpos[hand['site']] - target)
                if error < .012:
                    if hand['phase'] == 'approach':
                        hand.update(phase='reach', elapsed=0)
                    elif hand['phase'] == 'reach':
                        hand.update(phase='close', elapsed=0, closure=1.0, close_target=target.copy())
                if hand['elapsed'] > 12:
                    hand.update(phase='idle', target=None, closure=0.0)
                    self.last_contact_event = 'reach_failed'
            elif hand['phase'] == 'lift':
                target = hand['lift_origin'] + np.array([0, 0, min(.10, hand['elapsed'] * .025)])
                hand['cartesian_target'] = target.copy()
                self.solve_arm(side, target, hand['orientation'])
                if hand['elapsed'] > 4:
                    hand['phase'] = 'hold'
        super().step()
        self.update_contacts()

    def update_contacts(self):
        model = self.resources.model
        for side, hand in self.hands.items():
            touching = {}
            for contact_index, contact in enumerate(self.data.contact):
                contact_force = np.zeros(6)
                mujoco.mj_contactForce(model, self.data, contact_index, contact_force)
                if contact_force[0] < .02:
                    continue
                for finger_geom, object_geom in ((contact.geom1, contact.geom2), (contact.geom2, contact.geom1)):
                    finger_body = model.body(int(model.geom_bodyid[finger_geom])).name
                    object_body = model.body(int(model.geom_bodyid[object_geom])).name
                    if (finger_body.startswith(side + '_hand_') or finger_body == side + '_wrist_yaw_link') and object_body.startswith('object-'):
                        identifier = object_body.removeprefix('object-')
                        finger = 'palm' if finger_body == side + '_wrist_yaw_link' else finger_body.split('_')[2]
                        touching.setdefault(identifier, set()).add(finger)
            hand['contacts'] = [{'id': name, 'fingers': sorted(fingers)} for name, fingers in touching.items()]
            candidate = hand['target'] or hand['held']
            fingers = touching.get(candidate, set())
            supported = 'thumb' in fingers and bool(fingers.intersection({'index', 'middle', 'palm'}))
            hand['stable'] = hand['stable'] + .02 if supported else 0.0
            if hand['phase'] == 'close' and hand['stable'] >= .75:
                hand.update(phase='lift', held=candidate, elapsed=0, lift_origin=self.data.site_xpos[hand['site']].copy())
                self.last_contact_event = 'contact_grasp'
            if hand['held'] and not supported and hand['phase'] in ('lift', 'hold'):
                hand['lost_time'] = hand.get('lost_time', 0) + .02
                if hand['lost_time'] > .15:
                    hand.update(held=None, target=None, phase='slipped')
                    self.last_contact_event = 'slipped'
            else:
                hand['lost_time'] = 0

    def state(self, real_time_factor=1.0):
        result = super().state(real_time_factor)
        model = self.resources.model
        def pose(body_id):
            rotation = GAME_FROM_MUJOCO @ self.data.xmat[body_id].reshape(3, 3) @ GAME_FROM_MUJOCO.T
            quaternion = np.empty(4)
            mujoco.mju_mat2Quat(quaternion, rotation.ravel())
            return {'position': finite_list(GAME_FROM_MUJOCO @ self.data.xpos[body_id]), 'quaternion': finite_list([quaternion[1], quaternion[2], quaternion[3], quaternion[0]])}
        result['contactPhysics'] = {
            'balance': None if self.balance is None else {'status': self.balance.status, 'comError': self.balance.com_error},
            'revision': 'rf15-contact-v1', 'event': self.last_contact_event,
            'hands': {side: {key: hand[key] for key in ('phase', 'held', 'strength', 'contacts', 'closure')} for side, hand in self.hands.items()},
            'objects': {name: {**pose(item['body']), 'rooted': item['root'] is not None and bool(self.data.eq_active[item['root']])} for name, item in self.objects.items()},
            'handBodies': {model.body(index).name: pose(index) for index in range(model.nbody) if '_hand_' in model.body(index).name or model.body(index).name.endswith('_wrist_yaw_link')},
        }
        return result
