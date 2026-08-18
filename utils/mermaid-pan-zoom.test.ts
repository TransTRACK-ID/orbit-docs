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
