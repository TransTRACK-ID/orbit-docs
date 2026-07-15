import type { DocItem } from "~/composables/useDocs";

export const DOC_TYPE_LABELS: Record<string, string> = {
  srs: "SRS",
  fsd: "FSD",
  sdd: "SDD Index",
  sdd_index: "SDD Index",
  git_snapshot: "Git Snapshot",
  feature: "Feature",
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

export type DocListView = "all" | "product" | "knowledge";

export const DOC_LIST_VIEW_OPTIONS: { id: DocListView; label: string }[] = [
  { id: "all", label: "All docs" },
  { id: "product", label: "Product docs" },
  { id: "knowledge", label: "Knowledge base" },
];

export const KNOWLEDGE_SECTION_COLLAPSE_THRESHOLD = 8;

export function docTypeLabel(docType: string | null | undefined): string {
  if (!docType) return "—";
  return DOC_TYPE_LABELS[docType] || docType;
}

export function isFeatureCatalogDoc(doc: DocItem): boolean {
  return doc.source === "op_sync" && doc.docType === "feature";
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

export function docListPrimaryLabel(doc: DocItem): string {
  if (hasCanonicalGeneratedTitle(doc)) return docTypeLabel(doc.docType);
  return doc.title;
}

export function docListSecondaryLabel(doc: DocItem): string | null {
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

export interface DocListSection {
  kind: "product" | "knowledge";
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

export function filterDocsByView(docs: DocItem[], view: DocListView): DocItem[] {
  if (view === "all") return docs;
  if (view === "product") return docs.filter((doc) => !isFeatureCatalogDoc(doc));
  return docs.filter((doc) => isFeatureCatalogDoc(doc));
}

function buildSections(items: DocItem[]): DocListSection[] {
  const product = items.filter((doc) => !isFeatureCatalogDoc(doc));
  const knowledge = items.filter((doc) => isFeatureCatalogDoc(doc));
  const showSubheaders = product.length > 0 && knowledge.length > 0;
  const sections: DocListSection[] = [];

  if (product.length > 0) {
    sections.push({
      kind: "product",
      label: showSubheaders ? "Product documentation" : "",
      docs: [...product].sort(compareProductDocs),
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

export function groupDocsForList(docs: DocItem[], view: DocListView = "all"): DocListGroup[] {
  const filtered = filterDocsByView(docs, view);
  const byApp = new Map<string, DocItem[]>();

  for (const doc of filtered) {
    const key = doc.app?.id || "__unbound__";
    if (!byApp.has(key)) byApp.set(key, []);
    byApp.get(key)!.push(doc);
  }

  const groups: DocListGroup[] = [];

  for (const [key, items] of byApp) {
    const label = items[0]?.app?.name || "Other";
    const sections = buildSections(items);
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
