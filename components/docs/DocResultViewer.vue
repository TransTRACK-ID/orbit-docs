<script setup lang="ts">
import { renderMarkdown } from "~/composables/useMarkdown";
import type { DocGenerationRepoResult } from "~/composables/useDocGenerator";
import type { GenerationReviewStatus } from "~/composables/useDocGenerationCollaboration";
import {
  buildGeneratedDocLinkMap,
  buildGeneratedDocLinkSources,
  resolveGeneratedDocTab,
} from "~/utils/generated-doc-links";

interface Props {
  srs: string | null;
  fsd: string | null;
  gitSnapshot?: string | null;
  sdd: string | null;
  appId?: string;
  jobId?: string;
  repoResults?: DocGenerationRepoResult[];
  readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
});

const appIdRef = computed(() => props.appId || "");
const jobIdRef = computed(() => props.jobId || null);

const collaborationEnabled = computed(() => Boolean(props.jobId && props.appId && !props.readonly));

const {
  isLoading: collabLoading,
  isSaving: collabSaving,
  reviewForDoc,
  commentsForDoc,
  openCommentCount,
  addComment,
  setCommentStatus,
  setReviewStatus,
} = useDocGenerationCollaboration(appIdRef, jobIdRef);

function getContentForTab(key: string): string {
  if (key === "srs") return props.srs || "";
  if (key === "fsd") return props.fsd || "";
  if (key === "git_snapshot") return props.gitSnapshot || "";
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

function shortRepoLabel(url: string): string {
  const trimmed = url.replace(/\.git$/, "");
  try {
    const parsed = new URL(trimmed);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) return parts.slice(-2).join("/");
    if (parts.length === 1) return parts[0];
    return parsed.hostname;
  } catch {
    const parts = trimmed.split("/").filter(Boolean);
    return parts.slice(-2).join("/") || trimmed;
  }
}

const tabs = computed(() => {
  const base: { key: string; label: string; group: "product" | "snapshot" | "sdd" }[] = [
    { key: "srs", label: "SRS", group: "product" },
    { key: "fsd", label: "FSD", group: "product" },
    { key: "git_snapshot", label: "Git snapshot", group: "snapshot" },
    { key: "sdd", label: "SDD index", group: "sdd" },
  ];
  if (props.repoResults && props.repoResults.length > 0) {
    for (const r of props.repoResults) {
      base.push({
        key: `sdd:${r.id}`,
        label: shortRepoLabel(r.repoUrl),
        group: "sdd",
      });
    }
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

const activeTabMeta = computed(() => tabs.value.find((t) => t.key === activeTab.value) || null);

const activeRepoResult = computed<DocGenerationRepoResult | null>(() => {
  if (!activeTab.value.startsWith("sdd:")) return null;
  const id = activeTab.value.slice(4);
  return props.repoResults?.find((r) => r.id === id) || null;
});

const currentContent = computed(() => getContentForTab(activeTab.value));

const currentDocType = computed<"srs" | "fsd" | "sdd" | undefined>(() => {
  if (activeTab.value === "srs") return "srs";
  if (activeTab.value === "fsd") return "fsd";
  if (activeTab.value === "sdd" || activeTab.value.startsWith("sdd:")) return "sdd";
  return undefined;
});

const downloadFilename = computed(() => {
  if (activeTab.value === "git_snapshot") return "GIT-SNAPSHOT.md";
  if (activeTab.value === "sdd") return "SDD.md";
  if (activeTab.value.startsWith("sdd:")) {
    const name = activeRepoResult.value
      ? shortRepoLabel(activeRepoResult.value.repoUrl).replace(/\//g, "-")
      : "repo";
    return `SDD-${name}.md`;
  }
  if (currentDocType.value) return `${currentDocType.value.toUpperCase()}.md`;
  return "document.md";
});

function repoNameFromUrl(url: string): string {
  const trimmed = url.replace(/\.git$/, "");
  const parts = trimmed.split("/").filter(Boolean);
  return parts[parts.length - 1] || "repo";
}

const docLinkMap = computed(() => {
  const repos = (props.repoResults || [])
    .filter((r) => hasTabContent(`sdd:${r.id}`))
    .map((r) => ({ id: r.id, repoName: repoNameFromUrl(r.repoUrl) }));

  const sources = buildGeneratedDocLinkSources({
    availableTabs: tabs.value.map((t) => t.key),
    repos,
  });
  return buildGeneratedDocLinkMap(sources);
});

function patchInternalDocLinks(html: string): string {
  return html.replace(/<a\s+href="([^"]+)"([^>]*)>/gi, (match, href, rest) => {
    const tabKey = resolveGeneratedDocTab(href, docLinkMap.value);
    if (!tabKey) return match;
    return `<a href="#" data-gen-tab="${tabKey}" class="gen-doc-link"${rest}>`;
  });
}

const renderedContent = computed(() => {
  const content = currentContent.value.trim();
  if (!content) return "";
  return patchInternalDocLinks(renderMarkdown(content));
});

const wordCount = computed(() => {
  const text = currentContent.value.trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
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
  a.download = downloadFilename.value;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const { createDoc } = useDocs();
const isSaving = ref(false);

async function saveAsDocument() {
  if (!props.appId || props.readonly) return;
  isSaving.value = true;
  try {
    const tabLabel = activeTabMeta.value?.label || "Document";
    const doc = await createDoc({
      title: `${tabLabel} — Generated`,
      appId: props.appId,
      content: currentContent.value,
      status: "draft",
      source: "generated",
      ...(currentDocType.value ? { docType: currentDocType.value } : {}),
    });
    await navigateTo(`/docs/${doc.id}`);
  } catch {
    // Error handled by composable
  } finally {
    isSaving.value = false;
  }
}

function selectTab(key: string) {
  activeTab.value = key;
}

const proseRef = ref<HTMLElement | null>(null);

function handleProseClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest("a");
  if (!anchor) return;

  const tabFromData = anchor.getAttribute("data-gen-tab");
  if (tabFromData && tabs.value.some((t) => t.key === tabFromData)) {
    event.preventDefault();
    selectTab(tabFromData);
    return;
  }

  const href = anchor.getAttribute("href");
  if (!href) return;
  const tabKey = resolveGeneratedDocTab(href, docLinkMap.value);
  if (!tabKey) return;

  event.preventDefault();
  selectTab(tabKey);
}

watch(activeTab, () => {
  proseRef.value?.scrollTo({ top: 0, behavior: "smooth" });
});

const activeReviewStatus = computed(() => reviewForDoc(activeTab.value));
const activeComments = computed(() => commentsForDoc(activeTab.value));

async function handleAddComment(payload: { text: string; quote: string | null }) {
  await addComment(activeTab.value, payload.text, payload.quote);
}

async function handleReviewStatus(status: GenerationReviewStatus) {
  await setReviewStatus(activeTab.value, status);
}

async function handleResolveComment(commentId: string) {
  await setCommentStatus(commentId, "resolved");
}

async function handleReopenComment(commentId: string) {
  await setCommentStatus(commentId, "open");
}
</script>

<template>
  <div class="result-viewer">
    <template v-if="tabs.length > 0">
      <div class="viewer-toolbar">
        <nav class="doc-tabs" aria-label="Generated document types">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            role="tab"
            class="doc-tab"
            :class="{ active: activeTab === tab.key, 'doc-tab--repo': tab.key.startsWith('sdd:') }"
            :aria-selected="activeTab === tab.key"
            @click="selectTab(tab.key)"
          >
            <span v-if="tab.key.startsWith('sdd:')" class="doc-tab-prefix">SDD</span>
            {{ tab.label }}
            <span
              v-if="collaborationEnabled && openCommentCount(tab.key) > 0"
              class="doc-tab-badge"
              :title="`${openCommentCount(tab.key)} open comment(s)`"
            >
              {{ openCommentCount(tab.key) }}
            </span>
          </button>
        </nav>

        <div class="viewer-toolbar-foot">
          <div class="viewer-meta">
            <span class="viewer-meta-label">{{ activeTabMeta?.label }}</span>
            <span v-if="wordCount > 0" class="viewer-meta-stat">{{ wordCount.toLocaleString() }} words</span>
          </div>
          <div class="viewer-actions">
            <button
              v-if="!readonly && appId"
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="isSaving"
              @click="saveAsDocument"
            >
              <span v-if="isSaving">Saving…</span>
              <span v-else>Open in editor</span>
            </button>
            <button type="button" class="btn btn-ghost btn-sm" @click="copyContent">
              {{ isCopied ? "Copied" : "Copy" }}
            </button>
            <button type="button" class="btn btn-ghost btn-sm" @click="downloadContent">
              Download
            </button>
          </div>
        </div>
      </div>

      <div v-if="activeRepoResult" class="repo-meta">
        <div class="repo-meta-main">
          <span class="repo-meta-name">{{ shortRepoLabel(activeRepoResult.repoUrl) }}</span>
          <code v-if="activeRepoResult.repoRef" class="repo-meta-ref">{{ activeRepoResult.repoRef }}</code>
        </div>
        <div class="repo-meta-status">
          <a
            v-if="activeRepoResult.prUrl"
            :href="activeRepoResult.prUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="repo-meta-link"
          >
            View pull request
          </a>
          <span v-else-if="activeRepoResult.status === 'failed'" class="repo-meta-error">
            {{ activeRepoResult.errorMessage || "SDD generation failed" }}
          </span>
          <span v-else class="repo-meta-muted">No PR opened (token not configured)</span>
        </div>
      </div>
    </template>

    <div class="viewer-body" :class="{ 'viewer-body--split': collaborationEnabled && tabs.length > 0 }">
      <div v-if="tabs.length === 0" class="viewer-empty">
        <p class="viewer-empty-title">No documents generated</p>
        <p class="viewer-empty-desc">The job finished without markdown output. Check agent logs for errors.</p>
      </div>
      <template v-else>
        <div ref="proseRef" class="viewer-prose-wrap" @click="handleProseClick">
          <MermaidHtml class="markdown-body" :html="renderedContent" />
        </div>
        <DocGenerationReviewPanel
          v-if="collaborationEnabled && activeTabMeta"
          :doc-key="activeTab"
          :doc-label="activeTabMeta.label"
          :review-status="activeReviewStatus"
          :comments="activeComments"
          :is-loading="collabLoading"
          :is-saving="collabSaving"
          @update:review-status="handleReviewStatus"
          @add-comment="handleAddComment"
          @resolve-comment="handleResolveComment"
          @reopen-comment="handleReopenComment"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.result-viewer {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.viewer-toolbar {
  border-bottom: 1px solid var(--border);
  background: color-mix(in oklch, var(--fg) 2.5%, var(--surface));
}

.doc-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  overflow-x: auto;
  scrollbar-width: thin;
}

.doc-tabs::-webkit-scrollbar {
  height: 4px;
}

.doc-tab {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  transition:
    color 0.15s cubic-bezier(0.25, 1, 0.5, 1),
    background 0.15s cubic-bezier(0.25, 1, 0.5, 1),
    border-color 0.15s cubic-bezier(0.25, 1, 0.5, 1);
}

.doc-tab:hover {
  color: var(--fg);
  background: color-mix(in oklch, var(--fg) 6%, transparent);
}

.doc-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.doc-tab.active {
  color: var(--fg);
  background: var(--surface);
  border-color: var(--border);
  box-shadow: 0 1px 2px color-mix(in oklch, var(--fg) 8%, transparent);
}

.doc-tab-prefix {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.doc-tab.active .doc-tab-prefix {
  color: var(--accent);
}

.viewer-toolbar-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  border-top: 1px solid color-mix(in oklch, var(--border) 80%, transparent);
}

.viewer-meta {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.viewer-meta-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
}

.viewer-meta-stat {
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.viewer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.repo-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in oklch, var(--fg) 3%, var(--bg));
  font-size: 12px;
}

.repo-meta-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.repo-meta-name {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.repo-meta-ref {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
  background: color-mix(in oklch, var(--fg) 7%, transparent);
  padding: 2px 7px;
  border-radius: 4px;
}

.repo-meta-status {
  flex-shrink: 0;
  text-align: right;
}

.repo-meta-link {
  color: var(--accent);
  font-weight: 500;
  text-decoration: none;
}

.repo-meta-link:hover {
  text-decoration: underline;
}

.repo-meta-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}

.repo-meta-muted {
  color: var(--muted);
}

.repo-meta-error {
  color: oklch(50% 0.14 25);
  max-width: 280px;
  text-align: right;
  line-height: 1.4;
}

.viewer-body {
  flex: 1;
  min-height: 360px;
  background: var(--surface);
}

.viewer-body--split {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  min-height: 0;
}

.viewer-body--split .viewer-prose-wrap {
  flex: 1;
  min-width: 0;
}

.doc-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  background: color-mix(in oklch, oklch(55% 0.16 25) 14%, var(--surface));
  color: oklch(50% 0.14 25);
}

.viewer-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 280px;
  padding: 48px 24px;
  text-align: center;
}

.viewer-empty-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
}

.viewer-empty-desc {
  margin: 0;
  max-width: 36ch;
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted);
}

.viewer-prose-wrap {
  padding: 28px 32px 36px;
  max-height: min(70vh, 720px);
  overflow-y: auto;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: var(--muted);
  transition:
    color 0.15s cubic-bezier(0.25, 1, 0.5, 1),
    background 0.15s cubic-bezier(0.25, 1, 0.5, 1),
    border-color 0.15s cubic-bezier(0.25, 1, 0.5, 1);
}

.btn:hover:not(:disabled) {
  color: var(--fg);
  background: color-mix(in oklch, var(--fg) 5%, transparent);
}

.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 5px 10px;
}

.btn-primary {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}

.btn-primary:hover:not(:disabled) {
  background: color-mix(in oklch, var(--accent) 88%, black);
}

.btn-ghost {
  border-color: transparent;
  background: transparent;
}

:deep(.markdown-body) {
  max-width: 72ch;
  margin: 0 auto;
  font-size: 14px;
  line-height: 1.65;
  color: var(--fg);
}

:deep(.markdown-body h1) {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
  letter-spacing: -0.01em;
}

:deep(.markdown-body h2) {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 1.75rem 0 0.75rem;
  letter-spacing: -0.01em;
}

:deep(.markdown-body h3) {
  font-size: 1rem;
  font-weight: 600;
  margin: 1.5rem 0 0.5rem;
}

:deep(.markdown-body p) {
  margin: 0 0 0.85rem;
}

:deep(.markdown-body ul) {
  margin: 0 0 0.85rem;
  padding-left: 1.35rem;
  list-style-type: disc;
  list-style-position: outside;
}

:deep(.markdown-body ol) {
  margin: 0 0 0.85rem;
  padding-left: 1.35rem;
  list-style-type: decimal;
  list-style-position: outside;
}

:deep(.markdown-body li) {
  display: list-item;
  margin-bottom: 0.35rem;
}

:deep(.markdown-body li > p) {
  margin-bottom: 0.35rem;
}

:deep(.markdown-body ul ul) {
  margin-top: 0.35rem;
  margin-bottom: 0;
  list-style-type: circle;
}

:deep(.markdown-body ol ol) {
  list-style-type: lower-alpha;
}

:deep(.markdown-body code) {
  background: color-mix(in oklch, var(--fg) 7%, transparent);
  padding: 0.1em 0.35em;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.92em;
}

:deep(.markdown-body pre) {
  background: color-mix(in oklch, var(--fg) 4%, var(--bg));
  padding: 14px 16px;
  border-radius: var(--radius);
  overflow-x: auto;
  margin: 0.85rem 0 1rem;
  border: 1px solid var(--border);
}

:deep(.markdown-body pre code) {
  background: none;
  padding: 0;
  font-size: 12px;
  line-height: 1.55;
}

:deep(.markdown-body table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.85rem 0 1rem;
  font-size: 13px;
}

:deep(.markdown-body th),
:deep(.markdown-body td) {
  padding: 8px 12px;
  text-align: left;
  border: 1px solid var(--border);
  vertical-align: top;
}

:deep(.markdown-body th) {
  background: color-mix(in oklch, var(--fg) 4%, var(--surface));
  font-weight: 600;
}

:deep(.markdown-body blockquote) {
  margin: 0.85rem 0;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in oklch, var(--fg) 4%, var(--surface));
  color: var(--muted);
}

:deep(.markdown-body hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 1.5rem 0;
}

:deep(.markdown-body a) {
  color: var(--accent);
  text-decoration: none;
}

:deep(.markdown-body a:hover) {
  text-decoration: underline;
}

:deep(.markdown-body a.gen-doc-link) {
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

:deep(.markdown-body a.gen-doc-link:hover) {
  color: color-mix(in oklch, var(--accent) 85%, var(--fg));
}

@media (max-width: 960px) {
  .viewer-body--split {
    flex-direction: column;
  }
}

@media (max-width: 720px) {
  .viewer-toolbar-foot {
    flex-direction: column;
    align-items: stretch;
  }

  .viewer-actions {
    justify-content: flex-end;
  }

  .repo-meta {
    flex-direction: column;
    align-items: flex-start;
  }

  .repo-meta-status {
    text-align: left;
  }

  .repo-meta-error {
    max-width: none;
    text-align: left;
  }

  .viewer-prose-wrap {
    padding: 20px 16px 28px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .doc-tab,
  .btn {
    transition: none;
  }
}
</style>
