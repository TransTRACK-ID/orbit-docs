<script setup lang="ts">
import Modal from '../Modal/index.vue';
import OutlinedButton from '../OutlinedButton/index.vue';

const emit = defineEmits(['on-mounted', 'on-click-button'])
const props = defineProps({
  id: {
    type: String,
    default: 'modal-warning'
  },
  title: {
    type: String,
    default: ''
  },
  subtitle: {
    type: String,
    default: ''
  },
  buttonLabel: {
    type: String,
    default: ''
  }
})

</script>

<template>
  <Modal
    :id="props.id"
    class-modal="max-w-md"
    @mounted="emit('on-mounted', $event)"  
  >
    <template #body>
      <div class="flex flex-col items-center">
        <div v-if="$slots.icon" class="mb-5">
          <slot name="icon"/>
        </div>

        <div class="space-y-2 mb-6">
          <p class="text-lg text-gray-900 font-[600] text-center">{{ title }}</p>
          <p class="text-sm text-gray-500 font-[400] text-center">{{ subtitle }}</p>
        </div>

        <OutlinedButton
          class="w-full"
          :label="props.buttonLabel"
          @on-click="emit('on-click-button')"  
        />
      </div>
    </template>
  </Modal>
</template>

<style scoped>

</style>
