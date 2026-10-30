<script setup lang="ts">
import { usePageStore } from "~/store/page";

interface Owner {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

definePageMeta({
  auth: true,
});

const $page = usePageStore();
const { can } = usePermissions();
const canManage = computed(() => can("owners:write"));
onBeforeMount(() => {
  $page.setTitle("Owners");
});

const owners = ref<Owner[]>([]);
const isLoading = ref(false);
const searchQuery = ref("");

const showCreateModal = ref(false);
const showEditModal = ref(false);
const showDeleteModal = ref(false);

const createForm = reactive({ name: "", email: "", role: "" });
const createNameError = ref(false);
const isCreating = ref(false);

const editForm = reactive({ id: "", name: "", email: "", role: "" });
const editNameError = ref(false);
const isEditing = ref(false);

const ownerToDelete = ref<Owner | null>(null);
const isDeleting = ref(false);

const ownerStats = computed(() => [
  { label: "Total owners", value: owners.value.length },
  { label: "With email", value: owners.value.filter((o) => o.email).length },
]);

const filteredOwners = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return owners.value;
  return owners.value.filter(
    (o) =>
      o.name.toLowerCase().includes(q) ||
      (o.email && o.email.toLowerCase().includes(q)) ||
      (o.role && o.role.toLowerCase().includes(q))
  );
});

async function fetchOwners() {
  isLoading.value = true;
  try {
    const res = await $fetch<{ data: Owner[] }>("/api/owners");
    owners.value = res.data;
  } catch (err) {
    console.error("Failed to fetch owners", err);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchOwners();
});

function openCreateModal() {
  showCreateModal.value = true;
  createNameError.value = false;
  createForm.name = "";
  createForm.email = "";
  createForm.role = "";
}

function closeCreateModal() {
  showCreateModal.value = false;
  createNameError.value = false;
}

async function submitCreate() {
  if (!createForm.name.trim()) {
    createNameError.value = true;
    return;
  }
  createNameError.value = false;
  isCreating.value = true;
  try {
    await $fetch("/api/owners", {
      method: "POST",
      body: {
        name: createForm.name.trim(),
        email: createForm.email || null,
        role: createForm.role || null,
      },
    });
    await fetchOwners();
    closeCreateModal();
  } catch (err) {
    console.error("Failed to create owner", err);
  } finally {
    isCreating.value = false;
  }
}

function openEditModal(owner: Owner) {
  showEditModal.value = true;
  editNameError.value = false;
  editForm.id = owner.id;
  editForm.name = owner.name;
  editForm.email = owner.email || "";
  editForm.role = owner.role || "";
}

function closeEditModal() {
  showEditModal.value = false;
  editNameError.value = false;
}

async function submitEdit() {
  if (!editForm.name.trim()) {
    editNameError.value = true;
    return;
  }
  editNameError.value = false;
  isEditing.value = true;
  try {
    await $fetch(`/api/owners/${editForm.id}`, {
      method: "PUT",
      body: {
        name: editForm.name.trim(),
        email: editForm.email || null,
        role: editForm.role || null,
      },
    });
    await fetchOwners();
    closeEditModal();
  } catch (err) {
    console.error("Failed to update owner", err);
  } finally {
    isEditing.value = false;
  }
}

function confirmDelete(owner: Owner) {
  ownerToDelete.value = owner;
  showDeleteModal.value = true;
}

function closeDeleteModal() {
  showDeleteModal.value = false;
  ownerToDelete.value = null;
}

async function doDelete() {
  if (!ownerToDelete.value || isDeleting.value) return;
  isDeleting.value = true;
  try {
    await $fetch(`/api/owners/${ownerToDelete.value.id}`, { method: "DELETE" });
    await fetchOwners();
    closeDeleteModal();
  } catch (err) {
    console.error("Failed to delete owner", err);
  } finally {
    isDeleting.value = false;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
</script>

<template>
  <div class="owners-page">
    <GeneralPageHeader
      v-model:search="searchQuery"
      title="Owners"
      subtitle="People accountable for each app. Pick an owner when you create or edit an app."
      search-placeholder="Search owners…"
      search-label="Search owners"
      :stats="ownerStats"
      stats-label="Owner summary"
    >
      <template v-if="canManage" #actions>
        <button type="button" class="btn btn-primary" @click="openCreateModal">
          + New Owner
        </button>
      </template>
    </GeneralPageHeader>

    <!-- Owners Table -->
    <div class="row-between" style="margin-bottom:16px;">
      <h2>All owners</h2>
      <span v-if="searchQuery.trim()" class="result-count">
        {{ filteredOwners.length }} result{{ filteredOwners.length === 1 ? '' : 's' }}
      </span>
    </div>

    <div v-if="isLoading" class="card" style="padding: 32px;">
      <div class="animate-pulse space-y-3">
        <div class="h-4 bg-gray-200 rounded w-3/4"></div>
        <div class="h-3 bg-gray-200 rounded w-1/2"></div>
        <div class="h-3 bg-gray-200 rounded w-2/3"></div>
      </div>
    </div>

    <div v-else-if="filteredOwners.length === 0" class="empty-state">
      <p v-if="searchQuery.trim()">No owners match your search.</p>
      <p v-else-if="canManage">No owners yet. Create one to get started.</p>
      <p v-else>No owners yet.</p>
    </div>

    <div v-else class="card" style="padding: 0; overflow: hidden;">
      <table class="ds-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Updated</th>
            <th v-if="canManage" style="width: 100px; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="owner in filteredOwners" :key="owner.id">
            <td>
              <div class="owner-name">{{ owner.name }}</div>
            </td>
            <td class="cell-muted">{{ owner.email || "—" }}</td>
            <td>
              <span v-if="owner.role" class="pill pill-blue">{{ owner.role }}</span>
              <span v-else class="cell-muted">—</span>
            </td>
            <td class="num cell-muted">{{ formatDate(owner.updatedAt) }}</td>
            <td v-if="canManage" style="text-align: right;">
              <div class="row-actions">
                <button
                  class="btn btn-ghost btn-sm action-btn"
                  title="Edit owner"
                  @click="openEditModal(owner)"
                >
                  <IconsPencil size="14" />
                </button>
                <button
                  class="btn btn-ghost btn-sm action-btn"
                  title="Delete owner"
                  @click="confirmDelete(owner)"
                >
                  <IconsTrash size="14" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Modal -->
    <div class="modal-overlay" :class="{ open: showCreateModal }" @click.self="closeCreateModal">
      <div class="modal">
        <div class="modal-header">
          <h2>Create New Owner</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="closeCreateModal">
            ✕
          </button>
        </div>
        <form novalidate @submit.prevent="submitCreate">
          <div class="modal-body">
            <div class="form-group">
              <label for="ownerName">Name</label>
              <input
                id="ownerName"
                v-model="createForm.name"
                type="text"
                placeholder="e.g. Sarah Chen"
                required
                :class="{ 'input-error': createNameError }"
                aria-describedby="ownerNameError"
                @input="createNameError = false"
              />
              <span id="ownerNameError" class="error-msg" :class="{ show: createNameError }">
                Name is required
              </span>
            </div>
            <div class="form-group">
              <label for="ownerEmail">
                Email <span class="opt">(optional)</span>
              </label>
              <input id="ownerEmail" v-model="createForm.email" type="email" placeholder="sarah@company.com" />
            </div>
            <div class="form-group">
              <label for="ownerRole">
                Role <span class="opt">(optional)</span>
              </label>
              <input id="ownerRole" v-model="createForm.role" type="text" placeholder="e.g. Engineering Lead" />
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeCreateModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="isCreating">
              <span v-if="isCreating">Creating…</span>
              <span v-else>Create Owner</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Modal -->
    <div class="modal-overlay" :class="{ open: showEditModal }" @click.self="closeEditModal">
      <div class="modal">
        <div class="modal-header">
          <h2>Edit Owner</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="closeEditModal">
            ✕
          </button>
        </div>
        <form novalidate @submit.prevent="submitEdit">
          <div class="modal-body">
            <div class="form-group">
              <label for="editOwnerName">Name</label>
              <input
                id="editOwnerName"
                v-model="editForm.name"
                type="text"
                required
                :class="{ 'input-error': editNameError }"
                aria-describedby="editOwnerNameError"
                @input="editNameError = false"
              />
              <span id="editOwnerNameError" class="error-msg" :class="{ show: editNameError }">
                Name is required
              </span>
            </div>
            <div class="form-group">
              <label for="editOwnerEmail">
                Email <span class="opt">(optional)</span>
              </label>
              <input id="editOwnerEmail" v-model="editForm.email" type="email" placeholder="sarah@company.com" />
            </div>
            <div class="form-group">
              <label for="editOwnerRole">
                Role <span class="opt">(optional)</span>
              </label>
              <input id="editOwnerRole" v-model="editForm.role" type="text" placeholder="e.g. Engineering Lead" />
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeEditModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="isEditing">
              <span v-if="isEditing">Saving…</span>
              <span v-else>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal-overlay" :class="{ open: showDeleteModal }" @click.self="closeDeleteModal">
      <div class="modal" style="width: 400px;">
        <div class="modal-header">
          <h2>Delete Owner</h2>
          <button type="button" class="modal-close" aria-label="Close modal" @click="closeDeleteModal">
            ✕
          </button>
        </div>
        <div class="modal-body">
          <p style="margin:0;color:var(--muted);">
            Are you sure you want to delete <strong>{{ ownerToDelete?.name }}</strong>? This action cannot be undone.
          </p>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" @click="closeDeleteModal">
            Cancel
          </button>
          <button type="button" class="btn btn-danger" :disabled="isDeleting" @click="doDelete">
            <span v-if="isDeleting">Deleting…</span>
            <span v-else>Delete</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.owners-page {
  /* Inherits global semantic tokens from :root — no local overrides so dark mode works */
}

h2 {
  margin: 0;
  font-weight: 600;
  font-size: 18px;
  color: var(--fg);
}

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.card:hover {
  box-shadow: 0 1px 3px var(--fg-soft);
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}
.pill-blue {
  background: color-mix(in oklch, var(--info) 12%, transparent);
  color: var(--info-text);
}

.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.ds-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.ds-table th,
.ds-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
.ds-table th {
  color: var(--muted);
  font-weight: 500;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.ds-table tbody tr:hover {
  background: var(--fg-soft);
}
.ds-table tbody tr:last-child td {
  border-bottom: none;
}

.owner-name {
  font-weight: 500;
  color: var(--fg);
}
.cell-muted {
  color: var(--muted);
  font-size: 14px;
}

.empty-state {
  text-align: center;
  padding: 48px 0;
  color: var(--muted);
}

.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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
.btn-ghost {
  background: transparent;
  color: var(--muted);
  border-color: transparent;
}
.btn-ghost:hover {
  color: var(--fg);
}
.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}
.btn-danger {
  background: oklch(55% 0.16 25);
  color: var(--surface);
  border-color: oklch(55% 0.16 25);
}
.btn-danger:hover {
  background: oklch(50% 0.18 25);
}
.action-btn {
  padding: 4px;
  border-radius: 6px;
}

.result-count {
  font-size: 13px;
  color: var(--muted);
  font-family: var(--font-mono);
}

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
.error-msg {
  display: none;
  color: var(--error-text);
  font-size: 12px;
  margin-top: 4px;
}
.error-msg.show {
  display: block;
}
.form-group input,
.form-group textarea,
.form-group select {
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
.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.input-error {
  border-color: var(--error) !important;
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--error) 20%, transparent) !important;
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .modal-overlay,
  .modal,
  .btn {
    transition: none !important;
  }
}
</style>
