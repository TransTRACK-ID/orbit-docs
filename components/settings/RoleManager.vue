<script setup lang="ts">
import { toast } from "vue3-toastify";
import type { RoleDefinition } from "~/types/permissions";

const props = defineProps<{
  roles: RoleDefinition[];
}>();

const { createRole, updateRole, deleteRole } = usePermissions();

const levelOptions = [
  { value: 0, label: "0 — Viewer-level" },
  { value: 1, label: "1 — Tech Writer-level" },
  { value: 2, label: "2 — Product Manager-level" },
  { value: 3, label: "3 — Admin-level" },
];

const newName = ref("");
const newSlug = ref("");
const slugTouched = ref(false);
const newLevel = ref(0);
const cloneFrom = ref("");
const creating = ref(false);

watch(newName, (name) => {
  if (slugTouched.value) return;
  newSlug.value = name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[^a-z]+/, "")
    .replace(/_$/, "");
});

function onSlugInput() {
  slugTouched.value = true;
}

async function submitCreate() {
  creating.value = true;
  try {
    await createRole({
      slug: newSlug.value,
      name: newName.value,
      level: Number(newLevel.value),
      cloneFrom: cloneFrom.value || undefined,
    });
    toast.success("Role created");
    newName.value = "";
    newSlug.value = "";
    slugTouched.value = false;
    newLevel.value = 0;
    cloneFrom.value = "";
  } catch (e: any) {
    toast.error(e?.data?.message || "Failed to create role");
  } finally {
    creating.value = false;
  }
}

const editingSlug = ref<string | null>(null);
const editName = ref("");
const editLevel = ref(0);
const savingSlug = ref<string | null>(null);

function startEdit(role: RoleDefinition) {
  editingSlug.value = role.slug;
  editName.value = role.name;
  editLevel.value = role.level;
}

function cancelEdit() {
  editingSlug.value = null;
}

async function saveEdit(role: RoleDefinition) {
  savingSlug.value = role.slug;
  try {
    await updateRole(role.slug, { name: editName.value, level: Number(editLevel.value) });
    toast.success("Role updated");
    editingSlug.value = null;
  } catch (e: any) {
    toast.error(e?.data?.message || "Failed to update role");
  } finally {
    savingSlug.value = null;
  }
}

const confirmDeleteSlug = ref<string | null>(null);
const deletingSlug = ref<string | null>(null);

async function confirmDelete(role: RoleDefinition) {
  deletingSlug.value = role.slug;
  try {
    await deleteRole(role.slug);
    toast.success("Role deleted");
    confirmDeleteSlug.value = null;
  } catch (e: any) {
    toast.error(e?.data?.message || "Failed to delete role");
  } finally {
    deletingSlug.value = null;
  }
}
</script>

<template>
  <div class="role-manager">
    <h3>Roles</h3>
    <p class="desc">
      Create custom roles and assign them to members. Role slugs cannot be changed after creation.
    </p>

    <div class="role-list">
      <div v-for="role in props.roles" :key="role.slug" class="role-row">
        <template v-if="editingSlug === role.slug">
          <div class="role-edit-form">
            <div class="form-group">
              <label>Name</label>
              <input v-model="editName" type="text" />
            </div>
            <div class="form-group">
              <label>Slug</label>
              <input :value="role.slug" type="text" readonly class="mono" />
            </div>
            <div class="form-group">
              <label>Level</label>
              <select v-model.number="editLevel">
                <option v-for="opt in levelOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div class="role-actions">
              <button
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="savingSlug === role.slug"
                @click="saveEdit(role)"
              >
                Save
              </button>
              <button type="button" class="btn btn-secondary btn-sm" @click="cancelEdit">
                Cancel
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="role-meta">
            <span class="role-name">{{ role.name }}</span>
            <code class="role-slug">{{ role.slug }}</code>
            <span class="pill role-kind">{{ role.kind }}</span>
            <span class="role-level">Level {{ role.level }}</span>
            <span v-if="role.isSystem" class="pill">System</span>
          </div>
          <div class="role-actions">
            <button type="button" class="btn btn-secondary btn-sm" @click="startEdit(role)">
              Edit
            </button>
            <template v-if="confirmDeleteSlug === role.slug">
              <span>Confirm delete?</span>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="deletingSlug === role.slug"
                @click="confirmDelete(role)"
              >
                Confirm
              </button>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                @click="confirmDeleteSlug = null"
              >
                Cancel
              </button>
            </template>
            <button
              v-else
              type="button"
              class="btn btn-ghost btn-sm"
              :disabled="role.isSystem"
              :title="role.isSystem ? 'System roles cannot be deleted' : undefined"
              @click="confirmDeleteSlug = role.slug"
            >
              Delete
            </button>
          </div>
        </template>
      </div>
    </div>

    <form class="role-create" @submit.prevent="submitCreate">
      <h4>Create role</h4>
      <div class="role-create-grid">
        <div class="form-group">
          <label for="newRoleName">Name</label>
          <input id="newRoleName" v-model="newName" type="text" placeholder="Auditor" required />
        </div>
        <div class="form-group">
          <label for="newRoleSlug">Slug</label>
          <input
            id="newRoleSlug"
            v-model="newSlug"
            type="text"
            class="mono"
            placeholder="auditor"
            required
            @input="onSlugInput"
          />
        </div>
        <div class="form-group">
          <label for="newRoleLevel">Level</label>
          <select id="newRoleLevel" v-model.number="newLevel">
            <option v-for="opt in levelOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label for="newRoleClone">Clone permissions from</label>
          <select id="newRoleClone" v-model="cloneFrom">
            <option value="">Start with no permissions</option>
            <option v-for="role in props.roles" :key="role.slug" :value="role.slug">
              {{ role.name }}
            </option>
          </select>
        </div>
      </div>
      <button type="submit" class="btn btn-primary btn-sm" :disabled="creating">
        <span v-if="creating">Creating…</span>
        <span v-else>Create role</span>
      </button>
    </form>
  </div>
</template>

<style scoped>
.role-manager {
  margin-bottom: 24px;
}

.role-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0 20px;
}

.role-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--od-border, #e5e7eb);
  border-radius: 8px;
  flex-wrap: wrap;
}

.role-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.role-name {
  font-weight: 600;
}

.role-slug,
.mono {
  font-family: monospace;
  font-size: 12px;
}

.role-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.role-edit-form {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}

.role-create-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
</style>
