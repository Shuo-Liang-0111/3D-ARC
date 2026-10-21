export function getThirdPersonCssViewport(mode, width, height) {
  if (mode === "first") return null;
  if (mode === "third") return { x: 0, y: 0, width, height };
  if (mode !== "dual") return null;
  if (width >= height) return { x: width / 2, y: 0, width: width / 2, height };
  return { x: 0, y: height / 2, width, height: height / 2 };
}

export function isPointInThirdPersonViewport(mode, width, height, x, y) {
  const view = getThirdPersonCssViewport(mode, width, height);
  if (!view) return false;
  return x >= view.x && x <= view.x + view.width && y >= view.y && y <= view.y + view.height;
}

export function nextThirdPersonZoom(currentZoom, deltaY, minimum = 0.35, maximum = 2.6) {
  const nextZoom = currentZoom * Math.exp(deltaY * 0.0012);
  return Math.min(maximum, Math.max(minimum, nextZoom));
}

export function mountThirdPersonViewControls({
  element,
  shell,
  getViewMode,
  onOrbit,
  onZoom,
}) {
  if (!element || !shell) return null;

  let selected = false;
  let hovered = false;
  let dragging = false;
  let pointerId = null;
  let previousX = 0;
  let previousY = 0;

  function pointInThirdView(event) {
    const bounds = element.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    return isPointInThirdPersonViewport(getViewMode(), bounds.width, bounds.height, x, y);
  }

  function syncState() {
    shell.dataset.thirdViewSelected = String(selected);
    shell.dataset.thirdViewHovered = String(hovered);
    shell.dataset.thirdViewDragging = String(dragging);
  }

  function setSelected(nextSelected) {
    selected = Boolean(nextSelected);
    syncState();
  }

  function setHovered(nextHovered) {
    hovered = Boolean(nextHovered);
    syncState();
  }

  function finishDrag(event) {
    if (!dragging) return;
    if (event?.pointerId !== undefined && pointerId !== null && event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    syncState();
  }

  function handlePointerDown(event) {
    const inside = pointInThirdView(event);
    if (event.button === 0) {
      setSelected(inside);
      return;
    }
    if (event.button !== 1 || !inside) return;
    event.preventDefault();
    selected = true;
    hovered = true;
    dragging = true;
    pointerId = event.pointerId;
    previousX = event.clientX;
    previousY = event.clientY;
    element.setPointerCapture?.(event.pointerId);
    syncState();
  }

  function handlePointerMove(event) {
    if (!dragging) {
      setHovered(pointInThirdView(event));
      return;
    }
    if (pointerId !== null && event.pointerId !== pointerId) return;
    const movementX = event.clientX - previousX;
    const movementY = event.clientY - previousY;
    previousX = event.clientX;
    previousY = event.clientY;
    onOrbit({ yaw: -movementX * 0.005, pitch: -movementY * 0.004 });
  }

  function handleWheel(event) {
    if (!pointInThirdView(event)) return;
    event.preventDefault();
    setHovered(true);
    onZoom(event.deltaY);
  }

  function handleAuxClick(event) {
    if (event.button === 1 && pointInThirdView(event)) event.preventDefault();
  }

  function handlePointerLeave() {
    if (!dragging) setHovered(false);
  }

  function refresh() {
    if (getViewMode() === "first") {
      hovered = false;
      dragging = false;
      pointerId = null;
    }
    syncState();
  }

  element.addEventListener("pointerdown", handlePointerDown);
  element.addEventListener("pointermove", handlePointerMove);
  element.addEventListener("pointerup", finishDrag);
  element.addEventListener("pointercancel", finishDrag);
  element.addEventListener("lostpointercapture", finishDrag);
  element.addEventListener("pointerleave", handlePointerLeave);
  element.addEventListener("wheel", handleWheel, { passive: false });
  element.addEventListener("auxclick", handleAuxClick);
  window.addEventListener("blur", finishDrag);
  refresh();

  return {
    refresh,
    getState: () => ({ selected, hovered, dragging }),
    destroy() {
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerup", finishDrag);
      element.removeEventListener("pointercancel", finishDrag);
      element.removeEventListener("lostpointercapture", finishDrag);
      element.removeEventListener("pointerleave", handlePointerLeave);
      element.removeEventListener("wheel", handleWheel);
      element.removeEventListener("auxclick", handleAuxClick);
      window.removeEventListener("blur", finishDrag);
    },
  };
}
