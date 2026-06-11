/**
 * Default relative paths for product-level and repository-level documents.
 *
 * PRD/FSD are product-scoped (one per product, lives in the product docs repo).
 * SDD is repo-scoped (one per repository).
 */
export interface DocPathConfig {
  /** PRD file path relative to repo root (default: docs/PRD.md) */
  prdDocPath: string;
  /** FSD file path relative to repo root (default: docs/FSD.md) */
  fsdDocPath: string;
  /** SDD file path relative to repo root (default: docs/SDD.md) */
  sddDocPath: string;
}

export const DEFAULT_DOC_PATHS: DocPathConfig = {
  prdDocPath: "docs/PRD.md",
  fsdDocPath: "docs/FSD.md",
  sddDocPath: "docs/SDD.md",
};

/** Internal doc type names used in code. */
export type ProductDocType = "srs"; // internal name; UI = PRD
export type RepoDocType = "sdd";
export type DocType = ProductDocType | RepoDocType | "fsd";

/**
 * Resolve the effective file path for a doc type given optional overrides.
 */
export function resolveDocPath(
  type: DocType,
  overrides?: Partial<DocPathConfig>
): string {
  switch (type) {
    case "srs":
      return overrides?.prdDocPath || DEFAULT_DOC_PATHS.prdDocPath;
    case "fsd":
      return overrides?.fsdDocPath || DEFAULT_DOC_PATHS.fsdDocPath;
    case "sdd":
      return overrides?.sddDocPath || DEFAULT_DOC_PATHS.sddDocPath;
    default:
      return DEFAULT_DOC_PATHS.sddDocPath;
  }
}
