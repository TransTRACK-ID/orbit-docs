import type { DocItem } from "~/composables/useDocs";
import {
  docListPrimaryLabel,
  docListSecondaryLabel,
  groupDocsForList,
  isAdrDoc,
  isFeatureCatalogDoc,
  shouldCollapseKnowledgeSection,
  type DocListView,
} from "~/utils/doc-display";
import { buildDocPublicUrls } from "~/server/lib/mcp-public-urls";
import { formatAdrApiItem } from "~/server/lib/adr-queries";

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
  siteId?: string | null;
  slug?: string | null;
  siteSlug?: string | null;
  siteStatus?: string | null;
  siteName?: string | null;
  frontmatter?: Record<string, unknown> | null;
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
  const publicLinks = buildDocPublicUrls({
    id: item.id,
    status: item.status,
    slug: row.slug,
    siteId: row.siteId,
    siteSlug: row.siteSlug,
    siteStatus: row.siteStatus,
  });
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
    slug: row.slug ?? null,
    site: row.siteId
      ? {
          id: row.siteId,
          name: row.siteName ?? null,
          slug: row.siteSlug ?? null,
          status: row.siteStatus ?? null,
        }
      : null,
    category,
    displayLabel: docListPrimaryLabel(item),
    displaySubtitle: docListSecondaryLabel(item),
    publicPath: publicLinks.path,
    publicUrl: publicLinks.url,
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
  const adrRows = rows.filter((row) => isAdrDoc({ docType: row.docType ?? null }));
  const nonAdrRows = rows.filter((row) => !isAdrDoc({ docType: row.docType ?? null }));
  const items = nonAdrRows.map(toDocItem);
  const groups = groupDocsForList(items, view);

  return groups.map((group) => ({
    appId: group.key === "__unbound__" ? null : group.key,
    appName: group.label,
    sections: (() => {
      const appAdrs = adrRows.filter(
        (row) => (row.appId || "__unbound__") === group.key && row.status === "published"
      );
      const baseSections = group.sections.map((section) => {
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
      });

      if (appAdrs.length === 0) {
        return baseSections;
      }

      const adrSection = {
        kind: "architectural_decisions" as const,
        label: "Architectural decisions",
        docCount: appAdrs.length,
        collapsed: false,
        summary: null as string | null,
        docs: appAdrs.map((row) => {
          const formatted = formatAdrApiItem(
            {
              ...row,
              source: row.source ?? "manual",
              author: row.author ?? null,
              tags: row.tags ?? null,
              externalId: row.externalId ?? null,
              versionId: row.versionId ?? null,
              appName: row.appName ?? null,
              version: row.version ?? null,
              frontmatter: row.frontmatter ?? {},
            },
            { includeContent: false }
          );
          return {
            id: formatted.id,
            title: formatted.title,
            displayLabel: formatted.displayLabel,
            adrStatus: formatted.adrStatus,
            binding: formatted.binding,
            scope: formatted.scope,
            publicPath: formatted.publicPath,
            publicUrl: formatted.publicUrl,
            docType: "adr",
            category: "product" as const,
          };
        }),
      };

      const productIndex = baseSections.findIndex((section) => section.kind === "product");
      const knowledgeIndex = baseSections.findIndex((section) => section.kind === "knowledge");

      if (productIndex >= 0 && knowledgeIndex >= 0) {
        return [
          ...baseSections.slice(0, knowledgeIndex),
          adrSection,
          ...baseSections.slice(knowledgeIndex),
        ];
      }

      if (productIndex >= 0) {
        return [...baseSections.slice(0, productIndex + 1), adrSection, ...baseSections.slice(productIndex + 1)];
      }

      return [adrSection, ...baseSections];
    })(),
  }));
}
