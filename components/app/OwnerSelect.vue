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

function onDocClick(e: MouseEvent) {
  const t = e.target as HTMLElement;
  if (!t.closest(".owner-select") && dropdownOpen.value) {
    dropdownOpen.value = false;
  }
}
onMounted(() => document.addEventListener("click", onDocClick));
onBeforeUnmount(() => document.removeEventListener("click", onDocClick));

function select(name: string) {
  emit("update:modelValue", name);
  dropdownOpen.value = false;
}

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
  dropdownOpen.value = false;
}

function openEdit(owner: Owner) {
  modalMode.value = "edit";
  ownerForm.id = owner.id;
  ownerForm.name = owner.name;
  ownerForm.email = owner.email || "";
  ownerForm.role = owner.role || "";
  ownerNameError.value = false;
  showModal.value = true;
  dropdownOpen.value = false;
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
  <div class="owner-select" style="position: relative">
    <div
      class="owner-trigger"
      :class="{ open: dropdownOpen }"
      @click.stop="dropdownOpen = !dropdownOpen"
    >
      <span class="owner-trigger-text">{{ modelValue || "Select owner…" }}</span>
      <IconsChevronDown size="14" class="stroke-gray-900" />
    </div>

    <div v-if="dropdownOpen" class="dropdown-menu owner-menu">
      <div v-for="o in owners" :key="o.id" class="owner-item">
        <span
          class="owner-name"
          :class="{ active: modelValue === o.name }"
          @click="select(o.name)"
        >
          <span v-if="modelValue === o.name" class="check">✓</span>
          <span v-else class="check-placeholder" />
          {{ o.name }}
        </span>
        <button
          type="button"
          class="owner-edit-btn"
          title="Edit owner"
          @click.stop="openEdit(o)"
        >
          <IconsPencil size="12" />
        </button>
      </div>

      <div
        v-if="owners.length === 0 && !isLoading"
        class="dropdown-item"
        style="color: var(--muted)"
      >
        No owners yet
      </div>

      <div class="dropdown-divider" />
      <div
        class="dropdown-item"
        style="color: var(--accent); font-weight: 500"
        @click="openAdd"
      >
        + Add new owner
      </div>
    </div>

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
  width: 100%;
}

.owner-trigger {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--od-border, var(--border, #ddd));
  border-radius: var(--od-radius, 8px);
  background: var(--od-bg, var(--bg, #fafafa));
  font: inherit;
  font-size: 14px;
  color: var(--od-fg, var(--fg, #111));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.owner-trigger:hover {
  border-color: var(--od-muted, var(--muted, #888));
}
.owner-trigger.open,
.owner-trigger:focus-visible {
  outline: none;
  border-color: var(--od-accent, var(--accent, oklch(55% 0.16 25)));
  box-shadow: 0 0 0 3px var(--od-accent-soft, var(--accent-soft, rgba(0,0,0,0.05)));
}

.owner-menu {
  width: 100%;
  min-width: 240px;
}

.owner-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0;
}

.owner-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  font-size: 14px;
  color: var(--fg);
  cursor: pointer;
  transition: background 0.1s;
  user-select: none;
}
.owner-name:hover {
  background: var(--fg-soft);
}
.owner-name.active {
  color: var(--accent);
  font-weight: 500;
}

.owner-edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  margin-right: 8px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}
.owner-item:hover .owner-edit-btn {
  opacity: 1;
}
.owner-edit-btn:hover {
  color: var(--fg);
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

.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 4px 16px color-mix(in oklch, var(--fg) 10%, transparent);
  min-width: 200px;
  padding: 6px 0;
  z-index: 50;
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  font-size: 14px;
  color: var(--fg);
  cursor: pointer;
  transition: background 0.1s;
  user-select: none;
}
.dropdown-item:hover {
  background: var(--fg-soft);
}
.dropdown-divider {
  height: 1px;
  background: var(--border);
  margin: 6px 0;
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
  color: oklch(50% 0.16 25);
  font-size: 12px;
  margin-top: 4px;
}
.error-msg.show {
  display: block;
}
.input-error {
  border-color: oklch(55% 0.18 25) !important;
  box-shadow: 0 0 0 3px color-mix(in oklch, oklch(55% 0.18 25) 20%, transparent) !important;
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
  background: oklch(55% 0.16 25);
  color: var(--surface);
  border-color: oklch(55% 0.16 25);
}
.btn-danger:hover {
  background: oklch(50% 0.18 25);
}

@media (prefers-reduced-motion: reduce) {
  .modal-overlay,
  .modal,
  .btn,
  .owner-trigger,
  .owner-edit-btn {
    transition: none !important;
  }
}
</style>
