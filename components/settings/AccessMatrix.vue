<script setup lang="ts">
import { toRaw } from "vue";
import type { PermissionGroup, PermissionKey, RolePermissionMatrix } from "~/types/permissions";
import type { TeamRole } from "~/types/settings";

const props = defineProps<{
  matrix: RolePermissionMatrix | null;
  groups: PermissionGroup[];
  roles: TeamRole[];
  loading?: boolean;
  saving?: boolean;
  editable?: boolean;
}>();

const emit = defineEmits<{
  save: [matrix: RolePermissionMatrix];
}>();

const draft = ref<RolePermissionMatrix | null>(null);
const dirty = ref(false);

function cloneMatrix(matrix: RolePermissionMatrix): RolePermissionMatrix {
  return JSON.parse(JSON.stringify(toRaw(matrix))) as RolePermissionMatrix;
}

watch(
  () => props.matrix,
  (value) => {
    if (!value) return;
    draft.value = cloneMatrix(value);
    dirty.value = false;
  },
  { immediate: true }
);

const roleLabels: Record<TeamRole, string> = {
  viewer: "Viewer",
  tech_writer: "Tech Writer",
  product_manager: "Product Manager",
  admin: "Admin",
};

function togglePermission(role: TeamRole, key: PermissionKey) {
  if (!props.editable || !draft.value) return;
  draft.value[role][key] = !draft.value[role][key];
  dirty.value = true;
}

function resetDraft() {
  if (!props.matrix) return;
  draft.value = cloneMatrix(props.matrix);
  dirty.value = false;
}

function saveDraft() {
  if (!draft.value) return;
  emit("save", cloneMatrix(draft.value));
}

const groups = computed(() => props.groups);
const roles = computed(() => props.roles);
</script>

<template>
  <div class="access-matrix">
    <div class="row-between access-matrix-header">
      <div>
        <h3>Role permissions</h3>
        <p class="desc">
          Configure what each workspace role can do. Super admins always have full access.
        </p>
      </div>
      <div v-if="editable" class="access-matrix-actions">
        <button class="btn btn-ghost btn-sm" :disabled="!dirty || saving" @click="resetDraft">
          Reset
        </button>
        <button class="btn btn-primary btn-sm" :disabled="!dirty || saving" @click="saveDraft">
          <span v-if="saving">Saving…</span>
          <span v-else>Save changes</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="skeleton-wrap">
      <div class="skeleton-line w-full" />
      <div class="skeleton-line w-full" />
      <div class="skeleton-line w-2/3" />
    </div>

    <div v-else-if="!groups.length || !roles.length" class="access-empty">
      <p class="desc">No permission groups loaded yet.</p>
    </div>

    <div v-else-if="draft" class="access-matrix-scroll">
      <table class="ds-table access-table">
        <thead>
          <tr>
            <th scope="col">Permission</th>
            <th v-for="role in roles" :key="role" scope="col" class="access-col-role">
              {{ roleLabels[role] }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groups" :key="group.id">
            <tr class="access-group-row">
              <td :colspan="roles.length + 1">{{ group.label }}</td>
            </tr>
            <tr v-for="permission in group.permissions" :key="permission.key">
              <td class="access-permission-cell">
                <span class="access-permission-label">{{ permission.label }}</span>
                <span class="access-permission-desc">{{ permission.description }}</span>
              </td>
              <td v-for="role in roles" :key="`${permission.key}-${role}`" class="access-check-cell">
                <label class="access-check">
                  <input
                    type="checkbox"
                    :checked="draft[role][permission.key]"
                    :disabled="!editable"
                    :aria-label="`${permission.label} for ${roleLabels[role]}`"
                    @change="togglePermission(role, permission.key)"
                  />
                </label>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.access-matrix-header {
  margin-bottom: 20px;
  gap: 16px;
  align-items: flex-start;
}

.access-matrix-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.access-matrix-scroll {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 12px);
  background: var(--surface);
}

.access-table {
  min-width: 720px;
}

.access-col-role {
  text-align: center;
  white-space: nowrap;
}

.access-group-row td {
  background: var(--bg);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  padding-top: 14px;
  padding-bottom: 8px;
}

.access-permission-cell {
  min-width: 220px;
}

.access-permission-label {
  display: block;
  font-weight: 500;
  color: var(--fg);
}

.access-permission-desc {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}

.access-check-cell {
  text-align: center;
  width: 96px;
}

.access-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.access-check input {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
}

.access-check input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.access-empty {
  padding: 24px;
  color: var(--muted);
}
</style>
