import type { DocItem } from "~/composables/useDocs";
import { parseAdrFrontmatter } from "~/types/adr";

export const DOC_TYPE_LABELS: Record<string, string> = {
  srs: "SRS",
  fsd: "FSD",
  sdd: "SDD Index",
  sdd_index: "SDD Index",
  git_snapshot: "Git Snapshot",
  feature: "Feature",
  adr: "ADR",
};

/** Canonical titles written by product doc generation. */
const CANONICAL_GENERATED_TITLES = new Set([
  "Software Requirements Specification (SRS)",
  "Functional Specification Document (FSD)",
  "Git Snapshot",
  "SDD Index",
  "SDD index",
  "SRS",
  "FSD",
]);

const DOC_TYPE_SORT: Record<string, number> = {
  srs: 1,
  fsd: 2,
  git_snapshot: 3,
  sdd: 4,
  sdd_index: 4,
};

export type DocListView = "all" | "product" | "knowledge" | "adrs";

export const DOC_LIST_VIEW_OPTIONS: { id: DocListView; label: string }[] = [
  { id: "all", label: "All docs" },
  { id: "product", label: "Product docs" },
  { id: "knowledge", label: "Knowledge base" },
  { id: "adrs", label: "Architectural decisions" },
];

export const KNOWLEDGE_SECTION_COLLAPSE_THRESHOLD = 8;

export function docTypeLabel(docType: string | null | undefined): string {
  if (!docType) return "—";
  return DOC_TYPE_LABELS[docType] || docType;
}

export function isFeatureCatalogDoc(doc: DocItem): boolean {
  return doc.source === "op_sync" && doc.docType === "feature";
}

export function isAdrDoc(doc: Pick<DocItem, "docType">): boolean {
  return doc.docType === "adr";
}

export function isBindingAdr(
  doc: Pick<DocItem, "docType" | "status"> & {
    frontmatter?: Record<string, unknown> | null;
  }
): boolean {
  if (!isAdrDoc(doc)) return false;
  if (doc.status !== "published") return false;
  const fm = parseAdrFrontmatter(doc.frontmatter ?? undefined);
  return fm.adr_status === "accepted";
}

export function adrDisplayLabel(
  doc: Pick<DocItem, "title" | "docType"> & {
    frontmatter?: Record<string, unknown> | null;
  }
): string {
  const fm = parseAdrFrontmatter(doc.frontmatter ?? undefined);
  const num = fm.adr_number;
  const prefix = num != null ? `ADR-${String(num).padStart(3, "0")}` : "ADR";
  return `${prefix}: ${doc.title}`;
}

export function parseModuleFromTags(tags: string[] | null | undefined): string | null {
  if (!tags?.length) return null;
  const tag = tags.find((t) => t.startsWith("module:"));
  return tag ? tag.slice("module:".length) : null;
}

export function isGeneratedProductDoc(doc: DocItem): boolean {
  return doc.source === "generated" && !!doc.docType && !!doc.appId;
}

/** Generated docs whose title restates the doc type (the common duplicate case). */
export function hasCanonicalGeneratedTitle(doc: DocItem): boolean {
  if (!isGeneratedProductDoc(doc)) return false;
  const title = doc.title.trim();
  const typeLabel = docTypeLabel(doc.docType);
  if (CANONICAL_GENERATED_TITLES.has(title)) return true;
  if (title.toLowerCase() === typeLabel.toLowerCase()) return true;
  const slug = doc.docType!.replace(/_/g, " ").toLowerCase();
  return title.toLowerCase().includes(slug);
}

export function docListPrimaryLabel(
  doc: DocItem & { frontmatter?: Record<string, unknown> | null }
): string {
  if (isAdrDoc(doc)) return adrDisplayLabel(doc);
  if (hasCanonicalGeneratedTitle(doc)) return docTypeLabel(doc.docType);
  return doc.title;
}

export function docListSecondaryLabel(
  doc: DocItem & { frontmatter?: Record<string, unknown> | null }
): string | null {
  if (isAdrDoc(doc)) {
    if (isBindingAdr(doc)) return "Binding constraint";
    const fm = parseAdrFrontmatter(doc.frontmatter ?? undefined);
    if (fm.adr_status) {
      return fm.adr_status.charAt(0).toUpperCase() + fm.adr_status.slice(1);
    }
    return "Architectural decision";
  }
  if (isFeatureCatalogDoc(doc)) {
    const module = parseModuleFromTags(doc.tags);
    const id = doc.externalId?.trim();
    if (id && module) return `${id} · ${module}`;
    if (id) return id;
    if (module) return module;
    return "Synced feature";
  }
  if (hasCanonicalGeneratedTitle(doc)) return null;
  if (isGeneratedProductDoc(doc)) return docTypeLabel(doc.docType);
  return null;
}

export type DocListSectionKind = "product" | "knowledge" | "architectural_decisions";

export interface DocListSection {
  kind: DocListSectionKind;
  label: string;
  docs: DocItem[];
}

export interface DocListGroup {
  key: string;
  label: string;
  sections: DocListSection[];
}

function compareProductDocs(a: DocItem, b: DocItem): number {
  const orderA = DOC_TYPE_SORT[a.docType || ""] ?? 100;
  const orderB = DOC_TYPE_SORT[b.docType || ""] ?? 100;
  if (orderA !== orderB) return orderA - orderB;
  if (a.source !== b.source) {
    return a.source === "generated" ? -1 : 1;
  }
  return a.title.localeCompare(b.title);
}

function compareKnowledgeDocs(a: DocItem, b: DocItem): number {
  const idA = a.externalId || a.title;
  const idB = b.externalId || b.title;
  return idA.localeCompare(idB);
}

function compareAdrDocs(
  a: DocItem & { frontmatter?: Record<string, unknown> | null },
  b: DocItem & { frontmatter?: Record<string, unknown> | null }
): number {
  const numA = parseAdrFrontmatter(a.frontmatter ?? undefined).adr_number ?? 999_999;
  const numB = parseAdrFrontmatter(b.frontmatter ?? undefined).adr_number ?? 999_999;
  if (numA !== numB) return numA - numB;
  return a.title.localeCompare(b.title);
}

/** Published ADRs visible on `/docs`; draft ADRs stay in Settings unless user has `adrs:read`. */
export function isPublishedAdrForDocsList(
  doc: Pick<DocItem, "docType" | "status">
): boolean {
  return isAdrDoc(doc) && doc.status === "published";
}

export function filterDocsForDocsPage(
  docs: Array<DocItem & { frontmatter?: Record<string, unknown> | null }>,
  canReadDraftAdrs: boolean
): DocItem[] {
  return docs.filter((doc) => {
    if (!isAdrDoc(doc)) return true;
    if (doc.status === "published") return true;
    return canReadDraftAdrs;
  });
}

export function filterDocsByView(
  docs: DocItem[],
  view: DocListView,
  options?: { includeDraftAdrs?: boolean }
): DocItem[] {
  const includeDraftAdrs = options?.includeDraftAdrs ?? false;
  const visibleAdr = (doc: DocItem) =>
    doc.status === "published" || includeDraftAdrs;

  if (view === "all") {
    return docs.filter((doc) => !isAdrDoc(doc) || visibleAdr(doc));
  }
  if (view === "product") {
    return docs.filter((doc) => !isFeatureCatalogDoc(doc) && !isAdrDoc(doc));
  }
  if (view === "knowledge") return docs.filter((doc) => isFeatureCatalogDoc(doc));
  return docs.filter((doc) => isAdrDoc(doc) && visibleAdr(doc));
}

function buildSections(
  items: DocItem[],
  options?: { includeDraftAdrs?: boolean }
): DocListSection[] {
  const includeDraftAdrs = options?.includeDraftAdrs ?? false;
  const product = items.filter((doc) => !isFeatureCatalogDoc(doc) && !isAdrDoc(doc));
  const adrs = items.filter(
    (doc) => isAdrDoc(doc) && (doc.status === "published" || includeDraftAdrs)
  );
  const knowledge = items.filter((doc) => isFeatureCatalogDoc(doc));
  const sectionFamilies = [product, adrs, knowledge].filter((section) => section.length > 0);
  const showSubheaders = sectionFamilies.length > 1;
  const sections: DocListSection[] = [];

  if (product.length > 0) {
    sections.push({
      kind: "product",
      label: showSubheaders ? "Product documentation" : "",
      docs: [...product].sort(compareProductDocs),
    });
  }

  if (adrs.length > 0) {
    sections.push({
      kind: "architectural_decisions",
      label: showSubheaders ? "Architectural decisions" : "",
      docs: [...adrs].sort(compareAdrDocs),
    });
  }

  if (knowledge.length > 0) {
    sections.push({
      kind: "knowledge",
      label: showSubheaders ? "Knowledge base" : "",
      docs: [...knowledge].sort(compareKnowledgeDocs),
    });
  }

  return sections;
}

export function groupDocsForList(
  docs: DocItem[],
  view: DocListView = "all",
  options?: { includeDraftAdrs?: boolean }
): DocListGroup[] {
  const filtered = filterDocsByView(docs, view, options);
  const byApp = new Map<string, DocItem[]>();

  for (const doc of filtered) {
    const key = doc.app?.id || "__unbound__";
    if (!byApp.has(key)) byApp.set(key, []);
    byApp.get(key)!.push(doc);
  }

  const groups: DocListGroup[] = [];

  for (const [key, items] of byApp) {
    const label = items[0]?.app?.name || "Other";
    const sections = buildSections(items, options);
    if (sections.length === 0) continue;
    groups.push({ key, label, sections });
  }

  groups.sort((a, b) => {
    if (a.key === "__unbound__") return 1;
    if (b.key === "__unbound__") return -1;
    return a.label.localeCompare(b.label);
  });

  return groups;
}

export function sectionCollapseKey(groupKey: string, sectionKind: DocListSection["kind"]): string {
  return `${groupKey}:${sectionKind}`;
}

export function shouldCollapseKnowledgeSection(section: DocListSection): boolean {
  return section.kind === "knowledge" && section.docs.length > KNOWLEDGE_SECTION_COLLAPSE_THRESHOLD;
}
