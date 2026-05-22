<script setup lang="ts">
const props = defineProps({
  modelValue: {
    type: Array as () => boolean[],
    default: []
  },
  id: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  required: {
    type: Boolean,
    default: false
  },
  itemPerColumn: {
    type: Number,
    default: 4
  },
  items: {
    type: Array as () => {
      title: string,
      subtitle: string,
      value: string
    }[],
    default: []
  },
  color: {
    type: String as () =>  'primary' | 'success' | 'info' | 'warning' |'error',
    default: 'primary'
  }
})

const emit = defineEmits(['update:model-value'])

const checkboxValues = ref<boolean[]>([])

onMounted(() => {
  for (let i = 0; i < props.items.length; i++) {
    checkboxValues.value[i] = false
  }
})

watch(() => checkboxValues.value, (value) => {
  emit('update:model-value', value)
}, {deep: true})


const variant = {
  primary: 'border-primary-500 bg-primary-50',
  success: 'border-success-500 bg-success-50',
  info: 'border-info-500 bg-info-50',
  warning: 'border-warning-500 bg-warning-50',
  error: 'border-error-500 bg-error-50',
}

const bgColor = computed(() => {
  return variant[props.color]
})

</script>

<template>
  <div>
    <p class="text-sm font-medium text-gray-700 cursor-default select-none mb-1.5">
      {{ props.label }}
      <span v-if="props.required" class="text-primary-500">*</span>
    </p>
    <div :class="`grid grid-cols-${props.itemPerColumn} gap-3`">
      <div
        v-for="(item, i) in props.items"
        class="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer"
        :class="checkboxValues[i] ? bgColor : ''"
        @click="checkboxValues[i] = !checkboxValues[i]"
      >
        <input
          type="checkbox"
          :id="`${props.id}${item.value}`"
          :name="props.id"
          :checked="checkboxValues[i]"
          @change="checkboxValues[i] = ($event.target as HTMLInputElement)?.checked"
          class="text-primary-500 rounded focus:ring-0"
        />
        <div class="space-y-0.5">
          <p class="font-semibold text-gray-900 select-none">{{ item.title }}</p>
          <p class="text-sm text-gray-500 select-none">{{ item.subtitle }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>