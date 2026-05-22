<script setup lang="ts">
definePageMeta({
  auth: false,
  layout: false,
});

const $router = useRouter();
</script>

<template>
  <div class="min-h-screen flex justify-center items-center p-10">
    <div
      class="flex flex-col-reverse items-center max-w-[960px] md:flex-row md:space-x-10"
    >
      <div class="flex flex-col items-center md:items-start">
        <p
          class="text-6xl font-semibold text-gray-900 text-center mb-6 md:text-left"
        >
          Internal Server Error
        </p>

        <p class="text-lg text-gray-700 mb-10 text-center md:text-left">
          Our servers are currently undergoing maintenance to ensure the ebst
          experience for you. Please be patient, we'll be back soon!
        </p>

        <GeneralButton label="Refresh Page" @on-click="$router.back()" />
      </div>

      <div class="mb-10 md:mb-0">
        <IlustrationInternalServerError />
      </div>
    </div>
  </div>
</template>

<style scoped></style>
