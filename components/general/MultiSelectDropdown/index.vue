<script setup lang="ts">
interface MultiSelectOption {
  id: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    /** Selected option ids. Empty means "no narrowing" (everything). */
    modelValue: string[];
    options: MultiSelectOption[];
    /** Trigger text when nothing is narrowed (none or every option selected). */
    allLabel?: string;
    /** Plural noun for the trigger when several options are selected, e.g. "apps". */
    noun?: string;
    searchPlaceholder?: string;
    selectAllLabel?: string;
    ariaLabel?: string;
  }>(),
  {
    allLabel: "All",
    noun: "items",
    searchPlaceholder: "Filter…",
    selectAllLabel: "Select All",
    ariaLabel: undefined,
  }
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string[]): void;
}>();

const PANEL_WIDTH = 254;
const VIEWPORT_MARGIN = 8;

const instanceId = `multi-select-${Math.random().toString(36).slice(2, 9)}`;

const isOpen = ref(false);
const query = ref("");
const rootRef = ref<HTMLDivElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const panelRef = ref<HTMLDivElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const panelStyle = ref<Record<string, string>>({ top: "0px", left: "0px" });

const selected = computed(() => new Set(props.modelValue));

const selectedCount = computed(
  () => props.options.filter((o) => selected.value.has(o.id)).length
);

const triggerLabel = computed(() => {
  const count = selectedCount.value;
  if (count === 0 || count === props.options.length) return props.allLabel;
  if (count === 1) {
    return props.options.find((o) => selected.value.has(o.id))?.label ?? props.allLabel;
  }
  return `${count} ${props.noun}`;
});

const visibleOptions = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.options;
  return props.options.filter((o) => o.label.toLowerCase().includes(q));
});

const visibleSelectedCount = computed(
  () => visibleOptions.value.filter((o) => selected.value.has(o.id)).length
);
const allVisibleSelected = computed(
  () => visibleOptions.value.length > 0 && visibleSelectedCount.value === visibleOptions.value.length
);
const someVisibleSelected = computed(
  () => visibleSelectedCount.value > 0 && !allVisibleSelected.value
);

function updatePanelPosition() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  const maxLeft = window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN;
  panelStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft))}px`,
  };
}

function open() {
  isOpen.value = true;
  updatePanelPosition();
  nextTick(() => searchInputRef.value?.focus());
}

function close(returnFocus = true) {
  isOpen.value = false;
  query.value = "";
  if (returnFocus) nextTick(() => triggerRef.value?.focus());
}

function toggle() {
  if (isOpen.value) close();
  else open();
}

function toggleOption(id: string) {
  const next = new Set(props.modelValue);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  emit("update:modelValue", [...next]);
}

function toggleAllVisible() {
  const next = new Set(props.modelValue);
  if (allVisibleSelected.value) {
    for (const o of visibleOptions.value) next.delete(o.id);
  } else {
    for (const o of visibleOptions.value) next.add(o.id);
  }
  emit("update:modelValue", [...next]);
}

function onClickOutside(e: MouseEvent) {
  const t = e.target as Node;
  if (rootRef.value?.contains(t) || panelRef.value?.contains(t)) return;
  if (isOpen.value) close(false);
}

function onScrollResize(e: Event) {
  if (!isOpen.value) return;
  if (e.target instanceof Node && panelRef.value?.contains(e.target)) return;
  updatePanelPosition();
}

onMounted(() => {
  document.addEventListener("click", onClickOutside);
  window.addEventListener("scroll", onScrollResize, true);
  window.addEventListener("resize", onScrollResize);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onClickOutside);
  window.removeEventListener("scroll", onScrollResize, true);
  window.removeEventListener("resize", onScrollResize);
});
</script>

<template>
  <div ref="rootRef" class="multi-select">
    <button
      ref="triggerRef"
      type="button"
      class="multi-select__trigger"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      :aria-controls="isOpen ? `${instanceId}-panel` : undefined"
      :aria-label="ariaLabel ? `${ariaLabel}: ${triggerLabel}` : undefined"
      @click="toggle"
      @keydown.esc="isOpen && close()"
    >
      <span class="multi-select__label">{{ triggerLabel }}</span>
      <svg
        class="multi-select__chevron"
        :class="{ 'is-flipped': isOpen }"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.25"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <Teleport to="body">
      <Transition enter-active-class="ms-enter" leave-active-class="ms-leave">
        <div
          v-show="isOpen"
          :id="`${instanceId}-panel`"
          ref="panelRef"
          class="multi-select__panel"
          role="group"
          :aria-label="ariaLabel"
          :style="{ ...panelStyle, width: `${PANEL_WIDTH}px` }"
          @keydown.esc.stop.prevent="close()"
          @keydown.tab="close(false)"
        >
          <div class="multi-select__search">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref="searchInputRef"
              v-model="query"
              type="text"
              class="multi-select__search-input"
              :placeholder="searchPlaceholder"
              :aria-label="searchPlaceholder"
            />
          </div>

          <div class="multi-select__list">
            <label v-if="visibleOptions.length" class="multi-select__row">
              <input
                type="checkbox"
                class="multi-select__check"
                :checked="allVisibleSelected"
                :indeterminate.prop="someVisibleSelected"
                @change="toggleAllVisible"
              />
              <span class="multi-select__row-label">{{ selectAllLabel }}</span>
            </label>
            <label v-for="opt in visibleOptions" :key="opt.id" class="multi-select__row">
              <input
                type="checkbox"
                class="multi-select__check"
                :checked="selected.has(opt.id)"
                @change="toggleOption(opt.id)"
              />
              <span class="multi-select__row-label">{{ opt.label }}</span>
            </label>
            <div v-if="visibleOptions.length === 0" class="multi-select__empty" role="status">
              No matches
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.multi-select {
  position: relative;
  display: inline-flex;
}

.multi-select__trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 39px;
  padding: 8px 12px;
  border: 1px solid var(--control-border);
  border-radius: var(--ms-trigger-radius, var(--radius));
  background: var(--surface);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--fg);
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.multi-select__trigger:hover {
  border-color: var(--fg);
}

.multi-select__trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.multi-select__trigger[aria-expanded="true"] {
  border-color: var(--accent);
}

.multi-select__label {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.multi-select__chevron {
  flex-shrink: 0;
  color: var(--fg);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.multi-select__chevron.is-flipped {
  transform: rotate(180deg);
}

.multi-select__panel {
  position: fixed;
  z-index: 200;
  display: flex;
  flex-direction: column;
  max-height: 323px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow:
    0 1px 2px color-mix(in oklch, var(--fg) 4%, transparent),
    0 4px 12px color-mix(in oklch, var(--fg) 8%, transparent);
  overflow: hidden;
}

.multi-select__search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
  flex-shrink: 0;
}

.multi-select__search svg {
  flex-shrink: 0;
}

.multi-select__search-input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--control-border);
  border-radius: 6px;
  background: var(--surface);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
}

.multi-select__search-input::placeholder {
  color: var(--muted);
}

.multi-select__search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.multi-select__list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  scroll-padding: 6px;
}

.multi-select__row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 37px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  color: var(--fg);
  cursor: pointer;
}

.multi-select__row:hover {
  background: var(--fg-soft);
}

.multi-select__row:has(.multi-select__check:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.multi-select__row-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.multi-select__check {
  appearance: none;
  position: relative;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin: 0;
  border: 1px solid var(--control-border);
  border-radius: 4px;
  background: var(--surface);
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.multi-select__check:checked,
.multi-select__check:indeterminate {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
}

.multi-select__check:checked::after {
  content: "";
  position: absolute;
  left: 4.5px;
  top: 1.5px;
  width: 4px;
  height: 8px;
  border: solid var(--surface);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.multi-select__check:indeterminate::after {
  content: "";
  position: absolute;
  left: 3px;
  top: 6.5px;
  width: 8px;
  height: 2px;
  border-radius: 1px;
  background: var(--surface);
}

.multi-select__check:focus-visible {
  outline: none;
}

.multi-select__empty {
  padding: 20px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}

.ms-enter {
  animation: msIn 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.ms-leave {
  animation: msOut 0.1s cubic-bezier(0.4, 0, 1, 1) forwards;
}

@keyframes msIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes msOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .multi-select__chevron,
  .multi-select__trigger,
  .multi-select__check,
  .ms-enter,
  .ms-leave {
    transition: none !important;
    animation: none !important;
  }
}
</style>
