interface HeadingHit {
  level: number;
  text: string;
  start: number;
  end: number;
}

function normalizeHeadingText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function unwrapMarkdownFence(text: string): string {
  const fullFence = text.match(/^```(?:markdown|md)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
  return fullFence ? fullFence[1].trim() : text;
}

function findHeadings(md: string): HeadingHit[] {
  const hits: HeadingHit[] = [];
  let inFence = false;
  let offset = 0;
  const lines = md.split("\n");

  for (const line of lines) {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        hits.push({
          level: match[1].length,
          text: match[2].trim(),
          start: offset,
          end: offset + line.length,
        });
      }
    }
    offset += line.length + 1;
  }

  return hits;
}

function stripPreambleBeforeHeading(md: string): string {
  const headings = findHeadings(md);
  if (!headings.length || headings[0].start <= 0) return md.trimStart();
  return md.slice(headings[0].start).trimStart();
}

function collapseRepeatedText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const repeated = trimmed.match(/^([\s\S]+?)\s+\1$/);
  return repeated ? repeated[1].trim() : trimmed;
}

function collapseDuplicateBlocks(md: string): string {
  const blocks = md.split(/\n{2,}/);
  const out: string[] = [];
  for (const block of blocks) {
    const collapsed = collapseRepeatedText(block);
    if (!collapsed) continue;
    if (out.length && out[out.length - 1] === collapsed) continue;
    out.push(collapsed);
  }
  return out.join("\n\n");
}

function keepFromLastTitleHeading(md: string, title: string): string {
  if (!title.trim()) return md;
  const want = normalizeHeadingText(title);
  const matches = findHeadings(md).filter(
    (heading) => heading.level <= 2 && normalizeHeadingText(heading.text) === want,
  );
  if (matches.length < 2) return md;
  return md.slice(matches[matches.length - 1].start).trimStart();
}

function collapseDoubledH2Sequence(md: string): string {
  const h2 = findHeadings(md).filter((heading) => heading.level === 2);
  if (h2.length < 4 || h2.length % 2 !== 0) return md;

  const half = h2.length / 2;
  const first = h2.slice(0, half).map((heading) => normalizeHeadingText(heading.text));
  const second = h2.slice(half).map((heading) => normalizeHeadingText(heading.text));
  if (!first.every((text, i) => text === second[i])) return md;

  return md.slice(h2[half].start).trimStart();
}

function stripLeadingTitleHeading(md: string, title: string): string {
  if (!title.trim()) return md;
  const headings = findHeadings(md);
  if (!headings.length || headings[0].start > 0) return md;

  const first = headings[0];
  if (first.level > 2) return md;
  if (normalizeHeadingText(first.text) !== normalizeHeadingText(title)) return md;

  let next = first.end;
  if (md[next] === "\n") next += 1;
  return md.slice(next).trimStart();
}

function stripLeadingTitleHeadings(md: string, title: string): string {
  let text = md;
  for (let i = 0; i < 3; i++) {
    const next = stripLeadingTitleHeading(text, title);
    if (next === text) break;
    text = next;
  }
  return text;
}

/**
 * Clean generated wiki markdown: drop agent preamble, title-matching H1s
 * (the reader already shows the page title), stuttered paragraphs, and a
 * second copy of the same heading tree.
 */
export function sanitizeWikiMarkdown(content: string, title = ""): string {
  if (!content) return content;

  let text = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  text = unwrapMarkdownFence(text);
  text = stripPreambleBeforeHeading(text);
  text = collapseDuplicateBlocks(text);
  text = keepFromLastTitleHeading(text, title);
  text = collapseDoubledH2Sequence(text);
  text = stripLeadingTitleHeadings(text, title);
  text = collapseDuplicateBlocks(text);
  return text.trim();
}
