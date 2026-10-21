# Display numbering (2026-09-20)

The user-facing RF sequence excludes the two real-scene tests. Existing route IDs, asset paths, simulation IDs and saved episodes remain stable; use the menu labels and runtime `ui.levelLabel` for presentation, not the internal route number.

| Route ID | Display label | Scene |
| --- | --- | --- |
| rf08 | — | 真实场景互动测试 |
| rf09 | RF-08 | 会议准备 |
| rf10 | — | 真实场景验证 |
| rf11 | RF-09 | 双机器人协作搬运 |
| rf12 | RF-10 | 中国家庭厨房 |
| rf13 | RF-11 | 社区诊所开诊 |
| rf14 | RF-12 | 网球场捡球归筐 |
| rf15 | RF-13 | 农产品冷链装运 |
| rf15-1 | RF-13-1 | 手推车归位 |
| rf15-2 | RF-13-2 | 田间收割入筐 |
| rf15-3 | RF-13-3 | 动态称重装车 |

RF-01 through RF-07 and their variants retain their labels. The two real-scene tests have no displayed RF number. The game menu, runtime headings, operator feed, and Agent guide preview links use the updated labels.

The fixed RF-01 play entry serves `public/rf01-sorting-build-v4-navigation-v1`. It changes only the menu HTML from v4; all 77 other release files are byte-identical. Other levels continue through the existing source runtime.

Validation: build and JavaScript syntax checks passed; all 24 menu routes preserved; all 11 changed runtime labels verified over HTTP. Browser accessibility inspection confirmed the deployed menu. Further screenshot/click checks were not executed because the automatic approval service returned HTTP 503. Existing regression selection: 22 passed, 2 failed, matching the baseline (old import-path expectation in rf09-office and old maxPixelRadius expectation in rf10-gaussian). No Git commit was created because those checks remain failing.
