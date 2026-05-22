<script setup lang="ts">
definePageMeta({
  auth: false,
  layout: "login",
});

const router = useRouter();
</script>

<template>
  <AppLayoutsAuth>
    <!-- Card -->
    <div
      class="bg-[var(--od-surface)] border border-[var(--od-border)] rounded-[var(--od-radius-lg)] p-6 text-center"
    >
      <div
        class="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
        style="background: color-mix(in oklch, oklch(55% 0.18 25) 8%, transparent)"
      >
        <svg
          class="w-6 h-6"
          style="color: oklch(50% 0.16 25)"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h1 class="text-[18px] font-semibold text-[var(--od-fg)] mb-2">
        Something went wrong
      </h1>
      <p class="text-[14px] text-[var(--od-muted)] mb-6">
        We're experiencing technical difficulties. Please try again in a moment or contact your system administrator if the problem persists.
      </p>

      <div class="flex flex-col gap-3">
        <button
          type="button"
          class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[14px] font-medium text-[var(--od-surface)] bg-[var(--od-accent)] border border-[var(--od-accent)] rounded-[var(--od-radius)] transition-colors hover:bg-[color-mix(in_oklch,var(--od-accent)_88%,black)]"
          @click="router.back()"
        >
          Go back
        </button>
        <NuxtLink
          to="/login"
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[14px] font-medium text-[var(--od-fg)] bg-transparent border border-[var(--od-border)] rounded-[var(--od-radius)] transition-colors hover:border-[var(--od-fg)]"
        >
          Back to sign in
        </NuxtLink>
      </div>
    </div>
  </AppLayoutsAuth>
</template>
