export interface FeatureRow {
  feature_id: string;
  module: string;
  feature_name: string;
  what_is_it: string;
  who_uses_it: string;
  when_to_use: string;
  how_to_use: string;
  business_rules: string;
  limitations: string;
  related_features: string;
  faq: string;
  sales_pitch?: string;
  version: string;
  status: string;
  last_updated: string;
  author: string;
}

export const REQUIRED_FEATURE_FIELDS = [
  "feature_id",
  "module",
  "feature_name",
  "what_is_it",
  "who_uses_it",
  "when_to_use",
  "how_to_use",
  "business_rules",
  "limitations",
  "related_features",
  "faq",
  "version",
  "status",
  "last_updated",
  "author",
] as const satisfies ReadonlyArray<keyof FeatureRow>;

export type DocStatus = "draft" | "in_review" | "published" | "archived";

export interface FeatureValidationError {
  feature_id?: string;
  message: string;
}

export function moduleTag(module: string): string {
  return `module:${module.trim()}`;
}

export function parseModuleFromTags(tags: string[] | null | undefined): string | null {
  if (!tags?.length) return null;
  const tag = tags.find((t) => t.startsWith("module:"));
  return tag ? tag.slice("module:".length) : null;
}

export function mapFeatureStatus(raw: string): { status: DocStatus; warning?: string } {
  const normalized = raw.trim().toLowerCase();

  if (["published", "live", "active", "done"].includes(normalized)) {
    return { status: "published" };
  }
  if (["draft", "wip"].includes(normalized)) {
    return { status: "draft" };
  }
  if (["review", "in_review", "in review"].includes(normalized)) {
    return { status: "in_review" };
  }
  if (["archived", "deprecated", "retired"].includes(normalized)) {
    return { status: "archived" };
  }

  return {
    status: "draft",
    warning: `Unknown status "${raw}" — defaulted to draft`,
  };
}

function coerceSpreadsheetValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

/** Normalize raw spreadsheet cells (numbers, dates, booleans) before validation. */
export function coerceFeatureRow(row: Record<string, unknown>): Record<string, unknown> {
  const coerced: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    coerced[key] = coerceSpreadsheetValue(value);
  }
  return coerced;
}

function requireString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return `${field} is required`;
  }
  if (typeof value !== "string") {
    return `${field} must be a string`;
  }
  if (!value.trim()) {
    return `${field} is required`;
  }
  return null;
}

export function validateFeatureRow(row: unknown): FeatureValidationError | null {
  if (!row || typeof row !== "object") {
    return { message: "Feature row must be an object" };
  }

  const record = coerceFeatureRow(row as Record<string, unknown>);
  const featureId = record.feature_id;

  for (const field of REQUIRED_FEATURE_FIELDS) {
    const error = requireString(record[field], field);
    if (error) {
      return {
        feature_id: typeof featureId === "string" ? featureId : undefined,
        message: error,
      };
    }
  }

  if (record.sales_pitch !== undefined && record.sales_pitch !== null && typeof record.sales_pitch !== "string") {
    return {
      feature_id: String(featureId),
      message: "sales_pitch must be a string",
    };
  }

  return null;
}

export function buildFeatureMarkdown(feature: FeatureRow): string {
  const lines = [
    `# ${feature.feature_name.trim()}`,
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| Feature ID | ${feature.feature_id.trim()} |`,
    `| Module | ${feature.module.trim()} |`,
    `| Version | ${feature.version.trim()} |`,
    `| Status | ${feature.status.trim()} |`,
    `| Last updated | ${feature.last_updated.trim()} |`,
    `| Author | ${feature.author.trim()} |`,
    "",
    "## What is it",
    feature.what_is_it.trim(),
    "",
    "## Who uses it",
    feature.who_uses_it.trim(),
    "",
    "## When to use",
    feature.when_to_use.trim(),
    "",
    "## How to use",
    feature.how_to_use.trim(),
    "",
    "## Business rules",
    feature.business_rules.trim(),
    "",
    "## Limitations",
    feature.limitations.trim(),
    "",
    "## Related features",
    feature.related_features.trim(),
    "",
    "## FAQ",
    feature.faq.trim(),
  ];

  const pitch = feature.sales_pitch?.trim();
  if (pitch) {
    lines.push("", "## Sales pitch", pitch);
  }

  return lines.join("\n");
}

export function normalizeFeatureRow(row: Record<string, unknown>): FeatureRow {
  return {
    feature_id: String(row.feature_id).trim(),
    module: String(row.module).trim(),
    feature_name: String(row.feature_name).trim(),
    what_is_it: String(row.what_is_it).trim(),
    who_uses_it: String(row.who_uses_it).trim(),
    when_to_use: String(row.when_to_use).trim(),
    how_to_use: String(row.how_to_use).trim(),
    business_rules: String(row.business_rules).trim(),
    limitations: String(row.limitations).trim(),
    related_features: String(row.related_features).trim(),
    faq: String(row.faq).trim(),
    sales_pitch: row.sales_pitch != null ? String(row.sales_pitch).trim() : "",
    version: String(row.version).trim(),
    status: String(row.status).trim(),
    last_updated: String(row.last_updated).trim(),
    author: String(row.author).trim(),
  };
}

export function featureTags(feature: FeatureRow): string[] {
  return ["feature-catalog", moduleTag(feature.module)];
}
