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

export interface ReleaseItem {
  id: string;
  appId: string;
  versionId: string;
  heroTitle: string | null;
  summary: string | null;
  features: ReleaseFeature[] | null;
  categories: ReleaseCategories | null;
  published: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  appName: string;
  version: string;
  releaseDate: string | null;
  createdBy: string | null;
  versionStatus: string;
}

export interface CreateReleasePayload {
  appId: string;
  versionId: string;
  heroTitle?: string;
  summary?: string;
  features?: ReleaseFeature[];
  categories?: ReleaseCategories;
  published?: boolean;
}
