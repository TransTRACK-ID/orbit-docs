import { describe, expect, it } from "vitest";
import {
  adrDisplayLabel,
  extractDecisionSnippet,
  formatAdrConstraintSummary,
  isBindingAdrDoc,
  renderAdrTemplate,
} from "./adr-queries";

describe("isBindingAdrDoc", () => {
  it("is binding only when published and accepted", () => {
    expect(
      isBindingAdrDoc({
        docType: "adr",
        status: "published",
        frontmatter: { adr_status: "accepted" },
      })
    ).toBe(true);

    expect(
      isBindingAdrDoc({
        docType: "adr",
        status: "draft",
        frontmatter: { adr_status: "accepted" },
      })
    ).toBe(false);

    expect(
      isBindingAdrDoc({
        docType: "adr",
        status: "published",
        frontmatter: { adr_status: "proposed" },
      })
    ).toBe(false);
  });
});

describe("extractDecisionSnippet", () => {
  it("extracts the Decision section", () => {
    const content = `# ADR-001: Auth

## Context
Some context.

## Decision
All APIs must use OAuth 2.0 with PKCE.

## Consequences
More work.`;

    expect(extractDecisionSnippet(content)).toBe("All APIs must use OAuth 2.0 with PKCE.");
  });
});

describe("formatAdrConstraintSummary", () => {
  it("formats binding ADRs as bullet list", () => {
    const summary = formatAdrConstraintSummary([
      {
        id: "1",
        appId: "app-1",
        title: "Use OAuth 2.0 with PKCE",
        content: "## Decision\nAll APIs must use OAuth 2.0 with PKCE.",
        status: "published",
        versionId: null,
        tags: null,
        author: null,
        docType: "adr",
        frontmatter: { adr_number: 7, adr_status: "accepted" },
        createdAt: null,
        updatedAt: null,
      },
    ]);

    expect(summary).toContain("BINDING ADRs:");
    expect(summary).toContain("ADR-007");
    expect(summary).toContain("OAuth 2.0 with PKCE");
  });

  it("returns empty string when no rows", () => {
    expect(formatAdrConstraintSummary([])).toBe("");
  });
});

describe("adrDisplayLabel", () => {
  it("formats ADR number and title", () => {
    expect(adrDisplayLabel("Use JWT", { adr_number: 3 })).toBe("ADR-003: Use JWT");
  });
});

describe("renderAdrTemplate", () => {
  it("replaces template placeholders", () => {
    const rendered = renderAdrTemplate(
      "# ADR-{{ADR_NUMBER}}: {{TITLE}}\nStatus: {{ADR_STATUS}}",
      { adrNumber: 2, title: "Use Postgres", adrStatus: "proposed" }
    );

    expect(rendered).toContain("ADR-002: Use Postgres");
    expect(rendered).toContain("Status: proposed");
  });
});
