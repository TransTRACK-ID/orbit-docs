<script setup lang="ts">
import { onMounted } from "vue";
import { Dropdown, type DropdownInterface, initFlowbite } from "flowbite";

const props = defineProps({
  id: {
    type: String,
    default: "",
  },
});

let dropdown: DropdownInterface | null = null;

onMounted(() => {
  initFlowbite();

  const $trigger = document.getElementById(`${props.id}-activator`);
  const $target = document.getElementById(`${props.id}`);
  dropdown = new Dropdown($target, $trigger);
});
</script>

<template>
  <div :id="`${props.id}-activator`" :data-dropdown-toggle="props.id">
    <slot name="activator" />
  </div>

  <div :id="`${props.id}`" class="z-10 px-3 hidden">
    <div class="rounded-lg border shadow-sm" style="background: var(--surface, oklch(100% 0 0)); border-color: var(--border, oklch(90% 0.006 250));">
      <div :aria-labelledby="`${props.id}-activator`" class="divide-y" style="border-color: var(--border, oklch(90% 0.006 250));">
        <slot
          name="content"
          :close="
            () => {
              (dropdown as any)?.hide();
            }
          "
        />
      </div>
    </div>
  </div>
</template>

<style scoped></style>
