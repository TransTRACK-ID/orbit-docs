const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.2;

const MERMAID_THEME_VARS = [
  "--od-bg",
  "--od-fg",
  "--od-border",
  "--od-muted",
  "--od-radius",
  "--bg",
  "--fg",
  "--border",
  "--muted",
] as const;

function pinMermaidStageTheme(stage: HTMLElement): void {
  const rootStyle = getComputedStyle(document.documentElement);
  for (const name of MERMAID_THEME_VARS) {
    const value = rootStyle.getPropertyValue(name).trim();
    if (value) stage.style.setProperty(name, value);
  }
}

function clearMermaidStageTheme(stage: HTMLElement): void {
  for (const name of MERMAID_THEME_VARS) {
    stage.style.removeProperty(name);
  }
}

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function formatZoomLabel(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

export function wrapRenderedMermaidNode(node: HTMLPreElement): HTMLElement {
  const doc = node.ownerDocument;
  const stage = doc.createElement("div");
  stage.className = "mermaid-stage";
  stage.setAttribute("data-mermaid-rendered", "true");

  const toolbar = doc.createElement("div");
  toolbar.className = "mermaid-stage__toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Diagram controls");

  const toolbarActions = doc.createElement("div");
  toolbarActions.className = "mermaid-stage__toolbar-actions";

  const zoomOut = doc.createElement("button");
  zoomOut.type = "button";
  zoomOut.className = "mermaid-stage__btn";
  zoomOut.dataset.action = "zoom-out";
  zoomOut.title = "Zoom out";
  zoomOut.setAttribute("aria-label", "Zoom out");
  zoomOut.textContent = "−";

  const zoomReset = doc.createElement("button");
  zoomReset.type = "button";
  zoomReset.className = "mermaid-stage__btn mermaid-stage__btn--label";
  zoomReset.dataset.action = "zoom-reset";
  zoomReset.title = "Reset zoom";
  zoomReset.setAttribute("aria-label", "Reset zoom");
  zoomReset.textContent = "100%";

  const zoomIn = doc.createElement("button");
  zoomIn.type = "button";
  zoomIn.className = "mermaid-stage__btn";
  zoomIn.dataset.action = "zoom-in";
  zoomIn.title = "Zoom in";
  zoomIn.setAttribute("aria-label", "Zoom in");
  zoomIn.textContent = "+";

  toolbarActions.append(zoomOut, zoomReset, zoomIn);

  const toolbarSpacer = doc.createElement("div");
  toolbarSpacer.className = "mermaid-stage__toolbar-spacer";

  const fullscreenBtn = doc.createElement("button");
  fullscreenBtn.type = "button";
  fullscreenBtn.className = "mermaid-stage__btn";
  fullscreenBtn.dataset.action = "fullscreen";
  fullscreenBtn.title = "Full screen";
  fullscreenBtn.setAttribute("aria-label", "Full screen");
  fullscreenBtn.textContent = "⛶";

  toolbar.append(toolbarActions, toolbarSpacer, fullscreenBtn);

  const hint = doc.createElement("p");
  hint.className = "mermaid-stage__hint";
  hint.textContent = "Drag to pan · Scroll to zoom · ⛶ Full screen";

  const viewport = doc.createElement("div");
  viewport.className = "mermaid-stage__viewport";

  const content = doc.createElement("div");
  content.className = "mermaid-stage__content";
  content.innerHTML = node.innerHTML;

  viewport.appendChild(content);
  stage.append(toolbar, hint, viewport);
  node.replaceWith(stage);

  return stage;
}

export function attachMermaidPanZoom(stage: HTMLElement): void {
  if (stage.dataset.mermaidPanZoom === "true") return;

  const viewport = stage.querySelector<HTMLElement>(".mermaid-stage__viewport");
  const content = stage.querySelector<HTMLElement>(".mermaid-stage__content");
  const resetBtn = stage.querySelector<HTMLElement>("[data-action='zoom-reset']");
  const fullscreenBtn = stage.querySelector<HTMLElement>("[data-action='fullscreen']");
  if (!viewport || !content) return;

  stage.dataset.mermaidPanZoom = "true";

  let scale = 1;
  let tx = 0;
  let ty = 0;
  let dragging = false;
  let dragPointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let pinchMidX = 0;
  let pinchMidY = 0;

  const applyTransform = () => {
    content.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    if (resetBtn) resetBtn.textContent = formatZoomLabel(scale);
  };

  const resetTransform = () => {
    scale = 1;
    tx = 0;
    ty = 0;
    applyTransform();
  };

  const zoomAt = (clientX: number, clientY: number, nextScale: number) => {
    const rect = viewport.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const clamped = clampScale(nextScale);
    const ratio = clamped / scale;
    tx = mx - ratio * (mx - tx);
    ty = my - ratio * (my - ty);
    scale = clamped;
    applyTransform();
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomAt(event.clientX, event.clientY, scale * delta);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    dragging = true;
    dragPointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("is-panning");
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging || dragPointerId !== event.pointerId) return;
    tx += event.clientX - lastX;
    ty += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    applyTransform();
  };

  const endDrag = (event: PointerEvent) => {
    if (!dragging || dragPointerId !== event.pointerId) return;
    dragging = false;
    dragPointerId = null;
    viewport.classList.remove("is-panning");
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  };

  const getTouchDistance = (touches: TouchList): number => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 2) return;
    event.preventDefault();
    pinchStartDistance = getTouchDistance(event.touches);
    pinchStartScale = scale;
    const rect = viewport.getBoundingClientRect();
    pinchMidX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
    pinchMidY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
  };

  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length !== 2 || pinchStartDistance <= 0) return;
    event.preventDefault();
    const distance = getTouchDistance(event.touches);
    const nextScale = clampScale(pinchStartScale * (distance / pinchStartDistance));
    const ratio = nextScale / scale;
    tx = pinchMidX - ratio * (pinchMidX - tx);
    ty = pinchMidY - ratio * (pinchMidY - ty);
    scale = nextScale;
    applyTransform();
  };

  const supportsNativeFullscreen = (): boolean => {
    return typeof stage.requestFullscreen === "function";
  };

  const isOverlayFullscreen = (): boolean => {
    return stage.classList.contains("mermaid-stage--overlay");
  };

  const isFullscreenActive = (): boolean => {
    return document.fullscreenElement === stage || isOverlayFullscreen();
  };

  const enterOverlayFullscreen = () => {
    pinMermaidStageTheme(stage);
    stage.classList.add("mermaid-stage--overlay");
    document.body.classList.add("mermaid-stage-overlay-open");
  };

  const exitOverlayFullscreen = () => {
    stage.classList.remove("mermaid-stage--overlay");
    document.body.classList.remove("mermaid-stage-overlay-open");
    if (document.fullscreenElement !== stage) {
      clearMermaidStageTheme(stage);
    }
  };

  const updateFullscreenUi = () => {
    const active = isFullscreenActive();
    stage.classList.toggle("is-fullscreen", active);
    if (fullscreenBtn) {
      fullscreenBtn.title = active ? "Exit full screen" : "Full screen";
      fullscreenBtn.setAttribute(
        "aria-label",
        active ? "Exit full screen" : "Full screen"
      );
      fullscreenBtn.textContent = active ? "✕" : "⛶";
      fullscreenBtn.classList.toggle("mermaid-stage__btn--active", active);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === stage) {
        await document.exitFullscreen();
        return;
      }

      if (isOverlayFullscreen()) {
        exitOverlayFullscreen();
        updateFullscreenUi();
        return;
      }

      if (supportsNativeFullscreen()) {
        pinMermaidStageTheme(stage);
        await stage.requestFullscreen();
        return;
      }

      enterOverlayFullscreen();
      updateFullscreenUi();
    } catch {
      if (!isOverlayFullscreen()) {
        enterOverlayFullscreen();
        updateFullscreenUi();
      }
    }
  };

  const onFullscreenChange = () => {
    if (!stage.isConnected) {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("keydown", onOverlayKeyDown);
      exitOverlayFullscreen();
      return;
    }

    if (document.fullscreenElement === stage) {
      pinMermaidStageTheme(stage);
    } else if (!isOverlayFullscreen()) {
      clearMermaidStageTheme(stage);
    }

    if (document.fullscreenElement !== stage && isOverlayFullscreen()) {
      updateFullscreenUi();
      return;
    }

    if (document.fullscreenElement !== stage) {
      exitOverlayFullscreen();
    }

    updateFullscreenUi();
  };

  const onOverlayKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !isOverlayFullscreen()) return;
    exitOverlayFullscreen();
    updateFullscreenUi();
  };

  const onToolbarClick = (event: Event) => {
    const target = event.target as HTMLElement | null;
    const action = target?.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (!action) return;

    const rect = viewport.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    if (action === "zoom-in") {
      zoomAt(centerX, centerY, scale * ZOOM_STEP);
    } else if (action === "zoom-out") {
      zoomAt(centerX, centerY, scale / ZOOM_STEP);
    } else if (action === "zoom-reset") {
      resetTransform();
    } else if (action === "fullscreen") {
      void toggleFullscreen();
    }
  };

  viewport.addEventListener("wheel", onWheel, { passive: false });
  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("touchstart", onTouchStart, { passive: false });
  viewport.addEventListener("touchmove", onTouchMove, { passive: false });
  stage.addEventListener("click", onToolbarClick);
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("keydown", onOverlayKeyDown);

  applyTransform();
  updateFullscreenUi();
}
