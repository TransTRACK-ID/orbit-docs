import type { DocItem } from "~/composables/useDocs";

export const DOC_TYPE_LABELS: Record<string, string> = {
  srs: "SRS",
  fsd: "FSD",
  sdd: "SDD Index",
  sdd_index: "SDD Index",
  git_snapshot: "Git Snapshot",
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

export function docTypeLabel(docType: string | null | undefined): string {
  if (!docType) return "—";
  return DOC_TYPE_LABELS[docType] || docType;
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
  if (hasCanonicalGeneratedTitle(doc)) return null;
  if (isGeneratedProductDoc(doc)) return docTypeLabel(doc.docType);
  return null;
}

export interface DocListGroup {
  key: string;
  label: string;
  docs: DocItem[];
}

function compareDocs(a: DocItem, b: DocItem): number {
  const orderA = DOC_TYPE_SORT[a.docType || ""] ?? 100;
  const orderB = DOC_TYPE_SORT[b.docType || ""] ?? 100;
  if (orderA !== orderB) return orderA - orderB;
  if (a.source !== b.source) {
    return a.source === "generated" ? -1 : 1;
  }
  return a.title.localeCompare(b.title);
}

export function groupDocsForList(docs: DocItem[]): DocListGroup[] {
  const byApp = new Map<string, DocItem[]>();

  for (const doc of docs) {
    const key = doc.app?.id || "__unbound__";
    if (!byApp.has(key)) byApp.set(key, []);
    byApp.get(key)!.push(doc);
  }

  const groups: DocListGroup[] = [];

  for (const [key, items] of byApp) {
    const label = items[0]?.app?.name || "Other";
    groups.push({
      key,
      label,
      docs: [...items].sort(compareDocs),
    });
  }

  groups.sort((a, b) => {
    if (a.key === "__unbound__") return 1;
    if (b.key === "__unbound__") return -1;
    return a.label.localeCompare(b.label);
  });

  return groups;
}
