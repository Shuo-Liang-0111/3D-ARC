# RF-14 真实化第二轮

后续用户反馈已触发 `realism-v0.4.5` 布局修正：移除重复球车并调整裁判椅位置和朝向，详见 [球车与裁判椅布局修正](rf14-layout-correction.md)。本文以下保留第二轮原始生产与验收记录。

用户要求在现有蓝绿室外硬地、晴天下午和八球归筐玩法基础上，提高真实感，并使用 Cardinal、EmbodiedGen、Blender。生产与部署沿用本次授权服务器的 `.`，环境、缓存和生成记录保存在 `/path/to/arc-workspace`。机器人、共享相机、FOV、控制与运动参数冻结。

## 资产和工具来源

- Cardinal high-highpoly：新增带轮储球车、2.3 m 裁判椅、2.45 m 风挡模块。原有长椅和网球包继续复用。生成树木的叶片比例不合适，已拒绝接入。
- Cardinal image：蓝色丙烯酸表面、混凝土铺装、透明悬铃木枝叶。绿色表面由蓝色纹理派生；法线微颗粒由 Blender 流程生成，不将 RGB 图像称为完整扫描 PBR。
- EmbodiedGen 2.1.0 `asset-process`：实际运行等比缩放，同步 GLB、碰撞代理和 URDF 高度元数据；风挡旋转 90° 后检查正面。生成 CLI 缺少依赖，安装匹配 kaolin 后仍缺 nvdiffrast，且本地生成后端子模块为空。因此本轮没有 EmbodiedGen 生成模型；处理后的 Cardinal 模型确实用于场景。
- Blender 4.5.3：重建更细的网孔、下垂网带、排水沟、围网底脚和夹具；用透明枝叶卡片重建细叶树冠，并合并材质以减少绘制调用。新设施保持在场边，提供独立权威碰撞。
- 环境光：Poly Haven 的 `kloofendal_48d_partly_cloudy_puresky` 1k HDR，CC0。来源 https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky；下载字节 MD5 `c69498687e876bf68d2a8b8a62234eb9` 与官方 API 一致，运行时 SHA-256 随 manifest 保存。

源请求、task ID、原始模型、EmbodiedGen 输入与输出、度量及日志位于 `./authoring/server-production/rf14/realism-v0.4`。运行时使用不可变 `public/local-assets/levels/rf14/realism-v0.4.*`，失败候选不覆盖。

## 可复现入口

1. `tools/rf14-v04-assets.py`：恢复任务清单、查询和下载；不盲目重发状态未知的提交。
2. `tools/rf14-v04-normalize.py`：调用 EmbodiedGen 实际资产处理模块并输出尺寸证据。
3. `tools/rf14-build-v04.py`：Blender 生成候选环境、碰撞和树木。
4. `tools/rf14-v04-finish.py`：新版本中的材质色彩校准、透明边缘去白和远距离网体可见性修整。
5. `tools/rf14-verify-assets.mjs`：当前活动版本的实际包围盒、17 个碰撞体和 source/build/served SHA-256。
6. `tools/rf14-full-playtest.mjs` 与 `tools/rf14-release-check.mjs`：正式浏览器完整路线、视图、加载失败门禁和性能。

## 验收状态

活动资产为 `realism-v0.4.4`，目标 URL 为 `http://127.0.0.1:4173/?level=rf14&view=third`。完整浏览器八球归筐、放下重拾、持物绕网、完成和重置在 `realism-v0.4.2` 上通过；最终版本仅改树叶透明边缘并新增 HDR，九件环境/碰撞/交互资产与该路线版本 SHA-256 相同，玩法引擎未改。当前版本也重新执行完整引擎路线与浏览器近景交互，记录具体覆盖，不将旧截图冒充最终截图。

当前六项专项测试和构建通过，17 个权威碰撞体实测与结构定义一致。最终版本性能、缺失资产测试与近景交互结果写入 `production/rf14/realism-v0.4.4/review`；正式全景等截图另保存在 `./authoring/server-production/rf14/realism-v0.4.4/review`。

Chrome 152.0.7977.83、Apple M3、1920×1080 实测：第一视角 59–60 FPS，第三视角 47.1–59.5 FPS，双视角 32.7–49.6 FPS。刷新后 40/40 个世界资产就绪，脚本错误 0。环境、碰撞、球、HDR 的四项 404 注入均成功阻止开始。公网浏览器偶发连接重置/502；数值与图像测试通过 SSH 转发访问同一 Vite 服务完成，公网 HTTP 和运行时版本另行核实。

本轮没有改动机器人、共享相机或控制文件；冻结哈希全部一致。三维源文件、生成图片和环境不入 Git。历史共享测试中的五项基线失败不属于本轮变更，未修改它们。

最终 `realism-v0.4.4` 浏览器交互复测通过：拾取、手持、放下重拾、归筐、R 重置。对应 `interaction-check.json` 记录 `passed: true`；最终截图已实际查看。状态：已完成生产和部署，用户反馈待定。
