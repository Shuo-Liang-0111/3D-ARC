# RF-08 office series

Status: completed.
Authorized A office assistant, gameplay first then realism, selected host /path/to/arc-workspace deployment. No additional approvals or Git push authorized/needed.

Release: rf08-office-v1-r13. Gameplay/visual source: office-* modules shared across rf09/rf09-2/rf09-3.
Gameplay: base r12 6-action browser suite passed; setup r11 11-step representative suite passed; service r11 12-step suite passed and complete=true, phase=idle, all 3 requests done. r11/r12 office runtime equivalence verified after release/import name normalization.
Corrected issues: desk footprint mismatch, north-chair clearance, water selection occlusion, terminal approach gap, carried load approach envelope, frame-accumulated body bend, Draco loading for reused plant, unsupported office robot/control selections.
Visual: existing Cardinal office furniture/textures plus precise architecture and new detailed props. Cardinal printer submission failed without task receipt; not resubmitted; authored Blender replacement recorded. First/third/dual screenshots actually reviewed.
Verification: 12+1 tests passed; full build passed; 16 assets byte matched; canonical 3 routes serve r12 with no dev client; 11 protected files unchanged. Final screenshots and task-only commit completed.
Scope: robot station fixtures, formal animations, local collision. No full-route navigation or reserve-budget test. userAcceptance optional and not asserted.

Final: r13 tray rim grasp and return verified (0.031759 / 0.034321 m). First/third/dual and close-up screenshots saved under evidence/browser. Non-clearing full production build passed after shared dist cleanup race. Canonical routes now all serve r13.

Commit: 9180708b104856844fdf49bb7379140353b0836e (19 task-only files; no push). Normal canonical entry verified in a fresh browser: assets 42/42 ready, QA panel absent. Unrelated working-tree changes remain uncommitted and preserved.


## 2026-09-21 运动与余量一致性修复

阶段：completed。RF-08 三关恢复共享 MuJoCo 运动入口；推椅输入采用共享速度标定；恢复移动 1.2/s、F 4 点、转向及静止免扣、有效任务一次性奖励、耗尽失败。19 项逻辑/运动测试和注册测试通过；标准构建通过。r14 浏览器键盘链路与 RF-08-2 定点代表动作 11 步通过，三条正式入口已通过 r14 HTTP 字节核对。

正式入口另复验双手托盘取放：误差 0.03251 m / 0.03245 m，结束 idle、归还状态正确，第一人称显示顶棚。11 个受保护文件与生产基线一致。任务提交 cdf4d520f8181ab45b0a0ae8416746b76fcbb278；未 push。用户验收尚未记录。本次为定点功能回归，不包含完整路线或余量预算验证。


## 简化任务与 30 秒来电（迭代记录，已完成）

用户明确要求：RF-08 一份文件加一瓶水；RF-08-2 增加必须推到会议桌前的挡路椅子；RF-08-3 再增加 30 秒内接听电话，否则直接失败。电话触发时机已询问，等待期间采用已说明的默认：首件物品摆放成功后响铃。共享运动/余量、模型、相机保持 r14。

r15 候选：三关共用入口玻璃、同一套道具和电话。电话采用独立精确程序模型与双音铃声，既有 Cardinal 家具复用。17 项逻辑/碰撞/计时/运动测试通过，正在浏览器验证正式动作及超时。测试使用机器人定点站位，不代表完整路线验收。


r16 接听成功定点链 10 步通过，接听接触误差 0.000417 m，最终 idle 后 complete。实响 30 秒超时：期限 56.92240，失败时钟 56.93560，余量 100，failureReason=phone_timeout。发现浏览器入口漏导出失败文案，r17 补导出并增加测试；18 项测试通过，正在复验具体失败提示。


## 简化任务最终交付：completed

当前正式版本：rf08-office-v1-r18。RF-08 只摆放一份文件和一瓶水；RF-08-2 增加会议室入口挡路椅，需由玩家推至会议桌前恢复通行；RF-08-3 在第二关基础上增加一次来电。默认首次成功摆好文件或水后响铃，30 秒真实时间内未接听立即失败，持物时可用空闲手接听。三关共用场景与物体集合，第一人称顶棚可见、第三人称隐藏；保留 r14 运动与余量规则。

验证：18 项逻辑/运动/碰撞/计时测试及 1 项注册测试通过，标准生产构建和 r18 独立构建通过。三个正式入口 HTTP 均返回 r18，与发布构建字节一致；11 个受保护机器人/运动文件与生产基线一致。证据见 simple-tasks/tests-final.log、registration.log、canonical-http.json、protected-files.json、build-r18.log。

浏览器证据：r18 基础关 4 次取放完成，电话 inactive（simple-base-r18.json）；r16 接听成功链 10 步通过，接触误差 0.000417 m，恢复 idle 后完成（simple-service-r16.json）；r17 实际响铃 30 秒后失败，deadline 56.803300000071516、failure clock 56.81000000000058，余量仍为 100，失败文案正确（simple-timeout-r17.json）。r17/r18 办公室玩法模块及三个入口经发布路径和 chunk hash 规范化后字节一致，见 simple-tasks/r17-r18-equivalence.json。电话第一人称近景 simple-phone-first-r18.png 已实际查看；正式第二关入口无 QA 面板，第三人称画面已检查。上述截图与 JSON 位于 evidence/browser/。

验收范围：使用内部信息布置机器人定点站位，实际取放、推椅、接听播放正式动画，局部碰撞使用短程输入验证；不宣称完整路线通关或余量预算验证。

任务范围提交：2a6a73fb5ddc9647083ca9c72044ae5690545468（19 个文件，未 push）。无关既有改动保留，暂存区为空。用户验收可选，未冒称已接受。当前请求已完成，无待批准步骤。


## 2026-09-22 截图清理与办公区来电：completed

正式版本：rf08-office-v1-r19；任务范围提交：3e3e99a（未 push）。

本次按用户最新要求更新：移除截图中的任务文字、电话屏幕文字、场景文字标识和地面黄色框；电话移动到会议室外办公区域；RF-08-3 改为开局后 60–90 秒真实时间内随机响铃，响铃后 30 秒未接听立即失败。RF-08、RF-08-2、RF-08-3 共用四个会议座位：2–4 号座位开局已有文件和水，1 号座位缺一份文件和一瓶水；所有桌面文件和水均可拾取，机器人补齐缺件。RF-08-2/3 仍需先把挡路椅推到会议桌前。运动、转向、余量和相机合同保持不变。

验证通过：6 项新场景/玩法测试、7 项运动与余量回归测试、1 项 RF-09 注册测试；标准生产构建和 r19 候选构建通过。线上三条正式入口返回 x-arc-release: rf08-office-v1-r19，r19 页面文件已生成于 production/rf08-office-v1/build/r19。

验收范围仍为定点功能、正式动画和局部碰撞检查；未宣称完整路线或余量预算验证。

## 2026-09-22 桌面与椅子布局返工：completed

正式版本：rf08-office-v1-r22。

电话固定在会议室外办公桌面（4.0, 1.278, 1.55）；会议室八张椅子按南北两排各四张对称排列，挡路椅复位到红框左侧座位。移除黄色框对应的闲置边桌及其底座，保留电话桌和其他办公桌；红框座位仍为唯一缺文件/水的补齐位置。

验证通过：13 项 RF-08 系列逻辑、运动、余量和交互测试；标准 Vite 构建；r22 独立候选构建；RF-08-2 第三人称正式页面布局复核。未修改机器人模型、运动速度、转向、相机或余量规则。


## 2026-09-22 前台电话、对齐与黄框：completed

正式版本 rf08-office-v1-r26，三条普通入口 HTTP 与发布文件哈希相同。电话落在前台实测 0.838 m 工作台面，接听点与可见按键同源。椅子两排 x=-3,-1,1,3，围绕会议桌中心 z=-5.15 镜像；缺位椅仍从门口由玩家推回黄框。八座中七座预置文件和水；目标文件、水、椅子均有黄色轮廓。会议室闲置小桌、屏幕及碰撞均移除。

15 项逻辑/运动/取放站位回归通过，标准构建和独立构建通过。使用机器人定点站位验证 r25 四步实际取放，最终 complete 且 idle；r26 只追加 QA 来电自动触发按钮，生产办公室 runtime 经路径与 依赖 import hash 规范化一致。r26 实际响铃 61.9147 秒，69.5399 秒接听完成，按键接触误差 0.000593 m。第一人称前台和第三人称布局截图已在 CUA 实际查看，证据记录位于 layout-r25/。七个机器人/运动/相机受保护文件哈希未变。无完整路线或余量预算测试，未声称用户已验收。

任务范围提交：d330c7e2746ba3ce0b9d3d66d64fd575b652ddce；未 push。


## 2026-09-22 取消任务先后限制：completed

正式版本 rf08-office-v1-r28。摆放文件、水不再以椅子归位为前置条件；所有必需任务完成后才通关。RF-08-3 电话允许穿插，60–90 秒随机来电及 30 秒超时保留。任务文案标注顺序不限。18 项测试通过，其中三关覆盖 2/6/24 种任务顺序；保留占用位置拒绝重复放置及超时失败检查。标准/独立构建通过，三个普通入口字节匹配。

r27 正式动画定点验收：椅子仍在门口 (0,-2.1)，依次拿水、摆水、拿文件、摆文件四步通过，2/2 物品、idle、complete=false，等待椅子归位。r28 仅同步主界面文案，办公室 runtime 规范化字节一致。截图已在 CUA 实际查看。机器人、相机、运动、动画及场景共八个文件哈希不变。记录见 order-r27/；非完整路线导航验收。

任务范围提交：1ba9f1eaf5608734fc42bb253942593c32cae604（未 push）。
