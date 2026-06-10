<script setup lang="ts">
import { toast } from "vue3-toastify";
import type { AppRepository, RepositoryPayload } from "~/composables/useAppRepositories";

interface Props {
  appId: string;
}
const props = defineProps<Props>();

const {
  repositories,
  isLoading,
  isSaving,
  fetchRepositories,
  addRepository,
  updateRepository,
  removeRepository,
} = useAppRepositories();

const showForm = ref(false);
const editingId = ref<string | null>(null);

type ProviderChoice = "github" | "gitlab" | "github-enterprise" | "gitlab-self-hosted";

const blankForm = (): RepositoryPayload & { id?: string; providerChoice: ProviderChoice } => ({
  name: "",
  repoUrl: "",
  provider: "github",
  providerChoice: "github",
  hostUrl: null,
  defaultBranch: "main",
  accessToken: "",
  sddDocPath: "docs/SDD.md",
});

const form = reactive(blankForm());

// Derive actual provider + whether host URL is required from the choice
const needsHostUrl = computed(
  () => form.providerChoice === "github-enterprise" || form.providerChoice === "gitlab-self-hosted"
);
const providerLabel = computed(() => {
  if (form.providerChoice === "github-enterprise") return "GitHub Enterprise";
  if (form.providerChoice === "gitlab-self-hosted") return "GitLab Self-Hosted";
  if (form.providerChoice === "gitlab") return "GitLab";
  return "GitHub";
});

function onProviderChange() {
  if (form.providerChoice === "github" || form.providerChoice === "github-enterprise") {
    form.provider = "github";
  } else {
    form.provider = "gitlab";
  }
  if (!needsHostUrl.value) {
    form.hostUrl = null;
  }
}

onMounted(() => fetchRepositories(props.appId));

function openAdd() {
  Object.assign(form, blankForm());
  editingId.value = null;
  showForm.value = true;
}

function openEdit(repo: AppRepository) {
  let choice: ProviderChoice = repo.provider;
  if (repo.provider === "github" && repo.hostUrl) choice = "github-enterprise";
  if (repo.provider === "gitlab" && repo.hostUrl) choice = "gitlab-self-hosted";

  Object.assign(form, {
    id: repo.id,
    name: repo.name,
    repoUrl: repo.repoUrl,
    provider: repo.provider,
    providerChoice: choice,
    hostUrl: repo.hostUrl ?? null,
    defaultBranch: repo.defaultBranch,
    accessToken: "",
    sddDocPath: repo.sddDocPath,
  });
  editingId.value = repo.id;
  showForm.value = true;
}

function cancelForm() {
  showForm.value = false;
  editingId.value = null;
}

async function save() {
  if (!form.repoUrl?.trim()) {
    toast.error("Repository URL is required");
    return;
  }
  if (needsHostUrl.value && !form.hostUrl?.trim()) {
    toast.error(`Instance URL is required for ${providerLabel.value}`);
    return;
  }
  const payload: RepositoryPayload = {
    name: form.name?.trim() || undefined,
    repoUrl: form.repoUrl.trim(),
    provider: form.provider,
    hostUrl: needsHostUrl.value ? (form.hostUrl?.trim() || null) : null,
    defaultBranch: form.defaultBranch?.trim() || "main",
    sddDocPath: form.sddDocPath?.trim() || "docs/SDD.md",
  };
  // Only send the token when the user actually typed one
  if (form.accessToken && form.accessToken.trim()) {
    payload.accessToken = form.accessToken.trim();
  }

  if (editingId.value) {
    await updateRepository(props.appId, editingId.value, payload);
  } else {
    await addRepository(props.appId, payload);
  }
  showForm.value = false;
  editingId.value = null;
}

async function remove(repo: AppRepository) {
  if (!confirm(`Remove repository "${repo.name}"?`)) return;
  await removeRepository(props.appId, repo.id);
}

const copiedField = ref<string | null>(null);
async function copyToClipboard(text: string | undefined | null, field: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copiedField.value = field;
    setTimeout(() => (copiedField.value = null), 1500);
  } catch {
    // ignore
  }
}
</script>

<template>
  <div class="repo-manager">
    <div class="repo-header">
      <div>
        <h3>Repositories</h3>
        <p class="repo-sub">
          PRD and FSD are generated across all repositories; SDD is generated per repository.
        </p>
      </div>
      <button class="btn btn-primary btn-sm" @click="openAdd">+ Add Repository</button>
    </div>

    <div v-if="isLoading" class="repo-empty">Loading repositories…</div>

    <div v-else-if="repositories.length === 0 && !showForm" class="repo-empty">
      No repositories yet. Add one to get started.
    </div>

    <ul v-else class="repo-list">
      <li v-for="repo in repositories" :key="repo.id" class="repo-item">
        <div class="repo-main">
          <div class="repo-title-row">
            <span class="repo-name">{{ repo.name }}</span>
            <span class="pill" :class="repo.provider === 'gitlab' ? 'pill-orange' : 'pill-dark'">
              {{ repo.hostUrl ? (repo.provider === 'gitlab' ? 'GitLab Self-Hosted' : 'GitHub Enterprise') : (repo.provider === 'gitlab' ? 'GitLab' : 'GitHub') }}
            </span>
            <span v-if="!repo.hasAccessToken" class="pill pill-warn" title="No token: write-back PRs disabled">
              no token
            </span>
          </div>
          <div class="repo-url">{{ repo.repoUrl }}</div>
          <div class="repo-meta">
            <span v-if="repo.hostUrl" class="repo-host">
              instance: <code>{{ repo.hostUrl }}</code>
            </span>
            <span>branch: <code>{{ repo.defaultBranch }}</code></span>
            <span>SDD: <code>{{ repo.sddDocPath }}</code></span>
            <span v-if="repo.lastProcessedRef">last tag: <code>{{ repo.lastProcessedRef }}</code></span>
          </div>

          <!-- Webhook configuration -->
          <details class="repo-webhook">
            <summary>Webhook setup</summary>
            <div class="webhook-row">
              <label>Payload URL</label>
              <div class="copy-field">
                <input :value="repo.webhookUrl" readonly />
                <button class="btn btn-ghost btn-xs" @click="copyToClipboard(repo.webhookUrl, repo.id + '-url')">
                  {{ copiedField === repo.id + '-url' ? 'Copied' : 'Copy' }}
                </button>
              </div>
            </div>
            <div class="webhook-row">
              <label>Secret ({{ repo.provider === 'gitlab' ? 'Secret token' : 'Webhook secret' }})</label>
              <div class="copy-field">
                <input :value="repo.webhookSecret || ''" readonly />
                <button class="btn btn-ghost btn-xs" @click="copyToClipboard(repo.webhookSecret, repo.id + '-secret')">
                  {{ copiedField === repo.id + '-secret' ? 'Copied' : 'Copy' }}
                </button>
              </div>
            </div>
            <p class="webhook-hint">
              Configure this in your repository's webhook settings and trigger on
              <strong>tag</strong> events. New tags regenerate this repo's SDD (diff only) and open a PR.
            </p>
          </details>
        </div>

        <div class="repo-actions">
          <button class="btn btn-ghost btn-sm" @click="openEdit(repo)">Edit</button>
          <button class="btn btn-ghost btn-sm danger" @click="remove(repo)">Remove</button>
        </div>
      </li>
    </ul>

    <!-- Add / edit form -->
    <div v-if="showForm" class="repo-form">
      <h4>{{ editingId ? 'Edit Repository' : 'Add Repository' }}</h4>
      <div class="form-grid">
        <div class="form-group">
          <label>Name</label>
          <input v-model="form.name" type="text" placeholder="my-service" />
        </div>
        <div class="form-group">
          <label>Provider</label>
          <select v-model="form.providerChoice" @change="onProviderChange">
            <option value="github">GitHub</option>
            <option value="github-enterprise">GitHub Enterprise</option>
            <option value="gitlab">GitLab</option>
            <option value="gitlab-self-hosted">GitLab Self-Hosted</option>
          </select>
        </div>

        <!-- Instance URL — shown only for self-hosted / enterprise -->
        <div v-if="needsHostUrl" class="form-group full">
          <label>
            Instance URL *
            <span class="optional">e.g. https://gitlab.mycompany.com</span>
          </label>
          <input
            v-model="form.hostUrl"
            type="url"
            :placeholder="form.providerChoice === 'github-enterprise' ? 'https://github.mycompany.com' : 'https://gitlab.mycompany.com'"
          />
        </div>

        <div class="form-group full">
          <label>Repository URL *</label>
          <input
            v-model="form.repoUrl"
            type="url"
            :placeholder="needsHostUrl ? 'https://gitlab.mycompany.com/org/repo' : 'https://github.com/org/repo'"
          />
        </div>
        <div class="form-group">
          <label>Default Branch</label>
          <input v-model="form.defaultBranch" type="text" placeholder="main" />
        </div>
        <div class="form-group">
          <label>SDD Path</label>
          <input v-model="form.sddDocPath" type="text" placeholder="docs/SDD.md" />
        </div>
        <div class="form-group full">
          <label>
            Access Token
            <span class="optional">{{ editingId ? '(leave blank to keep current)' : '(required for write-back PRs)' }}</span>
          </label>
          <input
            v-model="form.accessToken"
            type="password"
            :placeholder="form.provider === 'gitlab' ? 'glpat-…' : 'ghp_…'"
            autocomplete="off"
          />
          <p v-if="form.providerChoice === 'gitlab-self-hosted'" class="field-hint">
            Use a Personal Access Token with <strong>api</strong> scope (GitLab → Profile → Access Tokens).
          </p>
          <p v-else-if="form.providerChoice === 'github-enterprise'" class="field-hint">
            Use a Personal Access Token (classic) with <strong>repo</strong> scope.
          </p>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary btn-sm" :disabled="isSaving" @click="save">
          {{ isSaving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Repository' }}
        </button>
        <button class="btn btn-ghost btn-sm" @click="cancelForm">Cancel</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.repo-manager {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.repo-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.repo-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--fg);
}

.repo-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.repo-empty {
  padding: 24px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
}

.repo-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.repo-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.repo-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.repo-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.repo-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--fg);
}

.repo-url {
  font-size: 12px;
  color: var(--muted);
  word-break: break-all;
  font-family: var(--font-mono);
}

.repo-meta {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--muted);
}

.repo-meta code,
.repo-webhook code {
  font-family: var(--font-mono);
  font-size: 11px;
  background: color-mix(in oklch, var(--fg) 6%, transparent);
  padding: 1px 5px;
  border-radius: 4px;
}

.repo-webhook {
  margin-top: 4px;
  font-size: 12px;
}

.repo-webhook summary {
  cursor: pointer;
  color: var(--accent);
  font-weight: 500;
}

.webhook-row {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.webhook-row label {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.copy-field {
  display: flex;
  gap: 6px;
}

.copy-field input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--fg);
}

.webhook-hint {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--muted);
}

.repo-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.repo-form {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  background: var(--surface);
}

.repo-form h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group.full {
  grid-column: 1 / -1;
}

.form-group label {
  font-size: 12px;
  font-weight: 500;
  color: var(--fg);
}

.optional {
  font-weight: 400;
  color: var(--muted);
}

.field-hint {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.4;
}

.repo-host {
  color: var(--muted);
  font-size: 12px;
}

.form-group input,
.form-group select {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font-size: 13px;
  color: var(--fg);
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
}

.pill-dark {
  background: color-mix(in oklch, var(--fg) 10%, transparent);
  color: var(--fg);
}

.pill-orange {
  background: color-mix(in oklch, oklch(70% 0.17 50) 18%, transparent);
  color: oklch(50% 0.15 50);
}

.pill-warn {
  background: color-mix(in oklch, oklch(75% 0.15 85) 20%, transparent);
  color: oklch(45% 0.12 85);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  transition: background 0.15s, border-color 0.15s;
}

.btn-primary {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}

.btn-primary:hover:not(:disabled) {
  background: color-mix(in oklch, var(--accent) 88%, black);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-ghost {
  color: var(--muted);
}

.btn-ghost:hover {
  color: var(--fg);
  background: color-mix(in oklch, var(--fg) 5%, transparent);
}

.btn-ghost.danger:hover {
  color: oklch(50% 0.16 25);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-xs {
  padding: 4px 10px;
  font-size: 11px;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .repo-item {
    flex-direction: column;
  }
  .repo-actions {
    flex-direction: row;
  }
}
</style>
