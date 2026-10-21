# RF-12 厨房安全检查重建 Brief

```yaml
id: rf12
title: Chinese Home Kitchen Safety
theme: 正常使用的中国城市家庭开放式厨房
space: 8.4 x 6.8 x 2.8 m
primary_concept: 家庭厨房风险排查
task_chain:
  - 读取入口安全检查单
  - 复位灶台燃气旋钮
  - 开启油烟机
  - 把炉边湿抹布移入水槽
  - 打开厨房窗通风
  - 关闭燃气总阀
  - 返回入口终端确认
failure_conditions:
  - 安全余量归零
items:
  - id: wet_cloth
    real_dimensions_m: [0.42, 0.04, 0.32]
    initial_area: 灶台右侧台面
    target: 水槽
terminal: 入口安全确认终端
completion: 五项风险全部清除且完成入口确认
special_risk: 燃气总阀必须在旋钮复位后关闭
camera_goal: 第三视角同时看清入口、后墙橱柜、窗和灶台
first_person_goal: D435 能辨认检查单、燃气旋钮、湿抹布和总阀
production_status: gameplay_complete
```

## 灰盒约束

- 房间使用米制坐标，Y 轴向上；南侧保留约 1.9 m 入户门洞，西侧保留服务门洞。
- 厨房固定柜体、冰箱、灶台、水槽和窗台均由明确碰撞代理表达；门洞不使用空气墙封闭。
- 视觉 GLB 只负责外观，`rf12_collision.glb` 只负责隐藏碰撞，二者不得混用。

## 视觉生成

环境和独立器具使用 Cardinal `high-highpoly`，每件资产单独生成、隔离预览、尺寸归一化、底部接触检查后才能接入。地板和墙砖使用无缝材质源图，按真实米制平铺，不能用纯色方块替代。

## 验收闸门

人工必须检查第三视角、第一视角和双视角截图中的中国家庭厨房合理性、比例、朝向、落地、门窗、材质、重叠和空气墙。没有截图或任一视角失败时，状态保持 `visual_candidate`。
