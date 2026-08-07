import { getDb } from "~/server/database";
import {
  adrDisplayLabel,
  extractDecisionSnippet,
  formatAdrConstraintSummary,
  listBindingAdrs,
} from "~/server/lib/adr-queries";
import { parseAdrFrontmatter, formatAdrNumber } from "~/types/adr";

export interface AdrViolation {
  adrId: string;
  adrLabel: string;
  excerpt: string;
  reason: string;
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 5)
    .slice(0, 8);
}

/**
 * Advisory compliance check — does not block saves.
 * Flags generated content that may not align with binding ADRs.
 */
export async function checkAdrCompliance(
  appId: string,
  generatedContent: string
): Promise<AdrViolation[]> {
  const content = generatedContent.trim();
  if (!content) return [];

  const bindingAdrs = await listBindingAdrs(getDb(), appId, { includeContent: true });
  if (bindingAdrs.length === 0) return [];

  const contentLower = content.toLowerCase();
  const violations: AdrViolation[] = [];

  for (const adr of bindingAdrs) {
    const fm = parseAdrFrontmatter(adr.frontmatter ?? undefined);
    const label = adrDisplayLabel(adr.title, adr.frontmatter);
    const decision = extractDecisionSnippet(adr.content);
    const adrTag = formatAdrNumber(fm.adr_number).toLowerCase();

    const mentionsAdr =
      contentLower.includes(adrTag) ||
      contentLower.includes(label.toLowerCase()) ||
      extractKeywords(decision).some((keyword) => contentLower.includes(keyword));

    if (!mentionsAdr && decision.length > 20) {
      violations.push({
        adrId: adr.id,
        adrLabel: label,
        excerpt: decision.slice(0, 200),
        reason:
          "Generated content does not appear to reference this binding ADR. Review for alignment before publishing.",
      });
    }
  }

  return violations;
}

export async function summarizeAdrCompliance(
  appId: string,
  generatedContent: string
): Promise<{ violations: AdrViolation[]; constraintSummary: string }> {
  const [violations, bindingAdrs] = await Promise.all([
    checkAdrCompliance(appId, generatedContent),
    listBindingAdrs(getDb(), appId, { includeContent: true }),
  ]);

  return {
    violations,
    constraintSummary: formatAdrConstraintSummary(bindingAdrs),
  };
}
