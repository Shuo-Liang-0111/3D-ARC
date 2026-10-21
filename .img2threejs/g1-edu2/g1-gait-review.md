# G1 Dex1 gait correction review

- Root cause: the previous web gait rotated all sagittal joints around local X, while the official USD declares hip pitch, knee, ankle pitch, shoulder pitch and elbow revolutes around local Y.
- Official kinematic evidence: `.img2threejs/g1-edu2/official-joints.json` extracted from `UsdPhysics.RevoluteJoint` definitions.
- Corrected chain: opposing hip pitch, swing-leg knee flexion, ankle pitch compensation, opposing shoulder pitch, mild elbow flexion, waist yaw and root vertical settling.
- Transition: gait influence is exponentially damped on start/stop instead of snapping.
- Visual evidence: `g1-gait-final-1_5708.png` and `g1-gait-final-4_7124.png` show the two opposing extreme phases from the same side view.
- Visual judgment: sagittal rotation plane is correct; left/right phases are symmetric; lifted-leg knee bends and ankle compensates; no lateral leg twist or chain separation observed.
- Scope: this remains a deterministic in-place Three.js gait preview, not an Isaac Sim dynamics playback with contact forces or center-of-pressure control.
