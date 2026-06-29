import type { API } from "@editorjs/editorjs";
import type { InlineTool } from "@editorjs/editorjs";
import {
  defaultLinkLabel,
  looksLikeUrl,
  prepareLinkUrl,
} from "~/components/editorjs/linkUtils";

const LINK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m7.7 12.6-.021.02a2.795 2.795 0 0 0-.044 4.005v0a2.795 2.795 0 0 0 3.936.006l1.455-1.438a3 3 0 0 0 .34-3.866l-.146-.207"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m16.22 11.12.136-.14c.933-.954.992-2.46.135-3.483v0a2.597 2.597 0 0 0-3.664-.32L11.39 8.386a3 3 0 0 0-.301 4.3l.031.034"/></svg>`;

const UNLINK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M9 12H7.1a2.8 2.8 0 0 1 0-5.6l1.455-1.438a3 3 0 0 1 4.246.006l.136.134M15 12h1.9a2.8 2.8 0 0 0 0-5.6l-1.455-1.438a3 3 0 0 0-4.246.006l-.136.134M8 12h8"/></svg>`;

let pendingPasteUrl: string | null = null;

export function armPasteLink(url: string) {
  pendingPasteUrl = prepareLinkUrl(url);
}

export function consumePendingPasteUrl(): string | null {
  const url = pendingPasteUrl;
  pendingPasteUrl = null;
  return url;
}

interface InlineLinkNodes {
  button: HTMLButtonElement | null;
  actions: HTMLDivElement | null;
  urlInput: HTMLInputElement | null;
  labelInput: HTMLInputElement | null;
}

const LINK_FIELD_IDS = {
  url: "orbit-editor-inline-link-url",
  label: "orbit-editor-inline-link-label",
} as const;

/** One shared actions panel — Editor.js creates a new tool instance on every toolbar open. */
let sharedLinkActions: InlineLinkNodes | null = null;
let activeLinkTool: InlineLinkTool | null = null;
const ENTER_KEY = 13;

function getSharedLinkActions(): InlineLinkNodes {
  if (sharedLinkActions) return sharedLinkActions;

  const actions = document.createElement("div");
  actions.classList.add("ce-inline-link-actions");

  const urlField = createLinkField("URL", "Paste or type a link", LINK_FIELD_IDS.url, "url");
  const labelField = createLinkField("Text", "Link label", LINK_FIELD_IDS.label, "label");

  urlField.input.addEventListener("keydown", (event) => {
    if (event.keyCode === ENTER_KEY) {
      event.preventDefault();
      activeLinkTool?.nodes.labelInput?.focus();
    }
  });

  labelField.input.addEventListener("keydown", (event) => {
    if (event.keyCode === ENTER_KEY) {
      activeLinkTool?.submit(event);
    }
  });

  actions.append(urlField.wrapper, labelField.wrapper);

  sharedLinkActions = {
    button: null,
    actions,
    urlInput: urlField.input,
    labelInput: labelField.input,
  };

  return sharedLinkActions;
}

function createLinkField(
  labelText: string,
  placeholder: string,
  id: string,
  name: string
) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("ce-inline-link-field");

  const label = document.createElement("label");
  label.classList.add("ce-inline-link-label");
  label.htmlFor = id;
  label.textContent = labelText;

  const input = document.createElement("input");
  input.type = "text";
  input.id = id;
  input.name = name;
  input.placeholder = placeholder;
  input.autocomplete = "off";
  input.enterKeyHint = labelText === "Text" ? "done" : "next";
  input.classList.add("ce-inline-tool-input");

  wrapper.append(label, input);
  return { wrapper, input };
}

export default class InlineLinkTool implements InlineTool {
  public static isInline = true;
  public static title = "Link";

  public static get sanitize() {
    return {
      a: {
        href: true,
        target: "_blank",
        rel: "nofollow noopener noreferrer",
      },
    };
  }

  private readonly api: API;
  private readonly commandLink = "createLink";
  private readonly commandUnlink = "unlink";
  private readonly CSS = {
    button: "ce-inline-tool",
    buttonActive: "ce-inline-tool--active",
    buttonModifier: "ce-inline-tool--link",
    buttonUnlink: "ce-inline-tool--unlink",
    input: "ce-inline-tool-input",
    inputShowed: "ce-inline-tool-input--showed",
    actions: "ce-inline-link-actions",
    field: "ce-inline-link-field",
    label: "ce-inline-link-label",
  };

  private nodes: InlineLinkNodes = {
    button: null,
    actions: null,
    urlInput: null,
    labelInput: null,
  };

  private inputOpened = false;
  private savedSelectionText = "";

  constructor({ api }: { api: API }) {
    this.api = api;
  }

  render() {
    this.nodes.button = document.createElement("button");
    this.nodes.button.type = "button";
    this.nodes.button.classList.add(this.CSS.button, this.CSS.buttonModifier);
    this.nodes.button.innerHTML = LINK_ICON;
    return this.nodes.button;
  }

  renderActions() {
    activeLinkTool = this;
    const shared = getSharedLinkActions();
    this.nodes.actions = shared.actions;
    this.nodes.urlInput = shared.urlInput;
    this.nodes.labelInput = shared.labelInput;
    return this.nodes.actions;
  }

  surround(range: Range | null) {
    if (range) {
      if (this.inputOpened) {
        this.api.selection.restore();
        this.api.selection.removeFakeBackground();
      } else {
        this.api.selection.setFakeBackground();
        this.api.selection.save();
        this.savedSelectionText = window.getSelection()?.toString() || "";
      }

      const anchor = this.api.selection.findParentTag("A");
      if (anchor) {
        if (this.inputOpened) {
          this.closeActions(false);
          this.checkState();
          return;
        }
        this.api.selection.expandToTag(anchor);
        this.unlink();
        this.closeActions();
        this.checkState();
        return;
      }
    }

    this.toggleActions();
  }

  checkState() {
    const anchor = this.api.selection.findParentTag("A");
    if (anchor) {
      if (this.nodes.button) {
        this.nodes.button.innerHTML = UNLINK_ICON;
        this.nodes.button.classList.add(this.CSS.buttonUnlink, this.CSS.buttonActive);
      }
      this.openActions();
      const href = anchor.getAttribute("href") || "";
      if (this.nodes.urlInput) {
        this.nodes.urlInput.value = href === "null" ? "" : href;
      }
      if (this.nodes.labelInput) {
        this.nodes.labelInput.value = anchor.textContent || "";
      }
      this.api.selection.save();
      return true;
    }

    if (this.nodes.button) {
      this.nodes.button.innerHTML = LINK_ICON;
      this.nodes.button.classList.remove(this.CSS.buttonUnlink, this.CSS.buttonActive);
    }
    return false;
  }

  clear() {
    if (activeLinkTool === this) {
      activeLinkTool = null;
    }
    this.closeActions();
  }

  get shortcut() {
    return "CMD+K";
  }

  private toggleActions() {
    if (this.inputOpened) {
      this.closeActions(false);
      return;
    }
    this.openActions(true);
  }

  private openActions(shouldFocus = false) {
    const anchor = this.api.selection.findParentTag("A");
    const pendingUrl = consumePendingPasteUrl();
    const selectionText = this.savedSelectionText || window.getSelection()?.toString() || "";

    if (!anchor) {
      if (pendingUrl) {
        if (this.nodes.urlInput) this.nodes.urlInput.value = pendingUrl;
        if (this.nodes.labelInput) {
          this.nodes.labelInput.value = "";
          this.nodes.labelInput.placeholder = defaultLinkLabel(pendingUrl);
        }
        shouldFocus = true;
      } else if (selectionText && !looksLikeUrl(selectionText)) {
        if (this.nodes.labelInput) this.nodes.labelInput.value = selectionText;
        if (this.nodes.urlInput) this.nodes.urlInput.value = "";
      } else if (selectionText && looksLikeUrl(selectionText)) {
        const url = prepareLinkUrl(selectionText);
        if (this.nodes.urlInput) this.nodes.urlInput.value = url;
        if (this.nodes.labelInput) {
          this.nodes.labelInput.value = "";
          this.nodes.labelInput.placeholder = defaultLinkLabel(url);
        }
      }
    }

    this.nodes.urlInput?.classList.add(this.CSS.inputShowed);
    this.nodes.labelInput?.classList.add(this.CSS.inputShowed);
    this.inputOpened = true;

    if (shouldFocus) {
      if (pendingUrl || (selectionText && looksLikeUrl(selectionText))) {
        this.nodes.labelInput?.focus();
      } else if (!anchor) {
        this.nodes.urlInput?.focus();
      }
    }
  }

  private closeActions(clearSavedSelection = true) {
    this.api.selection.restore();
    this.api.selection.removeFakeBackground();

    this.nodes.urlInput?.classList.remove(this.CSS.inputShowed);
    this.nodes.labelInput?.classList.remove(this.CSS.inputShowed);
    if (this.nodes.urlInput) this.nodes.urlInput.value = "";
    if (this.nodes.labelInput) {
      this.nodes.labelInput.value = "";
      this.nodes.labelInput.placeholder = "Link label";
    }

    if (clearSavedSelection) {
      this.savedSelectionText = "";
    }
    this.inputOpened = false;
  }

  submit(event: KeyboardEvent) {
    const hrefInput = this.nodes.urlInput?.value || "";
    const labelInput = this.nodes.labelInput?.value || "";

    if (!hrefInput.trim()) {
      this.api.selection.restore();
      this.unlink();
      event.preventDefault();
      this.closeActions();
      return;
    }

    if (/\s/.test(hrefInput)) {
      this.api.notifier.show({
        message: "Link URL cannot contain spaces.",
        style: "error",
      });
      return;
    }

    const href = prepareLinkUrl(hrefInput);
    const label = labelInput.trim() || defaultLinkLabel(href);

    this.api.selection.restore();
    this.api.selection.removeFakeBackground();
    this.insertLink(href, label);

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const selection = window.getSelection();
    if (selection) {
      selection.collapseToEnd();
    }
    this.api.inlineToolbar.close();
  }

  private insertLink(href: string, label: string) {
    const anchor = this.api.selection.findParentTag("A");
    if (anchor) {
      this.api.selection.expandToTag(anchor);
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      document.execCommand(this.commandLink, false, href);
      return;
    }

    const range = selection.getRangeAt(0);
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "nofollow noopener noreferrer";
    link.textContent = label;

    range.deleteContents();
    range.insertNode(link);

    range.setStartAfter(link);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private unlink() {
    document.execCommand(this.commandUnlink);
  }
}
