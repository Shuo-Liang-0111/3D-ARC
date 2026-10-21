from __future__ import annotations

import time

import numpy as np


class BrowserArmControl:
    def __init__(self, resources):
        self.resources = resources
        suffixes = ("shoulder_pitch", "shoulder_roll", "shoulder_yaw", "elbow", "wrist_roll", "wrist_pitch", "wrist_yaw")
        self.indices = {
            side: np.array([resources.joint_names.index(f"{side}_{suffix}_joint") for suffix in suffixes])
            for side in ("left", "right")
        }
        self.clear()

    def clear(self):
        self.targets = {}
        self.commanded = {}
        self.expires = 0.0

    def set_targets(self, targets, current):
        if not isinstance(targets, dict) or any(side not in self.indices for side in targets):
            raise ValueError("arm targets must map left/right to seven joint angles")
        checked = {}
        for side, values in targets.items():
            requested = np.asarray(values, dtype=np.float64)
            if requested.shape != (7,) or not np.isfinite(requested).all():
                raise ValueError("each arm requires seven finite joint angles")
            indices = self.indices[side]
            checked[side] = np.clip(requested, self.resources.joint_lower_limits[indices], self.resources.joint_upper_limits[indices])
        for side in checked:
            if side not in self.commanded:
                self.commanded[side] = current[self.indices[side]].copy()
        self.targets = checked
        self.expires = time.monotonic() + 1.0

    def apply(self, target_positions, timestep):
        if time.monotonic() > self.expires:
            self.clear()
            return []
        active = []
        for side, goal in self.targets.items():
            indices = self.indices[side]
            difference = goal - self.commanded[side]
            ratio = min(1.0, .8 * timestep / max(1e-9, float(np.max(np.abs(difference)))))
            self.commanded[side] += difference * ratio
            target_positions[indices] = self.commanded[side]
            active.extend(indices.tolist())
        return active
