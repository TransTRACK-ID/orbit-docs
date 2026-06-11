<script setup lang="ts">
interface Props {
  progressPct: number;
  status: string;
  message: string;
  errorMessage?: string | null;
}

const props = defineProps<Props>();

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    cloning: "Cloning Repository",
    analyzing: "Analyzing Codebase",
    generating_srs: "Generating SRS",
    generating_fsd: "Generating FSD",
    generating_git_snapshot: "Generating Git Snapshot",
    generating_sdd_index: "Generating SDD Index",
    generating_sdd: "Generating SDD",
    writing_back: "Writing Back to Repository",
    completed: "Completed",
    failed: "Failed",
  };
  return labels[props.status] || props.status;
});

const isFailed = computed(() => props.status === "failed");
const isCompleted = computed(() => props.status === "completed");
</script>

<template>
  <div class="progress-container" :class="{ failed: isFailed }">
    <div class="progress-header">
      <span class="status-label">{{ statusLabel }}</span>
      <span class="progress-pct">{{ progressPct }}%</span>
    </div>

    <div class="progress-bar-bg">
      <div
        class="progress-bar-fill"
        :style="{ width: `${progressPct}%` }"
        :class="{ completed: isCompleted, failed: isFailed }"
      />
    </div>

    <p class="progress-message">
      {{ message }}
    </p>

    <p v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </p>
  </div>
</template>

<style scoped>
.progress-container {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-container.failed {
  border-color: oklch(55% 0.18 25);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
}

.progress-pct {
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.progress-bar-bg {
  width: 100%;
  height: 8px;
  background: var(--fg-soft);
  border-radius: 999px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-bar-fill.completed {
  background: oklch(60% 0.18 145);
}

.progress-bar-fill.failed {
  background: oklch(55% 0.16 25);
}

.progress-message {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.error-message {
  margin: 0;
  font-size: 13px;
  color: oklch(50% 0.16 25);
}

@media (prefers-reduced-motion: reduce) {
  .progress-bar-fill {
    transition: none;
  }
}
</style>
