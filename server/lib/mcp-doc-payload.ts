import type { DocItem } from "~/composables/useDocs";
import {
  docListPrimaryLabel,
  docListSecondaryLabel,
  groupDocsForList,
  isFeatureCatalogDoc,
  shouldCollapseKnowledgeSection,
  type DocListView,
} from "~/utils/doc-display";

export type McpDocCategory = "product" | "knowledge";

export interface McpDocRow {
  id: string;
  appId: string | null;
  title: string;
  content: string | null;
  status: string;
  versionId: string | null;
  tags: string[] | null;
  author: string | null;
  source?: string | null;
  docType?: string | null;
  externalId?: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  appName?: string | null;
  version?: string | null;
}

export function toDocItem(row: McpDocRow): DocItem {
  return {
    id: row.id,
    appId: row.appId,
    title: row.title,
    content: row.content,
    status: row.status as DocItem["status"],
    versionId: row.versionId,
    tags: row.tags,
    author: row.author,
    source: (row.source || "manual") as DocItem["source"],
    docType: row.docType ?? null,
    externalId: row.externalId ?? null,
    createdAt: row.createdAt ? String(row.createdAt) : null,
    updatedAt: row.updatedAt ? String(row.updatedAt) : null,
    app: row.appName && row.appId ? { id: row.appId, name: row.appName } : null,
    version: row.version && row.versionId ? { id: row.versionId, version: row.version } : null,
  };
}

export function getDocCategory(doc: Pick<DocItem, "source" | "docType">): McpDocCategory {
  return isFeatureCatalogDoc(doc as DocItem) ? "knowledge" : "product";
}

export function formatMcpDoc(row: McpDocRow, options?: { includeContent?: boolean }) {
  const item = toDocItem(row);
  const category = getDocCategory(item);
  const base = {
    id: item.id,
    appId: item.appId,
    title: item.title,
    status: item.status,
    versionId: item.versionId,
    tags: item.tags,
    author: item.author,
    source: item.source,
    docType: item.docType,
    externalId: item.externalId,
    category,
    displayLabel: docListPrimaryLabel(item),
    displaySubtitle: docListSecondaryLabel(item),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    app: item.app,
    version: item.version,
  };

  if (options?.includeContent) {
    return { ...base, content: item.content };
  }

  return base;
}

export interface AppDocGroupOptions {
  /**
   * When true (default), large Knowledge base sections (> threshold) are
   * collapsed to an empty doc list with a summary hint, mirroring the /docs
   * UI. Set to false for MCP consumers so the model always receives the full
   * Knowledge base index and can actually report on it.
   */
  collapseKnowledge?: boolean;
}

export function buildGroupedAppDocumentation(
  rows: McpDocRow[],
  view: DocListView = "all",
  options: AppDocGroupOptions = {},
) {
  const collapseKnowledge = options.collapseKnowledge ?? true;
  const items = rows.map(toDocItem);
  const groups = groupDocsForList(items, view);

  return groups.map((group) => ({
    appId: group.key === "__unbound__" ? null : group.key,
    appName: group.label,
    sections: group.sections.map((section) => {
      // Only knowledge sections are ever collapsed, and only when the caller
      // wants the /docs-style compact view. MCP callers pass
      // collapseKnowledge:false so the model sees every feature.
      const collapsed = collapseKnowledge && shouldCollapseKnowledgeSection(section);
      return {
        kind: section.kind,
        label:
          section.label ||
          (section.kind === "product" ? "Product documentation" : "Knowledge base"),
        docCount: section.docs.length,
        collapsed,
        summary: collapsed
          ? `${section.docs.length} synced features. Use search_feature_docs to query the knowledge base.`
          : null,
        docs: collapsed
          ? []
          : section.docs.map((doc) =>
              formatMcpDoc(
                {
                  ...doc,
                  appName: doc.app?.name ?? null,
                  version: doc.version?.version ?? null,
                },
                { includeContent: false },
              ),
            ),
      };
    }),
  }));
}
