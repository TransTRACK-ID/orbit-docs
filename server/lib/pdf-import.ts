import { generateText } from "ai";
import { getCustomOpenAI } from "~/server/lib/openai";
import { createCursorAgent, isCursorAuthenticated, isCursorInstalled } from "~/server/lib/cursor-agent";
import { extractFullMarkdownFromAgentJson, normalizeMarkdownDiagrams } from "~/server/lib/doc-section-merge";

const BATCH_MAX_CHARS = 12_000;
/** Below this many extracted characters per page the PDF is almost certainly scanned images. */
const MIN_CHARS_PER_PAGE = 20;
const AI_CONCURRENCY = 3;
const HEADING_RATIO = 1.2;
const MAX_HEADING_LINE_CHARS = 90;
const MAX_HEADING_CHARS = 150;
/** A page is a table of contents only when most of its lines are "title ... page" entries. */
const MIN_TOC_LINES = 5;
/** Screenshot callouts such as "1 1", "a b", or "7". */
const CALLOUT_ONLY = /^(?:\d{1,4}|[a-z])(?:\s+(?:\d{1,3}|[a-z]))*$/;

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
}

interface PdfLine {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  /** Producers often end a paragraph's last text run with "\n". */
  endsParagraph: boolean;
}

type Block =
  | { kind: "heading"; text: string; fontSize: number; y: number; x: number; lines: number }
  | { kind: "paragraph"; text: string; fontSize: number; y: number; x: number; closed: boolean }
  | { kind: "list"; text: string; marker: string; fontSize: number; y: number; x: number }
  | { kind: "toc"; text: string; x: number };

export async function extractPdfPages(buffer: Buffer): Promise<string[]> {
  const { extractTextItems, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { items } = await extractTextItems(pdf);
  return pagesToStructuredMarkdown(items);
}

function groupLines(items: PdfTextItem[]): PdfLine[] {
  const runs = items
    .map((item) => ({ ...item, raw: item.str, str: item.str.replace(/\u0000/g, "").replace(/\s+/g, " ") }))
    .filter((item) => item.str.trim())
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: (typeof runs)[] = [];
  for (const run of runs) {
    const row = rows[rows.length - 1];
    const prev = row?.[row.length - 1];
    if (row && prev && Math.abs(prev.y - run.y) <= Math.max(prev.fontSize, run.fontSize) * 0.4) row.push(run);
    else rows.push([run]);
  }

  return rows.map((sortedRow) => {
    sortedRow.sort((a, b) => a.x - b.x);
    // Screenshot callout numbers sit alone, well apart from the text on the same row.
    const row = sortedRow.filter((run, i) => {
      if (sortedRow.length === 1 || !/^\s*\d{1,2}\s*$/.test(run.str)) return true;
      const prev = sortedRow[i - 1];
      const next = sortedRow[i + 1];
      const far = run.fontSize * 1.5;
      return !((!prev || run.x - (prev.x + prev.width) > far) && (!next || next.x - (run.x + run.width) > far));
    });
    if (!row.length) row.push(sortedRow[0]!);
    let text = "";
    let end = -Infinity;
    for (const run of row) {
      const gap = run.x - end;
      text += text && gap > run.fontSize * 0.15 && !text.endsWith(" ") ? ` ${run.str.trimStart()}` : run.str;
      end = Math.max(end, run.x + run.width);
    }
    const main = row.reduce((best, run) => (run.str.trim().length > best.str.trim().length ? run : best));
    return {
      text: text.replace(/\s+/g, " ").replace(/([“"(]) /g, "$1").replace(/ ([”")])/g, "$1").trim(),
      x: row[0]!.x,
      y: main.y,
      fontSize: main.fontSize,
      endsParagraph: /\n\s*$/.test(row[row.length - 1]!.raw),
    };
  });
}

/** Character-weighted most common font size, i.e. the body text size. */
function bodyFontSize(lines: PdfLine[]): number {
  const weights = new Map<number, number>();
  for (const line of lines) {
    const size = Math.round(line.fontSize * 2) / 2;
    weights.set(size, (weights.get(size) ?? 0) + line.text.length);
  }
  let best = 0;
  let bestWeight = -1;
  for (const [size, weight] of weights) {
    if (weight > bestWeight) [best, bestWeight] = [size, weight];
  }
  return best || 12;
}

/** Most common baseline-to-baseline distance between body lines, as a multiple of the body font size. */
function bodyLineSpacing(pageLines: PdfLine[][], body: number): number {
  const counts = new Map<number, number>();
  for (const lines of pageLines) {
    for (let i = 1; i < lines.length; i++) {
      const [prev, cur] = [lines[i - 1]!, lines[i]!];
      if (Math.abs(prev.fontSize - body) > 0.5 || Math.abs(cur.fontSize - body) > 0.5) continue;
      const ratio = Math.round(((prev.y - cur.y) / body) * 10) / 10;
      if (ratio >= 0.8 && ratio <= 3) counts.set(ratio, (counts.get(ratio) ?? 0) + 1);
    }
  }
  let best = 1.2;
  let bestCount = 0;
  for (const [ratio, count] of counts) {
    if (count > bestCount) [best, bestCount] = [ratio, count];
  }
  return best;
}

const footerKey = (text: string) => text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

function tocEntry(text: string, line: PdfLine, items: PdfTextItem[]): string | null {
  const dotted = text.match(/^(.*?\S)\s*(?:\.{3,}|…{2,}|(?:\. ){3,})[.\s…]*\d{1,4}$/);
  if (dotted) return dotted[1]!;
  if (!/^\p{L}/u.test(text)) return null;
  const sameRow = items.filter((i) => i.str.trim() && Math.abs(i.y - line.y) <= line.fontSize * 0.4).sort((a, b) => a.x - b.x);
  const last = sameRow[sameRow.length - 1];
  const prev = sameRow[sameRow.length - 2];
  if (!last || !prev || !/^\d{1,4}$/.test(last.str.trim())) return null;
  return last.x - (prev.x + prev.width) > line.fontSize * 4 ? text.replace(/\s+\d{1,4}$/, "") : null;
}

/**
 * Turns positioned PDF text runs into markdown per page: headings from font size, paragraphs from
 * vertical gaps, bullets, table-of-contents entries, and no repeated headers/footers or page numbers.
 */
export function pagesToStructuredMarkdown(pages: PdfTextItem[][]): string[] {
  const pageLines = pages.map(groupLines);

  // Headers and footers are the top/bottom lines of a page that recur (ignoring numbers) on many pages.
  const isEdge = (lines: PdfLine[], index: number) => index < 2 || index >= lines.length - 2;
  const repeatCount = new Map<string, number>();
  for (const lines of pageLines) {
    const keys = new Set(lines.filter((_, i) => isEdge(lines, i)).map((l) => footerKey(l.text)));
    for (const key of keys) repeatCount.set(key, (repeatCount.get(key) ?? 0) + 1);
  }
  const isRepeated = (text: string) =>
    pages.length >= 3 && (repeatCount.get(footerKey(text)) ?? 0) >= Math.max(3, pages.length * 0.5);

  const keptLines = pageLines.map((lines) =>
    lines.filter((l, i) => l.text && !CALLOUT_ONLY.test(l.text) && !(isEdge(lines, i) && isRepeated(l.text))),
  );
  const body = bodyFontSize(keptLines.flat());
  const maxLineGap = Math.max(1.6, bodyLineSpacing(keptLines, body) * 1.25);

  const pageBlocks = keptLines.map((lines, pageIndex) => {
    const tocTitles = lines.map((l) => tocEntry(l.text, l, pages[pageIndex]!));
    const tocCount = tocTitles.filter(Boolean).length;
    const isTocPage = tocCount >= MIN_TOC_LINES && tocCount >= lines.length * 0.5;

    const blocks: Block[] = [];
    for (const [lineIndex, line] of lines.entries()) {
      // Drop duplicated callout numbers in front of a numbered step: "3 3 Input" -> "3 Input".
      const text = line.text.replace(/^(?:\d{1,2}\s+)+(?=\d{1,2}\s+\S)/, "");

      const last = blocks[blocks.length - 1];
      const toc = tocTitles[lineIndex];
      if (isTocPage && toc) {
        blocks.push({ kind: "toc", text: toc, x: line.x });
        continue;
      }

      const nearLast =
        last !== undefined &&
        last.kind !== "toc" &&
        Math.abs(last.fontSize - line.fontSize) < 1 &&
        last.y - line.y > 0 &&
        last.y - line.y <= Math.max(last.fontSize, line.fontSize) * maxLineGap;

      const paragraphGoesOn = last?.kind === "paragraph" && !last.closed && nearLast;
      if (line.fontSize >= body * HEADING_RATIO && text.length <= MAX_HEADING_LINE_CHARS && !paragraphGoesOn) {
        if (last?.kind === "heading" && nearLast) {
          last.text += ` ${text}`;
          last.y = line.y;
          last.lines += 1;
          // Large-font body copy, not a heading: a real heading rarely wraps past two lines.
          if (last.lines >= 3 || last.text.length > MAX_HEADING_CHARS) {
            blocks[blocks.length - 1] = { ...last, kind: "paragraph", closed: line.endsParagraph };
          }
        } else {
          blocks.push({ kind: "heading", text, fontSize: line.fontSize, y: line.y, x: line.x, lines: 1 });
        }
        continue;
      }

      const bullet = text.match(/^([•▪●◦‣·➢►\-–*]|\d{1,2}[.)]?|[a-z][.)])\s+(?=[\p{L}“"(])(.*)$/u);
      if (bullet) {
        const symbol = bullet[1]!;
        const marker = /^\d/.test(symbol) ? `${symbol.replace(/[.)]$/, "")}.` : "-";
        // Markdown has no lettered lists, so "a." stays in the item text.
        const itemText = /^[a-z]/.test(symbol) ? `${symbol[0]}. ${bullet[2]}` : bullet[2]!;
        blocks.push({ kind: "list", text: itemText, marker, fontSize: line.fontSize, y: line.y, x: line.x });
        continue;
      }

      const continues =
        (last?.kind === "paragraph" || last?.kind === "list") &&
        !(last.kind === "paragraph" && last.closed) &&
        nearLast &&
        Math.abs(line.x - last.x) <= line.fontSize * 12;
      if (continues) {
        last.text += ` ${text}`;
        last.y = line.y;
        if (last.kind === "paragraph") last.closed = line.endsParagraph;
      } else {
        blocks.push({ kind: "paragraph", text, fontSize: line.fontSize, y: line.y, x: line.x, closed: line.endsParagraph });
      }
    }
    return blocks;
  });

  const headingSizes = [
    ...new Set(
      pageBlocks.flat().flatMap((b) => (b.kind === "heading" ? [Math.round(b.fontSize * 2) / 2] : [])),
    ),
  ].sort((a, b) => b - a);
  const tocIndents = [
    ...new Set(pageBlocks.flat().flatMap((b) => (b.kind === "toc" ? [Math.round(b.x / 5) * 5] : []))),
  ].sort((a, b) => a - b);

  return pageBlocks.map((blocks) => {
    let out = "";
    let prevKind: Block["kind"] | null = null;
    for (const block of blocks) {
      let rendered: string;
      if (block.kind === "heading") {
        const level = Math.min(3, headingSizes.indexOf(Math.round(block.fontSize * 2) / 2) + 1);
        rendered = `${"#".repeat(level)} ${block.text}`;
      } else if (block.kind === "toc") {
        const depth = Math.min(2, Math.max(0, tocIndents.indexOf(Math.round(block.x / 5) * 5)));
        rendered = `${"  ".repeat(depth)}- ${block.text}`;
      } else if (block.kind === "list") {
        rendered = `${block.marker} ${block.text}`;
      } else {
        rendered = block.text;
      }
      const tight = prevKind === block.kind && (block.kind === "list" || block.kind === "toc");
      out += out ? (tight ? "\n" : "\n\n") + rendered : rendered;
      prevKind = block.kind;
    }
    return out;
  });
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

export type PdfImportBackend = "openai" | "cursor" | "none";

export async function resolvePdfImportBackend(): Promise<PdfImportBackend> {
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if ((await isCursorInstalled()) && (await isCursorAuthenticated()).ok) return "cursor";
  return "none";
}

function getImportModelName(): string {
  return process.env.PDF_IMPORT_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

const SYSTEM_PROMPT = `You convert text extracted from a PDF into clean GitHub-flavored Markdown for a technical documentation editor.
The input is already roughly structured Markdown recovered from the PDF layout (headings from font size, lists, table-of-contents entries); it may contain mistakes.

Rules:
- Keep ALL content. Do not summarize, shorten, translate, or add commentary.
- Fix and complete structure: headings (#, ##, ###), bullet/numbered lists, tables, code blocks, and blockquotes where the source clearly has them.
- Join lines that were broken only by PDF layout; drop leftover page headers, footers, and page numbers.
- Output ONLY the Markdown. No code fence around the whole answer, no JSON, no explanations.`;

const MARKDOWN_OPEN = "<markdown>";
const MARKDOWN_CLOSE = "</markdown>";

/**
 * Cursor returns every assistant message of the session, so commentary or a retried answer can
 * surround the real output; keep only the last tagged block.
 */
export function lastMarkdownBlock(raw: string): string {
  const start = raw.lastIndexOf(MARKDOWN_OPEN);
  if (start === -1) return raw;
  const end = raw.indexOf(MARKDOWN_CLOSE, start);
  return raw.slice(start + MARKDOWN_OPEN.length, end === -1 ? undefined : end).trim();
}

async function convertBatch(backend: "openai" | "cursor", batch: string, index: number, total: number): Promise<string> {
  const prompt = `Part ${index + 1} of ${total} of the extracted PDF text:\n\n${batch}`;
  const signal = AbortSignal.timeout(240_000);
  const raw =
    backend === "openai"
      ? (
          await generateText({
            model: getCustomOpenAI().chat(getImportModelName()),
            abortSignal: signal,
            system: SYSTEM_PROMPT,
            prompt,
          })
        ).text
      : lastMarkdownBlock(
          await createCursorAgent({ mode: "ask", chat: true }).analyze(
            `${SYSTEM_PROMPT}\n\nDo not use tools or read files; answer only from the text below. ` +
              `Wrap the final Markdown in ${MARKDOWN_OPEN} and ${MARKDOWN_CLOSE}, exactly once.\n\n${prompt}`,
            { signal },
          ),
        );
  return cleanModelMarkdown(raw) ?? batch;
}

export async function pdfPagesToMarkdown(pages: string[]): Promise<{ markdown: string; usedAi: boolean }> {
  const backend = await resolvePdfImportBackend();
  if (backend === "none") {
    return { markdown: pages.filter(Boolean).join("\n\n").trim(), usedAi: false };
  }

  const batches = batchPages(pages);
  const parts: string[] = new Array(batches.length);
  let next = 0;
  let converted = 0;
  const worker = async () => {
    while (next < batches.length) {
      const index = next++;
      const batch = batches[index]!;
      try {
        parts[index] = await convertBatch(backend, batch, index, batches.length);
        converted++;
      } catch (err) {
        console.error(`[pdf-import] AI conversion failed for part ${index + 1}/${batches.length}:`, err);
        parts[index] = batch;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(AI_CONCURRENCY, batches.length) }, worker));
  return { markdown: parts.join("\n\n").trim(), usedAi: converted > 0 };
}
