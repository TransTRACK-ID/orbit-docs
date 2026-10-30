<script setup lang="ts">
import { formatBytes } from "~/composables/useDocAssets";

definePageMeta({
  layout: false,
  auth: false,
  layoutTransition: false,
  pageTransition: false,
});

interface SharedPdf {
  title: string;
  fileName: string;
  sizeBytes: number;
  sharedAt: string | null;
  fileUrl: string;
}

const route = useRoute();
const token = computed(() => route.params.token as string);

const { data, error, pending } = await useFetch<{ data: SharedPdf }>(
  () => `/api/public/doc-assets/${token.value}`,
);

const pdf = computed(() => data.value?.data ?? null);

useSeoMeta({
  title: () => pdf.value?.title || "Shared PDF",
  robots: "noindex",
});
</script>

<template>
  <div class="shared-pdf">
    <header class="shared-pdf-bar">
      <div class="shared-pdf-heading">
        <span class="shared-pdf-badge" aria-hidden="true">PDF</span>
        <div class="shared-pdf-copy">
          <h1>{{ pdf?.title || "Shared PDF" }}</h1>
          <p v-if="pdf">{{ pdf.fileName }} · {{ formatBytes(pdf.sizeBytes) }}</p>
        </div>
      </div>
      <a v-if="pdf" class="btn btn-secondary btn-sm" :href="`${pdf.fileUrl}?download=1`">Download PDF</a>
    </header>

    <main class="shared-pdf-body">
      <p v-if="pending" class="shared-pdf-state">Loading…</p>
      <div v-else-if="error || !pdf" class="shared-pdf-state">
        <h2>Link unavailable</h2>
        <p>This PDF is no longer shared, or the link is incorrect.</p>
      </div>
      <iframe v-else :src="pdf.fileUrl" class="shared-pdf-frame" :title="pdf.title" />
    </main>
  </div>
</template>

<style scoped>
.shared-pdf {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.shared-pdf-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.shared-pdf-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.shared-pdf-badge {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  font-size: 10px;
  font-weight: 700;
  background: color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent);
  color: oklch(50% 0.16 25);
}

.shared-pdf-copy {
  min-width: 0;
}

.shared-pdf-copy h1 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shared-pdf-copy p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.shared-pdf-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.shared-pdf-frame {
  flex: 1;
  border: 0;
  width: 100%;
}

.shared-pdf-state {
  margin: auto;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}

.shared-pdf-state h2 {
  margin: 0 0 6px;
  font-size: 18px;
  color: var(--fg);
}
</style>
