import { LEVEL } from "./level.js";
export { LEVEL };
export * from "./engine.js";
export * from "./scene.js";
export const camera = Object.freeze({ position: [0,18.5,16], lookAt: [0,.6,0], fov: 43 });
export const ui = Object.freeze({ id: "rf15-3", levelLabel: "RF-13-3", brand: "乡野合作社 · 冷链装运", unit: "RF-13-3 · WEIGH", systemLabel: "任务状态", cargoLabel: "携带", gateLabel: "完成", startKicker: "RF-13-3", startTitle: LEVEL.objective, startCopy: LEVEL.objective, completeKicker: "TASK COMPLETE", completeTitle: "称重装车 · 完成", completeCopy: "任务已完成。", terminalHeading: "RF-13-3 / 记录" });
export const audio = Object.freeze({ assets: {}, eventSounds: {}, volume: {} });
export const eventMessages = Object.freeze({ tool_room_opened: "工具房门已打开", tool_room_closed: "工具房门已关闭", tool_door_blocked: "请离开门扇摆动范围", harvest_tool_taken: "已拿取收割工具", harvest_tool_returned: "工具已放回", sprayer_picked: "已拿取农药喷剂", harvest_started: "正在用收割刀采收", harvest_knife_required: "需要携带收割刀", crop_picked: "蔬菜已收割", crop_basketed: "蔬菜已放入田边收集筐", crop_sprayed: "喷洒完成", already_sprayed: "这株作物已喷洒", orange_weighing: "电子秤读数正在稳定", weight_stabilizing: "电子秤读数稳定中，请等待", weight_not_ready: "重量尚未稳定在 5 kg", weight_ok: "5 kg 稳定称重记录已确认", packed: "包装已完成", loaded: "已放入装车位", nothing_in_reach: "附近没有可操作物体", progress_depleted: "余量耗尽，按 R 重置" });
export function isCarrying(state) { return Boolean(state.carriedItem || state.carriedCrop || state.heldTool || state.sprayer); }
