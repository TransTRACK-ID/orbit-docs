<script setup lang="ts">
import { marked } from "marked";

interface Props {
  srs: string | null;
  fsd: string | null;
  sdd: string | null;
  appId?: string;
}

const props = defineProps<Props>();

const activeTab = ref<"srs" | "fsd" | "sdd">("srs");

const tabs = [
  { key: "srs" as const, label: "SRS" },
  { key: "fsd" as const, label: "FSD" },
  { key: "sdd" as const, label: "SDD" },
];

const currentContent = computed(() => {
  if (activeTab.value === "srs") return props.srs || "";
  if (activeTab.value === "fsd") return props.fsd || "";
  return props.sdd || "";
});

const renderedContent = computed(() => {
  const content = currentContent.value || "No content available";
  return marked.parse(content, { async: false });
});

const isCopied = ref(false);

async function copyContent() {
  try {
    await navigator.clipboard.writeText(currentContent.value);
    isCopied.value = true;
    setTimeout(() => (isCopied.value = false), 2000);
  } catch {
    // Fallback
  }
}

function downloadContent() {
  const blob = new Blob([currentContent.value], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${activeTab.value.toUpperCase()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Save as Document and open in Technical Editor ─────────────
const { createDoc } = useDocs();
const isSaving = ref(false);

async function saveAsDocument() {
  if (!props.appId) return;
  isSaving.value = true;
  try {
    const tabLabel = tabs.find((t) => t.key === activeTab.value)?.label || "Document";
    const doc = await createDoc({
      title: `${tabLabel} — Generated`,
      appId: props.appId,
      content: currentContent.value,
      status: "draft",
      source: "generated",
      docType: activeTab.value,
    });
    await navigateTo(`/docs/${doc.id}`);
  } catch {
    // Error handled by composable
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="result-viewer">
    <div class="result-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>

      <div class="tab-actions">
        <button class="btn btn-primary btn-sm" @click="saveAsDocument">
          <span v-if="isSaving">Saving…</span>
          <span v-else>Open in Technical Editor</span>
        </button>
        <button class="btn btn-ghost btn-sm" @click="copyContent">
          <span v-if="isCopied">Copied!</span>
          <span v-else>Copy</span>
        </button>
        <button class="btn btn-ghost btn-sm" @click="downloadContent">
          Download
        </button>
      </div>
    </div>

    <div class="result-body">
      <div class="result-content">
        <div class="markdown-body" v-html="renderedContent" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-viewer {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.result-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.tab-btn {
  padding: 6px 12px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-btn:hover {
  color: var(--fg);
  background: var(--fg-soft);
}

.tab-btn.active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent-soft);
}

.tab-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.result-body {
  display: flex;
  gap: 0;
  min-height: 400px;
}

.result-content {
  padding: 24px;
  max-height: 70vh;
  overflow-y: auto;
  flex: 1;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: var(--muted);
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn:hover {
  color: var(--fg);
  border-color: var(--fg);
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.btn-primary {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}

.btn-primary:hover {
  background: color-mix(in oklch, var(--accent) 88%, black);
}

/* Markdown styling */
:deep(.markdown-body) {
  font-size: 14px;
  line-height: 1.6;
  color: var(--fg);
}

:deep(.markdown-body h1) {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

:deep(.markdown-body h2) {
  font-size: 20px;
  font-weight: 600;
  margin: 24px 0 12px;
}

:deep(.markdown-body h3) {
  font-size: 16px;
  font-weight: 600;
  margin: 20px 0 10px;
}

:deep(.markdown-body p) {
  margin: 0 0 12px;
}

:deep(.markdown-body ul, .markdown-body ol) {
  margin: 0 0 12px;
  padding-left: 24px;
}

:deep(.markdown-body li) {
  margin-bottom: 4px;
}

:deep(.markdown-body code) {
  background: var(--fg-soft);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
}

:deep(.markdown-body pre) {
  background: var(--bg);
  padding: 16px;
  border-radius: var(--radius);
  overflow-x: auto;
  margin: 12px 0;
  border: 1px solid var(--border);
}

:deep(.markdown-body pre code) {
  background: none;
  padding: 0;
}

:deep(.markdown-body table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}

:deep(.markdown-body th, .markdown-body td) {
  padding: 8px 12px;
  text-align: left;
  border: 1px solid var(--border);
}

:deep(.markdown-body th) {
  background: var(--bg);
  font-weight: 600;
}

:deep(.markdown-body blockquote) {
  margin: 12px 0;
  padding: 8px 16px;
  border-left: 3px solid var(--accent);
  background: var(--fg-soft);
  color: var(--muted);
}

:deep(.markdown-body hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 20px 0;
}

:deep(.markdown-body a) {
  color: var(--accent);
  text-decoration: none;
}

:deep(.markdown-body a:hover) {
  text-decoration: underline;
}
</style>
