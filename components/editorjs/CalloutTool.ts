import type { API, BlockTool, BlockToolData, ToolConfig } from "@editorjs/editorjs";

/**
 * Notion-style Callout block — an icon plus a single rich-text field.
 *
 * Persists as a GitHub-flavored alert in markdown (`> [!NOTE]`, `> [!TIP]`,
 * `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`) so it renders as a styled
 * alert box everywhere `renderMarkdown` runs (preview, public docs, chat).
 */

export type CalloutType = "note" | "tip" | "important" | "warning" | "caution";

export const CALLOUT_TYPES: Record<CalloutType, { emoji: string; label: string }> = {
  note: { emoji: "ℹ️", label: "Note" },
  tip: { emoji: "💡", label: "Tip" },
  important: { emoji: "❗", label: "Important" },
  warning: { emoji: "⚠️", label: "Warning" },
  caution: { emoji: "🛑", label: "Caution" },
};

export const CALLOUT_TYPE_NAMES = Object.keys(CALLOUT_TYPES) as CalloutType[];

interface CalloutData extends BlockToolData {
  type?: CalloutType;
  text?: string;
}

const TOOLBOX_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8h.01M12 12v4m9-4a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>';

export default class CalloutTool implements BlockTool {
  public static get toolbox() {
    return { title: "Callout", icon: TOOLBOX_ICON };
  }

  public static get isReadOnlySupported() {
    return true;
  }

  /** Lets "turn into"/convert move text between callout and text blocks. */
  public static get conversionConfig() {
    return { export: "text", import: "text" };
  }

  public static get sanitize() {
    return {
      type: false,
      text: { br: true },
    };
  }

  private readonly api: API;
  private readonly readOnly: boolean;
  private data: Required<CalloutData>;
  private wrapper: HTMLElement | null = null;
  private iconButton: HTMLButtonElement | null = null;
  private textEl: HTMLElement | null = null;
  private picker: HTMLElement | null = null;

  constructor({
    data,
    api,
    readOnly,
  }: {
    data: CalloutData;
    config?: ToolConfig;
    api: API;
    readOnly: boolean;
  }) {
    this.api = api;
    this.readOnly = readOnly;
    const type = data.type && data.type in CALLOUT_TYPES ? data.type : "note";
    this.data = { type, text: data.text ?? "" };
  }

  render(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.classList.add("cdx-callout", `cdx-callout--${this.data.type}`);

    const icon = document.createElement("button");
    icon.type = "button";
    icon.classList.add("cdx-callout__icon");
    icon.textContent = CALLOUT_TYPES[this.data.type].emoji;
    icon.setAttribute("aria-label", "Callout type");
    if (!this.readOnly) {
      icon.addEventListener("mousedown", (e) => e.preventDefault());
      icon.addEventListener("click", () => this.togglePicker());
    } else {
      icon.disabled = true;
      icon.tabIndex = -1;
    }

    const text = document.createElement("div");
    text.classList.add("cdx-callout__text");
    text.contentEditable = String(!this.readOnly);
    text.innerHTML = this.data.text;
    text.dataset.placeholder = "Type something important…";

    wrapper.appendChild(icon);
    wrapper.appendChild(text);

    this.wrapper = wrapper;
    this.iconButton = icon;
    this.textEl = text;
    return wrapper;
  }

  save(): CalloutData {
    return {
      type: this.data.type,
      text: this.textEl?.innerHTML ?? "",
    };
  }

  private togglePicker() {
    if (this.picker) {
      this.closePicker();
      return;
    }
    const picker = document.createElement("div");
    picker.classList.add("cdx-callout__picker");
    for (const name of CALLOUT_TYPE_NAMES) {
      const meta = CALLOUT_TYPES[name];
      const option = document.createElement("button");
      option.type = "button";
      option.classList.add("cdx-callout__picker-option");
      if (name === this.data.type) {
        option.classList.add("cdx-callout__picker-option--active");
      }
      option.innerHTML = `<span class="cdx-callout__picker-emoji">${meta.emoji}</span><span>${meta.label}</span>`;
      option.addEventListener("mousedown", (e) => e.preventDefault());
      option.addEventListener("click", () => this.setType(name));
      picker.appendChild(option);
    }
    this.wrapper?.appendChild(picker);
    this.picker = picker;

    // Close on outside click — registered deferred so this opening click
    // doesn't immediately trigger it.
    requestAnimationFrame(() => {
      document.addEventListener("mousedown", this.onDocumentClick, true);
    });
  }

  private closePicker() {
    this.picker?.remove();
    this.picker = null;
    document.removeEventListener("mousedown", this.onDocumentClick, true);
  }

  private onDocumentClick = (e: MouseEvent) => {
    if (this.picker && !this.picker.contains(e.target as Node)) {
      this.closePicker();
    }
  };

  private setType(type: CalloutType) {
    this.data.type = type;
    if (this.wrapper) {
      for (const name of CALLOUT_TYPE_NAMES) {
        this.wrapper.classList.remove(`cdx-callout--${name}`);
      }
      this.wrapper.classList.add(`cdx-callout--${type}`);
    }
    if (this.iconButton) {
      this.iconButton.textContent = CALLOUT_TYPES[type].emoji;
    }
    this.closePicker();
    // Class/text mutations are invisible to Editor.js — notify explicitly.
    this.wrapper?.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
}
