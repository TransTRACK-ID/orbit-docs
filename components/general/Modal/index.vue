<template>
  <slot
    name="trigger"
    :activator="
      () => {
        toggleModal(true);
        emit('trigger-click');
      }
    "
  />
  <div
    :id="props.id"
    tabindex="-1"
    aria-hidden="true"
    class="backdrop-blur-sm fixed flex justify-center items-center align-center top-0 left-0 right-0 bottom-0 z-50 hidden bg-black bg-opacity-50 p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-full"
  >
    <div :class="`relative w-full ${classModal} max-h-full`">
      <div class="relative bg-white rounded-lg shadow dark:bg-gray-700 p-4">
        <div
          v-if="
            $slots.icon || !isEmpty(props.title) || !isEmpty(props.subtitle)
          "
          class="w-full p-2"
        >
          <div class="flex items-start justify-between">
            <div class="flex flex-col items-start space-y-4">
              <div
                v-if="$slots.icon"
                class="p-2 mr-3 aspect-square w-min rounded-full bg-[var(--od-error-bg)]"
              >
                <div class="p-2 aspect-square w-min rounded-full bg-[var(--od-error-soft)]">
                  <slot name="icon" />
                </div>
              </div>

              <div class="space-y-2">
                <h3
                  v-if="props.title"
                  class="text-lg font-semibold text-[var(--fg)]"
                >
                  {{ props.title }}
                </h3>
                <h5
                  v-if="props.subtitle"
                  class="text-sm text-[var(--muted)]"
                >
                  {{ props.subtitle }}
                </h5>
              </div>
            </div>

            <button
              v-if="props.isHasClose"
              type="button"
              class="top-9 right-8 text-[var(--muted)] bg-transparent transition hover:bg-[var(--fg-soft)] hover:text-[var(--fg)] rounded-full text-sm p-1.5 ml-auto inline-flex items-center"
              @click.prevent="toggleModal(false)"
            >
              <Close class="stroke-[var(--fg)]" />
              <span class="sr-only">Close modal</span>
            </button>
          </div>
        </div>

        <div class="w-full p-2">
          <slot name="body" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Close from "~/components/icons/Close/index.vue";
import { useModal } from "~/composables/modal";
import type { ElementEvent } from "~/types/element";
import { isEmpty } from "~/utils/ui";

const emit = defineEmits([
  "mounted",
  "modal-opened",
  "modal-closed",
  "trigger-click",
]);
const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  title: {
    type: String,
  },
  subtitle: {
    type: String,
  },
  isHasClose: {
    type: Boolean,
    default: false,
  },
  classModal: {
    type: String,
    default: "max-w-lg",
  },
});
const isVisible = ref<boolean>(false);

let $modal: HTMLElement | null = null;

onMounted(() => {
  $modal = document.getElementById(props.id);

  emit("mounted", setModal);
});

const setModal: ElementEvent = {
  show: () => toggleModal(true),
  hide: () => toggleModal(false),
  toggle: () => toggleModal(!isVisible.value),
};

const toggleModal = (value: boolean) => {
  if (value) {
    $modal?.classList.add("animate-fade-in");
    $modal?.classList.remove("hidden");
    $modal?.classList.remove("animate-fade-out");
    emit("modal-opened");
  } else {
    $modal?.classList.remove("animate-fade-in");
    $modal?.classList.add("animate-fade-out");
    setTimeout(() => {
      $modal?.classList.add("hidden");
      emit("modal-closed");
    }, 300);
  }

  isVisible.value = value;
  useModal().value = !useModal().value;
};
</script>

<style scoped></style>
~/utils/ui