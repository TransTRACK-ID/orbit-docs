<script setup lang="ts">
import type { DocVersion } from "~/composables/useDocs";
import { getHistoryActionClass, getHistoryActionLabel } from "~/utils/history-actions";

const props = defineProps<{
  versions: DocVersion[];
  isLoading: boolean;
}>();

const emit = defineEmits<{
  restore: [version: DocVersion];
  viewDiff: [version: DocVersion];
}>();

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

function onViewDiff(version: DocVersion) {
  emit("viewDiff", version);
}

function canViewDiff(index: number): boolean {
  return props.versions.length > 1;
}
</script>

<template>
  <div class="version-timeline">
    <div class="timeline-header">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6;">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span class="timeline-title">Version History</span>
    </div>
    <div v-if="isLoading" class="timeline-loading">
      <div v-for="n in 3" :key="n" class="timeline-skeleton">
        <div class="skeleton-dot" />
        <div class="skeleton-line" />
      </div>
    </div>
    <div v-else-if="versions.length === 0" class="timeline-empty">
      <div class="timeline-empty-content">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>No versions yet</span>
      </div>
    </div>
    <ul v-else class="timeline-list" role="list">
      <li v-for="(version, idx) in versions" :key="version.id" class="timeline-item" :class="{ 'timeline-item-latest': idx === 0 }" role="listitem">
        <div class="timeline-dot-wrapper">
          <div class="timeline-dot" :class="{ 'timeline-dot-latest': idx === 0 }" />
          <div v-if="idx !== versions.length - 1" class="timeline-line" />
        </div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-version">{{ version.version }}</span>
            <span class="pill" :class="getHistoryActionClass(version.action || 'save')">
              {{ getHistoryActionLabel(version.action || 'save') }}
            </span>
            <span class="timeline-time">{{ timeAgo(version.createdAt) }}</span>
          </div>
          <div class="timeline-meta">
            <span v-if="version.actor">{{ version.actor }}</span>
            <span v-if="version.title"> · {{ version.title }}</span>
          </div>
          <div class="timeline-actions">
            <button
              v-if="canViewDiff(idx)"
              type="button"
              class="timeline-btn"
              @click="onViewDiff(version)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="6" y1="3" x2="6" y2="15"/>
                <circle cx="18" cy="6" r="3"/>
                <circle cx="6" cy="18" r="3"/>
                <path d="M18 9a9 9 0 0 1-9 9"/>
              </svg>
              View diff
            </button>
            <button type="button" class="timeline-btn" @click="onRestore(version)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
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
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
}

.timeline-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 600;
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
  padding: 24px 8px;
}

.timeline-empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
}

.timeline-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.timeline-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  position: relative;
}

.timeline-item-latest {
  background: var(--accent-soft);
  border-radius: var(--radius);
  margin: 0 -16px;
  padding: 12px 16px;
}

.timeline-dot-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  position: relative;
  width: 12px;
  padding-top: 2px;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--border);
  border: 2px solid var(--surface);
  z-index: 1;
  flex-shrink: 0;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.timeline-dot-latest {
  background: var(--accent);
  border-color: var(--accent);
}

.timeline-line {
  position: absolute;
  top: 7px;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  bottom: -31px;
  background: var(--border);
}

.timeline-content {
  flex: 1;
  min-width: 0;
  padding-bottom: 4px;
}

.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.timeline-version {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
  font-family: var(--font-mono);
}

.timeline-time {
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
  flex-shrink: 0;
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
}

.timeline-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-soft);
}

.timeline-btn:active {
  transform: scale(0.96);
}

.timeline-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
