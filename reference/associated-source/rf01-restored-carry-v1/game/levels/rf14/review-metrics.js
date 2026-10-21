export function mountCourtMetrics(renderer) {
  if (!new URLSearchParams(location.search).has('review')) return;
  const surface = document.querySelector('#game-shell');
  if (!surface) return;
  let previous = 0;
  let durations = [];
  let request;
  function sample(now) {
    if (previous) durations.push(now - previous);
    previous = now;
    const elapsed = durations.reduce((sum, duration) => sum + duration, 0);
    if (elapsed >= 2000 && durations.length > 5) {
      surface.dataset.reviewFps = (durations.length * 1000 / elapsed).toFixed(1);
      surface.dataset.reviewCalls = String(renderer.info.render.calls);
      surface.dataset.reviewTriangles = String(renderer.info.render.triangles);
      surface.dataset.reviewTextures = String(renderer.info.memory.textures);
      surface.dataset.reviewGeometries = String(renderer.info.memory.geometries);
      durations = [];
    }
    request = requestAnimationFrame(sample);
  }
  request = requestAnimationFrame(sample);
  addEventListener('pagehide', () => cancelAnimationFrame(request), { once: true });
}
