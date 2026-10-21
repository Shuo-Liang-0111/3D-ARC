# ARC 环境种子协议 / Environment seed protocol

环境种子固定环境的随机流，用来比较同一关卡、同一运行版本和配置下的不同模型。它不是模型 API 的采样种子，也不会强制不同动作轨迹得到相同成绩。

## 能力查询

读取 `GET /api/v1/seed-capabilities`，确认响应的 `protocolVersion` 为 `arc-seed-v1`，并查看目标关卡的能力：

- `seeded`：关卡的环境初始化或随机事件使用受控随机流。
- `fixed`：关卡的初态和事件不依赖环境种子。传入种子可记录配置，但不会把固定玩法改成随机玩法。

响应包含 `protocolVersion`、`minSeed`、`maxSeed`、`levels: [{id, seedPolicy}, ...]` 和 `verification` 说明。以服务器当前能力响应为准；不要从关卡编号、文档示例或提示词推断种子已生效。

## 创建与核对

`POST /api/v1/episodes` 接受可选的 `seed`，类型为 JSON 整数，范围为 `0..4294967295`（包含两端）。字符串 `"42"`、`null`、布尔值、负数、小数和越界值均不是有效 API 种子。

```json
{
  "level": "rf01",
  "view": "dual",
  "harness": "visual",
  "engine": "tool",
  "seed": 42
}
```

- 对 `seeded` 关卡，未提供种子时，服务器生成并保存一个有效种子；提供种子时使用该值。
- 对 `fixed` 关卡，显式提供的种子可以保存，但 `seedApplied=false`，玩法不变。
- 创建响应、Episode 状态、终局结果和轨迹记录 `seed`、`seedSource`（`provided` / `generated` / `null`）、`seedPolicy`、`seedApplied`、`seedVerified`、`initialStateFingerprint`。
- 创建时 `seedApplied=false`、`seedVerified=false`、指纹为 `null`。服务器收到并校验浏览器元数据后才确认应用。
- `seeded` 关卡的 `gameUrl` 携带种子；`fixed` 关卡的 URL 不携带种子，保留固定页面行为。所有 Episode URL 均明确使用 `mode=agent`。运行器应原样打开完整 URL，不能只把种子写进模型提示词。

固定种子的测评先核对创建响应的 `episode.seed` 等于请求值，再等待浏览器首张观察并在第一步动作前读取状态，核对 `seedApplied` / `seedVerified`。`fixed` 的 `seedApplied=false` 是正常结果；`seeded` 未确认应用时，应报告接入错误，不能宣称固定种子已生效。完成后再次核对终局结果。种子值相等本身不是初态指纹，也不是截图逐字节相同的证明；渲染时间、浏览器、资源加载和视角仍可能影响截图。

浏览器提交的 `environment` 只接受五个字段：`protocolVersion`、`seed`、`seedPolicy`、`seedApplied`、`initialStateFingerprint`。随机关卡必须匹配服务端存档种子、策略和应用状态，指纹必须采用 `fnv1a64-v1:<16位小写十六进制>`；固定关卡提交 `seed=null`、`seedApplied=false`、指纹 `null`，即使 Episode 保留了提供的种子。元数据必须随首张观察提交；存档后不可更改或省略，不允许夹带嵌套游戏状态。

显式提供种子的随机关卡若缺少或不匹配元数据，观察会被拒绝。服务器自动生成种子的旧客户端可以暂时不提供元数据，但保持 `seedApplied=false`、`seedVerified=false`；无元数据的固定旧客户端同样保持未验证。首张观察未提供元数据后，不允许在后续动作或终态中补交证据而升级整局验证状态；这种迟到的元数据会被拒绝，原有无元数据流程仍可继续。合法固定元数据可使 `seedVerified=true`，表示固定策略得到确认，不表示应用了随机种子。

`seedVerified` 表示浏览器上报与 Episode 协议及存档值一致，不能等同于服务器独立重演、绝对确定性或防作弊证明。初态指纹由浏览器报告。服务器生成的 `seedConfiguration` 与经过验证的 `environment` 一起纳入观察签名链，终局结果保留其可追溯字段。

排行榜保留原有 Agent / 版本 / 模型 / Harness / 视角 / 引擎 / 指令版本分组，不因种子改变既有十局口径。每条记录增加前十局窗口的 `seeds`；只有种子均相同时 `seed` 才为单值，混合时为 `null`。`seedApplied` / `seedVerified` 表示窗口内全部局均确认；`initialStateFingerprint` 仅在全部局相同时回显。因此比较时仍需检查种子列表，不能把混合种子窗口误称为同初态测评。

## 使用现有客户端

Python 和 Node.js starter 读取 `ARC_SEED`，在启动时验证并作为 JSON 数值传给 Episode API：

```bash
FIXED_SEED=42
export ARC_SEED="$FIXED_SEED"
# 其余 ARC / 模型环境变量按接入指南配置。
node node-agent.mjs
# 或：python3 python-agent.py
```

边界例子：`ARC_SEED=0` 和 `ARC_SEED=4294967295` 均有效。未设置 `ARC_SEED` 时不发送 `seed` 字段；`ARC_SEED=''` 是错误，不能用空字符串表示省略。环境变量使用十进制数字，不接受 `1e3` 这样的表达式。

MCP `start_episode` 增加可选数值参数 `seed`；显式参数覆盖 `ARC_SEED`，包括有效值 `0`。非法参数在发送创建请求前被拒绝。`visual` 模式的 `start_episode` / `get_status` 可提供 `seed`、`seedSource`、`seedPolicy`、`seedApplied`、`seedVerified`、`initialStateFingerprint` 配置元数据供运行器核对；`observe` / `act` 的视觉内容不会把这些字段作为模型游戏决策的结构化输入。

只有提示词中的 `FIXED_SEED=42` 不会改变环境。运行器必须将其设置为 `ARC_SEED`，或实际发送 JSON `seed: 42`；还必须核对服务器回显及应用状态。

## 跨模型比较

在不同模型之间保持相同关卡、代码与资源版本、种子、视角、Harness、引擎和浏览器配置。每次仍创建新的 Episode。相同种子控制随机输入；不同动作或动作时序可以产生不同进度、事件消耗与最终结果。

需要 10 个不同但可重复的初态时，应预先固定一组种子，并让所有模型按相同顺序使用；要求 10 局相同种子时，每局都显式传同一个值。不要将这两种统计口径混在一起。

## English summary

`POST /api/v1/episodes` accepts an optional integer `seed` in the inclusive range `0..4294967295`. Query `/api/v1/seed-capabilities` (`arc-seed-v1`) for each level's `seeded` or `fixed` behavior. Seeded levels receive a server-generated seed when omitted. Fixed levels may record a supplied seed with `seedApplied=false`; their gameplay is unchanged.

The returned Episode and final result expose seed and verification metadata. `seedApplied` starts false and becomes true only after matching browser metadata for a seeded level; `seedVerified` checks protocol consistency, not an independent server replay. Only seeded-level game URLs carry the seed; fixed levels retain their existing initialization. Node.js, Python and MCP clients accept `ARC_SEED`; explicit MCP `seed` takes precedence. Zero is valid. Validate the metadata before making claims about reproducibility. A prompt variable alone does not configure the environment, and an environment seed does not control model sampling or guarantee identical screenshots and outcomes.

## 开发验证

`npm test` 包含种子范围、客户端传值、API 迁移与首观确认、真实引擎随机序列和初态指纹测试。

真实浏览器链路可单独运行（先启动当前源码的 Vite 服务，并配置本机 Chromium 路径）：

```bash
ARC_SEED_BROWSER_TEST=1 \
ARC_SEED_TEST_GAME_URL=http://127.0.0.1:4173 \
ARC_CHROMIUM_EXECUTABLE=/path/to/chrome \
node --test tests/episode-seed-browser.test.mjs
```

该测试使用临时 API 与临时存储，验证全部随机关卡的首张原始视觉观察、同种子复现、零种子、不同种子、固定关卡和动作后证据持续一致；不写入正式 Episode 存储或排行榜。测试视口为 640×480，软件渲染环境可另外设置 `ARC_SOFTWARE_RENDERING=1`。
