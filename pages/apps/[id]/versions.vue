<script setup lang="ts">
const route = useRoute();
const appId = route.params.id as string;

await navigateTo(`/versions?app=${appId}`, { replace: true });
</script>

<template>
  <div />
</template>
