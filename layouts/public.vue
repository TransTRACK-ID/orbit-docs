<script setup lang="ts">
const route = useRoute();
const isEmbed = computed(() => route.query.embed === "1" || route.query.embed === "true");
</script>

<template>
  <div class="public-shell" :class="{ 'public-embed': isEmbed }">
    <main class="public-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.public-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.public-embed {
  min-height: auto;
}
.public-embed .public-main {
  padding: 0;
  max-width: none;
}
.public-main {
  flex: 1;
  padding: 32px 24px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}
@media (max-width: 600px) {
  .public-main {
    padding: 20px 16px;
  }
}
</style>

<style>
html, body {
  background: var(--bg);
}
</style>
