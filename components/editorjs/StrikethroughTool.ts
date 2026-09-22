import type { API, InlineTool } from "@editorjs/editorjs";

/**
 * Strikethrough inline tool — wraps the selection in <s>.
 * Round-trips to markdown as ~~text~~ (GFM).
 */
export default class StrikethroughTool implements InlineTool {
  public static isInline = true;
  public static title = "Strikethrough";

  public static get sanitize() {
    return { s: {} };
  }

  public static get shortcut() {
    return "CMD+SHIFT+X";
  }

  private readonly api: API;
  private readonly CSS = {
    button: "ce-inline-tool",
    buttonActive: "ce-inline-tool--active",
    tag: "s",
  };
  private button: HTMLButtonElement | null = null;

  constructor({ api }: { api: API }) {
    this.api = api;
  }

  render() {
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.classList.add(this.CSS.button);
    this.button.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M4 12h16"/><path stroke="currentColor" stroke-width="1.6" d="M17.3 7.5c-.4-2-2.3-3.5-5.3-3.5-2.9 0-5 1.4-5 3.6 0 .9.3 1.6 1 2.2M6.7 16.5c.4 2 2.3 3.5 5.3 3.5 2.9 0 5-1.4 5-3.6 0-1.2-.6-2.2-1.7-2.8"/></svg>';
    return this.button;
  }

  surround(range: Range | null) {
    if (!range) return;
    const parent = this.api.selection.findParentTag(this.CSS.tag);
    if (parent) {
      this.unwrap(parent);
    } else {
      this.wrap(range);
    }
  }

  checkState() {
    const parent = this.api.selection.findParentTag(this.CSS.tag);
    this.button?.classList.toggle(this.CSS.buttonActive, Boolean(parent));
    return Boolean(parent);
  }

  private wrap(range: Range) {
    const el = document.createElement(this.CSS.tag);
    el.appendChild(range.extractContents());
    range.insertNode(el);
    this.api.selection.expandToTag(el);
  }

  private unwrap(el: HTMLElement) {
    this.api.selection.expandToTag(el);
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const contents = range.extractContents();
    el.parentNode?.removeChild(el);
    range.insertNode(contents);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}
