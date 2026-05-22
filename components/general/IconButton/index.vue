<script setup lang="ts">
interface RoundedType {
  type: "full" | "lg" | "md" | "sm";
}
const props = defineProps({
  id: {
    type: String,
    default: "",
  },
  rounded: {
    type: String as () => "full" | "lg" | "md" | "none",
    default: "lg",
  },
  bordered: {
    type: Boolean,
    default: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  color: {
    type: String as () =>  'primary' | 'success' | 'info' | 'warning' |'error' | 'default',
    default: 'default'
  }
});

const emit = defineEmits(["on-click"]);

const buttonIconColor = computed(() => {
  const variant = {
    default: {
      border: 'border-gray-300',
      hover: 'hover:bg-gray-100',
      fill: 'bg-gray-500',
      fillHover: 'hover:bg-gray-400',
      stroke: 'stroke-gray-600'
    },
    primary: {
      border: 'border-primary-300',
      hover: 'hover:bg-primary-100',
      fill: 'bg-primary-500',
      fillHover: 'hover:bg-primary-400',
      stroke: 'stroke-primary-600'
    },
    success: {
      border: 'border-success-300',
      hover: 'hover:bg-success-100',
      fill: 'bg-success-500',
      fillHover: 'hover:bg-success-400',
      stroke: 'stroke-success-600'
    },
    info: {
      border: 'border-info-300',
      hover: 'hover:bg-info-100',
      fill: 'bg-info-500',
      fillHover: 'hover:bg-info-400',
      stroke: 'stroke-info-600'
    },
    warning: {
      border: 'border-warning-300',
      hover: 'hover:bg-warning-100',
      fill: 'bg-warning-500',
      fillHover: 'hover:bg-warning-400',
      stroke: 'stroke-warning-600'
    },
    error: {
      border: 'border-error-300',
      hover: 'hover:bg-error-100',
      fill: 'bg-error-500',
      fillHover: 'hover:bg-error-400',
      stroke: 'stroke-error-600'
    }
  };

  return variant[props.color];
});

const buttonClass = computed(() => {
  const rounded = `rounded-${props.rounded}`;
  const bordered = props.bordered
    ? `border ${buttonIconColor.value.border} ${buttonIconColor.value.hover}`
    : `${buttonIconColor.value.fill} ${buttonIconColor.value.fillHover}`;
  const disabled = props.disabled
    ? "!bg-gray-100 cursor-not-allowed"
    : "cursor-pointer";
  return `h-12 flex items-center justify-center aspect-square ${buttonIconColor.value.stroke} transition ${rounded} ${bordered} ${disabled}`;
});
</script>

<template>
  <button
    :id="props.id"
    :disabled="props.disabled"
    type="button"
    :class="buttonClass"
    @click="emit('on-click')"
  >
    <slot name="icon" />
  </button>
</template>

<style scoped></style>
