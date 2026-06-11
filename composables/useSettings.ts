import { toast } from "vue3-toastify";
import type {
  WorkspaceSettings,
  TeamMember,
  IntegrationSettings,
  NotificationSettings,
  ApiKeys,
  CreateTeamMemberPayload,
  UpdateWorkspacePayload,
  UpdateIntegrationsPayload,
  UpdateNotificationsPayload,
  UpdateDocGenerationPayload,
  DocGenerationSettings,
} from "~/types/settings";

export const useSettings = () => {
  const workspace = useState<WorkspaceSettings | null>("workspace-settings", () => null);
  const teamMembers = ref<TeamMember[]>([]);
  const currentMember = ref<TeamMember | null>(null);
  const pendingInvitations = ref<TeamMember[]>([]);
  const integrations = ref<IntegrationSettings | null>(null);
  const notifications = ref<NotificationSettings | null>(null);
  const docGeneration = ref<DocGenerationSettings | null>(null);
  const apiKeys = ref<ApiKeys | null>(null);

  const isLoadingWorkspace = ref(false);
  const isLoadingTeam = ref(false);
  const isLoadingCurrentMember = ref(false);
  const isLoadingIntegrations = ref(false);
  const isLoadingNotifications = ref(false);
  const isLoadingDocGeneration = ref(false);
  const isLoadingApiKeys = ref(false);
  const isSaving = ref(false);
  const isInviting = ref(false);
  const isAccepting = ref(false);

  const canManageTeam = computed(() => {
    if (!currentMember.value) return false;
    return ["admin", "product_manager"].includes(currentMember.value.role);
  });

  async function fetchWorkspace() {
    isLoadingWorkspace.value = true;
    try {
      const data = await $fetch<{ data: WorkspaceSettings }>("/api/settings");
      workspace.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load workspace settings");
      }
      console.error(e);
    } finally {
      isLoadingWorkspace.value = false;
    }
  }

  async function updateWorkspace(payload: UpdateWorkspacePayload) {
    isSaving.value = true;
    try {
      const data = await $fetch<{ data: WorkspaceSettings }>("/api/settings", {
        method: "PUT",
        body: payload,
      });
      workspace.value = data.data;
      toast.success("Workspace settings saved");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to save workspace settings";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  async function fetchTeam() {
    isLoadingTeam.value = true;
    try {
      const data = await $fetch<{ data: TeamMember[] }>("/api/settings/team");
      teamMembers.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load team members");
      }
      console.error(e);
    } finally {
      isLoadingTeam.value = false;
    }
  }

  async function fetchCurrentMember() {
    isLoadingCurrentMember.value = true;
    try {
      const data = await $fetch<{ data: TeamMember | null }>("/api/settings/team/me");
      currentMember.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      }
      console.error(e);
    } finally {
      isLoadingCurrentMember.value = false;
    }
  }

  async function fetchPendingInvitations() {
    try {
      const data = await $fetch<{ data: TeamMember[] }>("/api/settings/team/invitations");
      pendingInvitations.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      }
      console.error("Failed to load invitations", e);
    }
  }

  async function inviteMember(payload: CreateTeamMemberPayload) {
    isInviting.value = true;
    try {
      const data = await $fetch<{ data: TeamMember }>("/api/settings/team", {
        method: "POST",
        body: payload,
      });
      teamMembers.value.push(data.data);
      toast.success(`Invited ${data.data.name}`);
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to invite member";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    } finally {
      isInviting.value = false;
    }
  }

  async function acceptInvitation(memberId: string) {
    isAccepting.value = true;
    try {
      const data = await $fetch<{ data: TeamMember }>(`/api/settings/team/${memberId}/accept`, {
        method: "POST",
      });
      const idx = teamMembers.value.findIndex((m) => m.id === memberId);
      if (idx !== -1) {
        teamMembers.value[idx] = { ...teamMembers.value[idx], ...data.data };
      }
      pendingInvitations.value = pendingInvitations.value.filter((m) => m.id !== memberId);
      currentMember.value = data.data;
      toast.success("Invitation accepted. Welcome to the workspace!");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to accept invitation";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    } finally {
      isAccepting.value = false;
    }
  }

  async function updateMember(id: string, payload: Partial<CreateTeamMemberPayload>) {
    try {
      const data = await $fetch<{ data: TeamMember }>(`/api/settings/team/${id}`, {
        method: "PUT",
        body: payload,
      });
      const idx = teamMembers.value.findIndex((m) => m.id === id);
      if (idx !== -1) {
        teamMembers.value[idx] = { ...teamMembers.value[idx], ...data.data };
      }
      toast.success("Member updated");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to update member";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    }
  }

  async function deleteMember(id: string) {
    try {
      await $fetch(`/api/settings/team/${id}`, { method: "DELETE" });
      teamMembers.value = teamMembers.value.filter((m) => m.id !== id);
      toast.success("Member removed");
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to remove member";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    }
  }

  async function fetchIntegrations() {
    isLoadingIntegrations.value = true;
    try {
      const data = await $fetch<{ data: IntegrationSettings }>("/api/settings/integrations");
      integrations.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load integrations");
      }
      console.error(e);
    } finally {
      isLoadingIntegrations.value = false;
    }
  }

  async function updateIntegrations(payload: UpdateIntegrationsPayload) {
    try {
      const data = await $fetch<{ data: IntegrationSettings }>("/api/settings/integrations", {
        method: "PUT",
        body: payload,
      });
      integrations.value = data.data;
      toast.success("Integration settings saved");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to save integrations";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    }
  }

  async function fetchNotifications() {
    isLoadingNotifications.value = true;
    try {
      const data = await $fetch<{ data: NotificationSettings }>("/api/settings/notifications");
      notifications.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load notifications");
      }
      console.error(e);
    } finally {
      isLoadingNotifications.value = false;
    }
  }

  async function updateNotifications(payload: UpdateNotificationsPayload) {
    try {
      const data = await $fetch<{ data: NotificationSettings }>("/api/settings/notifications", {
        method: "PUT",
        body: payload,
      });
      notifications.value = data.data;
      toast.success("Notification preferences saved");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to save notifications";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    }
  }

  async function fetchDocGeneration() {
    isLoadingDocGeneration.value = true;
    try {
      const data = await $fetch<{ data: DocGenerationSettings }>("/api/settings/doc-generation");
      docGeneration.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load document generation settings");
      }
      console.error(e);
    } finally {
      isLoadingDocGeneration.value = false;
    }
  }

  async function updateDocGeneration(payload: UpdateDocGenerationPayload) {
    try {
      const data = await $fetch<{ data: DocGenerationSettings }>("/api/settings/doc-generation", {
        method: "PUT",
        body: payload,
      });
      docGeneration.value = data.data;
      toast.success("Document generation settings saved");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to save document generation settings";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    }
  }

  async function fetchApiKeys() {
    isLoadingApiKeys.value = true;
    try {
      const data = await $fetch<{ data: ApiKeys }>("/api/settings/api-keys");
      apiKeys.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load API keys");
      }
      console.error(e);
    } finally {
      isLoadingApiKeys.value = false;
    }
  }

  async function regenerateApiKeys(options: { productionKey?: boolean; webhookSecret?: boolean; revokeAll?: boolean }) {
    try {
      const data = await $fetch<{ data: ApiKeys }>("/api/settings/api-keys", {
        method: "PUT",
        body: options,
      });
      apiKeys.value = data.data;
      if (options.revokeAll) {
        toast.success("All API keys revoked");
      } else {
        toast.success("API key regenerated");
      }
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to regenerate API keys";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    }
  }

  return {
    workspace,
    teamMembers,
    currentMember,
    pendingInvitations,
    integrations,
    notifications,
    docGeneration,
    apiKeys,
    isLoadingWorkspace,
    isLoadingTeam,
    isLoadingCurrentMember,
    isLoadingIntegrations,
    isLoadingNotifications,
    isLoadingDocGeneration,
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
    updateMember,
    deleteMember,
    fetchIntegrations,
    updateIntegrations,
    fetchNotifications,
    updateNotifications,
    fetchDocGeneration,
    updateDocGeneration,
    fetchApiKeys,
    regenerateApiKeys,
  };
};
