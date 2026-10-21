import json
import os
import tempfile
import unittest
from pathlib import Path

import mujoco
import numpy as np

from g1_simulation import CONTROL_MODE_JOINT_POSITION, G1Paths, G1Resources
from rf15_balance import StandingBalance
from rf15_contact import RF15ContactSimulation, build_contact_resources


@unittest.skipUnless(os.environ.get('ARC_MUJOCO_RUNTIME') and os.environ.get('ARC_RF15_HAND_XML'), 'MuJoCo runtime and official hand XML required')
class ActiveBalanceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        runtime = Path(os.environ['ARC_MUJOCO_RUNTIME']) / 'vendor'
        policy = runtime / 'unitree_rl_lab/deploy/robots/g1_29dof/config/policy/velocity/v0'
        base = G1Resources(G1Paths(runtime / 'unitree_mujoco/unitree_robots/g1/scene_29dof.xml', policy / 'exported/policy.onnx', policy / 'params/deploy.yaml'))
        with tempfile.TemporaryDirectory() as directory:
            layout = Path(directory) / 'layout.json'
            layout.write_text(json.dumps({'structures': [], 'objects': []}))
            cls.resources = build_contact_resources(base, os.environ['ARC_RF15_HAND_XML'], layout)

    def setUp(self):
        self.simulation = RF15ContactSimulation(self.resources)
        for frame in range(80):
            self.simulation.step()
        self.simulation.set_control_mode(CONTROL_MODE_JOINT_POSITION)
        self.simulation.balance = StandingBalance(self.resources, self.simulation.data)
        self.assertEqual(self.resources.model.neq, 0)

    def assert_standing(self):
        simulation = self.simulation
        self.assertGreater(simulation.data.qpos[2], .72)
        self.assertGreater(simulation.data.xmat[1].reshape(3, 3)[2, 2], np.cos(.15))
        self.assertLess(simulation.balance.com_error, .045)
        self.assertTrue(np.isfinite(simulation.data.qpos).all())
        np.testing.assert_array_equal(simulation.data.xfrc_applied[1], np.zeros(6))

    def test_arm_motion_and_wrist_load_use_free_body_balance(self):
        simulation = self.simulation
        hand = simulation.hands['right']
        initial_legs = simulation.data.qpos[self.resources.robot_qpos[:12]].copy()
        hand.update(arm_target=np.array([-.6, -.25, 0, -.7, 0, 0, 0]), motor_target=simulation.data.qpos[hand['arm_qpos']].copy())
        for frame in range(450):
            simulation.data.xfrc_applied[hand['wrist'], 2] = -6 if 125 <= frame < 325 else 0
            simulation.step()
            self.assert_standing()
        final_legs = simulation.data.qpos[self.resources.robot_qpos[:12]]
        self.assertGreater(float(np.linalg.norm(final_legs - initial_legs)), .01)
        self.assertLess(float(np.linalg.norm(simulation.data.qvel[:3])), .025)

    def test_lateral_impulse_recovers_without_pelvis_support(self):
        simulation = self.simulation
        for frame in range(350):
            simulation.data.qfrc_applied[1] = 18 if 100 <= frame < 110 else 0
            simulation.step()
            self.assert_standing()
        self.assertLess(float(np.linalg.norm(simulation.data.qvel[:3])), .025)
        self.assertLess(simulation.balance.com_error, .015)


@unittest.skipUnless(os.environ.get('ARC_MUJOCO_RUNTIME') and os.environ.get('ARC_RF15_HAND_XML'), 'MuJoCo runtime and official hand XML required')
class GraspBalanceTest(unittest.TestCase):
    assert_standing = ActiveBalanceTest.assert_standing

    @classmethod
    def setUpClass(cls):
        runtime = Path(os.environ['ARC_MUJOCO_RUNTIME']) / 'vendor'
        policy = runtime / 'unitree_rl_lab/deploy/robots/g1_29dof/config/policy/velocity/v0'
        base = G1Resources(G1Paths(runtime / 'unitree_mujoco/unitree_robots/g1/scene_29dof.xml', policy / 'exported/policy.onnx', policy / 'params/deploy.yaml'))
        layout = {
            'structures': [
                {'id': 'tool-bench', 'position': [-4, .51, -13.15], 'size': [5.1, 1.02, 1]},
                {'id': 'knife-blade-rest', 'position': [-6.13, 1.097, -12.75], 'size': [.12, .154, .07]},
                {'id': 'knife-handle-rest', 'position': [-5.82, 1.09, -12.75], 'size': [.025, .14, .06]},
            ],
            'objects': [{'id': 'harvest-knife', 'position': [-6, 1.155, -12.75], 'quat': [2 ** -.5, 0, 0, -(2 ** -.5)], 'grasp': [-.045, 0, .025], 'shapes': [
                {'type': 'cylinder', 'size': [.016, .085], 'pos': [-.1, 0, .025], 'quat': [2 ** -.5, 0, 2 ** -.5, 0], 'mass': .13},
                {'type': 'box', 'size': [.11, .05, .002], 'pos': [.13, 0, .025], 'mass': .09},
            ]}],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'layout.json'
            path.write_text(json.dumps(layout))
            cls.resources = build_contact_resources(base, os.environ['ARC_RF15_HAND_XML'], path)

    def setUp(self):
        self.simulation = RF15ContactSimulation(self.resources)
        self.simulation.reset({'x': -6.1, 'z': -12.43, 'yaw': np.pi})
        for frame in range(80):
            self.simulation.step()
        self.assertEqual(self.resources.model.neq, 0)

    def grasp_and_hold(self):
        simulation = self.simulation
        initial_height = simulation.grasp_point('harvest-knife')[2]
        simulation.request_grasp('harvest-knife')
        held_frames = 0
        minimum_height = 2.0
        maximum_tilt = 0.0
        for frame in range(2200):
            simulation.step()
            self.assert_standing()
            minimum_height = min(minimum_height, float(simulation.data.qpos[2]))
            maximum_tilt = max(maximum_tilt, float(np.arccos(np.clip(simulation.data.xmat[1].reshape(3, 3)[2, 2], -1, 1))))
            hand = simulation.hands['right']
            if hand['phase'] == 'hold' and hand['held'] == 'harvest-knife':
                held_frames += 1
                self.assertGreater(simulation.grasp_point('harvest-knife')[2], initial_height + .055)
            else:
                held_frames = 0
            if held_frames >= 250:
                print(json.dumps({'physical_hold_seconds': 5, 'minimum_pelvis_height': minimum_height, 'maximum_tilt_degrees': maximum_tilt * 180 / np.pi, 'lift': float(simulation.grasp_point('harvest-knife')[2] - initial_height)}), flush=True)
                return float(simulation.grasp_point('harvest-knife')[2])
        self.fail('The free knife did not sustain a five-second physical hold')

    def test_physical_pickup_release_preserves_standing(self):
        height = self.grasp_and_hold()
        self.simulation.set_grip('right', .9, False)
        for frame in range(250):
            self.simulation.step()
            self.assert_standing()
        self.assertIsNone(self.simulation.hands['right']['held'])
        self.assertLess(self.simulation.grasp_point('harvest-knife')[2], height - .04)

    def test_low_grip_slips_without_toppling_robot(self):
        height = self.grasp_and_hold()
        self.simulation.set_grip('right', .01, True)
        for frame in range(350):
            self.simulation.step()
            self.assert_standing()
        self.assertIsNone(self.simulation.hands['right']['held'])
        self.assertLess(self.simulation.grasp_point('harvest-knife')[2], height - .04)


if __name__ == '__main__':
    unittest.main()
