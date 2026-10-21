const panel = document.createElement('aside');
panel.style.cssText = 'position:fixed;left:440px;top:100px;z-index:100;background:#102a20;color:white;padding:10px;font:12px monospace;max-width:440px';
const status = document.createElement('p');
status.id = 'wall-review-status';
status.textContent = '墙体验收：使用正式移动接口';
panel.append(status);
document.body.append(panel);
const state = () => window.__ARC_AGENT__.getState();
async function act(action, durationMs = 100) {
  const code = 'Key' + action;
  document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, durationMs));
  document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 120));
  if (state().failed) throw Error('Reserve depleted');
}
async function walk(horizontal, depth) {
  for (const axis of ['x', 'z']) for (let count = 0; count < 120; count += 1) {
    const before = state();
    const difference = (axis === 'x' ? horizontal : depth) - before.player[axis];
    if (Math.abs(difference) < .04) break;
    await act(axis === 'x' ? difference > 0 ? 'D' : 'A' : difference > 0 ? 'S' : 'W', Math.min(700, Math.max(80, Math.abs(difference) / .5 * 1000)));
    if (Math.abs(state().player[axis] - before.player[axis]) < .00001) throw Error(`Blocked at ${JSON.stringify(before.player)}`);
  }
}
function reset() {
  document.querySelector('#restart-button')?.click();
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
  document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR', bubbles: true }));
}
for (const [label, run] of [
  ['西墙阻挡', async () => { reset(); await walk(-7.7, .5); await act('A', 1000); await act('A', 1000); }],
  ['北墙阻挡', async () => { reset(); await walk(2.7, 2.5); await walk(2.7, -5.6); await walk(-2, -5.6); await act('W', 1000); await act('W', 1000); }],
  ['西北转角', async () => { reset(); await walk(2.7, 2.5); await walk(2.7, -5.6); await walk(-7.8, -5.6); await act('A', 1000); await act('W', 1000); }],
]) {
  const button = document.createElement('button');
  button.textContent = label;
  button.style.cssText = 'padding:8px;margin:3px';
  button.onclick = async () => {
    button.disabled = true;
    status.textContent = label + '运行中';
    try { await run(); status.textContent = label + ' ' + JSON.stringify(state().player); }
    catch (error) { status.textContent = 'FAILED: ' + error.message; }
    button.disabled = false;
  };
  panel.append(button);
}
