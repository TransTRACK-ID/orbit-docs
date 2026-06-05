import { describe, expect, it, vi, beforeEach } from "vitest";
import { useSettings } from "./useSettings";

const mockFetch = vi.fn();
(globalThis as any).$fetch = mockFetch;

const mockNavigateTo = vi.fn();
(globalThis as any).navigateTo = mockNavigateTo;

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("vue3-toastify", () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}));

describe("useSettings composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should fetch workspace settings", async () => {
    const data = { data: { id: "ws1", name: "Workspace", slug: "workspace", description: null, logoUrl: null, theme: "light" as const, publicDocsAccess: true, createdAt: null, updatedAt: null } };
    mockFetch.mockResolvedValueOnce(data);

    const { workspace, fetchWorkspace, isLoadingWorkspace } = useSettings();
    await fetchWorkspace();

    expect(workspace.value?.name).toBe("Workspace");
    expect(isLoadingWorkspace.value).toBe(false);
  });

  it("should update workspace settings", async () => {
    const data = { data: { id: "ws1", name: "Updated Workspace", slug: "updated", description: null, logoUrl: null, theme: "dark" as const, publicDocsAccess: true, createdAt: null, updatedAt: null } };
    mockFetch.mockResolvedValueOnce({ data: data.data });

    const { workspace, updateWorkspace, isSaving } = useSettings();
    const result = await updateWorkspace({ name: "Updated Workspace", theme: "dark" });

    expect(result.name).toBe("Updated Workspace");
    expect(workspace.value?.theme).toBe("dark");
    expect(isSaving.value).toBe(false);
    expect(mockToastSuccess).toHaveBeenCalledWith("Workspace settings saved");
  });

  it("should fetch team members", async () => {
    const data = { data: [{ id: "m1", name: "Alice", email: "alice@example.com", initials: "AL", role: "admin" as const, status: "active" as const, invitedBy: null, userId: null, lastActive: "just now", lastActiveAt: null, createdAt: null, updatedAt: null }] };
    mockFetch.mockResolvedValueOnce(data);

    const { teamMembers, fetchTeam, isLoadingTeam } = useSettings();
    await fetchTeam();

    expect(teamMembers.value).toHaveLength(1);
    expect(teamMembers.value[0].name).toBe("Alice");
    expect(isLoadingTeam.value).toBe(false);
  });

  it("should fetch current member", async () => {
    const data = { data: { id: "m1", name: "Alice", email: "alice@example.com", initials: "AL", role: "admin" as const, status: "active" as const, invitedBy: null, userId: null, lastActive: "just now", lastActiveAt: null, createdAt: null, updatedAt: null } };
    mockFetch.mockResolvedValueOnce(data);

    const { currentMember, fetchCurrentMember, isLoadingCurrentMember } = useSettings();
    await fetchCurrentMember();

    expect(currentMember.value?.role).toBe("admin");
    expect(isLoadingCurrentMember.value).toBe(false);
  });

  it("should compute canManageTeam correctly", async () => {
    const { canManageTeam, currentMember } = useSettings();
    expect(canManageTeam.value).toBe(false);

    currentMember.value = { id: "m1", name: "Alice", email: "alice@example.com", initials: "AL", role: "admin" as const, status: "active" as const, invitedBy: null, userId: null, lastActive: "just now", lastActiveAt: null, createdAt: null, updatedAt: null };
    expect(canManageTeam.value).toBe(true);

    currentMember.value = { id: "m2", name: "Bob", email: "bob@example.com", initials: "BO", role: "viewer" as const, status: "active" as const, invitedBy: null, userId: null, lastActive: "just now", lastActiveAt: null, createdAt: null, updatedAt: null };
    expect(canManageTeam.value).toBe(false);
  });

  it("should invite a team member", async () => {
    const newMember = { id: "m2", name: "Bob", email: "bob@example.com", initials: "BO", role: "tech_writer" as const, status: "pending" as const, invitedBy: null, userId: null, lastActive: "just now", lastActiveAt: null, createdAt: null, updatedAt: null };
    mockFetch.mockResolvedValueOnce({ data: newMember });

    const { teamMembers, inviteMember, isInviting } = useSettings();
    const result = await inviteMember({ name: "Bob", email: "bob@example.com", role: "tech_writer" });

    expect(result.name).toBe("Bob");
    expect(teamMembers.value).toHaveLength(1);
    expect(isInviting.value).toBe(false);
    expect(mockToastSuccess).toHaveBeenCalledWith("Invited Bob");
  });

  it("should accept an invitation", async () => {
    const accepted = { id: "m2", name: "Bob", email: "bob@example.com", initials: "BO", role: "tech_writer" as const, status: "active" as const, invitedBy: null, userId: null, lastActive: "just now", lastActiveAt: null, createdAt: null, updatedAt: null };
    mockFetch.mockResolvedValueOnce({ data: accepted });

    const { teamMembers, currentMember, pendingInvitations, acceptInvitation, isAccepting } = useSettings();
    teamMembers.value = [{ id: "m2", name: "Bob", email: "bob@example.com", initials: "BO", role: "tech_writer" as const, status: "pending" as const, invitedBy: null, userId: null, lastActive: "just now", lastActiveAt: null, createdAt: null, updatedAt: null }];
    pendingInvitations.value = [{ id: "m2", name: "Bob", email: "bob@example.com", initials: "BO", role: "tech_writer" as const, status: "pending" as const, invitedBy: null, userId: null, lastActive: "just now", lastActiveAt: null, createdAt: null, updatedAt: null }];

    const result = await acceptInvitation("m2");
    expect(result.status).toBe("active");
    expect(pendingInvitations.value).toHaveLength(0);
    expect(currentMember.value?.status).toBe("active");
    expect(isAccepting.value).toBe(false);
    expect(mockToastSuccess).toHaveBeenCalledWith("Invitation accepted. Welcome to the workspace!");
  });

  it("should update a team member", async () => {
    const updated = { id: "m2", name: "Bob Updated", email: "bob@example.com", initials: "BO", role: "product_manager" as const, status: "active" as const, invitedBy: null, userId: null, lastActive: "just now", lastActiveAt: null, createdAt: null, updatedAt: null };
    mockFetch.mockResolvedValueOnce({ data: updated });

    const { teamMembers, updateMember } = useSettings();
    teamMembers.value = [{ id: "m2", name: "Bob", email: "bob@example.com", initials: "BO", role: "tech_writer" as const, status: "active" as const, invitedBy: null, userId: null, lastActive: "just now", lastActiveAt: null, createdAt: null, updatedAt: null }];

    const result = await updateMember("m2", { name: "Bob Updated", role: "product_manager" });
    expect(result.name).toBe("Bob Updated");
    expect(teamMembers.value[0].role).toBe("product_manager");
    expect(mockToastSuccess).toHaveBeenCalledWith("Member updated");
  });

  it("should delete a team member", async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { teamMembers, deleteMember } = useSettings();
    teamMembers.value = [{ id: "m2", name: "Bob", email: "bob@example.com", initials: "BO", role: "tech_writer" as const, status: "active" as const, invitedBy: null, userId: null, lastActive: "just now", lastActiveAt: null, createdAt: null, updatedAt: null }];

    await deleteMember("m2");
    expect(teamMembers.value).toHaveLength(0);
    expect(mockToastSuccess).toHaveBeenCalledWith("Member removed");
  });

  it("should fetch integrations", async () => {
    const data = { data: { id: "int1", githubActions: true, gitlabCI: false, jenkins: false, circleCI: false, createdAt: null, updatedAt: null } };
    mockFetch.mockResolvedValueOnce(data);

    const { integrations, fetchIntegrations, isLoadingIntegrations } = useSettings();
    await fetchIntegrations();

    expect(integrations.value?.githubActions).toBe(true);
    expect(isLoadingIntegrations.value).toBe(false);
  });

  it("should update integrations", async () => {
    const data = { data: { id: "int1", githubActions: false, gitlabCI: true, jenkins: false, circleCI: false, createdAt: null, updatedAt: null } };
    mockFetch.mockResolvedValueOnce({ data: data.data });

    const { integrations, updateIntegrations } = useSettings();
    const result = await updateIntegrations({ gitlabCI: true });

    expect(result.gitlabCI).toBe(true);
    expect(mockToastSuccess).toHaveBeenCalledWith("Integration settings saved");
  });

  it("should fetch notifications", async () => {
    const data = { data: { id: "not1", emailDigest: true, releaseAlerts: false, docComments: true, slackNotifications: false, createdAt: null, updatedAt: null } };
    mockFetch.mockResolvedValueOnce(data);

    const { notifications, fetchNotifications, isLoadingNotifications } = useSettings();
    await fetchNotifications();

    expect(notifications.value?.emailDigest).toBe(true);
    expect(isLoadingNotifications.value).toBe(false);
  });

  it("should update notifications", async () => {
    const data = { data: { id: "not1", emailDigest: false, releaseAlerts: true, docComments: true, slackNotifications: true, createdAt: null, updatedAt: null } };
    mockFetch.mockResolvedValueOnce({ data: data.data });

    const { notifications, updateNotifications } = useSettings();
    const result = await updateNotifications({ slackNotifications: true });

    expect(result.slackNotifications).toBe(true);
    expect(mockToastSuccess).toHaveBeenCalledWith("Notification preferences saved");
  });

  it("should fetch API keys", async () => {
    const data = { data: { productionKey: "key1", webhookSecret: "secret1", updatedAt: null } };
    mockFetch.mockResolvedValueOnce(data);

    const { apiKeys, fetchApiKeys, isLoadingApiKeys } = useSettings();
    await fetchApiKeys();

    expect(apiKeys.value?.productionKey).toBe("key1");
    expect(isLoadingApiKeys.value).toBe(false);
  });

  it("should regenerate API keys", async () => {
    const data = { data: { productionKey: "key2", webhookSecret: "secret2", updatedAt: null } };
    mockFetch.mockResolvedValueOnce({ data: data.data });

    const { apiKeys, regenerateApiKeys } = useSettings();
    const result = await regenerateApiKeys({ productionKey: true });

    expect(result.productionKey).toBe("key2");
    expect(mockToastSuccess).toHaveBeenCalledWith("API key regenerated");
  });

  it("should revoke all API keys", async () => {
    const data = { data: { productionKey: null, webhookSecret: null, updatedAt: null } };
    mockFetch.mockResolvedValueOnce({ data: data.data });

    const { apiKeys, regenerateApiKeys } = useSettings();
    const result = await regenerateApiKeys({ revokeAll: true });

    expect(result.productionKey).toBeNull();
    expect(mockToastSuccess).toHaveBeenCalledWith("All API keys revoked");
  });

  it("should handle 401 on fetchWorkspace", async () => {
    mockFetch.mockRejectedValueOnce({ statusCode: 401 });
    const { fetchWorkspace } = useSettings();
    await fetchWorkspace();
    expect(mockToastError).toHaveBeenCalledWith("Session expired. Please sign in again.");
    expect(mockNavigateTo).toHaveBeenCalledWith("/login");
  });
});
