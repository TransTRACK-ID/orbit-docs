<script setup lang="ts">
definePageMeta({
  auth: true,
});

const router = useRouter();

onMounted(() => {
  router.replace('/apps');
});
</script>

<template>
  <div />
</template>
