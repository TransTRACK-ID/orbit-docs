<script setup lang="ts">

import Button from "../Button/index.vue";
import Modal from "../Modal/index.vue";
import OutlinedButton from "../OutlinedButton/index.vue";

const emit = defineEmits(["mounted", "negative", "positive"]);
const props = defineProps({
  id: {
    type: String,
    default: "modal-confirmation",
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: "",
  },
  subtitle: {
    type: String,
    default: "",
  },
  confirmLabel: {
    type: String,
    default: "",
  },
});
</script>

<template>
  <Modal :id="props.id" title="" @mounted="emit('mounted', $event)">
    <template #body>
      <div class="flex flex-col gap-2 items-center">
        <slot name="icon" />

        <div class="space-y-2 mb-5">
          <p class="text-lg text-gray-900 font-[600] text-center">
            {{ title }}
          </p>
          <p class="text-sm text-gray-500 font-[400] text-center">
            {{ subtitle }}
          </p>
        </div>

        <div class="flex w-full gap-3">
          <OutlinedButton
            label="Cancel"
            class="w-full"
            @on-click="emit('negative')"
          />
          <Button
            :loading="props.isLoading"
            :label="confirmLabel"
            class="w-full"
            @on-click="emit('positive')"
          />
        </div>
      </div>
    </template>
  </Modal>
</template>

<style scoped></style>
