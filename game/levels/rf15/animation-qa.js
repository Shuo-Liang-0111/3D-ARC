import { cartStand } from './cart-layout.js';
import { FIELD } from './field-layout.js';
import { ORANGE_TASK } from './orange-task.js';
export function installAnimationQA(animation) {
  const panel = document.createElement('aside');
  panel.id = 'animation-qa';
  panel.style.cssText = 'position:fixed;bottom:85px;left:20px;background:#14271eee;color:white;padding:10px;z-index:120;font:13px monospace';
  function button(label, callback) {
    const element = document.createElement('button');
    element.textContent = label;
    element.onclick = callback;
    panel.append(element);
  }
  function fixture(player) {
    if (animation.busy) return;
    const next = animation.options.runtime.cloneState(animation.options.getState());
    next.player = player;
    next.toolRoomOpen = true;
    next.toolDoorAngle = -Math.PI / 2;
    animation.options.setState(next);
  }
  button('手推车测试站位', () => { const stand = cartStand(animation.options.getState().cart); fixture({...stand, x:stand.x-.7,z:stand.z+.4,yaw:0}); });
  button('工具房测试站位', () => fixture({ x: -5.95, z: -11.85, yaw: Math.PI / 2 }));
  button('下一株田边测试站位', () => {
    const crop = Object.values(animation.options.getState().crops).find(crop => crop.location === 'field');
    if (crop) fixture({ x: crop.x - 1.1, z: crop.z + .25, yaw: -Math.PI / 2 });
  });
  button('收集筐测试站位', () => fixture({ x: FIELD.basket.x - .75, z: FIELD.basket.z + .18, yaw: Math.PI / 2 }));
  button('F 执行动画', () => animation.interact());
  for (const [station, label] of [['home', '空筐测试站位'], ['scale', '称重测试站位'], ['pack', '包装测试站位'], ['tail', '装车测试站位']]) {
    button(label, () => { const stand = ORANGE_TASK.stands[station]; fixture({ ...stand, x: stand.x - .08, z: stand.z + .02 }); });
  }
  // Explicit QA-only key pulses exercise the real keyboard handlers; no route/target steering.
  let pulse = null;
  function stopPulse() {
    if (!pulse) return;
    clearTimeout(pulse.timer);
    window.dispatchEvent(new KeyboardEvent('keyup', {code:pulse.code, bubbles:true}));
    pulse = null;
  }
  const controls = document.createElement('div'); panel.append(controls);
  for (const [key,label] of [['W','前进'],['S','后退'],['Q','左转'],['E','右转']]) for (const seconds of [1,5]) {
    const b=document.createElement('button');b.textContent=`${key} ${label} ${seconds}秒`;
    b.onclick=()=>{
      stopPulse();const code=`Key${key}`;
      window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));
      pulse={code,timer:setTimeout(stopPulse,seconds*1000)};
    };controls.append(b);
  }
  button('停止测试输入',stopPulse);
  panel.append(document.createTextNode(' 测试站位不代表行走路线'));
  document.body.append(panel);
}
