from pathlib import Path

root = Path('.')
path = root / 'game/levels/rf15/scene.js'
content = path.read_text()
anchor = 'function variants() {'
helper = '''function printedLabel(lines, width, height, background = '#264c3c', foreground = '#f4f1df') {
  const canvas = document.createElement('canvas');
  canvas.width = 1536; canvas.height = Math.round(1536 * height / width);
  const context = canvas.getContext('2d');
  context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = foreground; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.font = `600 ${Math.floor(canvas.height / (lines.length * 1.65))}px sans-serif`;
  lines.forEach((line, index) => context.fillText(line, canvas.width / 2, canvas.height * (index + .5) / lines.length, canvas.width * .94));
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
}
'''
if 'function printedLabel(' not in content:
    content = content.replace(anchor, helper + anchor)
    content = content.replace("jobs.push(attach(`${item.id}-${kind}`, variant));", """jobs.push(attach(`${item.id}-${kind}`, variant));
    if (kind === 'box') {
      const label = printedLabel([`${item.name} ${item.code}  ${item.weight.toFixed(1)} kg`, '乡野合作社 · 鲜品'], .35, .16, '#f1eee2', '#24523e');
      label.position.set(0, .22, .226); variant.add(label);
    }""")
    anchor = "  const display = scaleDisplay(); scene.add(display.mesh);"
    content = content.replace(anchor, """  for (const sign of [
    { lines: ['01  收货 · 新鲜农产品'], size: [3.38, .42], position: [-5.9, 1.98, -5.908] },
    { lines: ['02  电子称重'], size: [1.39, .29], position: [-2.6, 1.60, -4.798] },
    { lines: ['03  装箱封签'], size: [1.39, .29], position: [.6, 1.60, -4.798] },
    { lines: ['乡野合作社 · 冷链装运站'], size: [6.48, .53], position: [-3.3, 3.91, 1.92] },
    { lines: ['冷链鲜达  02—08°C'], size: [2.35, .27], position: [5.3, 2.87, .158] },
  ]) {
    const label = printedLabel(sign.lines, ...sign.size); label.position.set(...sign.position); scene.add(label);
  }
""" + anchor)
path.write_text(content)
