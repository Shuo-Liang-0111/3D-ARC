export function installPhysicsQA(physics) {
  const panel = document.createElement('aside');
  panel.id = 'physics-qa';
  panel.style.cssText = 'position:fixed;bottom:85px;left:20px;background:#14271eee;color:white;padding:10px;z-index:120;font:13px monospace';
  const status = document.createElement('output');
  const state = () => physics.options.getState();
  const wait = duration => new Promise(resolve => setTimeout(resolve, duration));
  button('取物测试站位', () => {
    const next = physics.options.runtime.cloneState(state());
    next.player = { x: -6.135, z: -12.20, yaw: Math.PI };
    next.toolRoomOpen = true;
    physics.options.setState(next);
    physics.resetHandPose = true;
  });
  async function walkPoint(targetX, targetZ) {
    for (let count = 0; count < 400; count++) {
      const before = state();
      const deltaX = targetX - before.player.x;
      const deltaZ = targetZ - before.player.z;
      if (Math.hypot(deltaX, deltaZ) < .085) return;
      const sine = Math.sin(before.player.yaw), cosine = Math.cos(before.player.yaw);
      const choices = [{ action: 'W', projection: deltaX * sine + deltaZ * cosine }, { action: 'S', projection: -deltaX * sine - deltaZ * cosine }, { action: 'A', projection: deltaX * cosine - deltaZ * sine }, { action: 'D', projection: -deltaX * cosine + deltaZ * sine }].sort((left, right) => right.projection - left.projection);
      const speed = { W: 1, S: .5, A: .3, D: .3 }[choices[0].action];
      await window.__ARC_AGENT__.act({ action: choices[0].action, durationMs: Math.min(1000, Math.max(50, choices[0].projection / speed * 1000)), harness: 'state' });
      if (Math.hypot(state().player.x - before.player.x, state().player.z - before.player.z) < .00001) throw Error('Route blocked ' + JSON.stringify(before.player));
    }
    throw Error('Route timeout');
  }
  async function route(points) { for (const [targetX, targetZ] of points) await walkPoint(targetX, targetZ); }
  function button(label, action) {
    const button = document.createElement('button');
    button.textContent = label;
    button.onclick = async () => {
      button.disabled = true;
      try { status.textContent = label; await action(); status.textContent = '完成：' + label; }
      catch (error) { status.textContent = String(error); }
      button.disabled = false;
    };
    panel.append(button);
  }
  button('导航到收割刀', async () => {
    await route([[2.8,2.5],[2.8,-8.7],[-2.6,-8.7],[-2.6,-9.2]]);
    physics.interact();
    for (let count = 0; count < 100 && Math.abs(state().toolDoorAngle + Math.PI / 2) > .02; count++) await wait(100);
    await route([[-4,-9.2],[-4,-11.65],[-5.95,-11.95]]);
  });
  button('F 自动取物', () => physics.interact());
  button('田间测试站位（保留夹持）', () => {
    const next = physics.options.runtime.cloneState(state());
    const delta = { x: 10.28 - next.player.x, y: 0, z: -3.55 - next.player.z };
    const shift = body => { const point = body.translation(); body.setTranslation({ x: point.x + delta.x, y: point.y, z: point.z + delta.z }, true); };
    for (const hand of Object.values(physics.hands)) {
      for (const part of hand.parts) shift(part.body);
      if (hand.held) shift(physics.physics.objects.get(hand.held).body);
    }
    next.player.x = 10.28; next.player.z = -3.55;
    physics.options.setState(next); physics.resetHandPose = true;
  });
  button('导航到田间第一株', async () => {
    await route([[-4,-11.65],[-4,-9.2],[-2.6,-9.2],[-2.6,-8.7],[2.8,-8.7],[9.6,-8.7],[10.28,-4.8],[10.28,-3.37]]);
  });
  button('导航到收集筐', async () => {
    await route([[10.28,1.2],[9.5,1.2],[9.5,2]]);
  });
  button('松开双手', () => { physics.hands.left.setGrip(false); physics.hands.right.setGrip(false); });
  panel.append(status);
  document.body.append(panel);
}
