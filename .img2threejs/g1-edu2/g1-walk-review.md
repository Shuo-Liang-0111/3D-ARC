# G1 contralateral arms and walking-pose review

- Corrected coordination: left foot forward/lift pairs with right shoulder forward; right foot forward/lift pairs with left shoulder forward.
- Added separate modes: `marching` keeps zero stride with 45 mm lift; `walking` uses 75 mm sagittal stride with 35 mm lift.
- Both modes retain official-GLB leg dimensions and two-link foot-target IK.
- UI now exposes independent `启动原地踏步` and `启动走路姿态` controls; selecting one stops/replaces the other mode.
- Visual evidence: `g1-walk-leftfoot.png` and `g1-walk-rightfoot.png` are opposing fixed walking phases from the same three-quarter camera.
- Visual judgment: each forward leg is paired with the opposite forward arm; mirrored phase is symmetric; no ipsilateral arm-leg pair remains.
- Scope: walking is an in-place presentation pose loop on the display platform, not world translation or a dynamics-policy playback.
