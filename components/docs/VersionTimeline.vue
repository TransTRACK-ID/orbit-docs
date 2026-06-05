<script setup lang="ts">
import type { DocVersion } from "~/composables/useDocs";

const props = defineProps<{
  versions: DocVersion[];
  isLoading: boolean;
}>();

const emit = defineEmits<{ restore: [version: any] }>();

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return `${Math.floor(diff / 604800)} weeks ago`;
}

function onRestore(version: DocVersion) {
  emit("restore", version);
}
</script>

<template>
  <div class="version-timeline">
    <div class="timeline-title">Version History</div>
    <div v-if="isLoading" class="timeline-loading">
      <div v-for="n in 3" :key="n" class="timeline-skeleton">
        <div class="skeleton-dot" />
        <div class="skeleton-line" />
      </div>
    </div>
    <div v-else-if="versions.length === 0" class="timeline-empty">
      No versions yet
    </div>
    <ul v-else class="timeline-list" role="list">
      <li v-for="(version, idx) in versions" :key="version.id" class="timeline-item" role="listitem">
        <div class="timeline-dot" :class="{ 'timeline-dot-latest': idx === 0 }" />
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-version">{{ version.version }}</span>
            <span class="timeline-time">{{ timeAgo(version.createdAt) }}</span>
          </div>
          <div class="timeline-meta">
            <span v-if="version.actor">by {{ version.actor }}</span>
            <span v-if="version.title">· {{ version.title }}</span>
          </div>
          <div class="timeline-actions">
            <button type="button" class="timeline-btn" @click="onRestore(version)">
              Restore
            </button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.version-timeline {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  overflow: auto;
}

.timeline-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 16px;
  font-weight: 500;
}

.timeline-loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timeline-skeleton {
  display: flex;
  align-items: center;
  gap: 12px;
}

.skeleton-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--border);
  flex-shrink: 0;
}

.skeleton-line {
  height: 12px;
  background: var(--border);
  border-radius: 4px;
  flex: 1;
  opacity: 0.7;
}

.timeline-empty {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  padding: 16px 0;
}

.timeline-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  position: relative;
}

.timeline-item:not(:last-child)::after {
  content: "";
  position: absolute;
  left: 4px;
  top: 28px;
  bottom: -4px;
  width: 2px;
  background: var(--border);
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--border);
  flex-shrink: 0;
  margin-top: 4px;
  border: 2px solid var(--surface);
  z-index: 1;
}

.timeline-dot-latest {
  background: var(--accent);
}

.timeline-content {
  flex: 1;
  min-width: 0;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.timeline-version {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
}

.timeline-time {
  font-size: 12px;
  color: var(--muted);
}

.timeline-meta {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 8px;
  line-height: 1.4;
}

.timeline-actions {
  display: flex;
  gap: 8px;
}

.timeline-btn {
  padding: 4px 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.timeline-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-soft);
}
</style>
