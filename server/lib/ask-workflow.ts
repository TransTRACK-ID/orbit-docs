import { generateObject, generateText } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "~/server/database";
import { docs } from "~/server/database/schema";
import {
  extractDecisionSection,
  formatAdrConstraintSummary,
  listBindingAdrs,
  type AdrDocRow,
} from "~/server/lib/adr-queries";
import { createChatAgent } from "~/server/lib/agent-factory";
import { searchDocChunksHybrid } from "~/server/lib/doc-chunk-search";
import { isSemanticSearchEnabled } from "~/server/lib/doc-embeddings";
import { searchDocsContent } from "~/server/lib/doc-content-search";
import { searchFeatureDocs } from "~/server/lib/feature-doc-search";
import { getCustomOpenAI } from "~/server/lib/openai";
import { formatAdrNumber, parseAdrFrontmatter } from "~/types/adr";

const ASK_MAX_CONTEXT_CHARS = 80_000;
const ASK_MAX_SEARCHES = 5;
const ASK_DOC_INDEX_LIMIT = 200;
const VALID_DOC_TYPES = ["sdd", "fsd", "srs", "feature", "adr", "wiki", "git_snapshot", "prd"] as const;

export const AskSearchItemSchema = z.object({
  query: z.string().min(1),
  docTypes: z.array(z.string()).optional(),
  module: z.string().optional(),
  bindingOnly: z.boolean().optional(),
  limit: z.number().min(1).max(20).optional(),
});

export const AskSearchPlanSchema = z.object({
  searches: z.array(AskSearchItemSchema).min(1).max(ASK_MAX_SEARCHES),
});

export type AskSearchItem = z.infer<typeof AskSearchItemSchema>;
export type AskSearchPlan = z.infer<typeof AskSearchPlanSchema>;

export interface AskDocIndexEntry {
  id: string;
  title: string;
  docType: string | null;
  module: string | null;
  status: string;
}

export interface AskAdrIndexEntry {
  id: string;
  adrNumber: number | null;
  title: string;
  scope: string[];
}

export interface AskDocIndex {
  docs: AskDocIndexEntry[];
  bindingAdrs: AskAdrIndexEntry[];
}

export interface AskCitation {
  ref: string;
  id: string;
  title: string;
  docType: string | null;
  adrNumber?: number | null;
}

export interface AskRetrievedSource {
  id: string;
  title: string;
  content: string;
  docType: string | null;
  citationRef: string;
  adrNumber?: number | null;
  /** Section heading when retrieval is chunk-level (semantic search). */
  sectionHeading?: string;
}

export interface AskWorkflowContextResult {
  systemPrompt: string;
  citations: AskCitation[];
  searchPlan: AskSearchPlan;
  sourcesUsed: number;
}

export interface AskWorkflowAnswerResult extends AskWorkflowContextResult {
  answer: string;
}

export function isAskWorkflowEnabled(): boolean {
  return (process.env.ASK_WORKFLOW ?? "true").toLowerCase() !== "false";
}

function getPlanModelName(): string {
  return (
    process.env.OPENAI_PLAN_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

function getSynthModelName(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function adrCitationRef(row: AdrDocRow): string {
  const fm = parseAdrFrontmatter(row.frontmatter ?? undefined);
  const num = fm.adr_number;
  return num != null ? `[adr:${formatAdrNumber(num)}]` : `[doc:${row.id}]`;
}

function docCitationRef(id: string): string {
  return `[doc:${id}]`;
}

function normalizeDocTypes(docTypes?: string[]): string[] {
  if (!docTypes?.length) return [];
  return docTypes
    .map((t) => t.trim().toLowerCase())
    .filter((t) => VALID_DOC_TYPES.includes(t as (typeof VALID_DOC_TYPES)[number]));
}

function matchesKeywords(text: string, query: string): boolean {
  const haystack = text.toLowerCase();
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);

  if (terms.length === 0) return true;
  return terms.some((term) => haystack.includes(term));
}

export async function buildAskDocIndex(
  appId: string,
  options: { publishedOnly?: boolean } = {},
): Promise<AskDocIndex> {
  const db = getDb();
  const conditions = [eq(docs.appId, appId)];

  if (options.publishedOnly) {
    conditions.push(eq(docs.status, "published"));
  }

  const rows = await db
    .select({
      id: docs.id,
      title: docs.title,
      docType: docs.docType,
      tags: docs.tags,
      status: docs.status,
    })
    .from(docs)
    .where(and(...conditions))
    .orderBy(docs.title)
    .limit(ASK_DOC_INDEX_LIMIT);

  const docEntries: AskDocIndexEntry[] = rows.map((row) => {
    const moduleTagValue = row.tags?.find((t) => t.startsWith("module:"));
    return {
      id: row.id,
      title: row.title,
      docType: row.docType,
      module: moduleTagValue ? moduleTagValue.slice("module:".length) : null,
      status: row.status,
    };
  });

  const bindingRows = await listBindingAdrs(db, appId, { includeContent: false });
  const bindingAdrs: AskAdrIndexEntry[] = bindingRows.map((row) => {
    const fm = parseAdrFrontmatter(row.frontmatter ?? undefined);
    return {
      id: row.id,
      adrNumber: fm.adr_number ?? null,
      title: row.title,
      scope: fm.scope ?? [],
    };
  });

  return { docs: docEntries, bindingAdrs };
}

function formatIndexForPlan(index: AskDocIndex): string {
  const docLines = index.docs.map(
    (d) =>
      `- ${d.docType || "unknown"} | ${d.title}${d.module ? ` [${d.module}]` : ""} | id=${d.id}`,
  );
  const adrLines = index.bindingAdrs.map(
    (a) =>
      `- ADR ${a.adrNumber != null ? formatAdrNumber(a.adrNumber) : "?"} | ${a.title}${a.scope.length ? ` scope=${a.scope.join(",")}` : ""}`,
  );

  return `DOCS (${index.docs.length}):\n${docLines.join("\n") || "_none_"}\n\nBINDING ADRs (${index.bindingAdrs.length}):\n${adrLines.join("\n") || "_none_"}`;
}

export function heuristicAskPlan(
  userQuestion: string,
  docIndex: AskDocIndex,
  moduleHint?: string,
): AskSearchPlan {
  const availableTypes = new Set(
    docIndex.docs.map((d) => d.docType).filter(Boolean) as string[],
  );
  const q = userQuestion.toLowerCase();
  const docTypes: string[] = [];

  if (availableTypes.has("feature")) docTypes.push("feature");
  if (/sdd|design|architecture|technical|api|oauth|auth|jwt|database/.test(q)) {
    if (availableTypes.has("sdd")) docTypes.push("sdd");
    if (availableTypes.has("fsd")) docTypes.push("fsd");
  }
  if (/requirement|srs|scope/.test(q) && availableTypes.has("srs")) {
    docTypes.push("srs");
  }
  if (/wiki|guide|how to/.test(q) && availableTypes.has("wiki")) {
    docTypes.push("wiki");
  }

  const searches: AskSearchItem[] = [
    {
      query: userQuestion,
      docTypes: docTypes.length > 0 ? docTypes : undefined,
      module: moduleHint,
      limit: 8,
    },
  ];

  if (/adr|architectural|decision|constraint|binding/.test(q) || docIndex.bindingAdrs.length > 0) {
    searches.push({
      query: userQuestion,
      docTypes: ["adr"],
      bindingOnly: true,
      limit: 5,
    });
  }

  return { searches: searches.slice(0, ASK_MAX_SEARCHES) };
}

export async function planAskSearches(params: {
  userQuestion: string;
  docIndex: AskDocIndex;
  moduleHint?: string;
}): Promise<AskSearchPlan> {
  const { userQuestion, docIndex, moduleHint } = params;

  if (!hasOpenAiKey()) {
    return heuristicAskPlan(userQuestion, docIndex, moduleHint);
  }

  try {
    const model = getCustomOpenAI().chat(getPlanModelName());
    const { object } = await generateObject({
      model,
      schema: AskSearchPlanSchema,
      prompt: `You are a documentation search planner for Orbit Docs.

Given a user question and a compact doc index, produce a JSON search plan with up to ${ASK_MAX_SEARCHES} targeted searches.

Valid docTypes: ${VALID_DOC_TYPES.join(", ")}
- Use "feature" for knowledge-base / spreadsheet features
- Use "sdd", "fsd", "srs" for product documentation
- Use "adr" with bindingOnly: true for architectural constraints
- Use module when the question targets a specific module (from index tags)

User question:
${userQuestion}
${moduleHint ? `\nModule hint: ${moduleHint}` : ""}

Doc index:
${formatIndexForPlan(docIndex)}

Return searches that together cover the question across relevant doc types. Prefer specific queries over broad ones.`,
    });

    return object;
  } catch {
    return heuristicAskPlan(userQuestion, docIndex, moduleHint);
  }
}

async function filterBindingAdrsByQuery(
  appId: string,
  query: string,
  options: { scope?: string; limit?: number; publishedOnly?: boolean },
): Promise<AskRetrievedSource[]> {
  const db = getDb();
  let rows = await listBindingAdrs(db, appId, {
    scope: options.scope,
    includeContent: true,
  });

  if (options.publishedOnly) {
    rows = rows.filter((row) => row.status === "published");
  }

  const filtered = rows.filter((row) => {
    const fm = parseAdrFrontmatter(row.frontmatter ?? undefined);
    const adrLabel = fm.adr_number != null ? formatAdrNumber(fm.adr_number) : "";
    const decision = extractDecisionSection(row.content);
    const blob = `${adrLabel} ${row.title} ${decision} ${row.content || ""}`;
    return matchesKeywords(blob, query);
  });

  const limit = options.limit ?? 5;
  return filtered.slice(0, limit).map((row) => {
    const fm = parseAdrFrontmatter(row.frontmatter ?? undefined);
    const decision = extractDecisionSection(row.content);
    const body = decision || row.content?.trim() || "";
    return {
      id: row.id,
      title: row.title,
      content: body,
      docType: "adr",
      citationRef: adrCitationRef(row),
      adrNumber: fm.adr_number ?? null,
    };
  });
}

async function executeSingleSearch(
  appId: string,
  item: AskSearchItem,
  options: { publishedOnly?: boolean },
): Promise<AskRetrievedSource[]> {
  const docTypes = normalizeDocTypes(item.docTypes);
  const limit = item.limit ?? 8;
  const results: AskRetrievedSource[] = [];

  if (item.bindingOnly || (docTypes.length === 1 && docTypes[0] === "adr")) {
    const adrResults = await filterBindingAdrsByQuery(appId, item.query, {
      scope: item.module,
      limit,
      publishedOnly: options.publishedOnly,
    });
    results.push(...adrResults);
    if (item.bindingOnly) return results;
  }

  const wantsFeature =
    docTypes.length === 0 || docTypes.includes("feature");
  const nonFeatureTypes = docTypes.filter((t) => t !== "feature" && t !== "adr");
  const wantsAdrInContent = docTypes.includes("adr") && !item.bindingOnly;
  const wantsChunkSearch =
    isSemanticSearchEnabled() &&
    (wantsFeature ||
      nonFeatureTypes.includes("sdd") ||
      nonFeatureTypes.includes("wiki") ||
      (docTypes.length === 0 && !item.bindingOnly));

  if (wantsChunkSearch) {
    const chunkDocTypes: string[] = [];
    if (wantsFeature || docTypes.length === 0) chunkDocTypes.push("feature");
    if (nonFeatureTypes.includes("sdd") || docTypes.length === 0) chunkDocTypes.push("sdd");
    if (nonFeatureTypes.includes("wiki") || docTypes.length === 0) chunkDocTypes.push("wiki");

    const chunkRows = await searchDocChunksHybrid({
      appId,
      query: item.query,
      docTypes: chunkDocTypes,
      publishedOnly: options.publishedOnly,
      limit,
    });

    if (chunkRows.length > 0) {
      for (const row of chunkRows) {
        results.push({
          id: row.docId,
          title: `${row.title} › ${row.heading}`,
          content: row.content.trim(),
          docType: row.docType,
          citationRef: docCitationRef(row.docId),
          sectionHeading: row.heading,
        });
      }
    } else if (wantsFeature) {
      const featureRows = await searchFeatureDocs({
        appId,
        query: item.query,
        module: item.module,
        publishedOnly: options.publishedOnly,
        limit,
      });

      for (const row of featureRows) {
        results.push({
          id: row.id,
          title: row.title,
          content: row.content?.trim() || "",
          docType: "feature",
          citationRef: docCitationRef(row.id),
        });
      }
    }
  } else if (wantsFeature) {
    const featureRows = await searchFeatureDocs({
      appId,
      query: item.query,
      module: item.module,
      publishedOnly: options.publishedOnly,
      limit,
    });

    for (const row of featureRows) {
      results.push({
        id: row.id,
        title: row.title,
        content: row.content?.trim() || "",
        docType: "feature",
        citationRef: docCitationRef(row.id),
      });
    }
  }

  const contentDocTypes = [...nonFeatureTypes];
  if (wantsAdrInContent && !contentDocTypes.includes("adr")) {
    contentDocTypes.push("adr");
  }

  const skipFullDocSearchForChunkTypes =
    wantsChunkSearch &&
    results.some((r) => r.sectionHeading) &&
    !contentDocTypes.some((t) => t !== "sdd" && t !== "feature" && t !== "wiki");

  if (
    !skipFullDocSearchForChunkTypes &&
    (contentDocTypes.length > 0 || (!wantsFeature && docTypes.length === 0))
  ) {
    const { results: contentRows } = await searchDocsContent({
      appId,
      query: item.query,
      docTypes: contentDocTypes.length > 0 ? contentDocTypes : undefined,
      publishedOnly: options.publishedOnly,
      limit,
    });

    for (const row of contentRows) {
      if (row.docType === "adr") {
        const fm = parseAdrFrontmatter(row.frontmatter ?? undefined);
        results.push({
          id: row.id,
          title: row.title,
          content: extractDecisionSection(row.content) || row.content?.trim() || "",
          docType: "adr",
          citationRef:
            fm.adr_number != null
              ? `[adr:${formatAdrNumber(fm.adr_number)}]`
              : docCitationRef(row.id),
          adrNumber: fm.adr_number ?? null,
        });
      } else {
        results.push({
          id: row.id,
          title: row.title,
          content: row.content?.trim() || "",
          docType: row.docType,
          citationRef: docCitationRef(row.id),
        });
      }
    }
  }

  return results;
}

export function dedupeAndBudgetSources(sources: AskRetrievedSource[]): AskRetrievedSource[] {
  const seen = new Set<string>();
  const deduped: AskRetrievedSource[] = [];

  for (const source of sources) {
    const dedupeKey = source.sectionHeading
      ? `${source.id}:${source.sectionHeading}`
      : source.id;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(source);
  }

  const budgeted: AskRetrievedSource[] = [];
  let usedChars = 0;

  for (const source of deduped) {
    const header = `### ${source.citationRef} ${source.title} (${source.docType || "doc"})\n\n`;
    const chunk = header + source.content + "\n";
    if (usedChars + chunk.length > ASK_MAX_CONTEXT_CHARS) {
      const remaining = ASK_MAX_CONTEXT_CHARS - usedChars;
      if (remaining > 200) {
        budgeted.push({
          ...source,
          content: source.content.slice(0, remaining - header.length - 20) + "\n[truncated]",
        });
      }
      break;
    }
    budgeted.push(source);
    usedChars += chunk.length;
  }

  return budgeted;
}

export async function executeAskRetrieval(
  appId: string,
  plan: AskSearchPlan,
  options: { publishedOnly?: boolean } = {},
): Promise<AskRetrievedSource[]> {
  const batches = await Promise.all(
    plan.searches.map((item) => executeSingleSearch(appId, item, options)),
  );
  return dedupeAndBudgetSources(batches.flat());
}

export function buildCitations(sources: AskRetrievedSource[]): AskCitation[] {
  return sources.map((source) => ({
    ref: source.citationRef,
    id: source.id,
    title: source.title,
    docType: source.docType,
    adrNumber: source.adrNumber,
  }));
}

export function buildAskSynthesisPrompt(params: {
  sources: AskRetrievedSource[];
  bindingAdrSummary: string;
  docIndex: AskDocIndex;
  searchPlan: AskSearchPlan;
}): string {
  const { sources, bindingAdrSummary, docIndex, searchPlan } = params;

  const sourceBlocks = sources
    .map(
      (s) =>
        `### ${s.citationRef} ${s.title} (${s.docType || "doc"})\n\n${s.content}`,
    )
    .join("\n\n---\n\n");

  const indexSample = docIndex.docs
    .slice(0, 30)
    .map((d) => `- ${d.docType}: ${d.title}${d.module ? ` [${d.module}]` : ""}`)
    .join("\n");

  const adrBlock = bindingAdrSummary
    ? `BINDING ARCHITECTURAL DECISIONS:\n${bindingAdrSummary}\n\n`
    : "";

  return `${adrBlock}You are a helpful product documentation assistant for this application.

Use ONLY the retrieved documentation below to answer. Cite sources inline using their citation refs (e.g. [doc:uuid] or [adr:001]).

Search plan executed: ${JSON.stringify(searchPlan.searches)}

## Retrieved documentation
${sourceBlocks || "_No matching content found in retrieval._"}

## Doc index (partial)
${indexSample || "_No docs indexed._"}

Rules:
- Answer from retrieved content and binding ADRs only.
- Cite with [doc:id] or [adr:NNN] when stating facts.
- If the answer is not in context, say so and suggest which doc type or module to check.
- Do not explore the filesystem or invent documentation.`;
}

async function loadBindingSummary(appId: string): Promise<string> {
  const db = getDb();
  const rows = await listBindingAdrs(db, appId, { includeContent: true });
  return formatAdrConstraintSummary(rows);
}

export async function runAskWorkflowContext(params: {
  appId: string;
  userQuestion: string;
  module?: string;
  publishedOnly?: boolean;
}): Promise<AskWorkflowContextResult> {
  const { appId, userQuestion, module, publishedOnly } = params;

  const docIndex = await buildAskDocIndex(appId, { publishedOnly });
  const searchPlan = await planAskSearches({
    userQuestion,
    docIndex,
    moduleHint: module,
  });
  const sources = await executeAskRetrieval(appId, searchPlan, { publishedOnly });
  const bindingAdrSummary = await loadBindingSummary(appId);
  const citations = buildCitations(sources);
  const systemPrompt = buildAskSynthesisPrompt({
    sources,
    bindingAdrSummary,
    docIndex,
    searchPlan,
  });

  return {
    systemPrompt,
    citations,
    searchPlan,
    sourcesUsed: sources.length,
  };
}

function buildAnswerPrompt(systemPrompt: string, userQuestion: string): string {
  return `${systemPrompt}

---

User: ${userQuestion}

Respond as the Assistant. Be concise and helpful.`;
}

export async function runAskWorkflowAnswer(params: {
  appId: string;
  question: string;
  module?: string;
  publishedOnly?: boolean;
}): Promise<AskWorkflowAnswerResult> {
  const context = await runAskWorkflowContext({
    appId: params.appId,
    userQuestion: params.question,
    module: params.module,
    publishedOnly: params.publishedOnly,
  });

  let answer: string;

  if (hasOpenAiKey()) {
    const model = getCustomOpenAI().chat(getSynthModelName());
    const result = await generateText({
      model,
      system: context.systemPrompt,
      prompt: params.question,
    });
    answer = result.text;
  } else {
    const agent = createChatAgent();
    answer = await agent.analyze(buildAnswerPrompt(context.systemPrompt, params.question));
  }

  return {
    ...context,
    answer,
  };
}

export { matchesKeywords, normalizeDocTypes };
