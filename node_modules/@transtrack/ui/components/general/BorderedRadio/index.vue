<script setup lang="ts">
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  value: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  color: {
    type: String as () =>  'primary' | 'success' | 'info' | 'warning' |'error',
    default: 'primary'
  }
})

const isChecked = ref<boolean>(false)

let $radio: HTMLElement | null = null

const emit = defineEmits(['update:modelValue'])

onMounted(() => {
  $radio = document.getElementById(props.id)
})

watch(() => props.modelValue, (value) => {
  isChecked.value = props.value === value
})

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
  <div class="p-4 flex items-center justify-between border rounded-lg cursor-pointer"
       :class="isChecked ? bgColor : 'border-gray-200'"
       @click="$radio?.click()"
  >
  
    <div class="flex items-center">
      <div v-if="$slots.icon"
           class="w-11 h-11 mr-5 aspect-square flex items-center justify-center rounded-full bg-[#FFF5F5]">
        <div class="w-8 h-8 flex aspect-square items-center justify-center rounded-full bg-[#FFEBEB]">
          <slot name="icon"/>
        </div>
      </div>
      <div>
        <label :for="props.id" class="text-gray-700 font-medium">{{ props.label }}</label>
        <p class="text-gray-500">{{ props.subtitle }}</p>
      </div>
    </div>

    <input :id="props.id" :name="props.name" :value="props.value" type="radio" class="text-primary-500 focus:ring-0"
           @change="emit('update:modelValue', ($event.target as HTMLInputElement)?.value)"
    >
  </div>
</template>

<style scoped>

</style>