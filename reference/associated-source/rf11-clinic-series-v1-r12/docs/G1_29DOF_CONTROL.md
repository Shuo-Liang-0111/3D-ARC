# G1 29DOF 控制模式

选关界面的“控制模式”提供两个并存版本：

- `速度策略`：原有 `velocity_policy`，继续使用 WASD 平移、Q/E 转向。
- `29DOF Agent`：新增 `joint_position`，由 VLA 或 Agent 提交 29 个关节目标角度。

关节模式目前只对 G1 单机器人关卡开放。URL 使用 `control=velocity` 或 `control=joint`，切换关卡、机器人和视角时会保留有效选择。

## 浏览器接口

```js
window.__RELAY_DEMO__.getControlMode();
window.__RELAY_DEMO__.getJointOrder();
window.__RELAY_DEMO__.setJointTargets(targets, 100);
```

`targets` 必须包含 29 个有限数值，单位为弧度。第二个参数是目标插值时长，单位为毫秒，默认 `100`，后端上限为 `2000`。

## WebSocket 协议

先选择控制模式：

```json
{"type":"control_mode","mode":"joint_position"}
```

再发送关节目标：

```json
{
  "type": "joint_command",
  "sequence": 1,
  "jointOrder": "g1_29dof_policy_v1",
  "targets": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "durationMs": 100
}
```

服务端会返回 `joint_command` 确认消息，并通过状态消息中的 `jointControl` 返回同一顺序下的关节名称、当前位置和目标位置。

## 关节顺序

`g1_29dof_policy_v1` 按以下顺序排列：

1. `left_hip_pitch_joint`
2. `right_hip_pitch_joint`
3. `waist_yaw_joint`
4. `left_hip_roll_joint`
5. `right_hip_roll_joint`
6. `waist_roll_joint`
7. `left_hip_yaw_joint`
8. `right_hip_yaw_joint`
9. `waist_pitch_joint`
10. `left_knee_joint`
11. `right_knee_joint`
12. `left_shoulder_pitch_joint`
13. `right_shoulder_pitch_joint`
14. `left_ankle_pitch_joint`
15. `right_ankle_pitch_joint`
16. `left_shoulder_roll_joint`
17. `right_shoulder_roll_joint`
18. `left_ankle_roll_joint`
19. `right_ankle_roll_joint`
20. `left_shoulder_yaw_joint`
21. `right_shoulder_yaw_joint`
22. `left_elbow_joint`
23. `right_elbow_joint`
24. `left_wrist_roll_joint`
25. `right_wrist_roll_joint`
26. `left_wrist_pitch_joint`
27. `right_wrist_pitch_joint`
28. `left_wrist_yaw_joint`
29. `right_wrist_yaw_joint`

输入会按 MuJoCo 模型关节范围裁剪，以 50Hz 平滑插值并继续通过 PD 力矩驱动。该模式不开放原始力矩写入；平衡、步态和防跌倒策略由调用方负责。
