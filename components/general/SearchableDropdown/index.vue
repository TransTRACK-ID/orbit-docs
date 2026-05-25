<script setup lang="ts" generic="T extends { id: string; label: string; disabled?: boolean }">
const props = defineProps<{
  modelValue: string;
  options: T[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  label?: string;
  id?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const instanceId = computed(() => props.id || `dropdown-${Math.random().toString(36).slice(2, 9)}`);

const isOpen = ref(false);
const searchQuery = ref("");
const dropdownRef = ref<HTMLDivElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const menuRef = ref<HTMLDivElement | null>(null);
const activeIndex = ref(-1);

const menuStyle = ref<Record<string, string>>({ top: "0px", left: "0px", minWidth: "0px" });

function updateMenuPosition() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  menuStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${rect.left}px`,
    minWidth: `${rect.width}px`,
  };
}

const selectedLabel = computed(() => {
  const found = props.options.find((o) => o.id === props.modelValue);
  return found?.label || props.placeholder || "Select…";
});

const filteredOptions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return props.options;
  return props.options.filter((o) => o.label.toLowerCase().includes(q));
});

const activeDescendantId = computed(() => {
  if (activeIndex.value < 0 || activeIndex.value >= filteredOptions.value.length) return undefined;
  const opt = filteredOptions.value[activeIndex.value];
  if (!opt) return undefined;
  return `${instanceId.value}-option-${opt.id}`;
});

function open() {
  if (props.disabled) return;
  isOpen.value = true;
  updateMenuPosition();
  activeIndex.value = filteredOptions.value.findIndex((o) => o.id === props.modelValue);
  nextTick(() => {
    searchInputRef.value?.focus();
    scrollActiveIntoView();
  });
}

function close(returnFocus = true) {
  isOpen.value = false;
  searchQuery.value = "";
  activeIndex.value = -1;
  if (returnFocus) {
    nextTick(() => triggerRef.value?.focus());
  }
}

function toggle() {
  if (isOpen.value) close();
  else open();
}

function select(id: string) {
  const option = props.options.find((o) => o.id === id);
  if (option?.disabled) return;
  emit("update:modelValue", id);
  close();
}

function highlightNext() {
  const len = filteredOptions.value.length;
  if (len === 0) return;
  let next = activeIndex.value + 1;
  if (next >= len) next = 0;
  // Skip disabled
  while (filteredOptions.value[next]?.disabled && next !== activeIndex.value) {
    next = next + 1 >= len ? 0 : next + 1;
    if (next === activeIndex.value) break;
  }
  activeIndex.value = next;
  scrollActiveIntoView();
}

function highlightPrev() {
  const len = filteredOptions.value.length;
  if (len === 0) return;
  let prev = activeIndex.value - 1;
  if (prev < 0) prev = len - 1;
  // Skip disabled
  while (filteredOptions.value[prev]?.disabled && prev !== activeIndex.value) {
    prev = prev - 1 < 0 ? len - 1 : prev - 1;
    if (prev === activeIndex.value) break;
  }
  activeIndex.value = prev;
  scrollActiveIntoView();
}

function scrollActiveIntoView() {
  nextTick(() => {
    const id = activeDescendantId.value;
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  });
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (props.disabled) return;
  switch (e.key) {
    case "ArrowDown":
    case "ArrowUp":
    case "Enter":
    case " ":
      e.preventDefault();
      open();
      break;
    case "Escape":
      if (isOpen.value) {
        e.preventDefault();
        close();
      }
      break;
  }
}

function onMenuKeydown(e: KeyboardEvent) {
  if (!isOpen.value) return;

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      highlightNext();
      break;
    case "ArrowUp":
      e.preventDefault();
      highlightPrev();
      break;
    case "Home":
      e.preventDefault();
      activeIndex.value = 0;
      scrollActiveIntoView();
      break;
    case "End":
      e.preventDefault();
      activeIndex.value = Math.max(0, filteredOptions.value.length - 1);
      scrollActiveIntoView();
      break;
    case "Enter":
    case " ": {
      const active = filteredOptions.value[activeIndex.value];
      if (active && !active.disabled) {
        e.preventDefault();
        select(active.id);
      }
      break;
    }
    case "Escape":
      e.preventDefault();
      close();
      break;
    case "Tab":
      close(false);
      break;
  }
}

function onClickOutside(e: MouseEvent) {
  const t = e.target as Node;
  if (
    dropdownRef.value &&
    !dropdownRef.value.contains(t) &&
    (!menuRef.value || !menuRef.value.contains(t))
  ) {
    close(false);
  }
}

function onScrollResize() {
  if (isOpen.value) close(false);
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
  <div ref="dropdownRef" class="searchable-dropdown">
    <label
      v-if="label"
      :for="`${instanceId}-trigger`"
      class="dropdown-label"
    >
      {{ label }}
    </label>

    <button
      :id="`${instanceId}-trigger`"
      ref="triggerRef"
      type="button"
      class="dropdown-trigger"
      :disabled="disabled"
      :aria-expanded="isOpen"
      :aria-haspopup="'listbox'"
      :aria-controls="isOpen ? `${instanceId}-listbox` : undefined"
      :aria-activedescendant="isOpen ? activeDescendantId : undefined"
      :aria-label="label ? undefined : selectedLabel"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="trigger-label">{{ selectedLabel }}</span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        :class="{ 'rotate-180': isOpen }"
        class="chevron"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <Teleport to="body">
      <Transition
        enter-active-class="menu-enter"
        leave-active-class="menu-leave"
      >
        <div
          v-show="isOpen"
          ref="menuRef"
          :id="`${instanceId}-listbox`"
          class="dropdown-menu"
          :style="menuStyle"
          role="listbox"
          tabindex="-1"
          @keydown="onMenuKeydown"
        >
        <div class="search-wrap">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="search-icon"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            class="search-input"
            :placeholder="searchPlaceholder || 'Search…'"
            :aria-label="`Search ${label || 'options'}`"
          />
        </div>

        <div
          class="sr-only"
          aria-live="polite"
          aria-atomic="true"
        >
          {{ filteredOptions.length }} result{{ filteredOptions.length === 1 ? '' : 's' }} available
        </div>

        <div class="options-list">
          <button
            v-for="(opt, idx) in filteredOptions"
            :id="`${instanceId}-option-${opt.id}`"
            :key="opt.id"
            type="button"
            class="option-item"
            :class="{
              active: opt.id === modelValue,
              highlighted: idx === activeIndex,
              disabled: opt.disabled,
            }"
            role="option"
            :aria-selected="opt.id === modelValue"
            :disabled="opt.disabled"
            @click="select(opt.id)"
          >
            <span class="option-label">{{ opt.label }}</span>
            <svg
              v-if="opt.id === modelValue"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              class="check-icon"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>

          <div v-if="filteredOptions.length === 0" class="empty-state" role="alert">
            No matches
          </div>
        </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── Container ───────────────────────────────────────────────── */
.searchable-dropdown {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  gap: 6px;
}

/* ── Label ─────────────────────────────────────────────────────── */
.dropdown-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
}

/* ── Trigger ───────────────────────────────────────────────────── */
.dropdown-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  cursor: pointer;
  transition: border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 180px;
  max-width: 280px;
  min-height: 40px;
}
.dropdown-trigger:hover {
  border-color: var(--fg);
}
.dropdown-trigger:active {
  background: var(--fg-soft);
}
.dropdown-trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.dropdown-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dropdown-trigger[aria-expanded="true"] {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.trigger-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.chevron {
  flex-shrink: 0;
  color: var(--muted);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.rotate-180 {
  transform: rotate(180deg);
}

/* ── Dropdown Menu ───────────────────────────────────────────── */
.dropdown-menu {
  position: fixed;
  min-width: 100%;
  width: max-content;
  max-width: 320px;
  max-height: 340px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow:
    0 1px 2px color-mix(in oklch, var(--fg) 4%, transparent),
    0 4px 12px color-mix(in oklch, var(--fg) 8%, transparent);
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  outline: none;
}

/* ── Transition ────────────────────────────────────────────────── */
.menu-enter {
  animation: menuIn 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
.menu-leave {
  animation: menuOut 0.1s cubic-bezier(0.4, 0, 1, 1) forwards;
}

@keyframes menuIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes menuOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-4px);
  }
}

/* ── Search Wrap ───────────────────────────────────────────────── */
.search-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.search-icon {
  color: var(--muted);
  flex-shrink: 0;
}
.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  outline: none;
}
.search-input::placeholder {
  color: var(--muted);
}
.search-input:focus-visible {
  outline: none;
}

/* ── Options List ──────────────────────────────────────────────── */
.options-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  scroll-padding: 6px;
}

/* ── Option Item ───────────────────────────────────────────────── */
.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s cubic-bezier(0.4, 0, 0.2, 1),
              color 0.12s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 40px;
}
.option-item:hover:not(.disabled) {
  background: var(--fg-soft);
}
.option-item.highlighted {
  background: var(--fg-soft);
  outline: 1px solid color-mix(in oklch, var(--accent) 20%, transparent);
  outline-offset: -1px;
}
.option-item.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 500;
}
.option-item.active:hover:not(.disabled) {
  background: color-mix(in oklch, var(--accent) 16%, transparent);
}
.option-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.option-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.option-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.check-icon {
  flex-shrink: 0;
  color: var(--accent);
}

/* ── Empty State ───────────────────────────────────────────────── */
.empty-state {
  padding: 20px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}

/* ── Screen-reader only ─────────────────────────────────────────── */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ── Reduced Motion ────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .chevron,
  .option-item,
  .dropdown-trigger {
    transition: none !important;
  }
  .menu-enter,
  .menu-leave {
    animation: none !important;
  }
}
</style>
