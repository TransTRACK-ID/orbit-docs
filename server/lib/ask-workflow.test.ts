import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AskSearchPlanSchema,
  buildAskSynthesisPrompt,
  buildCitations,
  dedupeAndBudgetSources,
  heuristicAskPlan,
  isAskWorkflowEnabled,
  matchesKeywords,
  normalizeDocTypes,
  type AskDocIndex,
  type AskRetrievedSource,
} from "./ask-workflow";

vi.mock("~/server/lib/feature-doc-search", () => ({
  searchFeatureDocs: vi.fn(),
}));

vi.mock("~/server/lib/doc-content-search", () => ({
  searchDocsContent: vi.fn(),
}));

vi.mock("~/server/lib/adr-queries", () => ({
  extractDecisionSection: vi.fn((c: string) => c),
  formatAdrConstraintSummary: vi.fn(() => "BINDING ADRs:\n- ADR-001: Use JWT"),
  listBindingAdrs: vi.fn(),
}));

vi.mock("~/server/database", () => ({
  getDb: vi.fn(),
}));

const sampleIndex: AskDocIndex = {
  docs: [
    { id: "d1", title: "SDD Auth", docType: "sdd", module: "auth", status: "published" },
    { id: "d2", title: "Login Feature", docType: "feature", module: "auth", status: "published" },
    { id: "d3", title: "FSD Overview", docType: "fsd", module: null, status: "published" },
  ],
  bindingAdrs: [
    { id: "a1", adrNumber: 1, title: "JWT Auth", scope: ["auth"] },
  ],
};

describe("isAskWorkflowEnabled", () => {
  const original = process.env.ASK_WORKFLOW;

  afterEach(() => {
    if (original === undefined) delete process.env.ASK_WORKFLOW;
    else process.env.ASK_WORKFLOW = original;
  });

  it("is enabled by default", () => {
    delete process.env.ASK_WORKFLOW;
    expect(isAskWorkflowEnabled()).toBe(true);
  });

  it("can be disabled", () => {
    process.env.ASK_WORKFLOW = "false";
    expect(isAskWorkflowEnabled()).toBe(false);
  });
});

describe("normalizeDocTypes", () => {
  it("filters invalid types and lowercases", () => {
    expect(normalizeDocTypes(["SDD", "feature", "invalid"])).toEqual(["sdd", "feature"]);
  });
});

describe("matchesKeywords", () => {
  it("matches when any term is found", () => {
    expect(matchesKeywords("OAuth JWT authentication flow", "jwt oauth")).toBe(true);
    expect(matchesKeywords("OAuth flow", "database schema")).toBe(false);
  });

  it("returns true for empty query", () => {
    expect(matchesKeywords("anything", "  ")).toBe(true);
  });
});

describe("heuristicAskPlan", () => {
  it("includes feature and sdd for auth questions", () => {
    const plan = heuristicAskPlan("how does OAuth authentication work?", sampleIndex);
    expect(plan.searches.length).toBeGreaterThanOrEqual(1);
    expect(plan.searches[0].docTypes).toContain("feature");
    expect(plan.searches[0].docTypes).toContain("sdd");
  });

  it("adds binding ADR search when ADRs exist", () => {
    const plan = heuristicAskPlan("tell me about login", sampleIndex);
    const adrSearch = plan.searches.find((s) => s.bindingOnly);
    expect(adrSearch).toBeDefined();
    expect(adrSearch?.docTypes).toContain("adr");
  });

  it("validates against schema", () => {
    const plan = heuristicAskPlan("overview", sampleIndex);
    expect(() => AskSearchPlanSchema.parse(plan)).not.toThrow();
  });
});

describe("dedupeAndBudgetSources", () => {
  it("deduplicates by id", () => {
    const sources: AskRetrievedSource[] = [
      { id: "d1", title: "A", content: "body", docType: "sdd", citationRef: "[doc:d1]" },
      { id: "d1", title: "A dup", content: "body2", docType: "sdd", citationRef: "[doc:d1]" },
      { id: "d2", title: "B", content: "body3", docType: "feature", citationRef: "[doc:d2]" },
    ];
    const result = dedupeAndBudgetSources(sources);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("d1");
  });

  it("truncates when over budget", () => {
    const huge = "x".repeat(100_000);
    const sources: AskRetrievedSource[] = [
      { id: "d1", title: "Big", content: huge, docType: "sdd", citationRef: "[doc:d1]" },
    ];
    const result = dedupeAndBudgetSources(sources);
    expect(result[0].content).toContain("[truncated]");
    expect(result[0].content.length).toBeLessThan(huge.length);
  });
});

describe("buildCitations", () => {
  it("maps sources to citation refs", () => {
    const citations = buildCitations([
      {
        id: "d1",
        title: "SDD",
        content: "x",
        docType: "sdd",
        citationRef: "[doc:d1]",
      },
      {
        id: "a1",
        title: "JWT ADR",
        content: "y",
        docType: "adr",
        citationRef: "[adr:001]",
        adrNumber: 1,
      },
    ]);
    expect(citations).toHaveLength(2);
    expect(citations[1].ref).toBe("[adr:001]");
    expect(citations[1].adrNumber).toBe(1);
  });
});

describe("buildAskSynthesisPrompt", () => {
  it("includes binding ADRs, sources, and citation rules", () => {
    const prompt = buildAskSynthesisPrompt({
      sources: [
        {
          id: "d1",
          title: "SDD Auth",
          content: "OAuth flow details",
          docType: "sdd",
          citationRef: "[doc:d1]",
        },
      ],
      bindingAdrSummary: "BINDING ADRs:\n- ADR-001: Use JWT",
      docIndex: sampleIndex,
      searchPlan: { searches: [{ query: "oauth", docTypes: ["sdd", "feature"] }] },
    });

    expect(prompt).toContain("BINDING ARCHITECTURAL DECISIONS");
    expect(prompt).toContain("[doc:d1]");
    expect(prompt).toContain("OAuth flow details");
    expect(prompt).toContain("[adr:NNN]");
  });
});

describe("executeAskRetrieval", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("routes feature searches to searchFeatureDocs", async () => {
    const { searchFeatureDocs } = await import("~/server/lib/feature-doc-search");
    vi.mocked(searchFeatureDocs).mockResolvedValue([
      {
        id: "f1",
        title: "Login",
        content: "OAuth login",
        status: "published",
        externalId: "FEAT-1",
        tags: ["module:auth"],
      },
    ]);

    const { executeAskRetrieval } = await import("./ask-workflow");
    const sources = await executeAskRetrieval(
      "app-1",
      { searches: [{ query: "oauth", docTypes: ["feature"], limit: 5 }] },
    );

    expect(searchFeatureDocs).toHaveBeenCalledWith(
      expect.objectContaining({ appId: "app-1", query: "oauth", limit: 5 }),
    );
    expect(sources.some((s) => s.id === "f1")).toBe(true);
  });
});

describe("planAskSearches", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  it("falls back to heuristic without API key", async () => {
    const { planAskSearches } = await import("./ask-workflow");
    const plan = await planAskSearches({
      userQuestion: "authentication oauth",
      docIndex: sampleIndex,
      moduleHint: "auth",
    });
    expect(plan.searches.length).toBeGreaterThan(0);
    expect(plan.searches[0].query).toBe("authentication oauth");
  });
});
