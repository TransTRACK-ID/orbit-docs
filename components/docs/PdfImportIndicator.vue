<script setup lang="ts">
import { isActivePdfImport, type PdfImportJob } from "~/composables/useDocAssets";
import type { PdfImportMode } from "~/components/docs/DocAttachments.vue";

export interface IndicatorImportJob extends PdfImportJob {
  title: string;
}

const props = defineProps<{
  jobs: IndicatorImportJob[];
  docHasContent: boolean;
  applyingId: string | null;
}>();

const emit = defineEmits<{
  apply: [job: IndicatorImportJob, mode: PdfImportMode];
  dismiss: [job: IndicatorImportJob];
  cancel: [job: IndicatorImportJob];
}>();

const isExpanded = ref(false);

const activeJobs = computed(() => props.jobs.filter(isActivePdfImport));
const readyJobs = computed(() => props.jobs.filter((j) => j.status === "completed"));
const failedJobs = computed(() => props.jobs.filter((j) => j.status === "failed"));

const tone = computed(() => {
  if (activeJobs.value.length) return "active";
  if (readyJobs.value.length) return "ready";
  return "failed";
});

const summaryLabel = computed(() => {
  if (activeJobs.value.length > 1) return `Importing ${activeJobs.value.length} PDFs`;
  if (activeJobs.value.length === 1) return "Importing PDF";
  if (readyJobs.value.length > 1) return `${readyJobs.value.length} PDF imports ready`;
  if (readyJobs.value.length === 1) return "PDF import ready to insert";
  return failedJobs.value.length > 1 ? `${failedJobs.value.length} PDF imports failed` : "PDF import failed";
});

const summaryTitle = computed(() => {
  const group = activeJobs.value.length ? activeJobs.value : readyJobs.value.length ? readyJobs.value : failedJobs.value;
  return group.length === 1 ? group[0]!.title : null;
});

const summaryPct = computed(() => {
  if (!activeJobs.value.length) return null;
  return Math.round(activeJobs.value.reduce((sum, j) => sum + j.progressPct, 0) / activeJobs.value.length);
});

const previousReady = ref(0);
watch(
  () => readyJobs.value.length,
  (count) => {
    if (count > previousReady.value) isExpanded.value = true;
    previousReady.value = count;
  },
);

function statusLine(job: IndicatorImportJob): string {
  if (isActivePdfImport(job)) return job.progressMessage || "Working";
  if (job.status === "completed") {
    const pages = job.pageCount ? `${job.pageCount} pages` : "Ready";
    return job.usedAi ? `${pages} · formatted with AI` : pages;
  }
  return job.errorMessage || "Import failed";
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pdf-float">
      <div v-if="jobs.length" class="pdf-float" role="status" aria-live="polite">
        <Transition name="pdf-float-panel">
          <div v-if="isExpanded" class="pdf-float-panel">
            <div class="pdf-float-header">
              <div class="pdf-float-heading">
                <span class="pdf-float-dot" :class="tone" aria-hidden="true" />
                <div>
                  <p class="pdf-float-title">{{ summaryLabel }}</p>
                  <p class="pdf-float-sub">
                    {{ activeJobs.length ? "Keeps running if you close this page." : "Saved until you insert or dismiss it." }}
                  </p>
                </div>
              </div>
              <button type="button" class="pdf-float-icon-btn" aria-label="Collapse" @click="isExpanded = false">
                −
              </button>
            </div>

            <ul class="pdf-float-list" role="list">
              <li v-for="job in jobs" :key="job.id" class="pdf-float-item">
                <div class="pdf-float-item-top">
                  <span class="pdf-float-item-name" :title="job.title">{{ job.title }}</span>
                  <span v-if="isActivePdfImport(job)" class="pdf-float-item-pct">{{ job.progressPct }}%</span>
                </div>
                <p class="pdf-float-item-meta" :class="{ 'is-error': job.status === 'failed' }">{{ statusLine(job) }}</p>
                <span v-if="isActivePdfImport(job)" class="pdf-float-track" aria-hidden="true">
                  <span class="pdf-float-fill" :style="{ width: `${job.progressPct}%` }" />
                </span>

                <div class="pdf-float-actions">
                  <template v-if="isActivePdfImport(job)">
                    <button type="button" class="btn btn-ghost btn-sm" @click="emit('cancel', job)">Cancel</button>
                  </template>
                  <template v-else-if="job.status === 'completed'">
                    <template v-if="docHasContent">
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        :disabled="applyingId !== null"
                        @click="emit('apply', job, 'append')"
                      >
                        Add to end
                      </button>
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        :disabled="applyingId !== null"
                        @click="emit('apply', job, 'replace')"
                      >
                        Replace content
                      </button>
                    </template>
                    <button
                      v-else
                      type="button"
                      class="btn btn-primary btn-sm"
                      :disabled="applyingId !== null"
                      @click="emit('apply', job, 'replace')"
                    >
                      {{ applyingId === job.id ? "Inserting…" : "Insert into editor" }}
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm" :disabled="applyingId !== null" @click="emit('dismiss', job)">
                      Dismiss
                    </button>
                  </template>
                  <button v-else type="button" class="btn btn-ghost btn-sm" @click="emit('dismiss', job)">Dismiss</button>
                </div>
              </li>
            </ul>
          </div>
        </Transition>

        <button
          v-if="!isExpanded"
          type="button"
          class="pdf-float-pill"
          :class="`is-${tone}`"
          :aria-expanded="isExpanded"
          @click="isExpanded = true"
        >
          <span class="pdf-float-dot" :class="tone" aria-hidden="true" />
          <span class="pdf-float-pill-text">
            <span>{{ summaryLabel }}</span>
            <span v-if="summaryTitle" class="pdf-float-pill-sub">{{ summaryTitle }}</span>
          </span>
          <span v-if="summaryPct !== null" class="pdf-float-pill-pct">{{ summaryPct }}%</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pdf-float {
  position: fixed;
  right: 24px;
  bottom: 88px;
  z-index: 79;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  max-width: min(400px, calc(100vw - 48px));
  pointer-events: none;
}

.pdf-float > * {
  pointer-events: auto;
}

.pdf-float-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: min(100%, 260px);
  max-width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 20px color-mix(in oklch, var(--fg) 12%, transparent);
  transition: border-color 0.15s cubic-bezier(0.25, 1, 0.5, 1);
}

.pdf-float-pill.is-active:hover {
  border-color: color-mix(in oklch, var(--info) 35%, var(--border));
}

.pdf-float-pill.is-ready {
  border-color: color-mix(in oklch, var(--success) 45%, var(--border));
}

.pdf-float-pill.is-failed {
  border-color: color-mix(in oklch, var(--error) 40%, var(--border));
}

.pdf-float-pill:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.pdf-float-pill-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  flex: 1;
  min-width: 0;
  text-align: left;
}

.pdf-float-pill-sub {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--muted);
}

.pdf-float-pill-pct,
.pdf-float-item-pct {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: var(--muted);
}

.pdf-float-panel {
  width: min(360px, calc(100vw - 48px));
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 40px color-mix(in oklch, var(--fg) 14%, transparent);
  overflow: hidden;
}

.pdf-float-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--border);
}

.pdf-float-heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.pdf-float-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
}

.pdf-float-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.pdf-float-icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.pdf-float-icon-btn:hover {
  color: var(--fg);
  border-color: var(--fg);
}

.pdf-float-list {
  list-style: none;
  margin: 0;
  padding: 4px;
  max-height: min(360px, 55vh);
  overflow-y: auto;
}

.pdf-float-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: var(--radius);
}

.pdf-float-item + .pdf-float-item {
  border-top: 1px solid var(--border);
}

.pdf-float-item-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.pdf-float-item-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
}

.pdf-float-item-pct {
  font-weight: 600;
  color: var(--fg);
}

.pdf-float-item-meta {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--muted);
}

.pdf-float-item-meta.is-error {
  color: var(--error-text);
}

.pdf-float-track {
  display: block;
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in oklch, var(--fg) 8%, transparent);
}

.pdf-float-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--info);
  transition: width 0.5s cubic-bezier(0.25, 1, 0.5, 1);
}

.pdf-float-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.pdf-float-dot {
  width: 8px;
  height: 8px;
  margin-top: 5px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--muted);
}

.pdf-float-pill .pdf-float-dot {
  margin-top: 0;
}

.pdf-float-dot.active {
  background: var(--info);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--info) 22%, transparent);
  animation: pdf-pulse 1.5s ease-in-out infinite;
}

.pdf-float-dot.ready {
  background: var(--success);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--success) 22%, transparent);
}

.pdf-float-dot.failed {
  background: var(--error);
}

@keyframes pdf-pulse {
  0%, 100% { box-shadow: 0 0 0 3px color-mix(in oklch, var(--info) 22%, transparent); }
  50% { box-shadow: 0 0 0 6px color-mix(in oklch, var(--info) 8%, transparent); }
}

.pdf-float-enter-active,
.pdf-float-leave-active,
.pdf-float-panel-enter-active,
.pdf-float-panel-leave-active {
  transition:
    opacity 0.18s cubic-bezier(0.25, 1, 0.5, 1),
    transform 0.18s cubic-bezier(0.25, 1, 0.5, 1);
}

.pdf-float-enter-from,
.pdf-float-leave-to,
.pdf-float-panel-enter-from,
.pdf-float-panel-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 640px) {
  .pdf-float {
    right: 16px;
    bottom: 76px;
    max-width: calc(100vw - 32px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pdf-float-pill,
  .pdf-float-fill,
  .pdf-float-dot.active,
  .pdf-float-enter-active,
  .pdf-float-leave-active,
  .pdf-float-panel-enter-active,
  .pdf-float-panel-leave-active {
    transition: none !important;
    animation: none !important;
  }
}
</style>
