from __future__ import annotations

import math
import os
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import mujoco
import numpy as np
import onnxruntime as ort
import yaml


POLICY_HZ = 50
STREAM_HZ = 30
HISTORY_LENGTH = 5
COMMAND_TIMEOUT_SECONDS = 0.35
DEFAULT_OPERATOR_YAW_RATE = 0.6
DEFAULT_YAW_TORQUE_GAIN = 6.0
DEFAULT_MAX_YAW_TORQUE = 12.0
DEFAULT_LEFT_YAW_TARGET_SCALE = 3.0
DEFAULT_RIGHT_YAW_TARGET_SCALE = 3.5
CONTROL_MODE_VELOCITY = "velocity_policy"
CONTROL_MODE_JOINT_POSITION = "joint_position"
CONTROL_MODES = (CONTROL_MODE_VELOCITY, CONTROL_MODE_JOINT_POSITION)
JOINT_ORDER = "g1_29dof_policy_v1"
DEFAULT_JOINT_COMMAND_DURATION_MS = 100.0
MAX_JOINT_COMMAND_DURATION_MS = 2000.0
GAME_FROM_MUJOCO = np.array(
    [
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
        [1.0, 0.0, 0.0],
    ],
    dtype=np.float64,
)


@dataclass(frozen=True)
class G1Paths:
    model: Path
    policy: Path
    config: Path

    @classmethod
    def from_environment(cls) -> "G1Paths":
        required = {
            "model": os.environ.get("ARC_MUJOCO_MODEL"),
            "policy": os.environ.get("ARC_G1_POLICY"),
            "config": os.environ.get("ARC_G1_POLICY_CONFIG"),
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            names = ", ".join(missing)
            raise RuntimeError(f"Missing MuJoCo runtime path(s): {names}")
        return cls(**{name: Path(value) for name, value in required.items()})


class G1Resources:
    def __init__(self, paths: G1Paths):
        self.paths = paths
        for path in (paths.model, paths.policy, paths.config):
            if not path.is_file():
                raise FileNotFoundError(path)
        with paths.config.open("r", encoding="utf-8") as stream:
            self.config = yaml.safe_load(stream)
        self.model = mujoco.MjModel.from_xml_path(str(paths.model))
        self.session = ort.InferenceSession(
            str(paths.policy),
            providers=["CPUExecutionProvider"],
        )
        input_spec = self.session.get_inputs()[0]
        output_spec = self.session.get_outputs()[0]
        if input_spec.name != "obs" or input_spec.shape != [1, 480]:
            raise RuntimeError(f"Unexpected policy input: {input_spec.name} {input_spec.shape}")
        if output_spec.name != "actions" or output_spec.shape != [1, 29]:
            raise RuntimeError(f"Unexpected policy output: {output_spec.name} {output_spec.shape}")

        self.joint_ids_map = np.asarray(self.config["joint_ids_map"], dtype=np.int32)
        self.default_joint_pos = np.asarray(self.config["default_joint_pos"], dtype=np.float64)
        self.stiffness = np.asarray(self.config["stiffness"], dtype=np.float64)
        self.damping = np.asarray(self.config["damping"], dtype=np.float64)
        self.action_scale = np.asarray(
            self.config["actions"]["JointPositionAction"]["scale"],
            dtype=np.float64,
        )
        self.command_limits = np.asarray(
            [
                self.config["commands"]["base_velocity"]["ranges"]["lin_vel_x"],
                self.config["commands"]["base_velocity"]["ranges"]["lin_vel_y"],
                self.config["commands"]["base_velocity"]["ranges"]["ang_vel_z"],
            ],
            dtype=np.float64,
        )
        self.operator_yaw_rate = float(
            os.environ.get("ARC_G1_YAW_RATE", str(DEFAULT_OPERATOR_YAW_RATE))
        )
        if (
            not math.isfinite(self.operator_yaw_rate)
            or not 0.0 < self.operator_yaw_rate <= 1.0
        ):
            raise RuntimeError("ARC_G1_YAW_RATE must be within (0, 1]")
        self.yaw_torque_gain = float(
            os.environ.get("ARC_G1_YAW_TORQUE_GAIN", str(DEFAULT_YAW_TORQUE_GAIN))
        )
        self.max_yaw_torque = float(
            os.environ.get("ARC_G1_MAX_YAW_TORQUE", str(DEFAULT_MAX_YAW_TORQUE))
        )
        self.left_yaw_target_scale = DEFAULT_LEFT_YAW_TARGET_SCALE
        self.right_yaw_target_scale = DEFAULT_RIGHT_YAW_TARGET_SCALE
        if not math.isfinite(self.yaw_torque_gain) or self.yaw_torque_gain <= 0.0:
            raise RuntimeError("ARC_G1_YAW_TORQUE_GAIN must be positive")
        if not math.isfinite(self.max_yaw_torque) or self.max_yaw_torque <= 0.0:
            raise RuntimeError("ARC_G1_MAX_YAW_TORQUE must be positive")
        if self.model.nu != 29 or self.model.nq != 36 or self.model.nv != 35:
            raise RuntimeError(
                f"Expected G1 29DOF model, received nq={self.model.nq}, "
                f"nv={self.model.nv}, nu={self.model.nu}"
            )
        if not all(
            array.shape == (29,)
            for array in (
                self.joint_ids_map,
                self.default_joint_pos,
                self.stiffness,
                self.damping,
                self.action_scale,
            )
        ):
            raise RuntimeError("G1 policy configuration must contain 29 joint values")

        self.joint_names = tuple(
            mujoco.mj_id2name(self.model, mujoco.mjtObj.mjOBJ_JOINT, index)
            for index in range(1, self.model.njnt)
        )
        self.policy_joint_names = tuple(
            self.joint_names[index] for index in self.joint_ids_map
        )
        self.robot_qpos = self.model.jnt_qposadr[1:].copy()
        self.robot_dofs = self.model.jnt_dofadr[1:].copy()
        self.robot_actuators = np.arange(29, dtype=np.int32)
        self.joint_lower_limits = self.model.jnt_range[1:, 0].copy()
        self.joint_upper_limits = self.model.jnt_range[1:, 1].copy()
        self.policy_joint_lower_limits = self.joint_lower_limits[self.joint_ids_map]
        self.policy_joint_upper_limits = self.joint_upper_limits[self.joint_ids_map]
        self.physics_steps_per_policy = round(
            (1.0 / POLICY_HZ) / self.model.opt.timestep
        )
        if not math.isclose(
            self.physics_steps_per_policy * self.model.opt.timestep,
            1.0 / POLICY_HZ,
            rel_tol=0,
            abs_tol=1e-9,
        ):
            raise RuntimeError("MuJoCo timestep must divide the 50 Hz policy interval")


class G1Simulation:
    def __init__(self, resources: G1Resources):
        self.resources = resources
        self.data = mujoco.MjData(resources.model)
        self.control_mode = CONTROL_MODE_VELOCITY
        self.command = np.zeros(3, dtype=np.float64)
        self.turn_rate = 0.0
        self.last_command_at = time.monotonic()
        self.last_action = np.zeros(29, dtype=np.float64)
        self.target_joint_pos = np.zeros(29, dtype=np.float64)
        self.joint_command_start = np.zeros(29, dtype=np.float64)
        self.joint_command_target = np.zeros(29, dtype=np.float64)
        self.joint_command_started_at = 0.0
        self.joint_command_duration = 0.0
        self.history: list[deque[np.ndarray]] = []
        self.sequence = 0
        self.spawn = {"x": 0.0, "z": 0.0, "yaw": 0.0}
        self.reset()

    def reset(self, spawn: dict | None = None) -> None:
        if spawn:
            self.spawn = {
                "x": float(spawn.get("x", self.spawn["x"])),
                "z": float(spawn.get("z", self.spawn["z"])),
                "yaw": float(spawn.get("yaw", self.spawn["yaw"])),
            }
        model = self.resources.model
        mujoco.mj_resetData(model, self.data)
        mapping = self.resources.joint_ids_map
        self.data.qpos[self.resources.robot_qpos[mapping]] = self.resources.default_joint_pos
        self.data.qpos[0] = self.spawn["z"]
        self.data.qpos[1] = self.spawn["x"]
        yaw_half = self.spawn["yaw"] / 2.0
        self.data.qpos[3:7] = (math.cos(yaw_half), 0.0, 0.0, math.sin(yaw_half))
        mujoco.mj_forward(model, self.data)
        self.command.fill(0.0)
        self.turn_rate = 0.0
        self.last_command_at = time.monotonic()
        self.last_action.fill(0.0)
        self.target_joint_pos.fill(0.0)
        self.target_joint_pos[mapping] = self.resources.default_joint_pos
        self.joint_command_start[:] = self.resources.default_joint_pos
        self.joint_command_target[:] = self.resources.default_joint_pos
        self.joint_command_started_at = self.data.time
        self.joint_command_duration = 0.0
        terms = self._observation_terms()
        self.history = [
            deque((value.copy() for _ in range(HISTORY_LENGTH)), maxlen=HISTORY_LENGTH)
            for value in terms
        ]
        self.sequence = 0

    def set_command(self, forward: float, lateral: float, yaw: float) -> None:
        if self.control_mode != CONTROL_MODE_VELOCITY:
            raise ValueError("velocity commands require velocity_policy mode")
        requested = np.asarray((forward, lateral, yaw), dtype=np.float64)
        if not np.isfinite(requested).all():
            raise ValueError("velocity command values must be finite")
        limits = self.resources.command_limits
        self.command[:] = np.clip(requested, limits[:, 0], limits[:, 1])
        self.turn_rate = float(np.clip(yaw, -1.0, 1.0)) * self.resources.operator_yaw_rate
        self.last_command_at = time.monotonic()

    def stop(self) -> None:
        self.command.fill(0.0)
        self.turn_rate = 0.0
        self.last_command_at = time.monotonic()

    def set_control_mode(self, mode: str) -> None:
        if mode not in CONTROL_MODES:
            raise ValueError(f"unsupported control mode: {mode}")
        if mode == self.control_mode:
            return
        self.stop()
        self.control_mode = mode
        self.last_action.fill(0.0)
        current_policy_order = self.data.qpos[self.resources.robot_qpos][self.resources.joint_ids_map]
        self.joint_command_start[:] = current_policy_order
        self.joint_command_target[:] = current_policy_order
        self.target_joint_pos[self.resources.joint_ids_map] = current_policy_order
        self.joint_command_started_at = self.data.time
        self.joint_command_duration = 0.0
        terms = self._observation_terms()
        self.history = [
            deque((value.copy() for _ in range(HISTORY_LENGTH)), maxlen=HISTORY_LENGTH)
            for value in terms
        ]

    def set_joint_targets(
        self,
        targets: Iterable[float],
        duration_ms: float = DEFAULT_JOINT_COMMAND_DURATION_MS,
    ) -> bool:
        if self.control_mode != CONTROL_MODE_JOINT_POSITION:
            raise ValueError("joint targets require joint_position mode")
        try:
            requested = np.asarray(targets, dtype=np.float64)
        except (TypeError, ValueError) as error:
            raise ValueError("joint targets must contain 29 numeric values") from error
        if requested.shape != (29,):
            raise ValueError("joint targets must contain exactly 29 values")
        if not np.isfinite(requested).all():
            raise ValueError("joint targets must be finite")
        try:
            duration = float(duration_ms)
        except (TypeError, ValueError) as error:
            raise ValueError("joint command duration must be numeric") from error
        if not math.isfinite(duration) or duration < 0.0:
            raise ValueError("joint command duration must be finite and non-negative")
        duration = min(duration, MAX_JOINT_COMMAND_DURATION_MS)
        clipped = np.clip(
            requested,
            self.resources.policy_joint_lower_limits,
            self.resources.policy_joint_upper_limits,
        )
        self.joint_command_start[:] = self.data.qpos[self.resources.robot_qpos][self.resources.joint_ids_map]
        self.joint_command_target[:] = clipped
        self.joint_command_started_at = self.data.time
        self.joint_command_duration = duration / 1000.0
        self.last_command_at = time.monotonic()
        return bool(np.any(clipped != requested))

    def step(self) -> None:
        if self.control_mode == CONTROL_MODE_JOINT_POSITION:
            self._step_joint_position()
        else:
            self.step_policy()

    def step_policy(self) -> None:
        if time.monotonic() - self.last_command_at > COMMAND_TIMEOUT_SECONDS:
            self.command.fill(0.0)
            self.turn_rate = 0.0
        observation = self._observation()
        action = self.resources.session.run(
            ["actions"],
            {"obs": observation[np.newaxis, :]},
        )[0][0]
        if action.shape != (29,) or not np.isfinite(action).all():
            raise RuntimeError("G1 policy returned an invalid action")
        self.last_action[:] = action
        target_policy_order = (
            self.resources.default_joint_pos
            + self.resources.action_scale * self.last_action
        )
        self.target_joint_pos[self.resources.joint_ids_map] = target_policy_order
        for _ in range(self.resources.physics_steps_per_policy):
            self._step_physics()
        self.sequence += 1

    def _step_joint_position(self) -> None:
        self.command.fill(0.0)
        self.turn_rate = 0.0
        if self.joint_command_duration <= 0.0:
            alpha = 1.0
        else:
            alpha = float(
                np.clip(
                    (self.data.time - self.joint_command_started_at)
                    / self.joint_command_duration,
                    0.0,
                    1.0,
                )
            )
            alpha = alpha * alpha * (3.0 - 2.0 * alpha)
        target_policy_order = (
            self.joint_command_start
            + (self.joint_command_target - self.joint_command_start) * alpha
        )
        self.target_joint_pos[self.resources.joint_ids_map] = target_policy_order
        for _ in range(self.resources.physics_steps_per_policy):
            self._step_physics()
        self.sequence += 1

    def _step_physics(self) -> None:
        joint_pos = self.data.qpos[self.resources.robot_qpos]
        joint_vel = self.data.qvel[self.resources.robot_dofs]
        torque = (
            self.resources.stiffness * (self.target_joint_pos - joint_pos)
            - self.resources.damping * joint_vel
        )
        control_range = self.resources.model.actuator_ctrlrange[self.resources.robot_actuators]
        self.data.ctrl[self.resources.robot_actuators] = np.clip(torque, control_range[:, 0], control_range[:, 1])
        yaw_target_scale = (
            self.resources.left_yaw_target_scale
            if self.turn_rate >= 0.0
            else self.resources.right_yaw_target_scale
        )
        yaw_torque = self.resources.yaw_torque_gain * (
            yaw_target_scale * self.turn_rate - self.data.qvel[5]
        )
        self.data.xfrc_applied[1, 5] = np.clip(
            yaw_torque,
            -self.resources.max_yaw_torque,
            self.resources.max_yaw_torque,
        )
        mujoco.mj_step(self.resources.model, self.data)

    def _observation_terms(self) -> tuple[np.ndarray, ...]:
        mapping = self.resources.joint_ids_map
        joint_pos_policy = self.data.qpos[self.resources.robot_qpos][mapping]
        joint_vel_policy = self.data.qvel[self.resources.robot_dofs][mapping]
        inverse_quaternion = self.data.qpos[3:7].copy()
        inverse_quaternion[1:] *= -1.0
        projected_gravity = np.empty(3, dtype=np.float64)
        mujoco.mju_rotVecQuat(
            projected_gravity,
            np.asarray((0.0, 0.0, -1.0), dtype=np.float64),
            inverse_quaternion,
        )
        return (
            self.data.sensor("imu_gyro").data.copy() * 0.2,
            projected_gravity,
            self.command.copy(),
            joint_pos_policy - self.resources.default_joint_pos,
            joint_vel_policy * 0.05,
            self.last_action.copy(),
        )

    def _observation(self) -> np.ndarray:
        for buffer, value in zip(self.history, self._observation_terms(), strict=True):
            buffer.append(value.copy())
        observation = np.concatenate(
            [np.concatenate(tuple(buffer)) for buffer in self.history]
        ).astype(np.float32)
        if observation.shape != (480,) or not np.isfinite(observation).all():
            raise RuntimeError("G1 policy observation is invalid")
        return observation

    def state(self, real_time_factor: float = 1.0) -> dict:
        game_position = GAME_FROM_MUJOCO @ self.data.qpos[:3]
        game_rotation = self._game_rotation_quaternion()
        game_linear_velocity = GAME_FROM_MUJOCO @ self.data.qvel[:3]
        game_angular_velocity = GAME_FROM_MUJOCO @ self.data.sensor("imu_gyro").data
        return {
            "type": "state",
            "sequence": self.sequence,
            "controlMode": self.control_mode,
            "simulationTime": float(self.data.time),
            "controllerHz": POLICY_HZ,
            "streamHz": STREAM_HZ,
            "coordinateFrame": "threejs-y-up",
            "base": {
                "position": finite_list(game_position),
                "quaternion": finite_list(
                    (game_rotation[1], game_rotation[2], game_rotation[3], game_rotation[0])
                ),
                "yaw": float(self._game_yaw()),
                "linearVelocity": finite_list(game_linear_velocity),
                "angularVelocity": finite_list(game_angular_velocity),
            },
            "joints": {
                "names": self.resources.joint_names,
                "positions": finite_list(self.data.qpos[self.resources.robot_qpos]),
                "velocities": finite_list(self.data.qvel[self.resources.robot_dofs]),
            },
            "jointControl": {
                "order": JOINT_ORDER,
                "names": self.resources.policy_joint_names,
                "positions": finite_list(
                    self.data.qpos[self.resources.robot_qpos][self.resources.joint_ids_map]
                ),
                "targets": finite_list(self.joint_command_target),
            },
            "contacts": {
                "count": int(self.data.ncon),
            },
            "fallen": bool(self.data.qpos[2] < 0.45),
            "realTimeFactor": float(real_time_factor),
        }

    def _game_rotation_quaternion(self) -> np.ndarray:
        mujoco_rotation = np.empty(9, dtype=np.float64)
        mujoco.mju_quat2Mat(mujoco_rotation, self.data.qpos[3:7])
        rotation = mujoco_rotation.reshape(3, 3)
        game_rotation = GAME_FROM_MUJOCO @ rotation @ GAME_FROM_MUJOCO.T
        quaternion = np.empty(4, dtype=np.float64)
        mujoco.mju_mat2Quat(quaternion, game_rotation.ravel())
        return quaternion

    def _game_yaw(self) -> float:
        quaternion = self._game_rotation_quaternion()
        w, x, y, z = quaternion
        return math.atan2(2.0 * (w * y + x * z), 1.0 - 2.0 * (y * y + z * z))


def finite_list(values: Iterable[float]) -> list[float]:
    result = [float(value) for value in values]
    if not all(math.isfinite(value) for value in result):
        raise RuntimeError("MuJoCo produced a non-finite state")
    return result
