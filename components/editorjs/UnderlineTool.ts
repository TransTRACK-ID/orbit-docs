import type { API, InlineTool } from "@editorjs/editorjs";

/**
 * Underline inline tool — wraps the selection in <u>.
 * Markdown has no underline syntax, so it round-trips as literal <u> markup,
 * which the preview sanitizer allowlists.
 */
export default class UnderlineTool implements InlineTool {
  public static isInline = true;
  public static title = "Underline";

  public static get sanitize() {
    return { u: {} };
  }

  public static get shortcut() {
    return "CMD+U";
  }

  private readonly api: API;
  private readonly CSS = {
    button: "ce-inline-tool",
    buttonActive: "ce-inline-tool--active",
    tag: "u",
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
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M6 4v6a6 6 0 0 0 12 0V4M5 20h14"/></svg>';
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
