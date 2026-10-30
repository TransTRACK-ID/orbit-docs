import { generateText } from "ai";
import { getCustomOpenAI } from "~/server/lib/openai";
import { extractFullMarkdownFromAgentJson, normalizeMarkdownDiagrams } from "~/server/lib/doc-section-merge";

const BATCH_MAX_CHARS = 12_000;
/** Below this many extracted characters per page the PDF is almost certainly scanned images. */
const MIN_CHARS_PER_PAGE = 20;

export async function extractPdfPages(buffer: Buffer): Promise<string[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  return (Array.isArray(text) ? text : [text]).map((page) => page.replace(/\u0000/g, "").trim());
}

export function looksLikeScannedPdf(pages: string[]): boolean {
  const total = pages.reduce((sum, page) => sum + page.replace(/\s+/g, "").length, 0);
  return total < Math.max(1, pages.length) * MIN_CHARS_PER_PAGE;
}

/** Groups consecutive pages so each AI call stays under `maxChars`; oversized pages are split. */
export function batchPages(pages: string[], maxChars = BATCH_MAX_CHARS): string[] {
  const batches: string[] = [];
  let current = "";
  for (const page of pages.filter(Boolean)) {
    const pieces: string[] = [];
    for (let i = 0; i < page.length; i += maxChars) pieces.push(page.slice(i, i + maxChars));
    for (const piece of pieces) {
      if (current && current.length + piece.length + 2 > maxChars) {
        batches.push(current);
        current = "";
      }
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) batches.push(current);
  return batches;
}

/** Fallback when no model is configured: keep the text, one paragraph per blank-line block. */
export function plainTextToMarkdown(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Rejects reasoning traces, wrapping fences, and JSON envelopes so only markdown reaches the editor.
 * Returns null when nothing usable remains.
 */
export function cleanModelMarkdown(raw: string): string | null {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  const fenced = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) text = fenced[1]!.trim();

  if (/^[[{]/.test(text)) {
    const fromJson = extractFullMarkdownFromAgentJson(text);
    if (!fromJson) return null;
    text = fromJson;
  }

  return text ? normalizeMarkdownDiagrams(text) : null;
}

function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function getImportModelName(): string {
  return process.env.PDF_IMPORT_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

async function convertBatch(batch: string, index: number, total: number): Promise<string> {
  const { text } = await generateText({
    model: getCustomOpenAI().chat(getImportModelName()),
    abortSignal: AbortSignal.timeout(120_000),
    system: `You convert text extracted from a PDF into clean GitHub-flavored Markdown for a technical documentation editor.

Rules:
- Keep ALL content. Do not summarize, shorten, translate, or add commentary.
- Restore structure: headings (#, ##, ###), bullet/numbered lists, tables, code blocks, and blockquotes where the source clearly has them.
- Join lines that were broken only by PDF layout; drop repeated page headers, footers, and page numbers.
- Output ONLY the Markdown. No code fence around the whole answer, no JSON, no explanations.`,
    prompt: `Part ${index + 1} of ${total} of the extracted PDF text:\n\n${batch}`,
  });
  return cleanModelMarkdown(text) ?? plainTextToMarkdown(batch);
}

export async function pdfPagesToMarkdown(pages: string[]): Promise<{ markdown: string; usedAi: boolean }> {
  const batches = batchPages(pages);
  if (!isAiConfigured()) {
    return { markdown: batches.map(plainTextToMarkdown).join("\n\n"), usedAi: false };
  }

  const parts: string[] = [];
  for (const [index, batch] of batches.entries()) {
    try {
      parts.push(await convertBatch(batch, index, batches.length));
    } catch (err) {
      console.error(`[pdf-import] AI conversion failed for part ${index + 1}/${batches.length}:`, err);
      parts.push(plainTextToMarkdown(batch));
    }
  }
  return { markdown: parts.join("\n\n").trim(), usedAi: true };
}
