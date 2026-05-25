<script setup lang="ts">
definePageMeta({
  auth: true,
});

const router = useRouter();
const route = useRoute();

// Guard: only redirect once per app session to avoid loops during transitions/HMR
const hasRedirected = useState('root-redirect-done', () => false);

onMounted(() => {
  if (hasRedirected.value) return;
  if (route.path !== '/') return;

  hasRedirected.value = true;
  router.replace('/apps');
});
</script>

<template>
  <div />
</template>
