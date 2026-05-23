export interface WorkspaceSettings {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  theme: "light" | "dark" | "system";
  logoUrl: string | null;
  publicDocsAccess: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export type TeamRole = "admin" | "product_manager" | "tech_writer" | "viewer";

export interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  initials: string;
  role: TeamRole;
  lastActive: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface IntegrationSettings {
  id: string;
  githubActions: boolean;
  gitlabCI: boolean;
  jenkins: boolean;
  circleCI: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface NotificationSettings {
  id: string;
  emailDigest: boolean;
  releaseAlerts: boolean;
  docComments: boolean;
  slackNotifications: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ApiKeys {
  id: string;
  productionKey: string;
  webhookSecret: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateTeamMemberPayload {
  name: string;
  email?: string;
  initials?: string;
  role?: TeamRole;
  lastActive?: string;
}

export interface UpdateWorkspacePayload {
  name?: string;
  slug?: string;
  description?: string;
  theme?: "light" | "dark" | "system";
  logoUrl?: string;
  publicDocsAccess?: boolean;
}

export interface UpdateIntegrationsPayload {
  githubActions?: boolean;
  gitlabCI?: boolean;
  jenkins?: boolean;
  circleCI?: boolean;
}

export interface UpdateNotificationsPayload {
  emailDigest?: boolean;
  releaseAlerts?: boolean;
  docComments?: boolean;
  slackNotifications?: boolean;
}
