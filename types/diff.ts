export type HistoryAction = "save" | "publish" | "restore" | "quick_release" | "article_release";

export interface DiffVersionMeta {
  id: string;
  action: string;
  actionLabel: string;
  actor: string | null;
  createdAt: string | null;
  label: string;
}

export interface DiffSection {
  key: string;
  label: string;
  from: string;
  to: string;
}

export interface DiffMetadataChange {
  field: string;
  label: string;
  from: string | boolean | null;
  to: string | boolean | null;
}

export interface HistoryDiffResponse {
  from: DiffVersionMeta;
  to: DiffVersionMeta;
  sections: DiffSection[];
  metadata: DiffMetadataChange[];
  versions: DiffVersionMeta[];
}

export type DiffEntityType = "doc" | "changelog" | "release";
