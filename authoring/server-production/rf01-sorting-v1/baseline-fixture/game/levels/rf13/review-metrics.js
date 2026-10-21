export function mountClinicReviewMetrics(renderer) {
  if (!new URLSearchParams(location.search).has("review")) return;
  const surface = document.querySelector("#game-shell") || document.querySelector("#canvas");
  if (!surface) return;
  let previous = 0;
  let durations = [];
  let request;
  function sample(now) {
    if (document.visibilityState !== "visible") {
      previous = 0;
      durations = [];
    } else {
      if (previous) durations.push(now - previous);
      previous = now;
      const elapsed = durations.reduce((sum, value) => sum + value, 0);
      if (elapsed >= 2000 && durations.length > 5) {
        const sorted = [...durations].sort((first, second) => first - second);
        surface.dataset.reviewFps = (durations.length * 1000 / elapsed).toFixed(1);
        surface.dataset.reviewFrameP95Ms = sorted[Math.floor(sorted.length * 0.95)].toFixed(1);
        surface.dataset.reviewGeometries = String(renderer.info.memory.geometries);
        surface.dataset.reviewTextures = String(renderer.info.memory.textures);
        surface.dataset.reviewTrianglesPerPass = String(renderer.info.render.triangles);
        surface.dataset.reviewCallsPerPass = String(renderer.info.render.calls);
        surface.dataset.reviewSampleMs = elapsed.toFixed(0);
        durations = [];
      }
    }
    request = requestAnimationFrame(sample);
  }
  request = requestAnimationFrame(sample);
  window.addEventListener("pagehide", () => cancelAnimationFrame(request), { once: true });
}
