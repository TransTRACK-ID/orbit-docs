<script setup lang="ts">
definePageMeta({
  auth: true,
});

const route = useRoute();
const appId = route.params.id as string;

// App detail lives in a drawer on the Apps list; keep old links working.
await navigateTo({ path: "/apps", query: { ...route.query, app: appId } }, { replace: true });
</script>

<template>
  <div />
</template>
