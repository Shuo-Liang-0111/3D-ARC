import unittest

import numpy as np

from g1_simulation import G1Resources, G1Simulation
from test_g1_simulation import runtime_paths
from level_environment import LevelEnvironments


class BrowserArmControlTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.resources = G1Resources(runtime_paths())

    def test_arm_targets_track_while_locomotion_policy_stands(self):
        simulation = G1Simulation(self.resources)
        LevelEnvironments(self.resources).apply(simulation, 'rf15-1')
        target = np.array([-1.37, -.77, .46, .36, -.73, .4, .76])
        for _ in range(500):
            simulation.browser_arms.set_targets({"right": target}, simulation.data.qpos[self.resources.robot_qpos])
            simulation.set_command(0, 0, 0)
            simulation.step()
        actual = simulation.data.qpos[self.resources.robot_qpos][simulation.browser_arms.indices["right"]]
        self.assertLess(np.max(np.abs(actual - target)), .08)
        self.assertFalse(simulation.state()["fallen"])
        self.assertGreater(simulation.state()["base"]["position"][1], .7)

    def test_invalid_targets_and_reset(self):
        simulation = G1Simulation(self.resources)
        current = simulation.data.qpos[self.resources.robot_qpos]
        for bad in ({"head": [0] * 7}, {"left": [0]}, {"right": [float("nan")] * 7}):
            with self.assertRaises(ValueError):
                simulation.browser_arms.set_targets(bad, current)
        simulation.browser_arms.set_targets({"right": [0] * 7}, current)
        simulation.reset()
        self.assertEqual(simulation.browser_arms.targets, {})

    def test_reach_sequence_remains_finite_and_upright(self):
        simulation = G1Simulation(self.resources)
        LevelEnvironments(self.resources).apply(simulation, 'rf15-1')
        for target in ([-2.069, -1.389, .545, -.359, -.541, .822, 1.61], [-1.87, -.931, .484, .312, -.711, .43, 1.282], [-1.198, -1.108, .439, -.447, -.685, .87, 1.084]):
            for frame in range(300):
                simulation.browser_arms.set_targets({'right': target}, simulation.data.qpos[self.resources.robot_qpos])
                simulation.set_command(0, .06 if frame < 30 else 0, 0)
                simulation.step()
                self.assertTrue(np.isfinite(simulation.data.qpos).all())
                self.assertFalse(simulation.state()['fallen'])


if __name__ == "__main__":
    unittest.main()
