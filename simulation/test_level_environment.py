import math
import unittest

import mujoco
import numpy as np

from g1_simulation import G1Resources, G1Simulation
from level_environment import LevelEnvironments
from test_g1_simulation import runtime_paths


class RF15WallEnvironmentTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = G1Resources(runtime_paths())
        cls.environments = LevelEnvironments(cls.base)

    def test_environment_preserves_robot_and_policy(self):
        target = self.environments.resources['rf15']
        self.assertIs(target.session, self.base.session)
        for field in ('body_mass', 'body_inertia', 'jnt_range', 'actuator_gainprm', 'actuator_biasprm', 'qpos0'):
            np.testing.assert_array_equal(getattr(target.model, field), getattr(self.base.model, field))
        self.assertEqual(target.model.ngeom, self.base.model.ngeom + 2)
        for name, expected_position, expected_size in [
            ('west-wall', [-2.4, -8.5, 1.9], [4.5, .1, 1.9]),
            ('north-wall', [-6.7, -3.55, 1.9], [.1, 5.05, 1.9]),
        ]:
            geom = target.model.geom(f'level_rf15_{name}')
            np.testing.assert_allclose(geom.pos, expected_position)
            np.testing.assert_allclose(geom.size, expected_size)

    def test_level_switch_preserves_pose_and_other_sessions(self):
        simulation = G1Simulation(self.base)
        other = G1Simulation(self.base)
        simulation.reset({'x': -5.9, 'z': 2.5, 'yaw': math.pi})
        for frame in range(50):
            simulation.step_policy()
        position = simulation.data.qpos.copy()
        velocity = simulation.data.qvel.copy()
        self.environments.apply(simulation, 'rf15')
        np.testing.assert_array_equal(simulation.data.qpos, position)
        np.testing.assert_array_equal(simulation.data.qvel, velocity)
        self.assertIs(other.resources, self.base)
        self.environments.apply(simulation, 'rf14')
        self.assertIs(simulation.resources, self.base)
        np.testing.assert_array_equal(simulation.data.qpos, position)

    def test_physical_wall_contacts_prevent_crossing(self):
        for wall, spawn in [
            ('west', {'x': -7.6, 'z': .5, 'yaw': -math.pi / 2}),
            ('north', {'x': -2, 'z': -5.6, 'yaw': math.pi}),
        ]:
            simulation = G1Simulation(self.base)
            self.environments.apply(simulation, 'rf15')
            simulation.reset(spawn)
            for frame in range(70):
                simulation.step_policy()
            contacts = 0
            minimum_clearance = 10
            for frame in range(400):
                simulation.set_command(.35, 0, 0)
                simulation.step_policy()
                position = simulation.state()['base']['position']
                clearance = position[0] + 8.4 if wall == 'west' else position[2] + 6.6
                minimum_clearance = min(minimum_clearance, clearance)
                self.assertGreater(clearance, .05, f'{wall} crossed wall at {position}')
                for contact in simulation.data.contact:
                    names = [mujoco.mj_id2name(simulation.resources.model, mujoco.mjtObj.mjOBJ_GEOM, int(index)) or '' for index in contact.geom]
                    contacts += any(name.startswith('level_rf15_') for name in names)
            self.assertGreater(contacts, 0, f'{wall} never contacted physical geometry')
            print(f'{wall}: contacts={contacts}, minimum base clearance={minimum_clearance:.4f} m')


if __name__ == '__main__':
    unittest.main()
