export type AdrStatus = "proposed" | "accepted" | "deprecated" | "superseded";

export const ADR_STATUSES: AdrStatus[] = [
  "proposed",
  "accepted",
  "deprecated",
  "superseded",
];

export interface AdrFrontmatter {
  /** ADR lifecycle status. Default: "proposed" */
  adr_status?: AdrStatus;

  /** Sequential number within the app, e.g. 7 → "ADR-007" */
  adr_number?: number;

  /** ID of the ADR doc this one supersedes (when adr_status = "superseded" on the old one) */
  supersedes?: string;

  /** Narrow applicability. Omit = entire app. */
  scope?: string[];

  /** ISO date when the decision was accepted */
  date?: string;

  /** Decision makers (names or emails) */
  deciders?: string[];
}

export interface AdrFrontmatterValidationError {
  field: string;
  message: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate ADR frontmatter against the JSON schema contract.
 * Returns an empty array when valid.
 */
export function validateAdrFrontmatter(
  frontmatter: unknown
): AdrFrontmatterValidationError[] {
  if (frontmatter == null) return [];
  if (!isRecord(frontmatter)) {
    return [{ field: "frontmatter", message: "Frontmatter must be an object" }];
  }

  const errors: AdrFrontmatterValidationError[] = [];

  if ("adr_status" in frontmatter && frontmatter.adr_status !== undefined) {
    if (
      typeof frontmatter.adr_status !== "string" ||
      !ADR_STATUSES.includes(frontmatter.adr_status as AdrStatus)
    ) {
      errors.push({
        field: "adr_status",
        message: `Must be one of: ${ADR_STATUSES.join(", ")}`,
      });
    }
  }

  if ("adr_number" in frontmatter && frontmatter.adr_number !== undefined) {
    if (
      typeof frontmatter.adr_number !== "number" ||
      !Number.isInteger(frontmatter.adr_number) ||
      frontmatter.adr_number < 1
    ) {
      errors.push({
        field: "adr_number",
        message: "Must be a positive integer",
      });
    }
  }

  if ("supersedes" in frontmatter && frontmatter.supersedes !== undefined) {
    if (
      typeof frontmatter.supersedes !== "string" ||
      !UUID_RE.test(frontmatter.supersedes)
    ) {
      errors.push({
        field: "supersedes",
        message: "Must be a valid UUID",
      });
    }
  }

  if ("scope" in frontmatter && frontmatter.scope !== undefined) {
    if (!Array.isArray(frontmatter.scope)) {
      errors.push({ field: "scope", message: "Must be an array of strings" });
    } else {
      for (const [index, item] of frontmatter.scope.entries()) {
        if (typeof item !== "string" || item.length === 0) {
          errors.push({
            field: `scope[${index}]`,
            message: "Must be a non-empty string",
          });
        }
      }
    }
  }

  if ("date" in frontmatter && frontmatter.date !== undefined) {
    if (typeof frontmatter.date !== "string" || !ISO_DATE_RE.test(frontmatter.date)) {
      errors.push({
        field: "date",
        message: "Must be an ISO date (YYYY-MM-DD)",
      });
    }
  }

  if ("deciders" in frontmatter && frontmatter.deciders !== undefined) {
    if (!Array.isArray(frontmatter.deciders)) {
      errors.push({ field: "deciders", message: "Must be an array of strings" });
    } else {
      for (const [index, item] of frontmatter.deciders.entries()) {
        if (typeof item !== "string") {
          errors.push({
            field: `deciders[${index}]`,
            message: "Must be a string",
          });
        }
      }
    }
  }

  return errors;
}

export function parseAdrFrontmatter(
  frontmatter: Record<string, unknown> | null | undefined
): AdrFrontmatter {
  if (!frontmatter) return {};
  return {
    adr_status: frontmatter.adr_status as AdrStatus | undefined,
    adr_number:
      typeof frontmatter.adr_number === "number"
        ? frontmatter.adr_number
        : undefined,
    supersedes:
      typeof frontmatter.supersedes === "string"
        ? frontmatter.supersedes
        : undefined,
    scope: Array.isArray(frontmatter.scope)
      ? frontmatter.scope.filter((s): s is string => typeof s === "string")
      : undefined,
    date: typeof frontmatter.date === "string" ? frontmatter.date : undefined,
    deciders: Array.isArray(frontmatter.deciders)
      ? frontmatter.deciders.filter((d): d is string => typeof d === "string")
      : undefined,
  };
}

export function formatAdrNumber(adrNumber: number | undefined | null): string {
  if (adrNumber == null) return "ADR";
  return `ADR-${String(adrNumber).padStart(3, "0")}`;
}
