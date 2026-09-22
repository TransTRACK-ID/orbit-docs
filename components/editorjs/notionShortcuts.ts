import type EditorJS from "@editorjs/editorjs";
import type { BlockAPI } from "@editorjs/editorjs";

/**
 * Notion-style typing shortcuts and block hotkeys for Editor.js.
 *
 * Space triggers — fire when Space is pressed and the text before the caret
 * exactly matches (Notion semantics: `>` is a toggle, `"` is a quote):
 *   #, ##, ### → Heading 1-3     -, *, +  → Bulleted list
 *   1.         → Numbered list   [], [ ]  → To-do (checklist)
 *   >          → Toggle          "        → Quote
 *
 * Instant triggers — fire as soon as the whole block text matches:
 *   ---        → Divider         ```      → Code block
 *
 * Hotkeys:
 *   Cmd/Ctrl+D            → duplicate block
 *   Cmd/Ctrl+Shift+↑/↓    → move block up/down
 *   Cmd/Ctrl+Alt+0..9     → turn into (Notion's option-command digits)
 */

type BlockSpec = { type: string; data: Record<string, any> };
type BlockBuilder = (text: string) => BlockSpec;

const SPACE_TRIGGERS: { pattern: RegExp; build: BlockBuilder }[] = [
  { pattern: /^#$/, build: (t) => ({ type: "header", data: { text: t, level: 1 } }) },
  { pattern: /^##$/, build: (t) => ({ type: "header", data: { text: t, level: 2 } }) },
  { pattern: /^###$/, build: (t) => ({ type: "header", data: { text: t, level: 3 } }) },
  {
    pattern: /^[-*+]$/,
    build: (t) => ({
      type: "list",
      data: { style: "unordered", items: [{ content: t, meta: {}, items: [] }] },
    }),
  },
  {
    pattern: /^\d+\.$/,
    build: (t) => ({
      type: "list",
      data: { style: "ordered", items: [{ content: t, meta: {}, items: [] }] },
    }),
  },
  {
    pattern: /^\[\s?\]$/,
    build: (t) => ({ type: "checklist", data: { items: [{ text: t, checked: false }] } }),
  },
  {
    pattern: /^>$/,
    build: (t) => ({ type: "toggle", data: { text: t, status: "open", items: 0 } }),
  },
  {
    pattern: /^"$/,
    build: (t) => ({ type: "quote", data: { text: t, alignment: "left", caption: "" } }),
  },
];

const INSTANT_TRIGGERS: { text: string; build: BlockBuilder }[] = [
  { text: "---", build: () => ({ type: "delimiter", data: {} }) },
  { text: "```", build: () => ({ type: "code", data: { code: "", language: "plaintext" } }) },
];

const TURN_DIGITS: Record<string, BlockBuilder> = {
  "0": (t) => ({ type: "paragraph", data: { text: t } }),
  "1": (t) => ({ type: "header", data: { text: t, level: 1 } }),
  "2": (t) => ({ type: "header", data: { text: t, level: 2 } }),
  "3": (t) => ({ type: "header", data: { text: t, level: 3 } }),
  "4": (t) => ({ type: "checklist", data: { items: [{ text: t, checked: false }] } }),
  "5": (t) => ({
    type: "list",
    data: { style: "unordered", items: [{ content: t, meta: {}, items: [] }] },
  }),
  "6": (t) => ({
    type: "list",
    data: { style: "ordered", items: [{ content: t, meta: {}, items: [] }] },
  }),
  "7": (t) => ({ type: "toggle", data: { text: t, status: "open", items: 0 } }),
  "8": (t) => ({ type: "code", data: { code: stripTags(t), language: "plaintext" } }),
  "9": (t) => ({ type: "quote", data: { text: t, alignment: "left", caption: "" } }),
};

function escapeInline(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

/** Text offset of the caret inside `el`, or -1 when the caret is elsewhere. */
function caretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return -1;
  const end = sel.getRangeAt(0);
  if (!el.contains(end.endContainer)) return -1;
  const probe = document.createRange();
  probe.selectNodeContents(el);
  probe.setEnd(end.endContainer, end.endOffset);
  return probe.toString().length;
}

function currentBlock(editor: EditorJS): { index: number; block: BlockAPI } | null {
  const index = editor.blocks.getCurrentBlockIndex();
  if (index == null || index < 0) return null;
  const block = editor.blocks.getBlockByIndex(index);
  if (!block) return null;
  return { index, block };
}

function currentEditable(editor: EditorJS): { index: number; block: BlockAPI; el: HTMLElement } | null {
  const cur = currentBlock(editor);
  if (!cur) return null;
  const el = cur.block.holder.querySelector<HTMLElement>('[contenteditable="true"]');
  if (!el) return null;
  return { ...cur, el };
}

/** Extract plain text from any text-bearing block's saved data. */
function extractBlockText(data: Record<string, any> | undefined): string {
  if (!data) return "";
  if (typeof data.text === "string") return stripTags(data.text);
  if (typeof data.code === "string") return data.code;
  if (typeof data.title === "string") return stripTags(data.title);
  if (Array.isArray(data.items)) {
    return data.items
      .map((item: any) =>
        stripTags(typeof item === "string" ? item : (item.content ?? item.text ?? ""))
      )
      .join(" ")
      .trim();
  }
  return "";
}

export function setupNotionShortcuts(editor: EditorJS, container: HTMLElement): () => void {
  const redactor = container.querySelector<HTMLElement>(".codex-editor__redactor");
  if (!redactor) return () => {};

  /**
   * Replace the block at `index` with a new block, keeping the caret usable.
   * `focusPos` controls where the caret lands inside the new block; pass null
   * to leave focus management to the caller.
   */
  function transform(index: number, spec: BlockSpec, focusPos: "start" | "end" | null = "start") {
    editor.blocks.insert(spec.type, spec.data, {}, index, true, true);
    if (focusPos) {
      requestAnimationFrame(() => editor.caret.setToBlock(index, focusPos));
    }
  }

  // ── Markdown triggers on Space ────────────────────────────────
  function handleSpaceTrigger(): boolean {
    const cur = currentEditable(editor);
    if (!cur || cur.block.name !== "paragraph") return false;

    const offset = caretOffset(cur.el);
    if (offset < 0) return false;

    const text = cur.el.textContent ?? "";
    const before = text.slice(0, offset);
    const after = text.slice(offset);

    for (const trigger of SPACE_TRIGGERS) {
      if (trigger.pattern.test(before)) {
        transform(cur.index, trigger.build(escapeInline(after)), "start");
        return true;
      }
    }
    return false;
  }

  // ── Instant triggers (--- and ```) ────────────────────────────
  function handleInstantTrigger() {
    const cur = currentEditable(editor);
    if (!cur || cur.block.name !== "paragraph") return;

    const text = (cur.el.textContent ?? "").trim();
    for (const trigger of INSTANT_TRIGGERS) {
      if (text !== trigger.text) continue;
      const spec = trigger.build("");
      if (spec.type === "delimiter") {
        // A divider has no editable surface — replace, then give the user a
        // fresh paragraph below and focus that instead.
        transform(cur.index, spec, null);
        editor.blocks.insert("paragraph", { text: "" }, {}, cur.index + 1, true);
      } else {
        transform(cur.index, spec);
      }
      return;
    }
  }

  // ── Cmd/Ctrl+D — duplicate ────────────────────────────────────
  async function duplicateBlock() {
    const cur = currentBlock(editor);
    if (!cur) return;
    const saved = await cur.block.save();
    if (!saved) return;
    const data = { ...saved.data };
    if (saved.tool === "toggle") {
      // Toggle children bind to the parent's `fk` and `items` count — reset
      // both so the copy doesn't hijack the original block's descendants.
      delete data.fk;
      data.items = 0;
    }
    editor.blocks.insert(saved.tool, data, {}, cur.index + 1, true);
  }

  // ── Cmd/Ctrl+Shift+↑/↓ — move ─────────────────────────────────
  function moveBlock(delta: -1 | 1) {
    const cur = currentBlock(editor);
    if (!cur) return;
    const target = cur.index + delta;
    if (target < 0 || target >= editor.blocks.getBlocksCount()) return;
    editor.blocks.move(target, cur.index);
    requestAnimationFrame(() => editor.caret.setToBlock(target));
  }

  // ── Cmd/Ctrl+Alt+0..9 — turn into ─────────────────────────────
  async function turnInto(digit: string) {
    const build = TURN_DIGITS[digit];
    const cur = currentBlock(editor);
    if (!build || !cur) return;

    const spec = build("");
    if (cur.block.name === spec.type) return;

    // Prefer the native conversion — it preserves inline formatting for
    // compatible pairs (paragraph ↔ header ↔ quote). Tools without a
    // conversionConfig throw, so fall back to a manual rebuild.
    try {
      const overrides: Record<string, any> = {};
      if (spec.data.level) overrides.level = spec.data.level;
      await editor.blocks.convert(cur.block.id, spec.type, overrides);
      return;
    } catch {
      /* pair not convertible — rebuild below */
    }

    const saved = await cur.block.save();
    const text = extractBlockText(saved?.data);
    transform(cur.index, build(escapeInline(text)), "end");
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (handleSpaceTrigger()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return;
    }

    if (!(e.ctrlKey || e.metaKey)) return;

    // Cmd/Ctrl+Alt+digit — on macOS Option can turn e.key into a glyph (º, ¡),
    // so fall back to e.code for the physical digit.
    if (e.altKey) {
      const digit = /^[0-9]$/.test(e.key) ? e.key : e.code.match(/^Digit([0-9])$/)?.[1];
      if (digit) {
        e.preventDefault();
        turnInto(digit);
      }
      return;
    }

    if (e.altKey) return;

    if (e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      moveBlock(e.key === "ArrowUp" ? -1 : 1);
      return;
    }

    if (!e.shiftKey && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicateBlock();
    }
  }

  function onInput() {
    handleInstantTrigger();
  }

  redactor.addEventListener("keydown", onKeydown, true);
  redactor.addEventListener("input", onInput, true);

  return () => {
    redactor.removeEventListener("keydown", onKeydown, true);
    redactor.removeEventListener("input", onInput, true);
  };
}
