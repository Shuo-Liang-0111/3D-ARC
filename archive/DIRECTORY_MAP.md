# 目录与原始来源对应

路径保持原工程结构；原服务器绝对路径与账号已替换为可移植占位符。精确来源类别及 SHA-256 见 `provenance.json`，文件数量按逻辑路径统计。

| 归档目录 | 内容及原始来源 |
|---|---|
| `game/` | 原工程当前可编辑场景、任务状态机、机器人、摄像机、交互与共享逻辑 |
| `server/`, `server.mjs`, `simulation/` | 原 API、旧测评及排行榜组件、G1 MuJoCo 与运动策略接入 |
| `public/local-assets/`, `public/vendor/` | 原模型、纹理、音频、碰撞代理、客户端机器人资源与前端运行依赖 |
| `public/<release-name>/` | 网站实际调用的 6 个冻结部署版本；外部符号链接已展开为文件，仍保留原路径 |
| `tools/`, `tests/`, `docs/` 等 | 原制作/测试/部署脚本与设计说明；不包含账号与运行记录 |
| `authoring/server-production/` | 原 production 下与这些任务相关的 Blender、模型、制作配置、脚本、诊断及历史补丁 |
| `reference/recovered-original/` | 原工作树已删除、仍能从原 Git 恢复的 63 个制作/设计文件 |
| `reference/associated-source/` | 与 4 个冻结版本关联的原历史提交源码；不是新的关卡实现 |
| `vendor-data/` | 从原外部机器人运行目录补齐的 G1 XML、网格、ONNX、YAML 和第三方许可 |
| `archive/` | 来源清单、映射、脱敏记录、恢复/启动辅助工具 |

## 36 个网站正式任务

RF-08 网页分组对应内部 `rf09`；RF-11 对应 `rf13`，不要按编号直接推测文件夹。详细关联文件与资产目录见 `tasks.json`。

| 网站编号 | 内部 ID | 名称 | 当前可编辑入口 | 人工入口实际版本 |
|---|---|---|---|---|
| RF-01 | `rf01` | 工业园区 | [`game/levels/rf01/runtime.js`](../game/levels/rf01/runtime.js) | rf01-restored-carry-v1 |
| RF-01-2 | `rf01-2` | 厂房照明 | [`game/levels/rf01-2/runtime.js`](../game/levels/rf01-2/runtime.js) | rf01-restored-carry-v1 |
| RF-01-3 | `rf01-3` | 厂房快递分拣 | [`game/levels/rf01-3/runtime.js`](../game/levels/rf01-3/runtime.js) | rf01-restored-carry-v1 |
| RF-02 | `rf02` | 图书馆归档 | [`game/levels/rf02/runtime.js`](../game/levels/rf02/runtime.js) | current-source |
| RF-02-2 | `rf02-2` | 闭馆复位 | [`game/levels/rf02-2/runtime.js`](../game/levels/rf02-2/runtime.js) | current-source |
| RF-02-3 | `rf02-3` | 动态巡检 | [`game/levels/rf02-3/runtime.js`](../game/levels/rf02-3/runtime.js) | current-source |
| RF-03 | `rf03` | 快递分拣线 | [`game/levels/rf03/runtime.js`](../game/levels/rf03/runtime.js) | current-source |
| RF-04 | `rf04` | 家庭洗衣 | [`game/levels/rf04/runtime.js`](../game/levels/rf04/runtime.js) | current-source |
| RF-04-2 | `rf04-2` | 衣物收纳 | [`game/levels/rf04-2/runtime.js`](../game/levels/rf04-2/runtime.js) | current-source |
| RF-04-3 | `rf04-3` | 家务与扫地机器人 | [`game/levels/rf04-3/runtime.js`](../game/levels/rf04-3/runtime.js) | current-source |
| RF-05 | `rf05` | 酒店整理 | [`game/levels/rf05/series-entry.js`](../game/levels/rf05/series-entry.js) | current-source |
| RF-05-2 | `rf05-2` | 客房补给 | [`game/levels/rf05-2/runtime.js`](../game/levels/rf05-2/runtime.js) | current-source |
| RF-05-3 | `rf05-3` | 动态客房服务 | [`game/levels/rf05-3/runtime.js`](../game/levels/rf05-3/runtime.js) | current-source |
| RF-06 | `rf06` | 家庭漏水 | [`game/levels/rf06/runtime.js`](../game/levels/rf06/runtime.js) | rf06-series-v1-r16 |
| RF-06-2 | `rf06-2` | 积水扩散 | [`game/levels/rf06-2/runtime.js`](../game/levels/rf06-2/runtime.js) | rf06-series-v1-r16 |
| RF-06-3 | `rf06-3` | 蟑螂清理 | [`game/levels/rf06-3/runtime.js`](../game/levels/rf06-3/runtime.js) | rf06-series-v1-r16 |
| RF-07 | `rf07` | 冷链转运 | [`game/levels/rf07/runtime.js`](../game/levels/rf07/runtime.js) | rf073-pickup-finish-r1 |
| RF-07-2 | `rf07-2` | 冷藏巡检 | [`game/levels/rf07-2/runtime.js`](../game/levels/rf07-2/runtime.js) | rf073-pickup-finish-r1 |
| RF-07-3 | `rf07-3` | 泄漏应急 | [`game/levels/rf07-3/runtime.js`](../game/levels/rf07-3/runtime.js) | rf073-pickup-finish-r1 |
| RF-08 | `rf09` | 会议准备 | [`game/levels/rf09/office-entry.js`](../game/levels/rf09/office-entry.js) | rf08-office-v1-r30 |
| RF-08-2 | `rf09-2` | 通道整理 | [`game/levels/rf09-2/office-entry.js`](../game/levels/rf09-2/office-entry.js) | rf08-office-v1-r30 |
| RF-08-3 | `rf09-3` | 会务来电 | [`game/levels/rf09-3/office-entry.js`](../game/levels/rf09-3/office-entry.js) | rf08-office-v1-r30 |
| RF-09 | `rf11` | 双机器人协作搬运 | [`game/levels/rf11/runtime.js`](../game/levels/rf11/runtime.js) | current-source |
| RF-10 | `rf12` | 中国家庭厨房 | [`game/levels/rf12/runtime.js`](../game/levels/rf12/runtime.js) | current-source |
| RF-10-2 | `rf12-2` | 简易备餐归位 | [`game/levels/rf12-2/runtime.js`](../game/levels/rf12-2/runtime.js) | current-source |
| RF-10-3 | `rf12-3` | 烧水计时灭火 | [`game/levels/rf12-3/runtime.js`](../game/levels/rf12-3/runtime.js) | current-source |
| RF-11 | `rf13` | 社区诊所开诊 | [`game/levels/rf13/series-entry.js`](../game/levels/rf13/series-entry.js) | rf11-clinic-series-v1-r12 |
| RF-11-02 | `rf13-02` | 基础补给 · 低等 | [`game/levels/rf13-02/runtime.js`](../game/levels/rf13-02/runtime.js) | rf11-clinic-series-v1-r12 |
| RF-11-03 | `rf13-03` | 动态诊间服务 · 高等 | [`game/levels/rf13-03/runtime.js`](../game/levels/rf13-03/runtime.js) | rf11-clinic-series-v1-r12 |
| RF-12 | `rf14` | 网球场捡球归筐 | [`game/levels/rf14/runtime.js`](../game/levels/rf14/runtime.js) | rf12-tennis-series-v1-r7 |
| RF-12-2 | `rf14-2` | 网球分类归筐 | [`game/levels/rf14-2/runtime.js`](../game/levels/rf14-2/runtime.js) | rf12-tennis-series-v1-r7 |
| RF-12-3 | `rf14-3` | 雨中分类与避雨 | [`game/levels/rf14-3/runtime.js`](../game/levels/rf14-3/runtime.js) | rf12-tennis-series-v1-r7 |
| RF-13 | `rf15` | 农产品冷链装运 | [`game/levels/rf15/runtime.js`](../game/levels/rf15/runtime.js) | current-source |
| RF-13-1 | `rf15-1` | 手推车归位 | [`game/levels/rf15-1/runtime.js`](../game/levels/rf15-1/runtime.js) | current-source |
| RF-13-2 | `rf15-2` | 田间收割入筐 | [`game/levels/rf15-2/runtime.js`](../game/levels/rf15-2/runtime.js) | current-source |
| RF-13-3 | `rf15-3` | 动态称重装车 | [`game/levels/rf15-3/runtime.js`](../game/levels/rf15-3/runtime.js) | current-source |

## 冻结目录的实际来源

`original-project` 表示原 arc-game 根目录，`original-production` 表示原 production 根目录。归档时展开符号链接，运行时不依赖服务器上的原目录。

| 归档中的路径 | 原目录对应关系 |
|---|---|
| `public/rf01-restored-carry-v1/` | `original-project/public/rf01-restored-carry-v1/` |
| `public/rf06-series-v1-r16/` | `original-production/rf06-series-v1/rf06-series-v1-r16/` |
| `public/rf073-pickup-finish-r1/` | `original-production/rf073-pickup-finish/release-r1/` |
| `public/rf08-office-v1-r30/` | `original-production/rf08-office-v1/build/r30/` |
| `public/rf11-clinic-series-v1-r12/` | `original-production/rf11-clinic-series-v1/release-r12/` |
| `public/rf12-tennis-series-v1-r7/` | `original-production/rf12-tennis-series-v1/rf12-tennis-series-v1-r7/` |

原项目 HEAD 为 `2fd164bc2f5bb24805a81ce9d29f2e576a0907bd`。此次导出包含经核对的原工作树修改与未跟踪制作资料，不只包含这个提交。为避免泄露已删除的历史凭据，未推送原 `.git` 全历史；相关历史源码快照、可恢复制作文件和原 SHA-256 另行保存。
