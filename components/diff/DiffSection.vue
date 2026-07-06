<script setup lang="ts">
import type { DiffSection as DiffSectionType } from "~/types/diff";
import { computeSplitRows, computeUnifiedLines } from "~/utils/diff-lines";

const props = defineProps<{
  section: DiffSectionType;
  mode: "unified" | "split";
}>();

const unifiedLines = computed(() => computeUnifiedLines(props.section.from, props.section.to));
const splitRows = computed(() => computeSplitRows(props.section.from, props.section.to));
</script>

<template>
  <div class="diff-section">
    <h4 class="diff-section-title">{{ section.label }}</h4>
    <div v-if="mode === 'unified'" class="diff-unified" role="region" :aria-label="`${section.label} diff`">
      <div
        v-for="(line, idx) in unifiedLines"
        :key="idx"
        class="diff-line"
        :class="`diff-line-${line.kind}`"
      >
        <span class="diff-gutter" aria-hidden="true">{{ line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " " }}</span>
        <span class="diff-line-num" aria-hidden="true">
          <template v-if="line.oldLineNumber">{{ line.oldLineNumber }}</template>
          <template v-else-if="line.newLineNumber">{{ line.newLineNumber }}</template>
        </span>
        <code class="diff-text">{{ line.text || " " }}</code>
      </div>
    </div>
    <div v-else class="diff-split" role="region" :aria-label="`${section.label} split diff`">
      <div class="diff-split-header">
        <span>Before</span>
        <span>After</span>
      </div>
      <div
        v-for="(row, idx) in splitRows"
        :key="idx"
        class="diff-split-row"
      >
        <div class="diff-split-cell" :class="row.left ? `diff-line-${row.left.kind}` : 'diff-line-empty'">
          <span class="diff-line-num" aria-hidden="true">{{ row.left?.oldLineNumber ?? "" }}</span>
          <code class="diff-text">{{ row.left?.text ?? "" }}</code>
        </div>
        <div class="diff-split-cell" :class="row.right ? `diff-line-${row.right.kind}` : 'diff-line-empty'">
          <span class="diff-line-num" aria-hidden="true">{{ row.right?.newLineNumber ?? "" }}</span>
          <code class="diff-text">{{ row.right?.text ?? "" }}</code>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.diff-section {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.diff-section-title {
  margin: 0;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.diff-unified,
.diff-split {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  max-height: 420px;
}

.diff-line,
.diff-split-cell {
  display: flex;
  gap: 8px;
  padding: 0 12px;
  min-height: 22px;
  align-items: flex-start;
}

.diff-line-added,
.diff-split-cell.diff-line-added {
  background: color-mix(in oklch, #22c55e 12%, transparent);
}

.diff-line-removed,
.diff-split-cell.diff-line-removed {
  background: color-mix(in oklch, #ef4444 12%, transparent);
}

.diff-line-empty {
  background: var(--surface);
}

.diff-gutter {
  width: 14px;
  flex-shrink: 0;
  color: var(--muted);
  user-select: none;
}

.diff-line-num {
  width: 36px;
  flex-shrink: 0;
  text-align: right;
  color: var(--muted);
  user-select: none;
}

.diff-text {
  flex: 1;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--fg);
}

.diff-split-header {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--border);
  border-bottom: 1px solid var(--border);
}

.diff-split-header span {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  background: var(--surface);
}

.diff-split-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--border);
}

.diff-split-cell {
  background: var(--bg);
  padding-top: 1px;
  padding-bottom: 1px;
}
</style>
