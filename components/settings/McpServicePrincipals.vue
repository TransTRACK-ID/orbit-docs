<script setup lang="ts">
import { toast } from "vue3-toastify";
import type { RoleDefinition } from "~/types/permissions";

const props = defineProps<{
  roles: RoleDefinition[];
}>();

interface McpKeyRow {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  isEnvKey: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
}

const keys = ref<McpKeyRow[]>([]);
const loading = ref(false);
const newKeyName = ref("");
const newKeyRole = ref("mcp_service");
const creating = ref(false);
const newApiKey = ref<string | null>(null);

async function loadKeys(clearNewKey = true) {
  if (clearNewKey) newApiKey.value = null;
  loading.value = true;
  try {
    const data = await $fetch<{ data: McpKeyRow[] }>("/api/settings/mcp-service-principals");
    keys.value = data.data;
  } catch (e: any) {
    toast.error(e?.data?.message || "Failed to load MCP keys");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadKeys();
});

function formatDate(value: string | null): string {
  if (!value) return "Never";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

async function updateKey(key: McpKeyRow, payload: { role?: string; isActive?: boolean }) {
  try {
    await $fetch(`/api/settings/mcp-service-principals/${key.id}`, {
      method: "PUT",
      body: payload,
    });
    toast.success("MCP key updated");
  } catch (e: any) {
    toast.error(e?.data?.message || "Failed to update MCP key");
  }
  await loadKeys();
}

async function deleteKey(key: McpKeyRow) {
  try {
    await $fetch(`/api/settings/mcp-service-principals/${key.id}`, { method: "DELETE" });
    toast.success("MCP key deleted");
  } catch (e: any) {
    toast.error(e?.data?.message || "Failed to delete MCP key");
  }
  await loadKeys();
}

async function createKey() {
  creating.value = true;
  try {
    const data = await $fetch<{ data: McpKeyRow & { apiKey: string } }>(
      "/api/settings/mcp-service-principals",
      {
        method: "POST",
        body: { name: newKeyName.value, role: newKeyRole.value },
      },
    );
    newApiKey.value = data.data.apiKey;
    newKeyName.value = "";
    toast.success("MCP key created");
    await loadKeys(false);
  } catch (e: any) {
    toast.error(e?.data?.message || "Failed to create MCP key");
  } finally {
    creating.value = false;
  }
}

async function copyNewKey() {
  if (!newApiKey.value) return;
  await navigator.clipboard.writeText(newApiKey.value);
  toast.success("Key copied");
}
</script>

<template>
  <div class="mcp-keys">
    <h3>MCP API keys</h3>
    <p class="desc">
      Named keys for automations. Each key acts with its assigned role's permissions, limited to
      published content.
    </p>

    <p v-if="loading" class="desc">Loading MCP keys…</p>

    <div v-else class="mcp-key-list">
      <div v-for="key in keys" :key="key.id" class="mcp-key-row">
        <div class="mcp-key-meta">
          <span class="mcp-key-name">{{ key.name }}</span>
          <span v-if="key.isEnvKey" class="pill">Env key</span>
        </div>
        <label class="mcp-key-field">
          Role
          <select
            :value="key.role"
            @change="updateKey(key, { role: ($event.target as HTMLSelectElement).value })"
          >
            <option v-for="role in props.roles" :key="role.slug" :value="role.slug">
              {{ role.name }}
            </option>
          </select>
        </label>
        <label class="mcp-key-field mcp-key-active">
          <input
            type="checkbox"
            :checked="key.isActive"
            @change="updateKey(key, { isActive: ($event.target as HTMLInputElement).checked })"
          />
          Active
        </label>
        <span class="mcp-key-date">Last used: {{ key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never" }}</span>
        <span class="mcp-key-date">Created: {{ formatDate(key.createdAt) }}</span>
        <button
          v-if="!key.isEnvKey"
          type="button"
          class="btn btn-ghost btn-sm"
          @click="deleteKey(key)"
        >
          Delete
        </button>
      </div>
      <p v-if="keys.length === 0" class="desc">No MCP keys yet.</p>
    </div>

    <form class="mcp-key-create" @submit.prevent="createKey">
      <div class="form-group">
        <label for="newMcpKeyName">Key name</label>
        <input id="newMcpKeyName" v-model="newKeyName" type="text" placeholder="CI" required />
      </div>
      <div class="form-group">
        <label for="newMcpKeyRole">Role</label>
        <select id="newMcpKeyRole" v-model="newKeyRole">
          <option v-for="role in props.roles" :key="role.slug" :value="role.slug">
            {{ role.name }}
          </option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary btn-sm" :disabled="creating">
        <span v-if="creating">Creating…</span>
        <span v-else>Create key</span>
      </button>
    </form>

    <div v-if="newApiKey" class="mcp-key-once">
      <p class="desc">Copy this key now — it won't be shown again.</p>
      <div class="mcp-key-copy-row">
        <input :value="newApiKey" type="text" readonly class="mono" />
        <button type="button" class="btn btn-secondary btn-sm" @click="copyNewKey">Copy</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mcp-keys {
  margin-top: 24px;
}

.mcp-key-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0 20px;
}

.mcp-key-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  border: 1px solid var(--od-border, #e5e7eb);
  border-radius: 8px;
  flex-wrap: wrap;
}

.mcp-key-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mcp-key-name {
  font-weight: 600;
}

.mcp-key-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.mcp-key-date {
  font-size: 12px;
  color: var(--muted, #6b7280);
}

.mcp-key-create {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.mcp-key-once {
  margin-top: 16px;
}

.mcp-key-copy-row {
  display: flex;
  gap: 8px;
}

.mcp-key-copy-row input {
  flex: 1;
}

.mono {
  font-family: monospace;
  font-size: 12px;
}
</style>
