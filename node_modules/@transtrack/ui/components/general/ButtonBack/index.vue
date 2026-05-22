<script setup lang="ts">
import { useRouter } from "vue-router";
import ChevronLeft from "~/components/icons/ChevronLeft/index.vue";
import TextButton from "../TextButton/index.vue";

const $router = useRouter();

const props = defineProps({
  id: {
    type: String,
    default: "btnBack",
  },
  label: {
    type: String,
    default: "Back",
  },
  step: {
    type: Number,
    default: -1,
  },
  path: {
    type: String || null,
    default: null,
  },
});

const emit = defineEmits(["on-click"]);

function redirect() {
  emit("on-click");
  if ($router) {
    props.path ? $router.push(props.path) : $router.go(props.step);
  } else {
    console.warn("Router tidak tersedia.");
  }
}
</script>

<template>
  <TextButton :label="props.label" @on-click="redirect()">
    <template #prefix>
      <ChevronLeft size="20" />
    </template>
  </TextButton>
</template>

<style scoped></style>
