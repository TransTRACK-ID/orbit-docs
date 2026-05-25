<script setup lang="ts">
import { toast } from "vue3-toastify";

interface Owner {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
}

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const owners = ref<Owner[]>([]);
const isLoading = ref(false);
const dropdownOpen = ref(false);
const searchQuery = ref("");
const activeIndex = ref(-1);
const dropdownRef = ref<HTMLDivElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const menuRef = ref<HTMLDivElement | null>(null);

const instanceId = computed(() => `owner-select-${Math.random().toString(36).slice(2, 9)}`);

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

async function fetchOwners() {
  isLoading.value = true;
  try {
    const res = await $fetch<{ data: Owner[] }>("/api/owners");
    owners.value = res.data;
  } catch {
    owners.value = [];
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchOwners);

const filteredOwners = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return owners.value;
  return owners.value.filter((o) => o.name.toLowerCase().includes(q));
});

const activeDescendantId = computed(() => {
  if (activeIndex.value < 0 || activeIndex.value >= filteredOwners.value.length) return undefined;
  const owner = filteredOwners.value[activeIndex.value];
  if (!owner) return undefined;
  return `${instanceId.value}-option-${owner.id}`;
});

function open() {
  dropdownOpen.value = true;
  updateMenuPosition();
  activeIndex.value = filteredOwners.value.findIndex((o) => o.name === props.modelValue);
  nextTick(() => {
    searchInputRef.value?.focus();
    scrollActiveIntoView();
  });
}

function close(returnFocus = true) {
  dropdownOpen.value = false;
  searchQuery.value = "";
  activeIndex.value = -1;
  if (returnFocus) {
    nextTick(() => triggerRef.value?.focus());
  }
}

function toggle() {
  if (dropdownOpen.value) close();
  else open();
}

function select(name: string) {
  emit("update:modelValue", name);
  close();
}

function highlightNext() {
  const len = filteredOwners.value.length;
  if (len === 0) return;
  let next = activeIndex.value + 1;
  if (next >= len) next = 0;
  activeIndex.value = next;
  scrollActiveIntoView();
}

function highlightPrev() {
  const len = filteredOwners.value.length;
  if (len === 0) return;
  let prev = activeIndex.value - 1;
  if (prev < 0) prev = len - 1;
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
  switch (e.key) {
    case "ArrowDown":
    case "ArrowUp":
    case "Enter":
    case " ":
      e.preventDefault();
      open();
      break;
    case "Escape":
      if (dropdownOpen.value) {
        e.preventDefault();
        close();
      }
      break;
  }
}

function onMenuKeydown(e: KeyboardEvent) {
  if (!dropdownOpen.value) return;
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
      activeIndex.value = Math.max(0, filteredOwners.value.length - 1);
      scrollActiveIntoView();
      break;
    case "Enter":
    case " ": {
      const active = filteredOwners.value[activeIndex.value];
      if (active) {
        e.preventDefault();
        select(active.name);
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

function onDocClick(e: MouseEvent) {
  const t = e.target as HTMLElement;
  if (
    !t.closest(".owner-select") &&
    (!menuRef.value || !menuRef.value.contains(t)) &&
    dropdownOpen.value
  ) {
    close(false);
  }
}

function onScrollResize() {
  if (dropdownOpen.value) close(false);
}

onMounted(() => {
  document.addEventListener("click", onDocClick);
  window.addEventListener("scroll", onScrollResize, true);
  window.addEventListener("resize", onScrollResize);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick);
  window.removeEventListener("scroll", onScrollResize, true);
  window.removeEventListener("resize", onScrollResize);
});

/* ─── owner modal ───────────────────────────────────────────── */
const showModal = ref(false);
const modalMode = ref<"add" | "edit">("add");
const ownerForm = reactive({ id: "", name: "", email: "", role: "" });
const ownerNameError = ref(false);
const isSaving = ref(false);

function openAdd() {
  modalMode.value = "add";
  ownerForm.id = "";
  ownerForm.name = "";
  ownerForm.email = "";
  ownerForm.role = "";
  ownerNameError.value = false;
  showModal.value = true;
  close(false);
}

function openEdit(owner: Owner) {
  modalMode.value = "edit";
  ownerForm.id = owner.id;
  ownerForm.name = owner.name;
  ownerForm.email = owner.email || "";
  ownerForm.role = owner.role || "";
  ownerNameError.value = false;
  showModal.value = true;
  close(false);
}

function closeModal() {
  showModal.value = false;
  ownerNameError.value = false;
}

async function submitOwner() {
  if (!ownerForm.name.trim()) {
    ownerNameError.value = true;
    return;
  }
  ownerNameError.value = false;
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    if (modalMode.value === "add") {
      const res = await $fetch<{ data: Owner }>("/api/owners", {
        method: "POST",
        body: {
          name: ownerForm.name.trim(),
          email: ownerForm.email || null,
          role: ownerForm.role || null,
        },
      });
      owners.value.push(res.data);
      emit("update:modelValue", res.data.name);
      toast.success(`Owner "${res.data.name}" added`);
    } else {
      const oldOwner = owners.value.find((o) => o.id === ownerForm.id);
      const oldName = oldOwner?.name;
      const res = await $fetch<{ data: Owner }>(`/api/owners/${ownerForm.id}`, {
        method: "PUT",
        body: {
          name: ownerForm.name.trim(),
          email: ownerForm.email || null,
          role: ownerForm.role || null,
        },
      });
      const idx = owners.value.findIndex((o) => o.id === ownerForm.id);
      if (idx !== -1) owners.value[idx] = res.data;
      if (props.modelValue && props.modelValue === oldName) {
        emit("update:modelValue", res.data.name);
      }
      toast.success(`Owner "${res.data.name}" updated`);
    }
    closeModal();
  } catch (e: any) {
    toast.error(e?.data?.message || "Failed to save owner");
  } finally {
    isSaving.value = false;
  }
}

async function deleteOwner() {
  if (!ownerForm.id || isSaving.value) return;
  isSaving.value = true;
  try {
    await $fetch(`/api/owners/${ownerForm.id}`, { method: "DELETE" });
    const idx = owners.value.findIndex((o) => o.id === ownerForm.id);
    const removed = owners.value[idx];
    owners.value.splice(idx, 1);
    if (props.modelValue && props.modelValue === removed?.name) {
      emit("update:modelValue", "");
    }
    toast.success("Owner deleted");
    closeModal();
  } catch (e: any) {
    toast.error(e?.data?.message || "Failed to delete owner");
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div ref="dropdownRef" class="owner-select">
    <button
      :id="`${instanceId}-trigger`"
      ref="triggerRef"
      type="button"
      class="owner-trigger"
      :class="{ open: dropdownOpen }"
      :aria-expanded="dropdownOpen"
      aria-haspopup="listbox"
      :aria-controls="dropdownOpen ? `${instanceId}-listbox` : undefined"
      :aria-activedescendant="dropdownOpen ? activeDescendantId : undefined"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="owner-trigger-text">
        <template v-if="isLoading">Loading…</template>
        <template v-else>{{ modelValue || "Select owner…" }}</template>
      </span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        :class="{ 'rotate-180': dropdownOpen }"
        class="chevron"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <Teleport to="body">
      <Transition enter-active-class="menu-enter" leave-active-class="menu-leave">
        <div
          v-show="dropdownOpen"
          ref="menuRef"
          :id="`${instanceId}-listbox`"
          class="dropdown-menu owner-menu"
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
            placeholder="Search owners…"
            aria-label="Search owners"
          />
        </div>

        <div class="options-list">
          <div
            v-for="(o, idx) in filteredOwners"
            :id="`${instanceId}-option-${o.id}`"
            :key="o.id"
            class="owner-option"
            :class="{
              active: modelValue === o.name,
              highlighted: idx === activeIndex,
            }"
            role="option"
            :aria-selected="modelValue === o.name"
            @click="select(o.name)"
          >
            <span class="option-label">
              <span v-if="modelValue === o.name" class="check">✓</span>
              <span v-else class="check-placeholder" />
              {{ o.name }}
            </span>
            <button
              type="button"
              class="owner-edit-btn"
              :aria-label="`Edit ${o.name}`"
              title="Edit owner"
              @click.stop="openEdit(o)"
            >
              <IconsPencil size="12" />
            </button>
          </div>

          <div
            v-if="filteredOwners.length === 0 && !isLoading"
            class="empty-state"
            role="alert"
          >
            No matches
          </div>
        </div>

        <div class="dropdown-divider" />
        <button type="button" class="add-owner-btn" @click="openAdd">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add new owner
        </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Owner Add / Edit Modal -->
    <div
      class="modal-overlay"
      :class="{ open: showModal }"
      @click.self="closeModal"
    >
      <div class="modal" style="width: 440px">
        <div class="modal-header">
          <h2>{{ modalMode === "add" ? "Add Owner" : "Edit Owner" }}</h2>
          <button
            type="button"
            class="modal-close"
            aria-label="Close modal"
            @click="closeModal"
          >
            ✕
          </button>
        </div>
        <form novalidate @submit.prevent="submitOwner">
          <div class="modal-body">
            <div class="form-group">
              <label for="ownerName">Name</label>
              <input
                id="ownerName"
                v-model="ownerForm.name"
                type="text"
                placeholder="e.g. Sarah Chen"
                :class="{ 'input-error': ownerNameError }"
                @input="ownerNameError = false"
              />
              <span class="error-msg" :class="{ show: ownerNameError }">
                Name is required
              </span>
            </div>
            <div class="form-group">
              <label for="ownerEmail">
                Email <span class="opt">(optional)</span>
              </label>
              <input
                id="ownerEmail"
                v-model="ownerForm.email"
                type="email"
                placeholder="sarah@company.com"
              />
            </div>
            <div class="form-group">
              <label for="ownerRole">
                Role <span class="opt">(optional)</span>
              </label>
              <input
                id="ownerRole"
                v-model="ownerForm.role"
                type="text"
                placeholder="e.g. Engineering Lead"
              />
            </div>
          </div>
          <div class="modal-foot" style="justify-content: space-between">
            <button
              v-if="modalMode === 'edit'"
              type="button"
              class="btn btn-danger"
              :disabled="isSaving"
              @click="deleteOwner"
            >
              <span v-if="isSaving">…</span>
              <span v-else>Delete</span>
            </button>
            <div style="display: flex; gap: 10px">
              <button
                type="button"
                class="btn btn-secondary"
                @click="closeModal"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="isSaving"
              >
                <span v-if="isSaving">Saving…</span>
                <span v-else>
                  {{ modalMode === "add" ? "Add Owner" : "Save Changes" }}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.owner-select {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  width: 100%;
}

.owner-trigger {
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
  min-height: 40px;
  width: 100%;
  text-align: left;
}
.owner-trigger:hover {
  border-color: var(--fg);
}
.owner-trigger:active {
  background: var(--fg-soft);
}
.owner-trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.owner-trigger.open {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.owner-trigger-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  flex-shrink: 0;
  color: var(--muted);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.rotate-180 {
  transform: rotate(180deg);
}

/* ── Dropdown Menu ─────────────────────────────────────────────── */
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

/* ── Options List ────────────────────────────────────────────── */
.options-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  scroll-padding: 6px;
}

/* ── Owner Option ────────────────────────────────────────────── */
.owner-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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
.owner-option:hover {
  background: var(--fg-soft);
}
.owner-option.highlighted {
  background: var(--fg-soft);
  outline: 1px solid color-mix(in oklch, var(--accent) 20%, transparent);
  outline-offset: -1px;
}
.owner-option.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 500;
}
.owner-option.active:hover {
  background: color-mix(in oklch, var(--accent) 16%, transparent);
}

.option-label {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.check {
  width: 16px;
  text-align: center;
  font-size: 13px;
}
.check-placeholder {
  width: 16px;
  display: inline-block;
}

.owner-edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}
.owner-option:hover .owner-edit-btn {
  opacity: 1;
}
.owner-edit-btn:hover {
  color: var(--fg);
}

/* ── Empty State ─────────────────────────────────────────────── */
.empty-state {
  padding: 20px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}

/* ── Add Owner Button ────────────────────────────────────────── */
.add-owner-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin: 6px;
  border-radius: 6px;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--accent);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s cubic-bezier(0.4, 0, 0.2, 1);
  width: calc(100% - 12px);
}
.add-owner-btn:hover {
  background: var(--accent-soft);
}

.dropdown-divider {
  height: 1px;
  background: var(--border);
  margin: 6px 0;
  flex-shrink: 0;
}

/* ─── modal primitives (mirrored from apps page) ────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: color-mix(in oklch, var(--fg) 35%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-overlay.open {
  opacity: 1;
  pointer-events: auto;
}
.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 520px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 20px 60px color-mix(in oklch, var(--fg) 15%, transparent);
  transform: translateY(12px) scale(0.98);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-overlay.open .modal {
  transform: translateY(0) scale(1);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}
.modal-header h2 {
  font-size: 18px;
  margin: 0;
  font-weight: 600;
}
.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  font-size: 16px;
}
.modal-close:hover {
  color: var(--fg);
  border-color: var(--fg);
}
.modal-body {
  padding: 20px 24px;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}

.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--fg);
}
.form-group label .opt {
  color: var(--muted);
  font-weight: 400;
}
.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.form-group input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.error-msg {
  display: none;
  color: var(--od-error-text);
  font-size: 12px;
  margin-top: 4px;
}
.error-msg.show {
  display: block;
}
.input-error {
  border-color: var(--od-error) !important;
  box-shadow: 0 0 0 3px var(--od-error-soft) !important;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  background: transparent;
}
.btn-primary {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}
.btn-primary:hover {
  background: color-mix(in oklch, var(--accent) 88%, black);
}
.btn-secondary {
  background: transparent;
  color: var(--fg);
  border-color: var(--border);
}
.btn-secondary:hover {
  border-color: var(--fg);
}
.btn-danger {
  background: var(--od-error);
  color: var(--surface);
  border-color: var(--od-error);
}
.btn-danger:hover {
  background: color-mix(in oklch, var(--od-error) 88%, black);
}

@media (prefers-reduced-motion: reduce) {
  .modal-overlay,
  .modal,
  .btn,
  .owner-trigger,
  .owner-edit-btn,
  .chevron,
  .owner-option,
  .add-owner-btn {
    transition: none !important;
  }
  .menu-enter,
  .menu-leave {
    animation: none !important;
  }
}
</style>
