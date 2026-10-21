# 3D-ARC 原工程归档 · 36 个正式任务

此仓库保存原工程截至 2026-10-20 的任务源码、必要资产、制作资料与网站实际使用的冻结版本，供阅读设计和后续修改。不是重新设计后的关卡，不包含后续新建的工厂、RF01 精修工程或新测评运行器。

**首次使用请先恢复资产。** GitHub 的源码 ZIP 和 `git clone` 包含源码、配置和冻结版 JS/CSS；模型、纹理、Blender 文件及大型历史补丁放在同仓库 [Release](https://github.com/Shuo-Liang-0111/3D-ARC/releases/tag/original-36-2026-10-20)，共 7 包约 4.72 GB。恢复后对应 8,134 个原文件路径，包含重复部署副本约 10.3 GB。下载缓存另占空间，建议预留 25 GB 以上（依赖环境另计）。

## 快速开始（Linux / WSL2）

需要 Node.js ≥20.19（本次验证 22.18）、Python 3.11/3.12、对应的 venv 支持。

```bash
git clone https://github.com/Shuo-Liang-0111/3D-ARC.git
cd 3D-ARC
python3 archive/restore.py
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r simulation/requirements.txt
node archive/run-original.mjs
```

打开 `http://127.0.0.1:4173/?mode=play&level=rf01&robot=g1&view=third`。首页可以选择其他关卡。`view=first` / `third` / `dual` 为原版三种视角。

启动器依次启动原 MuJoCo、原 API 服务、原 Vite 服务。按 Ctrl+C 退出这些子进程。默认仅绑定本机；端口被占用会停止，不会关闭其他服务。可使用 `ARC_WEB_PORT`、`ARC_API_PORT`、`ARC_SIM_PORT` 换端口，`ARC_PYTHON` 指定虚拟环境 Python，`ARC_BIND_HOST=0.0.0.0` 开放网页监听。对外部署还需自行配置网络访问。

恢复工具兼容 Python 3.10+；原 MuJoCo 服务使用 Unix 信号接口，Windows 用户应在 WSL2/Linux 运行完整 G1 服务。源码可直接在 Windows 阅读。手动下载全部 Release 文件到同一目录后，可运行 `python3 archive/restore.py --bundle-dir /path/to/downloads`。

```bash
# 完整性验证；修改源码或资产后出现差异是预期行为
python3 archive/restore.py --verify-only
```

恢复工具校验包与文件的 SHA-256，拒绝覆盖已编辑的数据文件；只有明确传入 `--overwrite` 才覆盖。重复资产恢复为独立文件，修改当前资产不会联动改变冻结包。历史 QA 夹具的 15 个路径别名记录在 `archive/fixture-aliases.json`；需要运行这些夹具时可加 `--fixtures` 恢复相对符号链接（Linux 推荐）。

## 从哪里读关卡

- [36 关目录对应表](archive/DIRECTORY_MAP.md)：网站编号、内部 level ID、源码入口、冻结版本。
- [版本差异与已知缺失](archive/KNOWN_LIMITS.md)：哪些源码只能关联到冻结版本、哪些历史制作输入未找到。
- [归档验证记录](archive/VERIFICATION.md)：下载、校验和运行测试结果与范围。
- [原 README](archive/original-README.md)：保留原说明，旧路径已脱敏；其中旧部署命令不作为本归档的启动步骤。
- [逐文件清单](archive/files.json)、[来源与原/现哈希](archive/provenance.json)、[脱敏变更](archive/sanitization.json)、[完整任务依赖表](archive/tasks.json)。

`archive/restore.py`、`archive/run-original.mjs` 和归档说明是本次新增的**归档辅助工具**。关卡规则、场景布局、机器人控制和旧测评逻辑保留原实现，仅做路径脱敏；根 Vite 配置增加可选 API 地址环境变量以便隔离运行。没有引入我们后来开发的玩法、精修场景或评测服务。

已完成 GitHub 重新下载与恢复验证；36 个人工入口中 35 个可进入任务，RF03 的原始加载判定错误已单列记录。见上方验证记录。

## 构建与版本注意事项

原网站有 18 个任务从当前源码运行，另 18 个任务由 6 个冻结部署包提供。阅读当前 `game/` 后直接改文件，未必会影响人工入口实际加载的冻结关卡。请先看目录对应表。

原 `npm run build` 仍保留，但其资产复制列表没有覆盖全部线上冻结版本。因此 `npm run build && npm run preview` **不是完整复现 36 关的启动方式**；本归档使用上面的 Vite 启动器复现原人工路由。原来的 `start-production.sh` 等服务管理脚本仅作为历史资料，不应直接执行。

原 Agent API/排行榜实现与人工入口存在版本、生命周期和分数语义问题，原样保留供研究，不代表可直接用于正式模型评测。本次没有对任务质量和旧服务端逻辑做修复。普通人工游玩不需要填写模型 API 密钥。

第三方模型、纹理与机器人数据保留原有许可证、来源信息及说明；本仓库不另行宣称这些素材适用统一的新许可证。
