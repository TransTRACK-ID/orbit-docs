import type { API } from "@editorjs/editorjs";
import type { InlineTool } from "@editorjs/editorjs";

export const TEXT_COLOR_PALETTE = [
  "#FF1300",
  "#FFAF00",
  "#ECECD7",
  "#00D08A",
  "#2C9EEC",
  "#8C00FF",
  "#FF4D4D",
  "#FFB84D",
  "#4D94FF",
  "#B84DFF",
  "#FF4DB8",
  "#4DFFB8",
  "#000000",
  "#333333",
  "#666666",
  "#999999",
  "#CCCCCC",
  "#FFFFFF",
] as const;

const DEFAULT_TEXT_COLOR = "#FF1300";

const TEXT_COLOR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 20h12M9.5 4.5 7 20h2.2l.6-3.2h5.4l.6 3.2H18l-2.5-15.5h-2.8L9.5 4.5Zm1.7 5.2 1-5.2h1.6l1 5.2h-3.6Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 18h8" stroke="var(--text-color-accent, #FF1300)" stroke-width="2.5" stroke-linecap="round"/></svg>`;

export default class TextColorTool implements InlineTool {
  public static isInline = true;
  public static title = "Color";

  public static get sanitize() {
    return {
      font: { color: true },
      span: { style: true },
    };
  }

  private readonly api: API;
  private readonly CSS = {
    button: "ce-inline-tool",
    buttonActive: "ce-inline-tool--active",
    buttonModifier: "ce-inline-tool--text-color",
    actions: "ce-inline-text-color-actions",
    swatch: "ce-inline-text-color-swatch",
    actionsShowed: "ce-inline-text-color-actions--showed",
  };

  private nodes: {
    button: HTMLButtonElement | null;
    actions: HTMLDivElement | null;
  } = {
    button: null,
    actions: null,
  };

  private paletteOpen = false;
  private currentColor = DEFAULT_TEXT_COLOR;

  constructor({ api }: { api: API }) {
    this.api = api;
  }

  render() {
    this.nodes.button = document.createElement("button");
    this.nodes.button.type = "button";
    this.nodes.button.classList.add(this.CSS.button, this.CSS.buttonModifier);
    this.nodes.button.innerHTML = TEXT_COLOR_ICON;
    this.nodes.button.style.setProperty("--text-color-accent", this.currentColor);
    return this.nodes.button;
  }

  renderActions() {
    this.nodes.actions = document.createElement("div");
    this.nodes.actions.classList.add(this.CSS.actions);

    for (const color of TEXT_COLOR_PALETTE) {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.classList.add(this.CSS.swatch);
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.setAttribute("aria-label", `Apply text color ${color}`);
      if (color.toLowerCase() === "#ffffff") {
        swatch.style.border = "1px solid var(--border, #ccc)";
      }
      swatch.addEventListener("mousedown", (event) => {
        event.preventDefault();
        this.applyColor(color);
      });
      this.nodes.actions.appendChild(swatch);
    }

    const clear = document.createElement("button");
    clear.type = "button";
    clear.classList.add(`${this.CSS.swatch}`, `${this.CSS.swatch}--clear`);
    clear.textContent = "Clear";
    clear.title = "Remove text color";
    clear.addEventListener("mousedown", (event) => {
      event.preventDefault();
      this.clearColor();
    });
    this.nodes.actions.appendChild(clear);

    return this.nodes.actions;
  }

  surround(range: Range | null) {
    if (!range) return;

    if (this.paletteOpen) {
      this.api.selection.restore();
      this.api.selection.removeFakeBackground();
      this.closePalette();
      return;
    }

    this.api.selection.setFakeBackground();
    this.api.selection.save();
    this.openPalette();
  }

  checkState() {
    const font = this.api.selection.findParentTag("FONT");
    const coloredSpan = this.findColoredSpan();
    const active = Boolean(font || coloredSpan);

    if (font) {
      const color = font.getAttribute("color") || font.style.color || DEFAULT_TEXT_COLOR;
      this.currentColor = color;
    } else if (coloredSpan) {
      this.currentColor = coloredSpan.style.color || DEFAULT_TEXT_COLOR;
    }

    this.nodes.button?.classList.toggle(this.CSS.buttonActive, active);
    this.nodes.button?.style.setProperty("--text-color-accent", this.currentColor);
    return active;
  }

  clear() {
    this.closePalette();
  }

  private openPalette() {
    this.nodes.actions?.classList.add(this.CSS.actionsShowed);
    this.paletteOpen = true;
  }

  private closePalette() {
    this.nodes.actions?.classList.remove(this.CSS.actionsShowed);
    this.paletteOpen = false;
  }

  private findColoredSpan(): HTMLElement | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    let node: Node | null = selection.anchorNode;
    while (node && node !== document) {
      if (node instanceof HTMLElement && node.tagName === "SPAN" && node.style.color) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  private applyColor(color: string) {
    this.api.selection.restore();
    this.api.selection.removeFakeBackground();

    const font = this.api.selection.findParentTag("FONT");
    if (font) {
      this.api.selection.expandToTag(font);
      font.setAttribute("color", color);
      font.style.color = color;
    } else {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      if (range.collapsed) return;

      const wrapper = document.createElement("font");
      wrapper.setAttribute("color", color);
      wrapper.style.color = color;

      try {
        range.surroundContents(wrapper);
      } catch {
        const contents = range.extractContents();
        wrapper.appendChild(contents);
        range.insertNode(wrapper);
      }

      range.setStartAfter(wrapper);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    this.currentColor = color;
    this.nodes.button?.style.setProperty("--text-color-accent", color);
    this.nodes.button?.classList.add(this.CSS.buttonActive);
    this.closePalette();
    this.api.inlineToolbar.close();
  }

  private clearColor() {
    this.api.selection.restore();
    this.api.selection.removeFakeBackground();

    const font = this.api.selection.findParentTag("FONT");
    if (font) {
      this.api.selection.expandToTag(font);
      const parent = font.parentNode;
      if (parent) {
        while (font.firstChild) {
          parent.insertBefore(font.firstChild, font);
        }
        parent.removeChild(font);
      }
    }

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selection.collapseToEnd();
    }

    this.nodes.button?.classList.remove(this.CSS.buttonActive);
    this.closePalette();
    this.api.inlineToolbar.close();
  }
}
