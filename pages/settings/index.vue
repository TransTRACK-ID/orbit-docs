<script setup lang="ts">
import { toast } from "vue3-toastify";
import { usePageStore } from "~/store/page";
import type {
  TeamMember,
  TeamRole,
  UpdateIntegrationsPayload,
  UpdateNotificationsPayload,
} from "~/types/settings";

definePageMeta({
  auth: { required: true },
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Settings");
});

const {
  workspace,
  teamMembers,
  currentMember,
  pendingInvitations,
  integrations,
  notifications,
  apiKeys,
  isLoadingWorkspace,
  isLoadingTeam,
  isLoadingIntegrations,
  isLoadingNotifications,
  isLoadingApiKeys,
  isSaving,
  isInviting,
  isAccepting,
  canManageTeam,
  fetchWorkspace,
  updateWorkspace,
  fetchTeam,
  fetchCurrentMember,
  fetchPendingInvitations,
  inviteMember,
  acceptInvitation,
  deleteMember,
  fetchIntegrations,
  updateIntegrations,
  fetchNotifications,
  updateNotifications,
  fetchApiKeys,
  regenerateApiKeys,
} = useSettings();

const { data: authData } = useAuth();

const currentUserEmail = computed(() => {
  const d = authData.value as any;
  return d?.data?.user?.email || d?.user?.email || null;
});

const myPendingInvitation = computed(() => {
  if (!currentUserEmail.value) return null;
  return pendingInvitations.value.find(
    (m) => m.status === "pending" && m.email === currentUserEmail.value
  ) || null;
});

const hasPendingInvitationForMe = computed(() => !!myPendingInvitation.value);

async function acceptMyInvitation() {
  if (!myPendingInvitation.value) return;
  await acceptInvitation(myPendingInvitation.value.id);
}

const activeTab = ref<"general" | "team" | "integrations" | "notifications" | "api">("general");

onMounted(() => {
  fetchWorkspace();
  fetchTeam();
  fetchCurrentMember();
  fetchPendingInvitations();
  fetchIntegrations();
  fetchNotifications();
  fetchApiKeys();
});

// ─── General tab form ───────────────────────────────────────────
const generalForm = reactive({
  name: "",
  slug: "",
  description: "",
  theme: "light" as "light" | "dark" | "system",
  logoUrl: "",
});
const generalDirty = ref(false);
const hasPopulatedGeneral = ref(false);
const slugManuallyEdited = ref(false);

watch(
  () => workspace.value,
  (ws) => {
    if (!ws || hasPopulatedGeneral.value) return;
    generalForm.name = ws.name;
    generalForm.slug = ws.slug;
    generalForm.description = ws.description || "";
    generalForm.theme = ws.theme;
    generalForm.logoUrl = ws.logoUrl || "";
    generalDirty.value = false;
    slugManuallyEdited.value = false;
    hasPopulatedGeneral.value = true;
  },
  { immediate: true }
);

/**
 * Generate a URL-friendly slug from a workspace name.
 * Mirrors the server-side slugify logic.
 */
function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function onGeneralChange() {
  generalDirty.value = true;
}

function onSlugInput() {
  slugManuallyEdited.value = true;
  onGeneralChange();
}

// Auto-generate slug from name when slug hasn't been manually edited
watch(
  () => generalForm.name,
  (newName) => {
    if (!slugManuallyEdited.value && hasPopulatedGeneral.value) {
      generalForm.slug = generateSlugFromName(newName);
      generalDirty.value = true;
    }
  }
);

async function saveGeneral() {
  await updateWorkspace({
    name: generalForm.name,
    slug: generalForm.slug,
    description: generalForm.description,
    theme: generalForm.theme,
    logoUrl: generalForm.logoUrl === "" ? null : generalForm.logoUrl || undefined,
  });
  generalDirty.value = false;
}

function resetGeneral() {
  const ws = workspace.value;
  if (!ws) return;
  generalForm.name = ws.name;
  generalForm.slug = ws.slug;
  generalForm.description = ws.description || "";
  generalForm.theme = ws.theme;
  generalForm.logoUrl = ws.logoUrl || "";
  generalDirty.value = false;
  slugManuallyEdited.value = false;
}

async function togglePublicDocs() {
  const next = !workspace.value?.publicDocsAccess;
  await updateWorkspace({ publicDocsAccess: next });
}

// ─── Team tab ───────────────────────────────────────────────────
const showInviteModal = ref(false);
const inviteForm = reactive({
  name: "",
  email: "",
  role: "viewer" as TeamRole,
});
const inviteNameError = ref(false);

function openInviteModal() {
  showInviteModal.value = true;
  inviteForm.name = "";
  inviteForm.email = "";
  inviteForm.role = "viewer";
  inviteNameError.value = false;
}

function closeInviteModal() {
  showInviteModal.value = false;
  inviteNameError.value = false;
}

async function submitInvite() {
  if (!inviteForm.name.trim()) {
    inviteNameError.value = true;
    return;
  }
  inviteNameError.value = false;
  const initials = inviteForm.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  await inviteMember({
    name: inviteForm.name.trim(),
    email: inviteForm.email || undefined,
    role: inviteForm.role,
    initials,
  });
  closeInviteModal();
}

const memberToDelete = ref<TeamMember | null>(null);

function confirmDeleteMember(member: TeamMember) {
  memberToDelete.value = member;
}

async function doDeleteMember() {
  if (!memberToDelete.value) return;
  await deleteMember(memberToDelete.value.id);
  memberToDelete.value = null;
}

const roleLabel: Record<TeamRole, string> = {
  admin: "Admin",
  product_manager: "Product Manager",
  tech_writer: "Tech Writer",
  viewer: "Viewer",
};

const rolePillClass: Record<TeamRole, string> = {
  admin: "pill-green",
  product_manager: "pill-blue",
  tech_writer: "pill-blue",
  viewer: "pill-amber",
};

const statusPillClass: Record<string, string> = {
  pending: "pill-amber",
  active: "pill-green",
};

const inviteableRoles = computed(() => {
  const roles: TeamRole[] = ["viewer", "tech_writer", "product_manager", "admin"];
  if (!currentMember.value) return roles;
  if (currentMember.value.role === "admin") return roles;
  if (currentMember.value.role === "product_manager") return ["viewer", "tech_writer"];
  return [];
});

// ─── Integrations toggles ───────────────────────────────────────
async function toggleIntegration(key: keyof UpdateIntegrationsPayload) {
  if (!integrations.value) return;
  const payload: UpdateIntegrationsPayload = {};
  payload[key] = !integrations.value[key];
  await updateIntegrations(payload);
}

// ─── Notifications toggles ────────────────────────────────────────
async function toggleNotification(key: keyof UpdateNotificationsPayload) {
  if (!notifications.value) return;
  const payload: UpdateNotificationsPayload = {};
  payload[key] = !notifications.value[key];
  await updateNotifications(payload);
}

// ─── API keys ─────────────────────────────────────────────────────
function copyToken(token: string) {
  navigator.clipboard.writeText(token);
  toast.success("Copied to clipboard");
}

async function regenerateProductionKey() {
  await regenerateApiKeys({ productionKey: true });
}

async function regenerateWebhookSecret() {
  await regenerateApiKeys({ webhookSecret: true });
}

async function revokeAllKeys() {
  await regenerateApiKeys({ revokeAll: true });
}
</script>

<template>
  <div class="settings-page">
    <!-- Topbar -->
    <header class="topbar">
      <h1>Settings</h1>
      <div class="topbar-meta">
        <span class="workspace-label">
          Workspace: <strong>{{ workspace?.name || "—" }}</strong>
        </span>
      </div>
    </header>

    <!-- Settings layout -->
    <div class="settings-layout">
      <!-- Settings navigation -->
      <nav class="settings-nav" aria-label="Settings sections">
        <button
          v-for="tab in [
            { id: 'general', label: 'General' },
            { id: 'team', label: 'Team Members' },
            { id: 'integrations', label: 'Integrations' },
            { id: 'notifications', label: 'Notifications' },
            { id: 'api', label: 'API Keys' },
          ] as const"
          :key="tab.id"
          class="settings-nav-item"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>

      <!-- Settings panels -->
      <div class="settings-panels">
        <!-- General -->
        <div v-show="activeTab === 'general'" class="settings-panel">
          <div class="setting-section">
            <h3>Workspace</h3>
            <p class="desc">Configure your workspace name and public-facing details.</p>

            <div v-if="isLoadingWorkspace" class="skeleton-wrap">
              <div class="skeleton-line w-3/4" />
              <div class="skeleton-line w-1/2" />
              <div class="skeleton-line w-2/3" />
            </div>

            <template v-else>
              <div class="form-group">
                <label for="wsName">Workspace Name</label>
                <input
                  id="wsName"
                  v-model="generalForm.name"
                  type="text"
                  @input="onGeneralChange"
                />
              </div>
              <div class="form-group">
                <label for="wsSlug">
                  Slug
                  <span v-if="!slugManuallyEdited" class="slug-auto-badge">auto</span>
                </label>
                <input
                  id="wsSlug"
                  v-model="generalForm.slug"
                  type="text"
                  @input="onSlugInput"
                />
                <span class="slug-hint">Used in URLs. Edit to customize.</span>
              </div>
              <div class="form-group">
                <label for="wsDesc">Description</label>
                <textarea
                  id="wsDesc"
                  v-model="generalForm.description"
                  @input="onGeneralChange"
                />
              </div>
              <div class="form-actions">
                <button class="btn btn-secondary" :disabled="isSaving || !generalDirty" @click="resetGeneral">
                  Reset
                </button>
                <button class="btn btn-primary" :disabled="isSaving || !generalDirty" @click="saveGeneral">
                  <span v-if="isSaving">Saving…</span>
                  <span v-else>Save Changes</span>
                </button>
              </div>
            </template>
          </div>

          <div class="setting-section">
            <h3>Appearance</h3>
            <p class="desc">Customize how your published docs look to readers.</p>

            <div v-if="isLoadingWorkspace" class="skeleton-wrap">
              <div class="skeleton-line w-1/2" />
              <div class="skeleton-line w-3/4" />
            </div>

            <template v-else>
              <div class="form-row">
                <div class="form-group">
                  <label for="theme">Default Theme</label>
                  <select id="theme" v-model="generalForm.theme" @change="onGeneralChange">
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="logo">Logo URL</label>
                  <input
                    id="logo"
                    v-model="generalForm.logoUrl"
                    type="url"
                    placeholder="https://cdn.example.com/logo.svg"
                    @input="onGeneralChange"
                  />
                </div>
              </div>
              <div class="toggle" style="margin-top: 8px;">
                <button
                  class="toggle-switch"
                  :class="{ on: workspace?.publicDocsAccess }"
                  aria-label="Toggle public docs access"
                  @click="togglePublicDocs"
                />
                <div>
                  <div class="toggle-label">Public Docs Access</div>
                  <div class="toggle-desc">Allow anyone with the link to view published docs</div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Team -->
        <div v-show="activeTab === 'team'" class="settings-panel">
          <div class="setting-section">
            <!-- Pending invitation banner for current user -->
            <div
              v-if="hasPendingInvitationForMe"
              class="invite-banner"
              style="margin-bottom: 20px;"
            >
              <div>
                <strong>You have a pending workspace invitation</strong>
                <p style="margin: 4px 0 0; font-size: 13px; color: var(--muted);">
                  Accept to join the team and access workspace features.
                </p>
              </div>
              <button
                class="btn btn-primary btn-sm"
                :disabled="isAccepting"
                @click="acceptMyInvitation"
              >
                <span v-if="isAccepting">Accepting…</span>
                <span v-else>Accept Invitation</span>
              </button>
            </div>

            <div class="row-between" style="margin-bottom: 20px;">
              <div>
                <h3>Team Members</h3>
                <p class="desc">Manage who can publish versions and edit docs.</p>
              </div>
              <button
                v-if="canManageTeam"
                class="btn btn-primary btn-sm"
                @click="openInviteModal"
              >
                + Invite Member
              </button>
            </div>

            <div v-if="isLoadingTeam" class="skeleton-wrap">
              <div class="skeleton-line w-full" />
              <div class="skeleton-line w-full" />
              <div class="skeleton-line w-full" />
            </div>

            <table v-else class="ds-table">
              <thead>
                <tr><th>User</th><th>Role</th><th>Status</th><th>Last Active</th><th></th></tr>
              </thead>
              <tbody>
                <tr v-for="member in teamMembers" :key="member.id">
                  <td>
                    <span class="avatar">{{ member.initials }}</span>
                    {{ member.name }}
                  </td>
                  <td>
                    <span class="pill" :class="rolePillClass[member.role]">
                      {{ roleLabel[member.role] }}
                    </span>
                  </td>
                  <td>
                    <span class="pill" :class="statusPillClass[member.status]">
                      {{ member.status === "pending" ? "Pending" : "Active" }}
                    </span>
                  </td>
                  <td class="num">{{ member.lastActive }}</td>
                  <td style="text-align: right;">
                    <button
                      v-if="canManageTeam && member.status === 'active'"
                      class="btn btn-ghost btn-sm"
                      title="Remove member"
                      @click="confirmDeleteMember(member)"
                    >
                      ⋯
                    </button>
                  </td>
                </tr>
                <tr v-if="teamMembers.length === 0">
                  <td colspan="5" class="text-center" style="color: var(--muted); padding: 24px;">
                    No team members yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Integrations -->
        <div v-show="activeTab === 'integrations'" class="settings-panel">
          <div class="setting-section">
            <h3>CI / CD Integrations</h3>
            <p class="desc">Connect your deployment pipeline to auto-publish changelogs.</p>

            <div v-if="isLoadingIntegrations" class="skeleton-wrap">
              <div class="skeleton-line w-full" />
              <div class="skeleton-line w-full" />
              <div class="skeleton-line w-full" />
            </div>

            <template v-else>
              <div class="integration-card">
                <div class="integration-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div class="integration-info">
                  <div class="name">GitHub Actions</div>
                  <div class="desc">Trigger changelog publish on release tags</div>
                </div>
                <div class="toggle">
                  <button
                    class="toggle-switch"
                    :class="{ on: integrations?.githubActions }"
                    aria-label="Toggle GitHub Actions"
                    @click="toggleIntegration('githubActions')"
                  />
                </div>
              </div>

              <div class="integration-card">
                <div class="integration-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div class="integration-info">
                  <div class="name">GitLab CI</div>
                  <div class="desc">Auto-sync merge request notes to drafts</div>
                </div>
                <div class="toggle">
                  <button
                    class="toggle-switch"
                    :class="{ on: integrations?.gitlabCI }"
                    aria-label="Toggle GitLab CI"
                    @click="toggleIntegration('gitlabCI')"
                  />
                </div>
              </div>

              <div class="integration-card">
                <div class="integration-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                </div>
                <div class="integration-info">
                  <div class="name">Jenkins</div>
                  <div class="desc">Post-build step to publish version artifacts</div>
                </div>
                <div class="toggle">
                  <button
                    class="toggle-switch"
                    :class="{ on: integrations?.jenkins }"
                    aria-label="Toggle Jenkins"
                    @click="toggleIntegration('jenkins')"
                  />
                </div>
              </div>

              <div class="integration-card" style="opacity: 0.6;">
                <div class="integration-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <div class="integration-info">
                  <div class="name">CircleCI</div>
                  <div class="desc">Coming soon — Orb for automated doc publishing</div>
                </div>
                <span class="pill pill-amber" style="flex-shrink: 0;">Soon</span>
              </div>
            </template>
          </div>
        </div>

        <!-- Notifications -->
        <div v-show="activeTab === 'notifications'" class="settings-panel">
          <div class="setting-section">
            <h3>Notification Preferences</h3>
            <p class="desc">Choose when Orbit Docs sends you updates.</p>

            <div v-if="isLoadingNotifications" class="skeleton-wrap">
              <div class="skeleton-line w-full" />
              <div class="skeleton-line w-full" />
              <div class="skeleton-line w-full" />
            </div>

            <template v-else>
              <div class="toggle" style="margin-bottom: 16px;">
                <button
                  class="toggle-switch"
                  :class="{ on: notifications?.emailDigest }"
                  aria-label="Toggle email digest"
                  @click="toggleNotification('emailDigest')"
                />
                <div>
                  <div class="toggle-label">Email Digest</div>
                  <div class="toggle-desc">Weekly summary of new versions and published docs</div>
                </div>
              </div>

              <div class="toggle" style="margin-bottom: 16px;">
                <button
                  class="toggle-switch"
                  :class="{ on: notifications?.releaseAlerts }"
                  aria-label="Toggle release alerts"
                  @click="toggleNotification('releaseAlerts')"
                />
                <div>
                  <div class="toggle-label">Release Alerts</div>
                  <div class="toggle-desc">Immediate notification when a version is published</div>
                </div>
              </div>

              <div class="toggle" style="margin-bottom: 16px;">
                <button
                  class="toggle-switch"
                  :class="{ on: notifications?.docComments }"
                  aria-label="Toggle doc comments"
                  @click="toggleNotification('docComments')"
                />
                <div>
                  <div class="toggle-label">Doc Comments</div>
                  <div class="toggle-desc">Notify when someone comments on a draft doc</div>
                </div>
              </div>

              <div class="toggle">
                <button
                  class="toggle-switch"
                  :class="{ on: notifications?.slackNotifications }"
                  aria-label="Toggle Slack notifications"
                  @click="toggleNotification('slackNotifications')"
                />
                <div>
                  <div class="toggle-label">Slack Notifications</div>
                  <div class="toggle-desc">Push release notes to a Slack channel</div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- API Keys -->
        <div v-show="activeTab === 'api'" class="settings-panel">
          <div class="setting-section">
            <h3>API Keys</h3>
            <p class="desc">Use these keys to push versions and docs programmatically.</p>

            <div v-if="isLoadingApiKeys" class="skeleton-wrap">
              <div class="skeleton-line w-full" />
              <div class="skeleton-line w-full" />
            </div>

            <template v-else>
              <div class="form-group">
                <label>Production API Key</label>
                <div class="token-box">
                  <span class="token-value">{{ apiKeys?.productionKey }}</span>
                  <button class="btn btn-ghost btn-sm" @click="copyToken(apiKeys?.productionKey || '')">
                    Copy
                  </button>
                  <button class="btn btn-ghost btn-sm" @click="regenerateProductionKey">
                    Regenerate
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label>Webhook Secret</label>
                <div class="token-box">
                  <span class="token-value">{{ apiKeys?.webhookSecret }}</span>
                  <button class="btn btn-ghost btn-sm" @click="copyToken(apiKeys?.webhookSecret || '')">
                    Copy
                  </button>
                  <button class="btn btn-ghost btn-sm" @click="regenerateWebhookSecret">
                    Regenerate
                  </button>
                </div>
              </div>

              <div class="form-actions" style="margin-top: 8px;">
                <button class="btn btn-danger btn-sm" @click="revokeAllKeys">
                  Revoke All
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Invite Member Modal -->
    <div class="modal-overlay" :class="{ open: showInviteModal }" @click.self="closeInviteModal">
      <div class="modal" style="width: 480px;">
        <div class="modal-header">
          <h2>Invite Member</h2>
          <button class="modal-close" aria-label="Close modal" @click="closeInviteModal">✕</button>
        </div>
        <form novalidate @submit.prevent="submitInvite">
          <div class="modal-body">
            <div class="form-group">
              <label for="inviteName">Name</label>
              <input
                id="inviteName"
                v-model="inviteForm.name"
                type="text"
                placeholder="e.g. Alex Rivera"
                required
                :class="{ 'input-error': inviteNameError }"
                @input="inviteNameError = false"
              />
              <span class="error-msg" :class="{ show: inviteNameError }">Name is required</span>
            </div>
            <div class="form-group">
              <label for="inviteEmail">Email <span class="opt">(optional)</span></label>
              <input id="inviteEmail" v-model="inviteForm.email" type="email" placeholder="alex@example.com" />
            </div>
            <div class="form-group">
              <label for="inviteRole">Role</label>
              <select id="inviteRole" v-model="inviteForm.role">
                <option v-for="role in inviteableRoles" :key="role" :value="role">
                  {{ roleLabel[role as TeamRole] }}
                </option>
              </select>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeInviteModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="isInviting">
              <span v-if="isInviting">Inviting…</span>
              <span v-else>Invite</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Member Confirmation Modal -->
    <div class="modal-overlay" :class="{ open: !!memberToDelete }" @click.self="memberToDelete = null">
      <div class="modal" style="width: 400px;">
        <div class="modal-header">
          <h2>Remove Member</h2>
          <button class="modal-close" aria-label="Close modal" @click="memberToDelete = null">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin: 0; color: var(--muted);">
            Are you sure you want to remove <strong>{{ memberToDelete?.name }}</strong>? This action cannot be undone.
          </p>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" @click="memberToDelete = null">Cancel</button>
          <button type="button" class="btn btn-danger" @click="doDeleteMember">Remove</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  --bg: var(--od-bg);
  --surface: var(--od-surface);
  --fg: var(--od-fg);
  --muted: var(--od-muted);
  --border: var(--od-border);
  --accent: var(--od-accent);
  --accent-soft: var(--od-accent-soft);
  --fg-soft: var(--od-fg-soft);
  --font-mono: var(--od-font-mono);
  --radius: var(--od-radius);
  --radius-lg: var(--od-radius-lg);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.topbar h1 {
  margin: 0;
  font-weight: 600;
  font-size: 20px;
  color: var(--fg);
}
.topbar-meta {
  display: flex;
  align-items: center;
  gap: 16px;
}
.workspace-label {
  color: var(--muted);
  font-size: 14px;
}
.workspace-label strong {
  color: var(--fg);
}

.settings-layout {
  display: flex;
  gap: 32px;
}
.settings-nav {
  width: 200px;
  flex-shrink: 0;
  position: sticky;
  top: 32px;
  align-self: flex-start;
}
.settings-nav-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  border-radius: var(--radius);
  font-size: 14px;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.1s cubic-bezier(0.4, 0, 0.2, 1), color 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: 2px;
  border: none;
  background: transparent;
  font-family: inherit;
}
.settings-nav-item:hover {
  background: var(--fg-soft);
  color: var(--fg);
}
.settings-nav-item.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 500;
}

.settings-panels {
  flex: 1;
  min-width: 0;
}

.setting-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  margin-bottom: 24px;
}
.setting-section h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--fg);
}
.desc {
  color: var(--muted);
  font-size: 13px;
  margin: 0 0 20px;
}

.form-group {
  margin-bottom: 20px;
}
.form-group:last-child {
  margin-bottom: 0;
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
.form-group input[type="text"],
.form-group input[type="email"],
.form-group input[type="url"],
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 8px 12px;
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
.form-group textarea {
  min-height: 80px;
  resize: vertical;
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
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
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}
.btn-primary:hover:not(:disabled) {
  background: color-mix(in oklch, var(--accent) 88%, black);
}
.btn-secondary {
  background: transparent;
  color: var(--fg);
  border-color: var(--border);
}
.btn-secondary:hover:not(:disabled) {
  border-color: var(--fg);
}
.btn-ghost {
  background: transparent;
  color: var(--muted);
  border-color: transparent;
}
.btn-ghost:hover:not(:disabled) {
  color: var(--fg);
}
.btn-danger {
  background: oklch(55% 0.18 25);
  color: white;
  border-color: oklch(55% 0.18 25);
}
.btn-danger:hover:not(:disabled) {
  background: oklch(45% 0.18 25);
}
.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 12px;
}
.toggle-switch {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: var(--border);
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
  border: none;
  padding: 0;
}
.toggle-switch.on {
  background: var(--accent);
}
.toggle-switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.toggle-switch.on::after {
  transform: translateX(18px);
}
.toggle-label {
  font-size: 14px;
  color: var(--fg);
}
.toggle-desc {
  color: var(--muted);
  font-size: 12px;
  margin-top: 2px;
}

.ds-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.ds-table th {
  text-align: left;
  padding: 10px 12px;
  font-weight: 500;
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border);
}
.ds-table td {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.ds-table tr:last-child td {
  border-bottom: none;
}
.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 13px;
  margin-right: 8px;
}
.pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 500;
}
.pill-green {
  background: oklch(95% 0.04 145);
  color: oklch(45% 0.12 145);
}
.pill-blue {
  background: oklch(95% 0.04 250);
  color: oklch(50% 0.12 250);
}
.pill-amber {
  background: oklch(95% 0.04 85);
  color: oklch(50% 0.1 85);
}

.integration-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  margin-bottom: 12px;
}
.integration-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius);
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.integration-icon svg {
  color: var(--fg);
}
.integration-info {
  flex: 1;
}
.integration-info .name {
  font-weight: 600;
  font-size: 14px;
  color: var(--fg);
}
.integration-info .desc {
  color: var(--muted);
  font-size: 13px;
  margin: 2px 0 0;
}

.token-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-family: var(--font-mono);
  font-size: 13px;
}
.token-box .token-value {
  flex: 1;
  color: var(--muted);
  word-break: break-all;
}

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

/* Modal */
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
  color: var(--fg);
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

.slug-auto-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 100px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-left: 6px;
  vertical-align: middle;
}
.slug-hint {
  display: block;
  color: var(--muted);
  font-size: 12px;
  margin-top: 4px;
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

/* Skeleton */
.skeleton-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.skeleton-line {
  height: 16px;
  background: var(--border);
  border-radius: 4px;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.invite-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-soft);
  border-radius: var(--radius-lg);
  color: var(--fg);
}

@media (max-width: 768px) {
  .settings-layout {
    flex-direction: column;
  }
  .settings-nav {
    width: 100%;
    position: static;
    display: flex;
    gap: 4px;
    overflow-x: auto;
  }
  .settings-nav-item {
    white-space: nowrap;
    flex-shrink: 0;
    width: auto;
  }
  .form-row {
    grid-template-columns: 1fr;
  }
  .topbar {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-overlay,
  .modal,
  .btn,
  .toggle-switch,
  .toggle-switch::after,
  .skeleton-line {
    transition: none !important;
    animation: none !important;
  }
}
</style>
