<template>
  <div class="w-full max-w-[420px] mx-auto">
    <!-- Brand -->
    <div class="flex items-center justify-center gap-2.5 mb-8">
      <svg
        class="w-[22px] h-[22px] text-[var(--od-accent)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="10" />
        <path
          d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
        />
        <path d="M2 12h20" />
      </svg>
      <span class="text-lg font-semibold text-[var(--od-fg)]">Orbit Docs</span>
    </div>

    <!-- Page content (card) -->
    <slot />

    <!-- Page foot -->
    <footer
      class="mt-6 flex items-center justify-center gap-2 text-[12px] text-[var(--od-muted)]"
    >
      <span>Orbit Docs · Internal documentation platform</span>
      <span class="font-[var(--od-font-mono)] text-[11px] tabular-nums"
        >v2026.05</span
      >
    </footer>
  </div>
</template>
