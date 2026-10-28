import { describe, expect, it } from "vitest";
import { attachMermaidPanZoom, wrapRenderedMermaidNode } from "./mermaid-pan-zoom";

describe("wrapRenderedMermaidNode", () => {
  it("replaces pre.mermaid with an interactive stage shell", () => {
    const container = document.createElement("div");
    const pre = document.createElement("pre");
    pre.className = "mermaid";
    pre.innerHTML = "<svg><text>ok</text></svg>";
    container.appendChild(pre);

    const stage = wrapRenderedMermaidNode(pre);
    attachMermaidPanZoom(stage);

    expect(container.querySelector("pre.mermaid")).toBeNull();
    expect(stage.classList.contains("mermaid-stage")).toBe(true);
    expect(stage.querySelector(".mermaid-stage__viewport svg")).not.toBeNull();
    expect(stage.querySelector("[data-action='zoom-in']")).not.toBeNull();
    expect(stage.querySelector("[data-action='fullscreen']")).not.toBeNull();
    expect(stage.dataset.mermaidPanZoom).toBe("true");
  });

  it("toggles overlay fullscreen when native fullscreen is unavailable", () => {
    const container = document.createElement("div");
    const pre = document.createElement("pre");
    pre.className = "mermaid";
    pre.innerHTML = "<svg><text>ok</text></svg>";
    container.appendChild(pre);

    const stage = wrapRenderedMermaidNode(pre);
    attachMermaidPanZoom(stage);

    const fullscreenBtn = stage.querySelector<HTMLButtonElement>(
      "[data-action='fullscreen']"
    );
    expect(fullscreenBtn).not.toBeNull();

    fullscreenBtn?.click();
    expect(stage.classList.contains("mermaid-stage--overlay")).toBe(true);
    expect(document.body.classList.contains("mermaid-stage-overlay-open")).toBe(true);
    expect(fullscreenBtn?.textContent).toBe("✕");

    fullscreenBtn?.click();
    expect(stage.classList.contains("mermaid-stage--overlay")).toBe(false);
    expect(document.body.classList.contains("mermaid-stage-overlay-open")).toBe(false);
    expect(fullscreenBtn?.textContent).toBe("⛶");
  });
});

describe("attachMermaidPanZoom wheel zoom", () => {
  function createStage() {
    const container = document.createElement("div");
    const pre = document.createElement("pre");
    pre.className = "mermaid";
    pre.innerHTML = "<svg><text>ok</text></svg>";
    container.appendChild(pre);
    const stage = wrapRenderedMermaidNode(pre);
    attachMermaidPanZoom(stage);
    document.body.appendChild(container);
    return stage;
  }

  function dispatchWheel(stage: HTMLElement, deltaY: number, deltaMode = 0) {
    const viewport = stage.querySelector<HTMLElement>(".mermaid-stage__viewport");
    viewport?.dispatchEvent(new WheelEvent("wheel", { deltaY, deltaMode }));
  }

  function zoomLabel(stage: HTMLElement) {
    return stage.querySelector("[data-action='zoom-reset']")?.textContent;
  }

  it("zooms one standard notch to 122%", () => {
    const stage = createStage();
    dispatchWheel(stage, -100);
    expect(zoomLabel(stage)).toBe("122%");
  });

  it("zooms proportionally to a small trackpad tick", () => {
    const stage = createStage();
    dispatchWheel(stage, -2);
    expect(zoomLabel(stage)).toBe("100%");
    const content = stage.querySelector<HTMLElement>(".mermaid-stage__content");
    expect(content?.style.transform).toMatch(/scale\(1\.004/);
  });

  it("accumulates ten small events like one notch", () => {
    const stage = createStage();
    for (let i = 0; i < 10; i += 1) dispatchWheel(stage, -10);
    expect(zoomLabel(stage)).toBe("122%");
  });

  it("normalizes line-mode deltas", () => {
    const stage = createStage();
    dispatchWheel(stage, -3, 1);
    expect(zoomLabel(stage)).toBe("110%");
  });

  it("clamps zoom-in at 400%", () => {
    const stage = createStage();
    for (let i = 0; i < 20; i += 1) dispatchWheel(stage, -100);
    expect(zoomLabel(stage)).toBe("400%");
  });

  it("clamps zoom-out at 25%", () => {
    const stage = createStage();
    for (let i = 0; i < 20; i += 1) dispatchWheel(stage, 100);
    expect(zoomLabel(stage)).toBe("25%");
  });

  it("toolbar zoom-in keeps the fixed 120% step", () => {
    const stage = createStage();
    stage.querySelector<HTMLButtonElement>("[data-action='zoom-in']")?.click();
    expect(zoomLabel(stage)).toBe("120%");
  });
});
