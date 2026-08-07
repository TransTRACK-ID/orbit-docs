import { describe, expect, it, vi, beforeEach } from "vitest";
import { checkAdrCompliance } from "./adr-verification";

vi.mock("~/server/database", () => ({
  getDb: vi.fn(),
}));

vi.mock("./adr-queries", () => ({
  listBindingAdrs: vi.fn(),
  extractDecisionSnippet: (content: string | null) => {
    const match = content?.match(/## Decision\s*\n+([^\n#]+)/i);
    return match?.[1]?.trim() ?? "";
  },
  adrDisplayLabel: (title: string, frontmatter?: Record<string, unknown> | null) => {
    const num = frontmatter?.adr_number;
    const prefix = num != null ? `ADR-${String(num).padStart(3, "0")}` : "ADR";
    return `${prefix}: ${title}`;
  },
  formatAdrConstraintSummary: vi.fn(() => ""),
}));

import { listBindingAdrs } from "./adr-queries";

describe("checkAdrCompliance", () => {
  beforeEach(() => {
    vi.mocked(listBindingAdrs).mockReset();
  });

  it("returns no violations when there are no binding ADRs", async () => {
    vi.mocked(listBindingAdrs).mockResolvedValue([]);
    await expect(checkAdrCompliance("app-1", "Some generated doc")).resolves.toEqual([]);
  });

  it("flags content that does not reference a binding ADR decision", async () => {
    vi.mocked(listBindingAdrs).mockResolvedValue([
      {
        id: "adr-1",
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

    const violations = await checkAdrCompliance(
      "app-1",
      "# API Design\n\nWe will use basic API keys for authentication."
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.adrLabel).toContain("ADR-007");
  });

  it("passes when generated content references ADR keywords", async () => {
    vi.mocked(listBindingAdrs).mockResolvedValue([
      {
        id: "adr-1",
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

    const violations = await checkAdrCompliance(
      "app-1",
      "# API Design\n\nAuthentication uses OAuth 2.0 with PKCE across all APIs."
    );

    expect(violations).toHaveLength(0);
  });
});
