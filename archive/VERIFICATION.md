# 归档验证记录

## 发布前检查

- 8,134 个原文件在导出前逐一核对 SHA-256，与审计清单一致。
- 七个数据包实际解包恢复成功，脱敏后的 8,134 个文件逐项校验通过。
- Node 22.18 / npm ci 按原 package-lock 安装成功；npm run build 成功。
- 独立 Python 3.12 环境安装 simulation/requirements.txt 成功，原 G1 MuJoCo、原 API、原 Vite 在隔离端口启动。
- 针对原主机、私人目录、常见密钥/私钥格式、新增项目名称的最终内容扫描无命中；排除 .codex/.claude/凭据目录与运行数据库。模式扫描不构成数学上的零泄露保证。
- 根 README、.gitignore、.gitattributes 保留原件到 archive/original-*，新文件仅服务于归档说明、资产分发和字节一致性。

## 原自动测试

在另一个只读取原文件建立的未脱敏副本上运行：738 项，708 通过，15 失败，15 跳过。归档副本完整运行：738 项，707 通过，16 失败，15 跳过。共同失败项见下方；额外一次失败为旧 Agent 命令超时测试的时序波动，单独复测该测试文件与 RF06 资产完整性文件合计 19 项全部通过。

初次脱敏曾使 RF06 校验清单中的大小/哈希与 GLB 新字节不一致，已同步 8 份引用清单。原始哈希仍保留在 provenance.json。没有修改测试断言或关卡规则以掩盖失败。

共同失败既包括原逻辑/测试与当前实现不一致，也包括按本次范围排除的扫描实验数据；不能称为全套测试通过。初始基线仅复制获准归档的文件，因此实验数据缺失导致的失败也会出现在基线。

- RF-01 Cardinal pass avoids tactile paving and duplicate facade layers
- RF-01 installs collision bounds from the loaded GLB nodes
- RF-08 static GLB embeds textures and contains no Gaussian extensions
- RF-08 uses full scan physics and retains free exploration semantics
- RF-12 resolves the five kitchen hazards and completes at the terminal
- a carried battery can be dropped on ordinary walkable ground
- bin pickup, relocation, collision, blocked placement and reset
- browser controls map A/D to strafe and Q/E to free turning
- cyan light guide is attached in head-link local space
- entry remains blocked until the shared official robot loads
- first-person view renders the actual full robot from the D435 optical pose
- rf08 supports energy-consuming lateral movement
- rf08 supports energy-free Q/E turning
- test_zpf2 is registered as the twelfth scene across the app, HUD and agent entry points
- tests/office-scan-physics.test.mjs

## 浏览器与上传后检查

36 个人工入口的逐关浏览器验证正在进行，完整结果将在上传后下载复核完成后更新。此前 RF01 冻结包与 RF02 当前源码均成功加载、进入任务并收到独立模拟器状态流；渲染检查不等同于任务通关或旧 G1 控制质量通过。
