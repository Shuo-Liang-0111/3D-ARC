export const VIEW_MODES = Object.freeze(["first", "third", "dual"]);
export const DEFAULT_VIEW_MODE = "third";

export function fitAspectViewport(view, targetAspect) {
  const viewAspect = view.width / Math.max(1, view.height);
  if (viewAspect > targetAspect) {
    const width = view.height * targetAspect;
    return { ...view, x: view.x + (view.width - width) / 2, width };
  }
  const height = view.width / targetAspect;
  return { ...view, y: view.y + (view.height - height) / 2, height };
}

export function normalizeViewMode(value) {
  return VIEW_MODES.includes(value) ? value : null;
}

export function resolveViewMode(requested, stored) {
  return normalizeViewMode(requested) ?? normalizeViewMode(stored) ?? DEFAULT_VIEW_MODE;
}

export function getViewports(mode, width, height) {
  const safeMode = normalizeViewMode(mode) ?? DEFAULT_VIEW_MODE;
  if (safeMode === "first") return [{ view: "first", x: 0, y: 0, width, height }];
  if (safeMode === "third") return [{ view: "third", x: 0, y: 0, width, height }];

  if (width >= height) {
    const halfWidth = width / 2;
    return [
      { view: "first", x: 0, y: 0, width: halfWidth, height },
      { view: "third", x: halfWidth, y: 0, width: halfWidth, height },
    ];
  }

  const halfHeight = height / 2;
  return [
    { view: "first", x: 0, y: halfHeight, width, height: halfHeight },
    { view: "third", x: 0, y: 0, width, height: halfHeight },
  ];
}
