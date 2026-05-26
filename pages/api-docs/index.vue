<script setup lang="ts">
import { usePageStore } from "~/store/page";

definePageMeta({
  auth: true,
});

const $page = usePageStore();
const router = useRouter();

const slugInput = ref("");
const isNavigating = ref(false);

onBeforeMount(() => {
  $page.setTitle("API Docs");
});

function viewDocs() {
  const slug = slugInput.value.trim();
  if (!slug) return;
  isNavigating.value = true;
  router.push(`/api-docs/${slug}`);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    viewDocs();
  }
}

const isValidSlug = computed(() => slugInput.value.trim().length > 0);
</script>

<template>
  <div class="api-docs-landing">
    <div class="landing-content">
      <div class="landing-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </div>

      <h1 class="landing-title">API Documentation</h1>
      <p class="landing-desc">
        Enter a Postrack collection slug to view its public API documentation.
      </p>

      <div class="search-box">
        <div class="input-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="slugInput"
            type="text"
            placeholder="Enter collection slug (e.g. my-api-docs)"
            class="slug-input"
            @keydown="onKeydown"
          />
        </div>
        <button
          class="view-btn"
          :disabled="!isValidSlug || isNavigating"
          @click="viewDocs"
        >
          <span v-if="isNavigating">Loading...</span>
          <span v-else>View Docs</span>
        </button>
      </div>

      <div class="hint">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        The slug is the public identifier set when publishing a collection in Postrack.
      </div>
    </div>
  </div>
</template>

<style scoped>
.api-docs-landing {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 120px);
  padding: 40px 20px;
}

.landing-content {
  text-align: center;
  max-width: 480px;
  width: 100%;
}

.landing-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: var(--radius-lg, 12px);
  background: var(--accent-soft, color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent));
  color: var(--accent, oklch(55% 0.16 25));
  margin-bottom: 24px;
}

.landing-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--fg, oklch(20% 0.02 250));
  margin: 0 0 8px;
  letter-spacing: -0.02em;
}

.landing-desc {
  font-size: 14px;
  color: var(--muted, oklch(55% 0.015 250));
  margin: 0 0 32px;
  line-height: 1.6;
}

.search-box {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--surface, oklch(100% 0 0));
  border: 1px solid var(--border, oklch(90% 0.006 250));
  border-radius: var(--radius, 8px);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input-wrap:focus-within {
  border-color: var(--accent, oklch(55% 0.16 25));
  box-shadow: 0 0 0 3px var(--accent-soft, color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent));
}

.search-icon {
  color: var(--muted, oklch(55% 0.015 250));
  flex-shrink: 0;
}

.slug-input {
  flex: 1;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  color: var(--fg, oklch(20% 0.02 250));
  outline: none;
  min-width: 0;
}

.slug-input::placeholder {
  color: var(--muted, oklch(55% 0.015 250));
}

.view-btn {
  padding: 10px 20px;
  border-radius: var(--radius, 8px);
  border: 1px solid transparent;
  background: var(--accent, oklch(55% 0.16 25));
  color: var(--surface, oklch(100% 0 0));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.view-btn:hover:not(:disabled) {
  background: color-mix(in oklch, var(--accent, oklch(55% 0.16 25)) 88%, black);
}

.view-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: var(--muted, oklch(55% 0.015 250));
  line-height: 1.5;
}

.hint svg {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--accent, oklch(55% 0.16 25));
}

@media (max-width: 480px) {
  .search-box {
    flex-direction: column;
  }

  .view-btn {
    width: 100%;
  }
}
</style>
