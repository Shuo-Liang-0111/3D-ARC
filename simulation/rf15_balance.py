from __future__ import annotations

import mujoco
import numpy as np
import osqp
from scipy import sparse


class StandingBalance:
    def __init__(self, resources, data):
        self.resources = resources
        self.model = resources.model
        self.dofs = np.r_[np.arange(6), resources.robot_dofs]
        self.feet = [self.model.body(side + '_ankle_roll_link').id for side in ('left', 'right')]
        self.positions = [self.foot_position(data, body) for body in self.feet]
        self.rotations = [data.xmat[body].reshape(3, 3).copy() for body in self.feet]
        self.com_target = data.subtree_com[1].copy()
        self.com_target[:2] = np.mean(self.positions, axis=0)[:2]
        self.rotation = data.xmat[1].reshape(3, 3).copy()
        self.previous_jacobians = {}
        self.torque = np.zeros(29)
        self.last_update = -1.0
        self.status = 'initializing'
        self.com_error = 0.0

    def foot_position(self, data, body):
        return data.xpos[body] + data.xmat[body].reshape(3, 3) @ np.array([.035, 0, -.035])

    def jacobian(self, data, body, point):
        position = np.zeros((3, self.model.nv))
        rotation = np.zeros_like(position)
        mujoco.mj_jac(self.model, data, position, rotation, point, body)
        return position[:, self.dofs], rotation[:, self.dofs]

    def derivative(self, name, matrix, velocity, timestep):
        previous = self.previous_jacobians.get(name, matrix)
        result = ((matrix - previous) / timestep) @ velocity
        self.previous_jacobians[name] = matrix.copy()
        return np.clip(result, -100, 100)

    def update(self, data, targets, hands=()):
        if data.time - self.last_update < .0099:
            return self.torque
        timestep = .01 if self.last_update < 0 else data.time - self.last_update
        self.last_update = data.time
        velocity = data.qvel[self.dofs]
        count = len(self.dofs)
        variables = count + 12
        tasks = []
        goals = []
        contact_jacobians = []

        def add_task(matrix, acceleration, weight):
            tasks.append(np.pad(matrix, ((0, 0), (0, 12))) * weight)
            goals.append(acceleration * weight)

        for index, body in enumerate(self.feet):
            position = self.foot_position(data, body)
            linear, angular = self.jacobian(data, body, position)
            rotation = data.xmat[body].reshape(3, 3)
            error = sum(np.cross(rotation[:, axis], self.rotations[index][:, axis]) for axis in range(3)) / 2
            jacobian = np.vstack([linear, angular])
            acceleration = np.r_[200 * (self.positions[index] - position), 120 * error] - 28 * jacobian @ velocity
            acceleration -= self.derivative(str(index), jacobian, velocity, timestep)
            add_task(jacobian, acceleration, 12)
            contact_jacobians.append(np.vstack([self.rotation.T @ linear, self.rotation.T @ angular]))

        center = np.zeros((3, self.model.nv))
        mujoco.mj_jacSubtreeCom(self.model, data, center, 1)
        center = center[:, self.dofs]
        com_error = self.com_target - data.subtree_com[1]
        self.com_error = float(np.linalg.norm(com_error[:2]))
        acceleration = 65 * com_error - 16 * center @ velocity
        acceleration -= self.derivative('com', center, velocity, timestep)
        add_task(center, acceleration, 20)
        _, torso = self.jacobian(data, 1, data.xpos[1])
        current = data.xmat[1].reshape(3, 3)
        error = sum(np.cross(current[:, axis], self.rotation[:, axis]) for axis in range(3)) / 2
        add_task(torso, 100 * error - 20 * torso @ velocity - self.derivative('torso', torso, velocity, timestep), 8)
        for hand in hands:
            if hand.get('cartesian_target') is None or hand['phase'] not in ('reach', 'close', 'lift', 'hold'):
                continue
            position = data.site_xpos[hand['site']]
            linear, angular = self.jacobian(data, hand['wrist'], position)
            acceleration = 130 * (hand['cartesian_target'] - position) - 23 * linear @ velocity
            acceleration -= self.derivative(str(hand['site']) + '-hand', linear, velocity, timestep)
            add_task(linear, acceleration, 10)
            current = data.site_xmat[hand['site']].reshape(3, 3)
            desired = hand['orientation']
            error = sum(np.cross(current[:, axis], desired[:, axis]) for axis in range(3)) / 2
            add_task(angular, 100 * error - 20 * angular @ velocity, 3)
        posture = np.eye(count)[6:]
        acceleration = 70 * (targets - data.qpos[self.resources.robot_qpos]) - 17 * velocity[6:]
        add_task(posture, acceleration, 1)

        mass = np.zeros((self.model.nv, self.model.nv))
        mujoco.mj_fullM(self.model, mass, data.qM)
        mass = mass[np.ix_(self.dofs, self.dofs)]
        bias = data.qfrc_bias[self.dofs] - data.qfrc_passive[self.dofs]
        contact = np.vstack(contact_jacobians)
        dynamics = np.hstack([mass, -contact.T])
        limits = self.model.actuator_ctrlrange[self.resources.robot_actuators]
        constraints = [dynamics[:6], dynamics[6:]]
        lower = [-bias[:6], limits[:, 0] - bias[6:]]
        upper = [-bias[:6], limits[:, 1] - bias[6:]]
        for foot in range(2):
            offset = count + 6 * foot
            normal = np.zeros((1, variables))
            normal[0, offset + 2] = 1
            constraints.append(normal)
            lower.append(np.array([0]))
            upper.append(np.array([650]))
            for axis, bound in ((0, .55), (1, .55), (3, .022), (4, .075), (5, .015)):
                for sign in (-1, 1):
                    row = np.zeros((1, variables))
                    row[0, offset + axis] = sign
                    row[0, offset + 2] = -bound
                    constraints.append(row)
                    lower.append(np.array([-np.inf]))
                    upper.append(np.array([0]))
        design = np.vstack(tasks)
        target = np.concatenate(goals)
        regularization = np.r_[np.full(count, .01), np.full(12, .0001)]
        hessian = design.T @ design + np.diag(regularization)
        solver = osqp.OSQP()
        solver.setup(P=sparse.csc_matrix(hessian), q=-design.T @ target, A=sparse.csc_matrix(np.vstack(constraints)), l=np.concatenate(lower), u=np.concatenate(upper), verbose=False, eps_abs=.002, eps_rel=.002, max_iter=3000, polishing=False)
        solution = solver.solve(raise_error=False)
        self.status = solution.info.status
        if solution.info.status_val not in (1, 2):
            raise RuntimeError('Standing balance QP failed: ' + self.status)
        self.torque = np.clip(dynamics[6:] @ solution.x + bias[6:], limits[:, 0], limits[:, 1])
        return self.torque
