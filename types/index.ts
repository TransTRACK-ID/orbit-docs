// Re-export shared types for cleaner imports across the app
export type { ISidebar, IChildSidebar } from "./sidebar";
export type { ElementEvent } from "./element";

// Release Management types
export interface ReleaseMedia {
  type: "image" | "video";
  src: string;
  alt: string;
}

export interface ReleaseFeature {
  id: string;
  heading: string;
  description: string;
  media?: ReleaseMedia[];
}

export interface ReleaseCategories {
  added?: string[];
  fixed?: string[];
  changed?: string[];
  deprecated?: string[];
  security?: string[];
}

export type ReleaseType = "normal" | "article";

export interface ReleaseItem {
  id: string;
  appId: string;
  versionId: string | null;
  heroTitle: string | null;
  summary: string | null;
  features: ReleaseFeature[] | null;
  categories: ReleaseCategories | null;
  type: ReleaseType;
  published: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  appName: string;
  version: string | null;
  releaseDate: string | null;
  createdBy: string | null;
  versionStatus: string | null;
}

export interface CreateReleasePayload {
  appId: string;
  versionId: string;
  heroTitle?: string;
  summary?: string;
  features?: ReleaseFeature[];
  categories?: ReleaseCategories;
  type?: ReleaseType;
  published?: boolean;
  versionAction?: "save" | "publish" | "restore";
}

export interface ReleaseVersion {
  id: string;
  releaseId: string;
  heroTitle: string | null;
  summary: string | null;
  published: boolean;
  action: string;
  actor: string | null;
  createdAt: string | null;
}

// Changelog types
export interface ChangelogItem {
  id: string;
  appId: string;
  versionId: string | null;
  title: string;
  content: string | null;
  status: "draft" | "published";
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  appName?: string;
  version?: string | null;
}

export interface CreateChangelogPayload {
  appId: string;
  versionId?: string;
  title: string;
  content?: string;
  status?: "draft" | "published";
}

// Docs types
export interface DocItem {
  id: string;
  appId: string | null;
  title: string;
  content: string | null;
  status: "draft" | "in_review" | "published" | "archived";
  versionId: string | null;
  tags: string[] | null;
  author: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  app: { id: string; name: string } | null;
  version: { id: string; version: string } | null;
}

export interface DocVersion {
  id: string;
  docId: string;
  version: string;
  content: string | null;
  title: string | null;
  actor: string | null;
  createdAt: string | null;
}

export interface DocVersionOption {
  id: string;
  version: string;
  status: string;
}

export interface DocDetail extends DocItem {
  appVersions: DocVersionOption[];
}

export interface CreateDocPayload {
  title: string;
  appId?: string | null;
  content?: string;
  status?: string;
  versionId?: string | null;
  tags?: string[];
  author?: string;
}

// Doc feedback types
export type FeedbackStatus = "open" | "resolved" | "closed";

export interface FeedbackItem {
  id: string;
  docId: string;
  appId: string | null;
  helpful: boolean;
  comment: string | null;
  status: FeedbackStatus;
  visitorId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  docTitle?: string;
  appName?: string;
}

export interface SubmitDocFeedbackPayload {
  helpful: boolean;
  comment?: string;
  visitorId?: string;
}

export interface FeedbackStats {
  total: number;
  helpful: number;
  notHelpful: number;
  open: number;
}

export type InternalFeedbackCategory = "general" | "bug" | "feature" | "docs";

export interface InternalFeedbackItem {
  id: string;
  userId: string | null;
  userName: string;
  userEmail: string | null;
  category: InternalFeedbackCategory;
  comment: string;
  status: FeedbackStatus;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SubmitInternalFeedbackPayload {
  category: InternalFeedbackCategory;
  comment: string;
}

export interface InternalFeedbackStats {
  total: number;
  open: number;
}
