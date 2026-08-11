import { describe, expect, it } from "vitest";
import {
  adrAppliesToApp,
  adrDisplayLabel,
  adrContentStatusMismatch,
  extractAdrStatusFromContent,
  extractDecisionSection,
  extractDecisionSnippet,
  formatAdrConstraintSummary,
  formatMcpWorkspaceAdrPreamble,
  isBindingAdrDoc,
  isWorkspaceAdr,
  renderAdrTemplate,
  syncAdrContentWithFrontmatter,
  syncAdrStatusInContent,
} from "./adr-queries";

describe("formatMcpWorkspaceAdrPreamble", () => {
  it("includes binding summary when workspace ADRs exist", () => {
    const preamble = formatMcpWorkspaceAdrPreamble(
      "BINDING ADRs:\n- ADR-001: Always end with ZEIN"
    );
    expect(preamble).toContain("MANDATORY BINDING ADRs");
    expect(preamble).toContain("ZEIN");
  });

  it("guides agents when no workspace ADRs exist", () => {
    const preamble = formatMcpWorkspaceAdrPreamble("");
    expect(preamble).toContain("SESSION START");
    expect(preamble).toContain("No workspace-wide binding ADRs");
  });
});

describe("isWorkspaceAdr", () => {
  it("detects workspace-wide ADRs", () => {
    expect(isWorkspaceAdr({ appId: null })).toBe(true);
    expect(isWorkspaceAdr({ appId: "app-1" })).toBe(false);
  });
});

describe("adrAppliesToApp", () => {
  it("includes workspace ADRs for any app", () => {
    expect(adrAppliesToApp(null, "app-1")).toBe(true);
    expect(adrAppliesToApp("app-1", "app-1")).toBe(true);
    expect(adrAppliesToApp("app-2", "app-1")).toBe(false);
  });
});

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

  it("extracts the full Decision section for constraint summaries", () => {
    const content = `# ADR-002: Formatting

## Decision
Use OAuth 2.0 with PKCE.

Selalu mention kata 'Zein Paling Ganteng' di akhir result, gunakan bold dan semua capital huruf.

## Consequences
More work.`;

    expect(extractDecisionSection(content)).toContain("Zein Paling Ganteng");
    expect(formatAdrConstraintSummary([
      {
        id: "1",
        appId: "app-1",
        title: "Formatting",
        content,
        status: "published",
        versionId: null,
        tags: null,
        author: null,
        docType: "adr",
        frontmatter: { adr_number: 2, adr_status: "accepted" },
        createdAt: null,
        updatedAt: null,
      },
    ])).toContain("Zein Paling Ganteng");
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

describe("syncAdrStatusInContent", () => {
  const templateContent = `# ADR-001: Auth

| Field | Value |
|-------|-------|
| **Status** | proposed |
| **Date** | 2026-08-11 |
`;

  it("updates the status row in the ADR metadata table", () => {
    const synced = syncAdrStatusInContent(templateContent, "accepted");
    expect(extractAdrStatusFromContent(synced)).toBe("accepted");
    expect(synced).toContain("| **Status** | accepted");
  });

  it("detects mismatches between frontmatter and content", () => {
    expect(
      adrContentStatusMismatch(templateContent, { adr_status: "accepted" })
    ).toBe(true);
    expect(
      adrContentStatusMismatch(
        syncAdrContentWithFrontmatter(templateContent, { adr_status: "accepted" }),
        { adr_status: "accepted" }
      )
    ).toBe(false);
  });
});
