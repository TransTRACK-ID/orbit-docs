<script setup lang="ts">
import { toast } from "vue3-toastify";
import { usePageStore } from "~/store/page";
import type {
  TeamMember,
  TeamRole,
  UpdateIntegrationsPayload,
  UpdateNotificationsPayload,
} from "~/types/settings";
import type { SsoProvider, SsoProviderType } from "~/types/sso";
import { SSO_PROVIDER_METADATA } from "~/types/sso";

definePageMeta({
  auth: true,
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

const {
  ssoConfig,
  isLoadingSso,
  isSavingSso,
  fetchSsoConfig,
  saveSsoProvider,
  deleteSsoProvider,
  toggleSsoProvider,
  buildEmptyProvider,
} = useSsoSettings();

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

const activeTab = ref<"general" | "team" | "mcp" | "sso">("general");

onMounted(() => {
  fetchWorkspace();
  fetchTeam();
  fetchCurrentMember();
  fetchPendingInvitations();
  fetchIntegrations();
  fetchNotifications();
  fetchApiKeys();
  fetchMcpConfig();
  fetchSsoConfig();
});

// ─── General tab form ───────────────────────────────────────────
const generalForm = reactive({
  name: "",
  slug: "",
  description: "",
  theme: "light" as "light" | "dark" | "system",
  logoUrl: "",
});
const originalGeneral = reactive({
  name: "",
  slug: "",
  description: "",
  theme: "light" as "light" | "dark" | "system",
  logoUrl: "",
});
const workspaceDirty = ref(false);
const appearanceDirty = ref(false);
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
    originalGeneral.name = ws.name;
    originalGeneral.slug = ws.slug;
    originalGeneral.description = ws.description || "";
    originalGeneral.theme = ws.theme;
    originalGeneral.logoUrl = ws.logoUrl || "";
    workspaceDirty.value = false;
    appearanceDirty.value = false;
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

function markWorkspaceDirty() {
  workspaceDirty.value = true;
}

function onSlugInput() {
  slugManuallyEdited.value = true;
  markWorkspaceDirty();
}

// Auto-generate slug from name when slug hasn't been manually edited
watch(
  () => generalForm.name,
  (newName) => {
    if (!slugManuallyEdited.value && hasPopulatedGeneral.value) {
      generalForm.slug = generateSlugFromName(newName);
    }
    if (hasPopulatedGeneral.value) {
      workspaceDirty.value = true;
    }
  }
);

/* ─── Live preview: theme ─────────────────────────────────────── */
function applyPreviewTheme(theme: string | undefined) {
  const html = document.documentElement;
  if (theme === "dark") {
    html.classList.add("dark");
  } else if (theme === "light") {
    html.classList.remove("dark");
  } else if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    html.classList.toggle("dark", prefersDark);
  } else {
    html.classList.remove("dark");
  }
}

watch(() => generalForm.theme, (theme) => {
  applyPreviewTheme(theme);
  appearanceDirty.value = true;
});

/* ─── Live preview: logo ────────────────────────────────────── */
watch(() => generalForm.logoUrl, (url) => {
  if (workspace.value) {
    workspace.value.logoUrl = url || null;
  }
  appearanceDirty.value = true;
});

async function saveGeneral() {
  await updateWorkspace({
    name: generalForm.name,
    slug: generalForm.slug,
    description: generalForm.description,
    theme: generalForm.theme,
    logoUrl: generalForm.logoUrl === "" ? null : generalForm.logoUrl || undefined,
  });
  // Sync originals so reset doesn't revert after a successful save
  originalGeneral.name = generalForm.name;
  originalGeneral.slug = generalForm.slug;
  originalGeneral.description = generalForm.description;
  originalGeneral.theme = generalForm.theme;
  originalGeneral.logoUrl = generalForm.logoUrl;
  workspaceDirty.value = false;
  appearanceDirty.value = false;
}

function resetGeneral() {
  generalForm.name = originalGeneral.name;
  generalForm.slug = originalGeneral.slug;
  generalForm.description = originalGeneral.description;
  generalForm.theme = originalGeneral.theme;
  generalForm.logoUrl = originalGeneral.logoUrl;
  if (workspace.value) {
    workspace.value.logoUrl = originalGeneral.logoUrl || null;
  }
  applyPreviewTheme(originalGeneral.theme);
  workspaceDirty.value = false;
  appearanceDirty.value = false;
  slugManuallyEdited.value = false;
}

// Restore original theme & logo when leaving settings if unsaved
onUnmounted(() => {
  applyPreviewTheme(originalGeneral.theme);
  if (workspace.value) {
    workspace.value.logoUrl = originalGeneral.logoUrl || null;
  }
});

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

// ─── MCP Connection ───────────────────────────────────────────────
const mcpConfig = ref<{ host: string; url: string; protocol: string; configured: boolean } | null>(null);
const mcpLoading = ref(false);

async function fetchMcpConfig() {
  mcpLoading.value = true;
  try {
    const { data } = await $fetch<{ data: { host: string; url: string; protocol: string; configured: boolean } }>("/api/mcp-config");
    mcpConfig.value = data;
  } catch (e) {
    console.error("Failed to fetch MCP config", e);
  } finally {
    mcpLoading.value = false;
  }
}

const mcpUrlHttps = computed(() => mcpConfig.value?.url || "https://localhost:41244/mcp");

const mcpAgents = [
  {
    name: "OpenCode / Kilocode",
    get json() {
      return JSON.stringify({
        mcpServers: {
          orbit_docs: {
            url: mcpUrlHttps.value,
            headers: { Authorization: "Bearer YOUR_MCP_API_KEY" },
          },
        },
      }, null, 2);
    },
  },
  {
    name: "VS Code (GitHub Copilot)",
    get json() {
      return JSON.stringify({
        mcp: {
          servers: {
            orbit_docs: {
              url: mcpUrlHttps.value,
              headers: { Authorization: "Bearer YOUR_MCP_API_KEY" },
            },
          },
        },
      }, null, 2);
    },
  },
  {
    name: "Cline",
    get json() {
      return JSON.stringify({
        mcpServers: {
          orbit_docs: {
            url: mcpUrlHttps.value,
            headers: { Authorization: "Bearer YOUR_MCP_API_KEY" },
            disabled: false,
            autoApprove: [],
          },
        },
      }, null, 2);
    },
  },
  {
    name: "Cursor",
    get json() {
      return JSON.stringify({
        name: "orbit_docs",
        type: "HTTP",
        url: mcpUrlHttps.value,
        headers: { Authorization: "Bearer YOUR_MCP_API_KEY" },
      }, null, 2);
    },
  },
];

const mcpCopied = ref<string | null>(null);

function copyMcpConfig(agentName: string, text: string) {
  navigator.clipboard.writeText(text);
  mcpCopied.value = agentName;
  setTimeout(() => { mcpCopied.value = null; }, 2000);
}

// ─── SSO Configuration ────────────────────────────────────────────
const showSsoModal = ref(false);
const ssoEditingProvider = ref<SsoProvider | null>(null);
const ssoProviderType = ref<SsoProviderType | "">("");
const ssoForm = reactive<Record<string, any>>({});
const ssoFormErrors = reactive<Record<string, boolean>>({});

const providerTypeOptions = [
  { value: "google", label: "Google" },
  { value: "github", label: "GitHub" },
  { value: "azure", label: "Microsoft Azure AD" },
  { value: "keycloak", label: "Keycloak" },
  { value: "oidc", label: "Generic OIDC" },
];

function openSsoModal(type?: SsoProviderType, existing?: SsoProvider) {
  ssoFormErrors.value = {};
  if (existing) {
    ssoEditingProvider.value = existing;
    ssoProviderType.value = existing.type;
    // Populate form fields
    const meta = SSO_PROVIDER_METADATA[existing.type];
    meta.fields.forEach((field) => {
      ssoForm[field.key] = (existing as any)[field.key] || "";
    });
    // Ensure base fields
    ssoForm.id = existing.id;
    ssoForm.enabled = existing.enabled;
    ssoForm.createdAt = existing.createdAt;
  } else if (type) {
    ssoEditingProvider.value = null;
    ssoProviderType.value = type;
    const meta = SSO_PROVIDER_METADATA[type];
    meta.fields.forEach((field) => {
      ssoForm[field.key] = "";
    });
    ssoForm.id = crypto.randomUUID();
    ssoForm.enabled = false;
    ssoForm.createdAt = new Date().toISOString();
  } else {
    ssoEditingProvider.value = null;
    ssoProviderType.value = "";
    Object.keys(ssoForm).forEach((k) => delete ssoForm[k]);
  }
  showSsoModal.value = true;
}

function closeSsoModal() {
  showSsoModal.value = false;
  ssoEditingProvider.value = null;
  ssoProviderType.value = "";
  Object.keys(ssoForm).forEach((k) => delete ssoForm[k]);
  Object.keys(ssoFormErrors).forEach((k) => delete ssoFormErrors[k]);
}

function validateSsoForm(): boolean {
  let valid = true;
  Object.keys(ssoFormErrors).forEach((k) => delete ssoFormErrors[k]);
  if (!ssoProviderType.value) {
    valid = false;
    return valid;
  }
  const meta = SSO_PROVIDER_METADATA[ssoProviderType.value];
  meta.fields.forEach((field) => {
    if (field.required && !ssoForm[field.key]?.trim()) {
      ssoFormErrors[field.key] = true;
      valid = false;
    }
  });
  return valid;
}

async function submitSsoProvider() {
  if (!validateSsoForm() || !ssoProviderType.value) return;
  const meta = SSO_PROVIDER_METADATA[ssoProviderType.value];
  const providerData: any = {
    id: ssoForm.id || crypto.randomUUID(),
    type: ssoProviderType.value,
    name: ssoForm.name?.trim(),
    enabled: ssoForm.enabled ?? false,
    clientId: ssoForm.clientId?.trim() || "",
    clientSecret: ssoForm.clientSecret || "",
    callbackUrl: ssoForm.callbackUrl?.trim() || undefined,
    createdAt: ssoForm.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  // Add type-specific fields
  meta.fields.forEach((field) => {
    if (field.key !== "name" && field.key !== "clientId" && field.key !== "clientSecret" && field.key !== "callbackUrl") {
      providerData[field.key] = ssoForm[field.key] || "";
    }
  });
  await saveSsoProvider(providerData as SsoProvider);
  closeSsoModal();
}

async function doToggleProvider(provider: SsoProvider) {
  await toggleSsoProvider(provider.id, !provider.enabled);
}

const providerToDelete = ref<SsoProvider | null>(null);

function confirmDeleteProvider(provider: SsoProvider) {
  providerToDelete.value = provider;
}

async function doDeleteProvider() {
  if (!providerToDelete.value) return;
  await deleteSsoProvider(providerToDelete.value.id);
  providerToDelete.value = null;
}

function providerTypeLabel(type: string) {
  return SSO_PROVIDER_METADATA[type as SsoProviderType]?.name || type;
}

function providerTypeColor(type: string) {
  return SSO_PROVIDER_METADATA[type as SsoProviderType]?.color || "var(--muted)";
}

const ssoProviderTypeList: SsoProviderType[] = ["google", "github", "azure", "keycloak", "oidc"];

function getCallbackUrl(provider: SsoProvider): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
  return `${origin}/api/auth/sso/${provider.type}/callback`;
}

</script>

<template>
  <div class="settings-page">
    <!-- Settings layout -->
    <div class="settings-layout">
      <!-- Settings navigation -->
      <nav class="settings-nav" aria-label="Settings sections">
        <button
          v-for="tab in [
            { id: 'general', label: 'General' },
            { id: 'team', label: 'Team Members' },
            { id: 'sso', label: 'SSO' },
            { id: 'mcp', label: 'MCP Connection' },
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
                  @input="markWorkspaceDirty"
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
                  @input="markWorkspaceDirty"
                />
              </div>
              <div class="form-actions">
                <button class="btn btn-secondary" :disabled="isSaving || !workspaceDirty" @click="resetGeneral">
                  Reset
                </button>
                <button class="btn btn-primary" :disabled="isSaving || !workspaceDirty" @click="saveGeneral">
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
                  <select id="theme" v-model="generalForm.theme">
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
                  />
                </div>
              </div>
              <div class="form-group" style="margin-top: 8px;">
                <label>Logo Preview</label>
                <div class="logo-preview">
                  <img
                    v-if="generalForm.logoUrl"
                    :src="generalForm.logoUrl"
                    alt="Logo preview"
                    class="logo-preview-img"
                    @error="(e) => { const t = e.target as HTMLImageElement | null; if (t) t.style.display = 'none'; }"
                  />
                  <span v-if="!generalForm.logoUrl" class="logo-preview-placeholder">
                    No logo set — default orbit icon will be used in the sidebar.
                  </span>
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
              <div class="form-actions">
                <button class="btn btn-secondary" :disabled="isSaving || !appearanceDirty" @click="resetGeneral">
                  Reset
                </button>
                <button class="btn btn-primary" :disabled="isSaving || !appearanceDirty" @click="saveGeneral">
                  <span v-if="isSaving">Saving…</span>
                  <span v-else>Save Changes</span>
                </button>
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

        <!-- SSO Configuration -->
        <div v-show="activeTab === 'sso'" class="settings-panel">
          <div class="setting-section">
            <div class="row-between" style="margin-bottom: 20px;">
              <div>
                <h3>Single Sign-On</h3>
                <p class="desc">Configure OAuth providers to let users sign in with existing accounts.</p>
              </div>
              <div class="sso-add-menu" style="position: relative;">
                <button class="btn btn-primary btn-sm" @click="openSsoModal()">
                  + Add Provider
                </button>
              </div>
            </div>

            <div v-if="isLoadingSso" class="skeleton-wrap">
              <div class="skeleton-line w-full" />
              <div class="skeleton-line w-full" />
              <div class="skeleton-line w-full" />
            </div>

            <table v-else-if="ssoConfig && ssoConfig.providers.length > 0" class="ds-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Default</th>
                  <th style="text-align: right;"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="provider in ssoConfig.providers" :key="provider.id">
                  <td>
                    <div class="sso-provider-cell">
                      <span class="sso-provider-icon" :style="{ background: providerTypeColor(provider.type) + '15', color: providerTypeColor(provider.type) }">
                        <span class="sso-provider-initial">{{ provider.name[0] }}</span>
                      </span>
                      <span class="sso-provider-name">{{ provider.name }}</span>
                    </div>
                  </td>
                  <td>
                    <span class="pill" :style="{ background: providerTypeColor(provider.type) + '15', color: providerTypeColor(provider.type) }">
                      {{ providerTypeLabel(provider.type) }}
                    </span>
                  </td>
                  <td>
                    <span class="pill" :class="provider.enabled ? 'pill-green' : 'pill-amber'">
                      {{ provider.enabled ? 'Enabled' : 'Disabled' }}
                    </span>
                  </td>
                  <td>
                    <span v-if="ssoConfig.defaultProvider === provider.id" class="pill pill-blue">Default</span>
                    <span v-else class="pill" style="opacity: 0.5;">—</span>
                  </td>
                  <td style="text-align: right;">
                    <div class="sso-actions">
                      <button
                        class="btn btn-ghost btn-sm"
                        :title="provider.enabled ? 'Disable' : 'Enable'"
                        @click="doToggleProvider(provider)"
                      >
                        {{ provider.enabled ? 'Disable' : 'Enable' }}
                      </button>
                      <button
                        class="btn btn-ghost btn-sm"
                        title="Edit"
                        @click="openSsoModal(undefined, provider)"
                      >
                        Edit
                      </button>
                      <button
                        class="btn btn-ghost btn-sm"
                        title="Delete"
                        style="color: var(--od-error);"
                        @click="confirmDeleteProvider(provider)"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-else class="sso-empty">
              <div class="sso-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              </div>
              <p class="sso-empty-title">No SSO providers configured</p>
              <p class="sso-empty-desc">Add an OAuth provider to let users sign in with their existing accounts.</p>
              <div class="sso-empty-types">
                <button
                  v-for="pt in ssoProviderTypeList"
                  :key="pt"
                  class="sso-type-chip"
                  @click="openSsoModal(pt)"
                >
                  <span class="sso-type-dot" :style="{ background: providerTypeColor(pt) }"></span>
                  {{ providerTypeLabel(pt) }}
                </button>
              </div>
            </div>
          </div>

          <!-- Provider Info -->
          <div v-if="ssoConfig && ssoConfig.providers.length > 0" class="setting-section">
            <h3>Callback URLs</h3>
            <p class="desc">Use these URLs when registering your OAuth application with the provider.</p>
            <div class="sso-callbacks">
              <div v-for="provider in ssoConfig.providers" :key="provider.id" class="sso-callback-row">
                <div class="sso-callback-label">
                  <span class="pill" :style="{ background: providerTypeColor(provider.type) + '15', color: providerTypeColor(provider.type) }">
                    {{ provider.name }}
                  </span>
                </div>
                <div class="token-box">
                  <span class="token-value">{{ provider.callbackUrl || getCallbackUrl(provider) }}</span>
                  <button class="btn btn-ghost btn-sm" @click="copyToken(provider.callbackUrl || getCallbackUrl(provider))">Copy</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- MCP Connection -->
        <div v-show="activeTab === 'mcp'" class="settings-panel">
          <div class="setting-section">
            <h3>MCP Connection</h3>
            <p class="desc">Connect your AI agents to your Orbit Docs data via the Model Context Protocol (MCP).</p>

            <div class="mcp-info">
              <div class="mcp-endpoint">
                <div class="form-group">
                  <label>MCP Endpoint URL</label>
                  <div class="token-box">
                    <span class="token-value">{{ mcpUrlHttps }}</span>
                    <button class="btn btn-ghost btn-sm" @click="copyToken(mcpUrlHttps)">Copy</button>
                  </div>
                  <div v-if="!mcpConfig?.configured" class="mcp-warning" style="margin-top: 8px;">
                    <span class="pill pill-amber">Not configured</span>
                    <span style="margin-left: 8px; color: var(--muted); font-size: 12px;">
                      Set <code>MCP_HOST</code> or <code>NUXT_PUBLIC_MCP_HOST</code> env variable on your server to customize this URL.
                    </span>
                  </div>
                  <div v-else class="mcp-ok" style="margin-top: 8px;">
                    <span class="pill pill-green">Configured</span>
                    <span style="margin-left: 8px; color: var(--muted); font-size: 12px;">
                      Host is set from server environment.
                    </span>
                  </div>
                </div>
                <div class="form-group">
                  <label>Authentication</label>
                  <p class="desc" style="margin: 0 0 8px;">
                    Provide your API key via the <code>Authorization: Bearer &lt;key&gt;</code> header.
                    Find your API key in the MCP_API_KEY environment variable on your server.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="setting-section">
            <h3>AI Agent Setup</h3>
            <p class="desc">Copy the configuration for your AI agent to start querying your docs, releases, and versions.</p>

            <div class="mcp-agents">
              <div v-for="agent in mcpAgents" :key="agent.name" class="mcp-agent-card">
                <div class="mcp-agent-header">
                  <div class="mcp-agent-name">{{ agent.name }}</div>
                  <button
                    class="btn btn-ghost btn-sm"
                    @click="copyMcpConfig(agent.name, agent.json)"
                  >
                    <span v-if="mcpCopied === agent.name">Copied!</span>
                    <span v-else>Copy Config</span>
                  </button>
                </div>
                <pre class="mcp-agent-code"><code>{{ agent.json }}</code></pre>
              </div>
            </div>
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

    <!-- SSO Provider Modal -->
    <div class="modal-overlay" :class="{ open: showSsoModal }" @click.self="closeSsoModal">
      <div class="modal sso-modal" style="width: 560px; max-height: 85vh;">
        <div class="modal-header">
          <h2>{{ ssoEditingProvider ? 'Edit Provider' : 'Add Provider' }}</h2>
          <button class="modal-close" aria-label="Close modal" @click="closeSsoModal">✕</button>
        </div>
        <form novalidate @submit.prevent="submitSsoProvider">
          <div class="modal-body">
            <!-- Provider Type Selection (only when adding) -->
            <div v-if="!ssoEditingProvider" class="form-group">
              <label for="ssoType">Provider Type</label>
              <select id="ssoType" v-model="ssoProviderType" @change="openSsoModal(ssoProviderType as SsoProviderType)">
                <option value="">Select a provider…</option>
                <option v-for="opt in providerTypeOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <!-- Provider Type Badge (when editing) -->
            <div v-else class="form-group" style="margin-bottom: 12px;">
              <label>Type</label>
              <div>
                <span class="pill" :style="{ background: providerTypeColor(ssoProviderType) + '15', color: providerTypeColor(ssoProviderType) }">
                  {{ providerTypeLabel(ssoProviderType) }}
                </span>
              </div>
            </div>

            <!-- Dynamic Fields -->
            <template v-if="ssoProviderType">
              <div
                v-for="field in SSO_PROVIDER_METADATA[ssoProviderType].fields"
                :key="field.key"
                class="form-group"
              >
                <label :for="'sso-' + field.key">
                  {{ field.label }}
                  <span v-if="!field.required" class="opt">(optional)</span>
                </label>
                <input
                  v-if="field.type === 'text' || field.type === 'url' || field.type === 'password'"
                  :id="'sso-' + field.key"
                  v-model="ssoForm[field.key]"
                  :type="field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text'"
                  :placeholder="field.placeholder"
                  :class="{ 'input-error': ssoFormErrors[field.key] }"
                  @input="delete ssoFormErrors[field.key]"
                />
                <select
                  v-else-if="field.type === 'select'"
                  :id="'sso-' + field.key"
                  v-model="ssoForm[field.key]"
                >
                  <option v-for="opt in field.options" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
                <span v-if="field.helpText" class="slug-hint">{{ field.helpText }}</span>
                <span v-if="ssoFormErrors[field.key]" class="error-msg show">{{ field.label }} is required</span>
              </div>
            </template>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeSsoModal">Cancel</button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isSavingSso || !ssoProviderType"
            >
              <span v-if="isSavingSso">Saving…</span>
              <span v-else>{{ ssoEditingProvider ? 'Save Changes' : 'Add Provider' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Provider Confirmation Modal -->
    <div class="modal-overlay" :class="{ open: !!providerToDelete }" @click.self="providerToDelete = null">
      <div class="modal" style="width: 400px;">
        <div class="modal-header">
          <h2>Remove Provider</h2>
          <button class="modal-close" aria-label="Close modal" @click="providerToDelete = null">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin: 0; color: var(--muted);">
            Are you sure you want to remove <strong>{{ providerToDelete?.name }}</strong>? Users will no longer be able to sign in with this provider.
          </p>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" @click="providerToDelete = null">Cancel</button>
          <button type="button" class="btn btn-danger" @click="doDeleteProvider">Remove</button>
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

.logo-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  min-height: 56px;
}
.logo-preview-img {
  max-height: 40px;
  max-width: 160px;
  object-fit: contain;
  border-radius: 4px;
}
.logo-preview-placeholder {
  color: var(--muted);
  font-size: 13px;
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

/* MCP Connection */
.mcp-info {
  margin-bottom: 16px;
}
.mcp-endpoint {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
}
.mcp-agents {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.mcp-agent-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.mcp-agent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.mcp-agent-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--fg);
}
.mcp-agent-code {
  margin: 0;
  padding: 16px;
  background: var(--surface);
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}
.mcp-agent-code code {
  font-family: var(--font-mono);
  color: var(--fg);
}

/* SSO Configuration */
.sso-provider-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sso-provider-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
}
.sso-provider-name {
  font-weight: 500;
  font-size: 14px;
  color: var(--fg);
}
.sso-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}
.sso-empty {
  text-align: center;
  padding: 48px 24px;
}
.sso-empty-icon {
  color: var(--border);
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
}
.sso-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fg);
  margin: 0 0 4px;
}
.sso-empty-desc {
  font-size: 13px;
  color: var(--muted);
  margin: 0 0 20px;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}
.sso-empty-types {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.sso-type-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--fg);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  font-family: inherit;
}
.sso-type-chip:hover {
  background: var(--bg);
  border-color: var(--fg);
}
.sso-type-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sso-callbacks {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sso-callback-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sso-callback-label {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sso-modal .modal-body {
  overflow-y: auto;
  max-height: 60vh;
}
</style>
