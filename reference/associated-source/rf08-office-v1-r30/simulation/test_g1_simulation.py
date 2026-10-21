import os
import unittest
from pathlib import Path

import numpy as np

from g1_simulation import (
    CONTROL_MODE_JOINT_POSITION,
    CONTROL_MODE_VELOCITY,
    JOINT_ORDER,
    G1Paths,
    G1Resources,
    G1Simulation,
)


def runtime_paths() -> G1Paths:
    runtime = Path(os.environ["ARC_MUJOCO_RUNTIME"])
    return G1Paths(
        model=runtime / "vendor/unitree_mujoco/unitree_robots/g1/scene_29dof.xml",
        policy=runtime
        / "vendor/unitree_rl_lab/deploy/robots/g1_29dof/config/policy/velocity/v0/exported/policy.onnx",
        config=runtime
        / "vendor/unitree_rl_lab/deploy/robots/g1_29dof/config/policy/velocity/v0/params/deploy.yaml",
    )


class G1SimulationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.resources = G1Resources(runtime_paths())

    def test_idle_policy_keeps_robot_upright(self):
        simulation = G1Simulation(self.resources)
        start = simulation.data.qpos[:3].copy()
        for _ in range(150):
            simulation.step_policy()
        end = simulation.data.qpos[:3].copy()
        self.assertGreater(end[2], 0.7)
        self.assertLess(np.linalg.norm(end[:2] - start[:2]), 0.2)
        self.assertFalse(simulation.state()["fallen"])

    def test_forward_policy_moves_robot_in_game_forward_direction(self):
        simulation = G1Simulation(self.resources)
        simulation.set_command(0.5, 0.0, 0.0)
        for _ in range(150):
            simulation.step_policy()
        state = simulation.state()
        self.assertGreater(state["base"]["position"][2], 0.8)
        self.assertGreater(state["base"]["position"][1], 0.7)

    def test_left_strafe_maps_to_positive_game_x(self):
        simulation = G1Simulation(self.resources)
        simulation.set_command(0.0, 0.3, 0.0)
        for _ in range(150):
            simulation.step_policy()
        self.assertGreater(simulation.state()["base"]["position"][0], 0.25)

    def test_operator_turn_command_uses_faster_yaw_rate(self):
        yaws = []
        drifts = []
        minimum_heights = []
        maximum_tilts = []
        for direction in (1.0, -1.0):
            simulation = G1Simulation(self.resources)
            start = simulation.state()["base"]["position"]
            heights = []
            tilts = []
            simulation.set_command(0.0, 0.0, direction)
            self.assertAlmostEqual(simulation.command[2], 0.2 * direction)
            self.assertAlmostEqual(simulation.turn_rate, 0.6 * direction)
            for _ in range(150):
                simulation.set_command(0.0, 0.0, direction)
                simulation.step_policy()
                frame = simulation.state()
                heights.append(frame["base"]["position"][1])
                quaternion = frame["base"]["quaternion"]
                tilts.append(np.hypot(quaternion[0], quaternion[2]))
            state = simulation.state()
            self.assertFalse(state["fallen"])
            yaws.append(state["base"]["yaw"])
            drifts.append(
                np.linalg.norm(
                    np.asarray(state["base"]["position"])[[0, 2]]
                    - np.asarray(start)[[0, 2]]
                )
            )
            minimum_heights.append(min(heights))
            maximum_tilts.append(max(tilts))
        self.assertGreater(yaws[0], 0.6)
        self.assertLess(yaws[1], -0.55)
        self.assertLess(max(drifts), 0.05)
        self.assertGreater(min(minimum_heights), 0.77)
        self.assertLess(max(maximum_tilts), 0.03)

    def test_sessions_have_independent_mjdata(self):
        first = G1Simulation(self.resources)
        second = G1Simulation(self.resources)
        first.set_command(0.5, 0.0, 0.0)
        for _ in range(80):
            first.step_policy()
        self.assertGreater(first.state()["base"]["position"][2], 0.3)
        self.assertAlmostEqual(second.state()["base"]["position"][2], 0.0, places=6)

    def test_spawn_round_trip_uses_game_coordinates(self):
        simulation = G1Simulation(self.resources)
        simulation.reset({"x": 4.0, "z": -3.0, "yaw": 0.75})
        state = simulation.state()
        self.assertAlmostEqual(state["base"]["position"][0], 4.0, places=6)
        self.assertAlmostEqual(state["base"]["position"][2], -3.0, places=6)
        self.assertAlmostEqual(state["base"]["yaw"], 0.75, places=6)

    def test_joint_position_mode_tracks_policy_order_targets(self):
        simulation = G1Simulation(self.resources)
        simulation.set_control_mode(CONTROL_MODE_JOINT_POSITION)
        targets = self.resources.default_joint_pos.copy()
        targets[15] += 0.25
        simulation.set_joint_targets(targets, duration_ms=100)
        for _ in range(20):
            simulation.step()
        state = simulation.state()
        self.assertEqual(state["controlMode"], CONTROL_MODE_JOINT_POSITION)
        self.assertEqual(state["jointControl"]["order"], JOINT_ORDER)
        self.assertAlmostEqual(state["jointControl"]["positions"][15], targets[15], delta=0.12)
        self.assertFalse(state["fallen"])

    def test_joint_position_targets_are_clipped_to_model_limits(self):
        simulation = G1Simulation(self.resources)
        simulation.set_control_mode(CONTROL_MODE_JOINT_POSITION)
        targets = self.resources.default_joint_pos.copy()
        targets[0] = 100.0
        clipped = simulation.set_joint_targets(targets)
        self.assertTrue(clipped)
        self.assertEqual(
            simulation.joint_command_target[0],
            self.resources.policy_joint_upper_limits[0],
        )

    def test_joint_position_mode_rejects_invalid_commands(self):
        simulation = G1Simulation(self.resources)
        with self.assertRaises(ValueError):
            simulation.set_joint_targets(np.zeros(29))
        simulation.set_control_mode(CONTROL_MODE_JOINT_POSITION)
        with self.assertRaises(ValueError):
            simulation.set_joint_targets(np.zeros(28))
        invalid = np.zeros(29)
        invalid[3] = np.nan
        with self.assertRaises(ValueError):
            simulation.set_joint_targets(invalid)
        with self.assertRaises(ValueError):
            simulation.set_command(0.0, 0.0, 0.0)

    def test_control_mode_switch_preserves_pose_and_supports_reset(self):
        simulation = G1Simulation(self.resources)
        start = simulation.data.qpos.copy()
        simulation.set_control_mode(CONTROL_MODE_JOINT_POSITION)
        np.testing.assert_allclose(simulation.data.qpos, start)
        simulation.reset()
        self.assertEqual(simulation.control_mode, CONTROL_MODE_JOINT_POSITION)
        simulation.set_control_mode(CONTROL_MODE_VELOCITY)
        self.assertEqual(simulation.control_mode, CONTROL_MODE_VELOCITY)


if __name__ == "__main__":
    unittest.main()
