<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import type { EditorJsData } from "~/composables/useEditorJsConverter";

interface Props {
  modelValue?: string; // markdown string
  placeholder?: string;
  readOnly?: boolean;
  autofocus?: boolean;
  minHeight?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  placeholder: "Let\'s write an awesome story!",
  readOnly: false,
  autofocus: false,
  minHeight: "300px",
});

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "change", data: EditorJsData, markdown: string): void;
  (e: "ready"): void;
}>();

const editorContainer = ref<HTMLDivElement | null>(null);
const editorInstance = ref<any>(null);
const isReady = ref(false);
const dragDropInstance = ref<any>(null);
const undoInstance = ref<any>(null);

// ── Import Editor.js dynamically (client-only) ─────────────────
async function initEditor() {
  if (!editorContainer.value) return;
  if (typeof window === "undefined") return;

  const [
    { default: EditorJS },
    { default: Header },
    { default: List },
    { default: NestedList },
    { default: Paragraph },
    { default: Code },
    { default: Quote },
    { default: Table },
    { default: Image },
    { default: LinkTool },
    { default: Marker },
    { default: Checklist },
    { default: InlineCode },
    { default: Embed },
    { default: Delimiter },
    { default: Warning },
    { default: ToggleBlock },
    { default: ColorPlugin },
    { default: TextVariantTune },
    { default: MermaidTool },
    { default: AlignmentTune },
    { default: IndentTune },
    { default: InlineImage },
    { default: DragDrop },
    { default: Undo },
  ] = await Promise.all([
    import("@editorjs/editorjs"),
    import("@editorjs/header"),
    import("@editorjs/list"),
    import("@editorjs/nested-list"),
    import("@editorjs/paragraph"),
    import("@editorjs/code"),
    import("@editorjs/quote"),
    import("@editorjs/table"),
    import("@editorjs/image"),
    import("@editorjs/link"),
    import("@editorjs/marker"),
    import("@editorjs/checklist"),
    import("@editorjs/inline-code"),
    import("@editorjs/embed"),
    import("@editorjs/delimiter"),
    import("@editorjs/warning"),
    import("editorjs-toggle-block"),
    import("editorjs-text-color-plugin"),
    import("@editorjs/text-variant-tune"),
    import("editorjs-mermaid"),
    import("editorjs-text-alignment-blocktune"),
    import("editorjs-indent-tune"),
    import("editorjs-inline-image"),
    import("editorjs-drag-drop"),
    import("editorjs-undo"),
  ]);

  // Convert initial markdown to Editor.js data
  const { markdownToEditorJs } = await import("~/composables/useEditorJsConverter");
  const initialData = markdownToEditorJs(props.modelValue || "");

  const editor = new EditorJS({
    holder: editorContainer.value,
    tools: {
      header: {
        class: Header,
        config: { placeholder: "Enter a header", levels: [1, 2, 3], defaultLevel: 2 },
      },
      paragraph: {
        class: Paragraph,
        config: { placeholder: props.placeholder },
      },
      list: { class: List, config: { defaultStyle: "unordered" } },
      nestedList: { class: NestedList, config: { defaultStyle: "unordered" } },
      checklist: { class: Checklist },
      code: { class: Code, config: { placeholder: "Enter code" } },
      quote: { class: Quote, config: { placeholder: "Enter a quote", captionPlaceholder: "Author" } },
      table: { class: Table },
      image: {
        class: Image,
        config: {
          placeholder: "Paste image URL",
          captionPlaceholder: "Image caption",
        },
      },
      link: { class: LinkTool },
      marker: { class: Marker },
      inlineCode: { class: InlineCode },
      embed: { class: Embed },
      delimiter: { class: Delimiter },
      warning: { class: Warning, config: { titlePlaceholder: "Title", messagePlaceholder: "Message" } },
      toggle: {
        class: ToggleBlock,
        config: { placeholder: "Toggle title" },
      },
      color: {
        class: ColorPlugin,
        config: {
          colorCollections: ["#FF1300", "#FFAF00", "#ECECD7", "#00D08A", "#2C9EEC", "#8C00FF", "#FF4D4D", "#FFB84D", "#4D94FF", "#B84DFF", "#FF4DB8", "#4DFFB8", "#000000", "#333333", "#666666", "#999999", "#CCCCCC", "#FFFFFF"],
          defaultColor: "#FF1300",
          type: "text",
        },
      },
      mermaid: {
        class: MermaidTool,
        config: { placeholder: "Enter Mermaid diagram code" },
      },
      inlineImage: {
        class: InlineImage,
        config: {
          embed: {
            display: true,
          },
          unsplash: {
            appName: "OrbitDocs",
            clientId: "",
          },
        },
      },
    },
    tunes: {
      textVariant: TextVariantTune,
      alignment: {
        class: AlignmentTune,
        config: {
          default: "left",
        },
      },
      indent: {
        class: IndentTune,
        config: {
          tuneName: "indent",
        },
      },
    },
    data: initialData,
    placeholder: props.placeholder || "Type '/' for commands, or start writing…",
    readOnly: props.readOnly,
    autofocus: props.autofocus,
    minHeight: props.minHeight,
    onReady: () => {
      isReady.value = true;
      // Drag & drop block reordering (Notion-style) — borderStyle:'none' suppresses the dashed line the plugin injects via inline styles
      dragDropInstance.value = new DragDrop(editor, 'none');
      // Undo / redo (Ctrl+Z / Ctrl+Shift+Z)
      undoInstance.value = new Undo({ editor });
      emit("ready");
    },
    onChange: async () => {
      const output = await editor.save();
      const { editorJsToMarkdown } = await import("~/composables/useEditorJsConverter");
      const markdown = editorJsToMarkdown(output);
      emit("update:modelValue", markdown);
      emit("change", output, markdown);
    },
  });

  editorInstance.value = editor;
}

// ── Watch modelValue changes from parent ─────────────────────
watch(() => props.modelValue, async (newVal) => {
  if (!editorInstance.value || !isReady.value) return;
  const current = await editorInstance.value.save();
  const { editorJsToMarkdown } = await import("~/composables/useEditorJsConverter");
  const currentMd = editorJsToMarkdown(current);
  if (currentMd !== newVal) {
    // Re-initialize with new data
    const { markdownToEditorJs } = await import("~/composables/useEditorJsConverter");
    await editorInstance.value.render(markdownToEditorJs(newVal || ""));
  }
});

// ── Lifecycle ─────────────────────────────────────────────────
onMounted(() => {
  nextTick(() => initEditor());
});

onBeforeUnmount(() => {
  if (dragDropInstance.value) {
    dragDropInstance.value = null;
  }
  if (undoInstance.value) {
    undoInstance.value = null;
  }
  if (editorInstance.value) {
    editorInstance.value.destroy();
    editorInstance.value = null;
  }
});

// ── Expose methods ────────────────────────────────────────────
defineExpose({
  async getData(): Promise<EditorJsData> {
    if (!editorInstance.value) return { blocks: [] };
    return editorInstance.value.save();
  },
  async getMarkdown(): Promise<string> {
    const data = await this.getData();
    const { editorJsToMarkdown } = await import("~/composables/useEditorJsConverter");
    return editorJsToMarkdown(data);
  },
});
</script>

<template>
  <div class="editor-js-wrapper">
    <div ref="editorContainer" class="editor-js-container" />
  </div>
</template>

<style>
/* Editor.js custom styling to match our design system */
.editor-js-wrapper {
  width: 100%;
  height: 100%;
}

.editor-js-container {
  width: 100%;
  height: 100%;
  padding: 16px;
  overflow: visible;
}

.editor-js-container .codex-editor {
  background: transparent;
}

.editor-js-container .codex-editor__redactor {
  padding-bottom: 100px !important;
  padding-left: 0 !important;
  padding-right: 24px !important;
  padding-top: 16px !important;
}

.editor-js-container .ce-block__content {
  max-width: 100%;
  margin: 0;
  padding: 0 16px 0 68px;
}

.editor-js-container .ce-toolbar__content {
  max-width: 100%;
  margin: 0;
}

/* Notion-style toolbar: overlay to the left of the block on hover */
.editor-js-container .ce-toolbar__actions {
  position: absolute;
  left: 12px;
  top: 0px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 1;
}

.editor-js-container .ce-block:hover ~ .ce-toolbar .ce-toolbar__actions,
.editor-js-container .ce-toolbar:hover .ce-toolbar__actions,
.editor-js-container .ce-toolbar--opened .ce-toolbar__actions {
  opacity: 1;
}

.editor-js-container .ce-toolbar__plus,
.editor-js-container .ce-toolbar__settings-btn {
  pointer-events: auto;
}

.editor-js-container .ce-header {
  font-family: inherit;
  color: var(--fg);
  padding: 0;
  margin: 0;
  line-height: 1.3;
}

.editor-js-container .ce-header.ce-header--h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 16px;
}

.editor-js-container .ce-header.ce-header--h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 24px 0 12px;
}

.editor-js-container .ce-header.ce-header--h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 20px 0 10px;
}

.editor-js-container .ce-paragraph {
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  color: var(--fg);
  padding: 0;
  margin: 0 0 12px;
}

.editor-js-container .ce-paragraph::before {
  color: var(--muted);
}

.editor-js-container .cdx-block {
  padding: 0;
  margin: 0;
}

.editor-js-container .ce-block {
  margin: 0;
  padding: 2px 0;
  border-radius: 4px;
  transition: background-color 0.1s ease;
}

.editor-js-container .ce-block:hover {
  background-color: color-mix(in oklch, var(--fg) 3%, transparent);
}

.editor-js-container .ce-block--focused {
  background: transparent;
}

.editor-js-container .ce-block--selected {
  background: var(--accent-soft);
}

.editor-js-container .ce-delimiter {
  color: var(--muted);
  margin: 16px 0;
}

.editor-js-container .cdx-list {
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  color: var(--fg);
  padding-left: 20px;
  margin: 8px 0;
}

.editor-js-container .cdx-list__item {
  padding: 2px 0;
}

.editor-js-container .cdx-checklist {
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  color: var(--fg);
  margin: 8px 0;
}

.editor-js-container .cdx-checklist__item {
  padding: 2px 0;
}

.editor-js-container .cdx-checklist__item-checkbox {
  border-color: var(--border);
  background: var(--surface);
}

.editor-js-container .cdx-checklist__item-checkbox--checked {
  background: var(--accent);
  border-color: var(--accent);
}

.editor-js-container .cdx-checklist__item-checkbox--checked svg path {
  stroke: var(--surface);
}

.editor-js-container .cdx-quote {
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  color: var(--fg);
  border-left: 3px solid var(--border);
  padding-left: 12px;
  margin: 8px 0;
  background: transparent;
}

.editor-js-container .cdx-quote__text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--muted);
  min-height: auto;
}

.editor-js-container .cdx-quote__caption {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
}

.editor-js-container .cdx-code {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  background: var(--bg);
  padding: 12px;
  border-radius: var(--radius);
  overflow: auto;
  margin: 8px 0;
  color: var(--fg);
}

.editor-js-container .tc-table {
  font-family: inherit;
  font-size: 14px;
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  margin: 8px 0;
}

.editor-js-container .tc-table__cell {
  border-color: var(--border);
  padding: 8px 12px;
}

.editor-js-container .tc-table__wrap {
  border: none;
}

.editor-js-container .cdx-warning {
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  color: var(--fg);
  background: color-mix(in oklch, oklch(75% 0.14 85) 8%, transparent);
  border: 1px solid color-mix(in oklch, oklch(75% 0.14 85) 20%, transparent);
  border-radius: var(--radius);
  padding: 12px;
  margin: 8px 0;
}

.editor-js-container .cdx-warning__title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  color: oklch(60% 0.12 85);
}

.editor-js-container .cdx-warning__message {
  font-size: 13px;
  color: var(--muted);
}

.editor-js-container .image-tool {
  font-family: inherit;
  margin: 16px 0;
}

.editor-js-container .image-tool__caption {
  font-size: 13px;
  color: var(--muted);
  margin-top: 8px;
  text-align: center;
}

.editor-js-container .ce-toolbar {
  background: none;
  border: none;
  border-radius: 0;
  box-shadow: none;
}

.editor-js-container .ce-toolbar__plus,
.editor-js-container .ce-toolbar__settings-btn {
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  padding: 0;
}

.editor-js-container .ce-toolbar__plus:hover,
.editor-js-container .ce-toolbar__settings-btn:hover {
  color: var(--fg);
  background: var(--fg-soft);
  transform: scale(1.08);
}

.editor-js-container .ce-popover {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 8px 24px color-mix(in oklch, var(--fg) 12%, transparent);
  color: var(--fg);
}

.editor-js-container .ce-popover-item {
  color: var(--fg);
}

.editor-js-container .ce-popover-item:hover {
  background: var(--fg-soft);
}

.editor-js-container .ce-popover-item-separator {
  background: var(--border);
}

.editor-js-container .ce-inline-toolbar {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 20px color-mix(in oklch, var(--fg) 12%, transparent);
  animation: editorFadeInUp 0.15s ease;
}

.editor-js-container .ce-inline-toolbar__toggler-and-button-wrapper {
  color: var(--fg);
}

.editor-js-container .ce-inline-tool {
  color: var(--muted);
}

.editor-js-container .ce-inline-tool:hover {
  color: var(--fg);
  background: var(--fg-soft);
}

.editor-js-container .ce-inline-tool--active {
  color: var(--accent);
}

.editor-js-container .ce-conversion-toolbar {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 30px color-mix(in oklch, var(--fg) 15%, transparent);
  padding: 6px;
  animation: editorFadeInUp 0.15s ease;
}

.editor-js-container .ce-conversion-tool {
  color: var(--fg);
  border-radius: 6px;
  transition: background 0.1s ease;
}

.editor-js-container .ce-conversion-tool:hover {
  background: var(--fg-soft);
  border-radius: 6px;
}

.editor-js-container .ce-conversion-tool--focused {
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 6px;
}

/* Drag & drop — drop target indicator */
.editor-js-container .ce-block--drop-target {
  background: color-mix(in oklch, var(--accent) 6%, transparent);
  border-radius: 4px;
}

/* Suppress the plugin's default dashed border and arrow pseudo-elements */
.ce-block--drop-target .ce-block__content::before,
.ce-block--drop-target .ce-block__content::after {
  display: none !important;
}

/* Drag handle (editorjs-drag-drop injects .drag-handle) */
.drag-handle {
  color: var(--muted);
  cursor: grab;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease;
}

.ce-block:hover .drag-handle {
  opacity: 1;
}

.drag-handle:hover {
  color: var(--fg);
}

.drag-handle:active {
  cursor: grabbing;
}

.editor-js-container .cdx-input {
  border-color: var(--border);
  background: var(--bg);
  color: var(--fg);
  font-family: inherit;
  font-size: 14px;
  border-radius: var(--radius);
  padding: 8px 12px;
}

.editor-js-container .cdx-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
  outline: none;
}

/* Toggle block styles */
.editor-js-container .cdx-toggle {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  margin: 8px 0;
  overflow: hidden;
}

.editor-js-container .cdx-toggle__title {
  padding: 12px 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg);
  font-size: 14px;
}

.editor-js-container .cdx-toggle__title::before {
  content: "▶";
  font-size: 10px;
  transition: transform 0.2s;
  color: var(--muted);
}

.editor-js-container .cdx-toggle--open .cdx-toggle__title::before {
  transform: rotate(90deg);
}

.editor-js-container .cdx-toggle__content {
  padding: 0 16px 16px 40px;
  display: none;
}

.editor-js-container .cdx-toggle--open .cdx-toggle__content {
  display: block;
}

/* Color plugin styles */
.editor-js-container .cdx-color {
  display: inline;
}

/* Text variant tune styles */
.editor-js-container .cdx-block[data-tune="text-variant"] {
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  border-radius: var(--radius);
  padding: 12px 16px;
  margin: 8px 0;
}

/* Mermaid diagram styles */
.editor-js-container .cdx-mermaid {
  margin: 16px 0;
  background: var(--bg);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  overflow: auto;
}

.editor-js-container .cdx-mermaid__textarea {
  width: 100%;
  min-height: 120px;
  padding: 12px;
  font-family: var(--font-mono);
  font-size: 13px;
  background: var(--bg);
  color: var(--fg);
  border: none;
  resize: vertical;
}

.editor-js-container .cdx-mermaid__preview {
  padding: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100px;
}

.editor-js-container .cdx-mermaid__preview svg {
  max-width: 100%;
}

/* Inline image styles */
.editor-js-container .cdx-inline-image {
  margin: 16px 0;
  max-width: 100%;
}

.editor-js-container .cdx-inline-image__picture img {
  max-width: 100%;
  border-radius: var(--radius);
}

/* Alignment tune styles */
.editor-js-container .ce-block[data-align="center"] .ce-block__content {
  text-align: center;
}

.editor-js-container .ce-block[data-align="right"] .ce-block__content {
  text-align: right;
}

.editor-js-container .ce-block[data-align="justify"] .ce-block__content {
  text-align: justify;
}

/* Indent tune styles */
.editor-js-container .ce-block[data-indent="1"] .ce-block__content {
  padding-left: 24px;
}

.editor-js-container .ce-block[data-indent="2"] .ce-block__content {
  padding-left: 48px;
}

.editor-js-container .ce-block[data-indent="3"] .ce-block__content {
  padding-left: 72px;
}

/* Hide default placeholder when we have content */
.editor-js-container .codex-editor--empty .codex-editor__redactor::before {
  opacity: 0.5;
  color: var(--muted);
  font-size: 14px;
  font-family: inherit;
}

/* Shared fade-in-up animation for all editor overlays */
@keyframes editorFadeInUp {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scrollbar styling */
.editor-js-container .codex-editor__redactor::-webkit-scrollbar {
  width: 8px;
}

.editor-js-container .codex-editor__redactor::-webkit-scrollbar-track {
  background: transparent;
}

.editor-js-container .codex-editor__redactor::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}

.editor-js-container .codex-editor__redactor::-webkit-scrollbar-thumb:hover {
  background: var(--muted);
}

</style>
