<script setup lang="ts">
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  id: {
    type: String,
    default: "",
  },
  isChecked: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  readonly: {
    type: Boolean,
    default: false,
  },
  color: {
    type: String as () =>  'primary' | 'success' | 'info' | 'warning' |'error',
    default: 'primary'
  }
});

const emit = defineEmits(["update:model-value", "on-click"]);

function onChange(isChecked: boolean) {
  emit("update:model-value", isChecked);
}

const variant = {
  primary: 'peer-checked:bg-primary-500 ',
  success: 'peer-checked:bg-success-500 ',
  info: 'peer-checked:bg-info-500 ',
  warning: 'peer-checked:bg-warning-500 ',
  error: 'peer-checked:bg-error-500 ',
}

const bgColor = computed(() => {
  return variant[props.color]
})
</script>

<template>
  <label
    class="relative inline-flex items-center"
    :class="props.disabled ? 'cursor-not-allowed' : 'cursor-pointer'"
    @click="emit('on-click')"
  >
    <input
      :disabled="props.disabled || props.readonly"
      :checked="props.modelValue || props.isChecked"
      :id="props.id"
      type="checkbox"
      class="sr-only peer"
      @change="onChange($event.target.checked)"
    />
    <span
      class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600"
      :class="
        props.disabled
          ? 'peer-checked:bg-primary-300'
          : bgColor
      "
    />
  </label>
</template>

<style scoped></style>
