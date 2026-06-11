<script setup lang="ts">
import { renderMarkdown } from "~/composables/useMarkdown";
import type { DocGenerationRepoResult } from "~/composables/useDocGenerator";

interface Props {
  srs: string | null;
  fsd: string | null;
  sdd: string | null;
  appId?: string;
  repoResults?: DocGenerationRepoResult[];
}

const props = defineProps<Props>();

function getContentForTab(key: string): string {
  if (key === "srs") return props.srs || "";
  if (key === "fsd") return props.fsd || "";
  if (key === "sdd") return props.sdd || "";
  if (key.startsWith("sdd:")) {
    const id = key.slice(4);
    const repo = props.repoResults?.find((r) => r.id === id);
    return repo?.sdd || "";
  }
  return "";
}

function hasTabContent(key: string): boolean {
  return getContentForTab(key).trim().length > 0;
}

// Tab keys: "srs" (shown as PRD), "fsd", and one per repo SDD ("sdd:<id>"),
// or a single "sdd" tab when there are no per-repo results.
// Only tabs with non-empty content are shown.
const tabs = computed(() => {
  const base = [
    { key: "srs", label: "PRD" },
    { key: "fsd", label: "FSD" },
  ];
  if (props.repoResults && props.repoResults.length > 0) {
    for (const r of props.repoResults) {
      const name = r.repoUrl.replace(/\.git$/, "").split("/").pop() || "repo";
      base.push({ key: `sdd:${r.id}`, label: `SDD · ${name}` });
    }
  } else {
    base.push({ key: "sdd", label: "SDD" });
  }
  return base.filter((tab) => hasTabContent(tab.key));
});

const activeTab = ref<string>("");

watch(
  tabs,
  (visibleTabs) => {
    if (visibleTabs.length === 0) {
      activeTab.value = "";
      return;
    }
    if (!visibleTabs.some((t) => t.key === activeTab.value)) {
      activeTab.value = visibleTabs[0].key;
    }
  },
  { immediate: true },
);

const activeRepoResult = computed<DocGenerationRepoResult | null>(() => {
  if (!activeTab.value.startsWith("sdd:")) return null;
  const id = activeTab.value.slice(4);
  return props.repoResults?.find((r) => r.id === id) || null;
});

const currentContent = computed(() => getContentForTab(activeTab.value));

const currentDocType = computed<"srs" | "fsd" | "sdd">(() => {
  if (activeTab.value === "srs") return "srs";
  if (activeTab.value === "fsd") return "fsd";
  return "sdd";
});

const renderedContent = computed(() => {
  const content = currentContent.value.trim();
  if (!content) return "";
  return renderMarkdown(content);
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
  a.download = `${currentDocType.value.toUpperCase()}.md`;
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
    const tabLabel = tabs.value.find((t) => t.key === activeTab.value)?.label || "Document";
    const doc = await createDoc({
      title: `${tabLabel} — Generated`,
      appId: props.appId,
      content: currentContent.value,
      status: "draft",
      source: "generated",
      docType: currentDocType.value,
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
    <div v-if="tabs.length > 0" class="result-tabs">
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

    <div v-if="activeRepoResult" class="repo-banner">
      <span class="repo-banner-label">{{ activeRepoResult.repoUrl }}</span>
      <span v-if="activeRepoResult.repoRef" class="repo-banner-ref">{{ activeRepoResult.repoRef }}</span>
      <a
        v-if="activeRepoResult.prUrl"
        :href="activeRepoResult.prUrl"
        target="_blank"
        rel="noopener"
        class="repo-banner-pr"
      >
        View Pull Request ↗
      </a>
      <span v-else-if="activeRepoResult.status === 'failed'" class="repo-banner-error">
        {{ activeRepoResult.errorMessage || 'SDD generation failed' }}
      </span>
      <span v-else class="repo-banner-muted">No PR (no access token configured)</span>
    </div>

    <div class="result-body">
      <div v-if="tabs.length === 0" class="result-empty">
        No documents with content were generated.
      </div>
      <div v-else class="result-content">
        <MermaidHtml class="markdown-body" :html="renderedContent" />
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

.repo-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  font-size: 12px;
}

.repo-banner-label {
  font-family: var(--font-mono);
  color: var(--fg);
  word-break: break-all;
}

.repo-banner-ref {
  font-family: var(--font-mono);
  background: color-mix(in oklch, var(--fg) 8%, transparent);
  color: var(--muted);
  padding: 1px 6px;
  border-radius: 4px;
}

.repo-banner-pr {
  margin-left: auto;
  color: var(--accent);
  font-weight: 600;
  text-decoration: none;
}

.repo-banner-pr:hover {
  text-decoration: underline;
}

.repo-banner-muted {
  margin-left: auto;
  color: var(--muted);
}

.repo-banner-error {
  margin-left: auto;
  color: oklch(50% 0.16 25);
}

.result-body {
  display: flex;
  gap: 0;
  min-height: 400px;
}

.result-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 48px 24px;
  color: var(--muted);
  font-size: 14px;
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
