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

const permissionCount = computed(() =>
  groups.value.reduce((total, group) => total + group.permissions.length, 0)
);

const groupCount = computed(() => groups.value.length);
</script>

<template>
  <div class="access-matrix">
    <header class="access-matrix-toolbar">
      <div class="access-matrix-intro">
        <div class="access-matrix-title-row">
          <h3>Role permissions</h3>
          <span v-if="dirty" class="access-unsaved-pill">Unsaved changes</span>
        </div>
        <p class="desc">
          Configure what each workspace role can do. Super admins always have full access.
        </p>
        <p v-if="groups.length && roles.length" class="access-matrix-meta">
          {{ groupCount }} groups · {{ permissionCount }} permissions · {{ roles.length }} roles
        </p>
      </div>

      <div v-if="editable" class="access-matrix-actions">
        <button class="btn btn-secondary btn-sm" :disabled="!dirty || saving" @click="resetDraft">
          Reset
        </button>
        <button class="btn btn-primary btn-sm" :disabled="!dirty || saving" @click="saveDraft">
          <span v-if="saving">Saving…</span>
          <span v-else>Save changes</span>
        </button>
      </div>
    </header>

    <div v-if="loading" class="access-matrix-loading">
      <div class="skeleton-wrap">
        <div class="skeleton-line w-full" />
        <div class="skeleton-line w-full" />
        <div class="skeleton-line w-2/3" />
      </div>
    </div>

    <div v-else-if="!groups.length || !roles.length" class="access-empty">
      <p class="desc">No permission groups loaded yet.</p>
    </div>

    <div v-else-if="draft" class="table-panel access-matrix-panel">
      <div class="table-scroll access-matrix-scroll" tabindex="0" aria-label="Role permissions matrix">
        <table class="ds-table access-table">
          <thead>
            <tr>
              <th scope="col" class="access-col-permission">Permission</th>
              <th
                v-for="role in roles"
                :key="role"
                scope="col"
                class="access-col-role"
              >
                {{ roleLabels[role] }}
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in groups" :key="group.id">
              <tr class="access-group-row">
                <th scope="rowgroup" :colspan="roles.length + 1">
                  {{ group.label }}
                </th>
              </tr>
              <tr
                v-for="permission in group.permissions"
                :key="permission.key"
                class="access-permission-row"
              >
                <th scope="row" class="access-permission-cell">
                  <span class="access-permission-label">{{ permission.label }}</span>
                  <span class="access-permission-desc">{{ permission.description }}</span>
                </th>
                <td
                  v-for="role in roles"
                  :key="`${permission.key}-${role}`"
                  class="access-check-cell"
                >
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
  </div>
</template>

<style scoped>
.access-matrix {
  --access-space-tight: 8px;
  --access-space-group: 12px;
  --access-space-section: 24px;
  --access-role-col: 104px;
}

.access-matrix-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--access-space-section);
  margin-bottom: var(--access-space-section);
}

.access-matrix-intro {
  min-width: 0;
  flex: 1;
}

.access-matrix-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--access-space-group);
  margin-bottom: 4px;
}

.access-matrix h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--fg);
}

.access-matrix .desc {
  margin: 0;
  max-width: 62ch;
}

.access-matrix-meta {
  margin: 10px 0 0;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.access-unsaved-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 100px;
  background: color-mix(in oklch, var(--warning, oklch(75% 0.14 85)) 18%, transparent);
  color: var(--warning-text, oklch(45% 0.12 85));
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.access-matrix-actions {
  display: flex;
  gap: var(--access-space-tight);
  flex-shrink: 0;
}

.access-matrix-loading,
.access-empty {
  padding: var(--access-space-section);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 12px);
}

.access-empty .desc {
  margin: 0;
}

.access-matrix-panel {
  background: var(--surface);
  border-color: var(--border);
}

.access-matrix-scroll {
  max-height: min(72vh, 880px);
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.access-matrix-scroll:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.access-table {
  min-width: 760px;
  border-collapse: separate;
  border-spacing: 0;
}

.access-table :is(th, td) {
  border-bottom: 1px solid var(--border);
}

.access-col-permission,
.access-permission-cell {
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 240px;
  max-width: 360px;
  background: var(--surface);
  text-align: left;
  font-weight: 400;
}

.access-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--surface);
  padding-top: 14px;
  padding-bottom: 14px;
  vertical-align: bottom;
}

.access-table thead .access-col-permission {
  z-index: 3;
}

.access-col-role {
  width: var(--access-role-col);
  min-width: var(--access-role-col);
  text-align: center;
  white-space: nowrap;
}

.access-group-row th {
  padding: 18px 16px 8px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
}

.access-group-row + .access-permission-row .access-permission-cell,
.access-group-row + .access-permission-row .access-check-cell {
  border-top: none;
}

.access-permission-row:hover .access-permission-cell,
.access-permission-row:hover .access-check-cell {
  background: var(--fg-soft);
}

.access-permission-cell {
  padding: 14px 16px;
}

.access-permission-label {
  display: block;
  font-weight: 500;
  color: var(--fg);
}

.access-permission-desc {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--muted);
}

.access-check-cell {
  width: var(--access-role-col);
  min-width: var(--access-role-col);
  padding: 0;
  text-align: center;
  vertical-align: middle;
  background: var(--surface);
}

.access-check {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 0 16px;
  cursor: pointer;
}

.access-check input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.access-check input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.access-table tbody tr:last-child :is(th, td) {
  border-bottom: none;
}

@media (max-width: 768px) {
  .access-matrix-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .access-matrix-actions {
    justify-content: flex-end;
  }

  .access-col-permission,
  .access-permission-cell {
    min-width: 200px;
  }
}
</style>
