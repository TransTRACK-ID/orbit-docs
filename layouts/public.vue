<template>
  <div class="public-shell">
    <header class="public-header">
      <NuxtLink to="/p/releases" class="public-brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
        <span>Orbit Docs</span>
      </NuxtLink>
    </header>
    <main class="public-main">
      <slot />
    </main>
    <footer class="public-footer">
      <span>Powered by Orbit Docs</span>
    </footer>
  </div>
</template>

<style scoped>
.public-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.public-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.public-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--fg);
  font-weight: 600;
  font-size: 15px;
}
.public-brand:hover {
  color: var(--accent);
}
.public-main {
  flex: 1;
  padding: 32px 24px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}
.public-footer {
  padding: 20px 24px;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  border-top: 1px solid var(--border);
}
@media (max-width: 600px) {
  .public-main {
    padding: 20px 16px;
  }
}
</style>
