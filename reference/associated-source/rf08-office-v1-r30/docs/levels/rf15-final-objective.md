# RF-15 final objective UI

The start screen and mission panel now show only: “将两箱农产品装入冷藏车，并完成出库确认”. Remove the RF-15 scene's extra step/interaction paragraph and stop showing task-step instructions in interaction toasts. Completion, failure and generic invalid-action feedback remain. Gameplay, controls and scene signs are unchanged.

Verification: JavaScript syntax checks, all 12 RF-15 harvest/material/wall tests, and the production build pass. The online start screen and running first-person view were inspected; the mission panel contains the final objective without the extra instruction paragraph.

`game/levels/rf15/scene.js` was already untracked before this task. Its deployed edit is recorded exactly in `tools/rf15/final-objective-scene.patch` to avoid committing the unrelated pre-existing file contents. That patch is already applied on the production server. A source workspace with the earlier scene file can apply it with `git apply --unidiff-zero tools/rf15/final-objective-scene.patch`. The tracked application changes are committed normally.
