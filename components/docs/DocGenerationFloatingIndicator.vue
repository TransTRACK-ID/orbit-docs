<script setup lang="ts">
import {
  DOC_GENERATION_STATUS_LABEL,
  isPendingDocGenerationStatus,
} from "~/utils/doc-generation-status";

export interface FloatingGenerationJob {
  appId: string;
  appName: string;
  jobId: string;
  status: string;
  progressPct: number;
  progressMessage?: string | null;
  currentActivity?: string | null;
}

interface Props {
  jobs?: FloatingGenerationJob[];
  isSubmitting?: boolean;
  canCancel?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  jobs: () => [],
  isSubmitting: false,
  canCancel: false,
});

const emit = defineEmits<{
  cancel: [jobId: string, appId: string];
  viewJob: [appId: string];
  dismiss: [];
}>();

const isExpanded = ref(false);

const pendingJobs = computed(() =>
  props.jobs.filter((job) => isPendingDocGenerationStatus(job.status))
);

const pendingCount = computed(() => pendingJobs.value.length);

const isVisible = computed(() => props.isSubmitting || pendingCount.value > 0);

const summaryLabel = computed(() => {
  if (props.isSubmitting && pendingCount.value === 0) return "Starting generation";
  if (pendingCount.value === 1) {
    const job = pendingJobs.value[0];
    return DOC_GENERATION_STATUS_LABEL[job.status] || "Generating";
  }
  return `${pendingCount.value} generations running`;
});

const summaryPct = computed(() => {
  if (pendingCount.value === 0) return 0;
  const total = pendingJobs.value.reduce((sum, job) => sum + job.progressPct, 0);
  return Math.round(total / pendingCount.value);
});

const summaryAppName = computed(() => {
  if (pendingCount.value !== 1) return null;
  return pendingJobs.value[0]?.appName ?? null;
});

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}

function handleViewJob(appId: string) {
  isExpanded.value = false;
  emit("viewJob", appId);
}

function phaseLabel(status: string) {
  return DOC_GENERATION_STATUS_LABEL[status] || status;
}

watch(pendingCount, (count, prev) => {
  if (count > 1 && prev <= 1) isExpanded.value = true;
  if (count === 0) isExpanded.value = false;
});
</script>

<template>
  <Teleport to="body">
    <Transition name="gen-float">
      <div
        v-if="isVisible"
        class="gen-float"
        :class="{ 'is-expanded': isExpanded, 'is-multi': pendingCount > 1 }"
        role="status"
        aria-live="polite"
      >
        <Transition name="gen-float-panel">
          <div v-if="isExpanded" class="gen-float-panel">
            <div class="gen-float-panel-header">
              <div class="gen-float-heading">
                <span class="gen-float-dot active" aria-hidden="true" />
                <div>
                  <p class="gen-float-title">
                    {{
                      pendingCount > 1
                        ? `${pendingCount} generations in progress`
                        : "Generation in progress"
                    }}
                  </p>
                  <p v-if="pendingCount > 1" class="gen-float-app">
                    Tap an app to open its progress page
                  </p>
                  <p v-else-if="summaryAppName" class="gen-float-app">{{ summaryAppName }}</p>
                </div>
              </div>
              <button
                type="button"
                class="gen-float-icon-btn"
                aria-label="Collapse indicator"
                @click="toggleExpanded"
              >
                −
              </button>
            </div>

            <ul class="gen-float-list" role="list">
              <li
                v-for="job in pendingJobs"
                :key="job.jobId"
                class="gen-float-item"
              >
                <button
                  type="button"
                  class="gen-float-item-main"
                  @click="handleViewJob(job.appId)"
                >
                  <span class="gen-float-item-name">{{ job.appName }}</span>
                  <span class="gen-float-item-phase">{{ phaseLabel(job.status) }}</span>
                  <div class="gen-float-item-track" aria-hidden="true">
                    <div
                      class="gen-float-item-fill"
                      :style="{ width: `${job.progressPct}%` }"
                    />
                  </div>
                  <span class="gen-float-item-pct">{{ job.progressPct }}%</span>
                </button>
                <button
                  v-if="canCancel"
                  type="button"
                  class="gen-float-item-cancel"
                  aria-label="Cancel generation"
                  @click.stop="emit('cancel', job.jobId, job.appId)"
                >
                  Cancel
                </button>
              </li>
            </ul>
          </div>
        </Transition>

        <button
          type="button"
          class="gen-float-pill"
          :aria-expanded="isExpanded"
          @click="toggleExpanded"
        >
          <span class="gen-float-dot active" aria-hidden="true" />
          <span class="gen-float-pill-text">
            <span class="gen-float-pill-status">{{ summaryLabel }}</span>
            <span v-if="summaryAppName" class="gen-float-pill-app">{{ summaryAppName }}</span>
            <span v-else-if="pendingCount > 1" class="gen-float-pill-app">
              Across {{ pendingCount }} apps
            </span>
          </span>
          <span class="gen-float-pill-pct">{{ summaryPct }}%</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.gen-float {
  position: fixed;
  right: 24px;
  bottom: 88px;
  left: auto;
  z-index: 79;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  max-width: min(400px, calc(100vw - 48px));
  pointer-events: none;
}

.gen-float > * {
  pointer-events: auto;
}

.gen-float-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  width: auto;
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
  transition:
    border-color 0.15s cubic-bezier(0.25, 1, 0.5, 1),
    box-shadow 0.15s cubic-bezier(0.25, 1, 0.5, 1);
}

.gen-float-pill:hover {
  border-color: color-mix(in oklch, oklch(60% 0.16 255) 35%, var(--border));
  box-shadow: 0 6px 24px color-mix(in oklch, var(--fg) 14%, transparent);
}

.gen-float-pill:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.gen-float.is-expanded .gen-float-pill {
  border-color: color-mix(in oklch, oklch(60% 0.16 255) 35%, var(--border));
  background: color-mix(in oklch, oklch(60% 0.16 255) 4%, var(--surface));
}

.gen-float-pill-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 0;
  flex: 1;
  text-align: left;
}

.gen-float-pill-status {
  line-height: 1.2;
}

.gen-float-pill-app {
  font-size: 11px;
  color: var(--muted);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gen-float-pill-pct {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: var(--muted);
  flex-shrink: 0;
}

.gen-float-panel {
  width: min(400px, calc(100vw - 48px));
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 40px color-mix(in oklch, var(--fg) 14%, transparent);
  overflow: hidden;
}

.gen-float-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--border);
}

.gen-float-heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.gen-float-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
}

.gen-float-app {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.gen-float-icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
  font-size: 16px;
  line-height: 1;
}

.gen-float-icon-btn:hover {
  color: var(--fg);
  border-color: var(--fg);
}

.gen-float-list {
  list-style: none;
  margin: 0;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: min(320px, 50vh);
  overflow-y: auto;
}

.gen-float-item {
  display: flex;
  align-items: stretch;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in oklch, var(--fg) 2%, var(--surface));
  overflow: hidden;
}

.gen-float-item-main {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: 4px 10px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s cubic-bezier(0.25, 1, 0.5, 1);
}

.gen-float-item-main:hover {
  background: var(--fg-soft);
}

.gen-float-item-name {
  grid-column: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gen-float-item-phase {
  grid-column: 1;
  grid-row: 2;
  font-size: 11px;
  color: var(--muted);
}

.gen-float-item-pct {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: center;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.gen-float-item-track {
  grid-column: 1 / -1;
  height: 4px;
  background: color-mix(in oklch, var(--fg) 8%, transparent);
  border-radius: 999px;
  overflow: hidden;
}

.gen-float-item-fill {
  height: 100%;
  background: oklch(60% 0.16 255);
  border-radius: 999px;
  transition: width 0.5s cubic-bezier(0.25, 1, 0.5, 1);
}

.gen-float-item-cancel {
  flex-shrink: 0;
  align-self: stretch;
  padding: 0 10px;
  border: none;
  border-left: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.15s cubic-bezier(0.25, 1, 0.5, 1),
    background 0.15s cubic-bezier(0.25, 1, 0.5, 1);
}

.gen-float-item-cancel:hover {
  color: oklch(50% 0.16 25);
  background: color-mix(in oklch, oklch(55% 0.18 25) 6%, transparent);
}

.gen-float-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--muted);
  flex-shrink: 0;
  margin-top: 5px;
}

.gen-float-dot.active {
  background: oklch(60% 0.16 255);
  box-shadow: 0 0 0 3px color-mix(in oklch, oklch(60% 0.16 255) 22%, transparent);
  animation: gen-pulse 1.5s ease-in-out infinite;
}

@keyframes gen-pulse {
  0%, 100% { box-shadow: 0 0 0 3px color-mix(in oklch, oklch(60% 0.16 255) 22%, transparent); }
  50% { box-shadow: 0 0 0 6px color-mix(in oklch, oklch(60% 0.16 255) 8%, transparent); }
}

.gen-float-enter-active,
.gen-float-leave-active {
  transition:
    opacity 0.18s cubic-bezier(0.25, 1, 0.5, 1),
    transform 0.18s cubic-bezier(0.25, 1, 0.5, 1);
}

.gen-float-enter-from,
.gen-float-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.gen-float-panel-enter-active,
.gen-float-panel-leave-active {
  transition:
    opacity 0.18s cubic-bezier(0.25, 1, 0.5, 1),
    transform 0.18s cubic-bezier(0.25, 1, 0.5, 1);
}

.gen-float-panel-enter-from,
.gen-float-panel-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 640px) {
  .gen-float {
    right: 16px;
    bottom: 76px;
    max-width: calc(100vw - 32px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .gen-float-pill,
  .gen-float-enter-active,
  .gen-float-leave-active,
  .gen-float-panel-enter-active,
  .gen-float-panel-leave-active,
  .gen-float-item-fill,
  .gen-float-dot.active {
    transition: none !important;
    animation: none !important;
  }
}
</style>
