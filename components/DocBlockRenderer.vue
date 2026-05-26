<script setup lang="ts">
import { renderMarkdown } from "~/composables/useMarkdown";
import type { ApiDocBlock, ApiDocEndpoint } from "~/types/apiDocs";

interface Props {
  block: ApiDocBlock;
  baseUrl?: string | null;
  endpoints?: ApiDocEndpoint[];
}

const props = defineProps<Props>();

const findEndpoint = (requestId: string): ApiDocEndpoint | undefined => {
  if (!props.endpoints) return undefined;
  return props.endpoints.find((ep) => ep.id === requestId);
};

const renderBlockMarkdown = (content: string): string => {
  if (!content) return "";
  try {
    return renderMarkdown(content);
  } catch {
    return content;
  }
};
</script>

<template>
  <div class="doc-block">
    <!-- Markdown -->
    <div v-if="block.type === 'markdown'" class="markdown-block">
      <div v-html="renderBlockMarkdown(typeof block.content === 'string' ? block.content : '')"></div>
    </div>

    <!-- Image -->
    <div v-else-if="block.type === 'image'" class="image-block">
      <img
        :src="block.content?.url || block.content"
        :alt="block.content?.alt || ''"
        class="doc-image"
      />
      <p v-if="block.content?.caption" class="image-caption">
        {{ block.content.caption }}
      </p>
    </div>

    <!-- Table -->
    <div v-else-if="block.type === 'table'" class="table-block">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th
                v-for="header in (block.content?.headers || [])"
                :key="header"
              >
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in (block.content?.rows || [])" :key="i">
              <td v-for="(cell, j) in row" :key="j">
                {{ cell }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Endpoint Reference -->
    <ApiEndpointBlock
      v-else-if="block.type === 'endpoint_ref' && findEndpoint(block.content?.requestId || block.content)"
      :endpoint="findEndpoint(block.content?.requestId || block.content)!"
      :base-url="baseUrl"
    />

    <!-- Divider -->
    <hr v-else-if="block.type === 'divider'" class="doc-divider" />
  </div>
</template>

<style scoped>
.doc-block {
  margin-bottom: 24px;
}

.markdown-block {
  font-size: 14px;
  line-height: 1.7;
  color: var(--fg);
}

.markdown-block :deep(h1) {
  font-size: 22px;
  font-weight: 600;
  margin: 20px 0 12px;
  line-height: 1.3;
  color: var(--fg);
}

.markdown-block :deep(h2) {
  font-size: 18px;
  font-weight: 600;
  margin: 18px 0 10px;
  line-height: 1.35;
  color: var(--fg);
}

.markdown-block :deep(h3) {
  font-size: 16px;
  font-weight: 600;
  margin: 14px 0 8px;
  line-height: 1.4;
  color: var(--fg);
}

.markdown-block :deep(p) {
  margin: 0 0 12px;
}

.markdown-block :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-block :deep(ul) {
  list-style-type: disc;
  padding-left: 24px;
  margin: 0 0 12px;
}

.markdown-block :deep(ol) {
  list-style-type: decimal;
  padding-left: 24px;
  margin: 0 0 12px;
}

.markdown-block :deep(li) {
  margin: 4px 0;
}

.markdown-block :deep(code) {
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
}

.markdown-block :deep(pre) {
  background: var(--bg);
  padding: 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  overflow-x: auto;
  margin: 0 0 12px;
}

.markdown-block :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 13px;
}

.markdown-block :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.markdown-block :deep(strong) {
  font-weight: 600;
  color: var(--fg);
}

.markdown-block :deep(em) {
  font-style: italic;
}

.markdown-block :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius);
  margin: 8px 0 12px;
}

.markdown-block :deep(blockquote) {
  margin: 0 0 12px;
  padding: 12px 16px;
  background: var(--accent-soft);
  border-radius: var(--radius);
  border: 1px solid color-mix(in oklch, var(--accent) 20%, transparent);
}

.markdown-block :deep(blockquote p) {
  margin: 0;
}

.markdown-block :deep(hr) {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 24px 0;
}

.image-block {
  margin: 16px 0;
}

.doc-image {
  border-radius: var(--radius);
  border: 1px solid var(--border);
  max-width: 100%;
  height: auto;
  display: block;
}

.image-caption {
  font-size: 12px;
  color: var(--muted);
  margin-top: 8px;
  text-align: center;
}

.table-block {
  margin: 16px 0;
}

.table-wrap {
  overflow-x: auto;
}

.table-wrap table {
  width: 100%;
  font-size: 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
}

.table-wrap thead {
  background: var(--bg);
}

.table-wrap th {
  padding: 8px 12px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  border-bottom: 1px solid var(--border);
}

.table-wrap td {
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
  color: var(--fg);
  border-bottom: 1px solid var(--border);
}

.table-wrap tbody tr:last-child td {
  border-bottom: none;
}

.doc-divider {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 24px 0;
}
</style>
