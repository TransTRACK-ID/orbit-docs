import type EditorJS from "@editorjs/editorjs";

export interface EditorJsData {
  time?: number;
  version?: string;
  blocks: Array<{
    type: string;
    data: Record<string, any>;
  }>;
}

const MERMAID_START_RE =
  /^(flowchart|graph)\s+/i;

const MERMAID_KEYWORD_START_RE =
  /^(sequenceDiagram|classDiagram|stateDiagram-v2?|erDiagram|gantt|pie|gitGraph|journey|mindmap|timeline|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\b/;

const NOTION_IMAGE_EXT_RE = /\.(?:gif|jpe?g|png|webp|tiff|svg|bmp)$/i;

export function isLoadableImageUrl(url: string): boolean {
  const value = url.trim();
  return /^(https?:|data:image\/|blob:)/i.test(value);
}

export function isNotionImageReference(text: string): { filename: string } | null {
  const plain = decodeHtmlEntities(stripHtml(text || "")).trim();
  const match = plain.match(/^!([^!\[\n]+)$/);
  if (!match) return null;
  const filename = match[1].trim();
  if (!NOTION_IMAGE_EXT_RE.test(filename)) return null;
  return { filename };
}

export function createImageBlockData(url: string, caption = "") {
  return {
    url,
    caption,
    withBorder: false,
    withBackground: false,
    stretched: false,
  };
}

export function normalizeFilename(name: string): string {
  return decodeURIComponent(name).toLowerCase().replace(/\s+/g, " ").trim();
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function resolveFileForReference(
  reference: string,
  filesByName: Map<string, File>
): File | undefined {
  const candidates = [
    normalizeFilename(reference),
    normalizeFilename(reference.replace(/^!/, "")),
    normalizeFilename(reference.split("/").pop() || reference),
  ];
  for (const candidate of candidates) {
    const file = filesByName.get(candidate);
    if (file) return file;
  }
  return undefined;
}

async function flattenListImageItems(
  block: EditorJsData["blocks"][number],
  filesByName: Map<string, File>
): Promise<EditorJsData["blocks"]> {
  const items = block.data.items || [];
  const chunks: EditorJsData["blocks"] = [];
  let pendingItems: any[] = [];

  const flushList = () => {
    if (!pendingItems.length) return;
    chunks.push({
      type: "list",
      data: {
        ...block.data,
        items: pendingItems,
      },
    });
    pendingItems = [];
  };

  for (const item of items) {
    const content = typeof item === "string" ? item : item.content || "";
    if (typeof document !== "undefined") {
      const shell = document.createElement("div");
      shell.innerHTML = content;
      const soleImg = getSoleImage(shell);
      if (soleImg) {
        flushList();
        const caption = decodeHtmlEntities(soleImg.getAttribute("alt") || "");
        const url = soleImg.getAttribute("src") || "";
        const file = !isLoadableImageUrl(url)
          ? resolveFileForReference(url, filesByName)
          : undefined;
        chunks.push({
          type: "image",
          data: createImageBlockData(
            file ? await readFileAsDataUrl(file) : url,
            caption
          ),
        });
        continue;
      }

      const ref = isNotionImageReference(content);
      if (ref) {
        flushList();
        const file = resolveFileForReference(ref.filename, filesByName);
        chunks.push({
          type: "image",
          data: createImageBlockData(
            file ? await readFileAsDataUrl(file) : ref.filename,
            ref.filename.replace(/\.[^.]+$/, "")
          ),
        });
        continue;
      }
    }

    pendingItems.push(item);
  }

  flushList();
  return chunks;
}

/** Match Notion attachment placeholders to clipboard image files and normalize image blocks. */
export async function reconcileNotionImageBlocks(
  blocks: EditorJsData["blocks"],
  files: File[] = []
): Promise<EditorJsData["blocks"]> {
  const filesByName = new Map<string, File>();
  for (const file of files) {
    filesByName.set(normalizeFilename(file.name), file);
  }

  const output: EditorJsData["blocks"] = [];

  for (const block of blocks) {
    if (block.type === "list") {
      output.push(...await flattenListImageItems(block, filesByName));
      continue;
    }

    if (block.type === "paragraph") {
      const ref = isNotionImageReference(block.data.text || "");
      if (ref) {
        const file = resolveFileForReference(ref.filename, filesByName);
        output.push({
          type: "image",
          data: createImageBlockData(
            file ? await readFileAsDataUrl(file) : ref.filename,
            ref.filename.replace(/\.[^.]+$/, "")
          ),
        });
        continue;
      }
    }

    if (block.type === "image") {
      const url = String(block.data.url || "");
      if (!isLoadableImageUrl(url)) {
        const file = resolveFileForReference(url, filesByName)
          || resolveFileForReference(String(block.data.caption || ""), filesByName);
        if (file) {
          output.push({
            type: "image",
            data: {
              ...block.data,
              url: await readFileAsDataUrl(file),
            },
          });
          continue;
        }
      }
    }

    output.push(block);
  }

  return output;
}

function imageBlockIdentities(block: EditorJsData["blocks"][number]): string[] {
  if (block.type !== "image") return [];
  const caption = String(block.data.caption || "");
  const url = String(block.data.url || "");
  const ids = new Set<string>();

  const add = (value: string) => {
    const normalized = normalizeFilename(value);
    if (!normalized) return;
    ids.add(normalized);
    const withoutExt = normalized.replace(/\.[^.]+$/, "");
    if (withoutExt) ids.add(withoutExt);
  };

  add(caption);
  add(url.split("/").pop() || url);

  return Array.from(ids);
}

function imageBlocksMatch(
  a: EditorJsData["blocks"][number],
  b: EditorJsData["blocks"][number]
): boolean {
  if (a.type !== "image" || b.type !== "image") return false;
  const aIds = imageBlockIdentities(a);
  const bIds = imageBlockIdentities(b);
  return aIds.some((id) => bIds.includes(id));
}

function containsImageBlock(
  blocks: EditorJsData["blocks"],
  imageBlock: EditorJsData["blocks"][number]
): boolean {
  if (imageBlock.type !== "image") return false;
  return blocks.some((block) => imageBlocksMatch(block, imageBlock));
}

/** Align HTML-derived blocks with plain-text structure so Notion image placeholders are kept. */
export function alignBlocksWithPlainImages(
  htmlBlocks: EditorJsData["blocks"],
  plainBlocks: EditorJsData["blocks"]
): EditorJsData["blocks"] {
  const result: EditorJsData["blocks"] = [];
  let htmlIndex = 0;
  const usedHtmlIndices = new Set<number>();

  const findMatchingHtmlImage = (
    fromIndex: number,
    plainImage: EditorJsData["blocks"][number]
  ): number => {
    for (let i = fromIndex; i < htmlBlocks.length; i++) {
      if (
        htmlBlocks[i].type === "image"
        && imageBlocksMatch(htmlBlocks[i], plainImage)
        && !usedHtmlIndices.has(i)
      ) {
        return i;
      }
    }
    return -1;
  };

  const pushHtmlImageFor = (plainImage: EditorJsData["blocks"][number]): boolean => {
    const idx = findMatchingHtmlImage(htmlIndex, plainImage);
    if (idx === -1) return false;
    result.push(htmlBlocks[idx]);
    usedHtmlIndices.add(idx);
    return true;
  };

  for (let plainIndex = 0; plainIndex < plainBlocks.length; plainIndex++) {
    const plainBlock = plainBlocks[plainIndex];

    if (plainBlock.type === "image") {
      if (containsImageBlock(result, plainBlock)) {
        continue;
      }

      // Prefer the HTML-derived image (better URL/formatting) if it matches.
      if (pushHtmlImageFor(plainBlock)) {
        continue;
      }

      result.push(plainBlock);
      continue;
    }

    if (
      plainBlock.type === "list"
      && plainBlocks[plainIndex + 1]?.type === "image"
      && plainBlocks[plainIndex + 2]?.type === "list"
      && htmlIndex < htmlBlocks.length
      && htmlBlocks[htmlIndex].type === "list"
    ) {
      const htmlList = htmlBlocks[htmlIndex];
      const firstCount = (plainBlock.data.items || []).length;
      const secondCount = (plainBlocks[plainIndex + 2].data.items || []).length;
      const allItems = htmlList.data.items || [];

      if (allItems.length >= firstCount + secondCount) {
        if (firstCount > 0) {
          result.push({
            type: "list",
            data: { ...htmlList.data, items: allItems.slice(0, firstCount) },
          });
        }

        const imageBlock = plainBlocks[plainIndex + 1];
        if (!containsImageBlock(result, imageBlock) && !pushHtmlImageFor(imageBlock)) {
          result.push(imageBlock);
        }

        if (secondCount > 0) {
          result.push({
            type: "list",
            data: {
              ...htmlList.data,
              items: allItems.slice(firstCount, firstCount + secondCount),
            },
          });
        }

        htmlIndex++;
        plainIndex += 2;
        continue;
      }
    }

    if (htmlIndex < htmlBlocks.length && htmlBlocks[htmlIndex].type === plainBlock.type) {
      result.push(htmlBlocks[htmlIndex]);
      htmlIndex++;
    }
  }

  while (htmlIndex < htmlBlocks.length) {
    if (!usedHtmlIndices.has(htmlIndex)) {
      result.push(htmlBlocks[htmlIndex]);
    }
    htmlIndex++;
  }

  return result;
}

/** Build final pasted blocks from Notion HTML + plain text + clipboard image files. */
export async function mergeNotionPasteBlocks(
  html: string,
  plainText: string,
  files: File[] = []
): Promise<EditorJsData["blocks"]> {
  let htmlBlocks = htmlToEditorJsBlocks(html);
  htmlBlocks = await reconcileNotionImageBlocks(htmlBlocks, files);

  if (!plainText.trim()) {
    return htmlBlocks;
  }

  const plainBlocks = await reconcileNotionImageBlocks(
    markdownToEditorJs(plainText).blocks,
    files
  );

  return alignBlocksWithPlainImages(htmlBlocks, plainBlocks);
}

function isMermaidStartLine(line: string): boolean {
  const trimmed = line.trim();
  return MERMAID_START_RE.test(trimmed) || MERMAID_KEYWORD_START_RE.test(trimmed);
}

// ── Markdown → Editor.js JSON ─────────────────────────────────
export function markdownToEditorJs(md: string): EditorJsData {
  const blocks: EditorJsData["blocks"] = [];
  const lines = md.split("\n");
  let i = 0;

  function flushParagraph(buffer: string[]) {
    if (buffer.length > 0) {
      const text = buffer.join("\n").trim();
      if (text) {
        blocks.push({
          type: "paragraph",
          data: { text: inlineMarkdownToHtml(text) },
        });
      }
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Delimiter
    if (/^(---|___|\*\*\*)$/.test(line.trim())) {
      blocks.push({ type: "delimiter", data: {} });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      blocks.push({
        type: "header",
        data: { text: escapeHtml(decodeHtmlEntities(text)), level },
      });
      i++;
      continue;
    }

    // Code block (including fenced mermaid diagrams)
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      const code = codeLines.join("\n");
      if (language === "mermaid") {
        blocks.push({ type: "mermaid", data: { code } });
      } else {
        blocks.push({
          type: "code",
          data: { code, language: language || "plaintext" },
        });
      }
      continue;
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1].includes("|")) {
      const headerCells = line
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c !== "");
      i++;
      // skip separator line
      if (i < lines.length && /^[-\s:|]+$/.test(lines[i])) i++;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        const cells = lines[i]
          .split("|")
          .map((c) => c.trim())
          .filter((c) => c !== "");
        rows.push(cells);
        i++;
      }
      blocks.push({
        type: "table",
        data: {
          withHeadings: true,
          content: [headerCells, ...rows],
        },
      });
      continue;
    }

    // Quote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({
        type: "quote",
        data: {
          text: inlineMarkdownToHtml(quoteLines.join("\n")),
          alignment: "left",
        },
      });
      continue;
    }

    // List (bullet, ordered, checklist)
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const items: Array<{ content: string; meta: Record<string, any>; items: any[] }> = [];
      let listStyle: "unordered" | "ordered" = "unordered";
      if (/^\d+\./.test(listMatch[2])) listStyle = "ordered";

      while (i < lines.length) {
        const currentLine = lines[i];
        const currentMatch = currentLine.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
        if (!currentMatch) break;
        if (/^\d+\./.test(currentMatch[2])) listStyle = "ordered";
        items.push({ content: inlineMarkdownToHtml(currentMatch[3]), meta: {}, items: [] });
        i++;
      }
      blocks.push({
        type: "list",
        data: { style: listStyle, items },
      });
      continue;
    }

    // Nested list (with indentation)
    const nestedListMatch = line.match(/^(\s+)([-*]|\d+\.)\s+(.+)$/);
    if (nestedListMatch) {
      const baseIndent = nestedListMatch[1].length;
      let listStyle: "unordered" | "ordered" = "unordered";
      if (/^\d+\./.test(nestedListMatch[2])) listStyle = "ordered";

      const parseNestedList = (startIdx: number, minIndent: number): { items: Array<{ content: string; meta: Record<string, any>; items: any[] }>; nextIdx: number } => {
        const items: Array<{ content: string; meta: Record<string, any>; items: any[] }> = [];
        let idx = startIdx;

        while (idx < lines.length) {
          const currentLine = lines[idx];
          const match = currentLine.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
          if (!match) break;

          const indent = match[1].length;
          if (indent < minIndent) break;

          if (indent === minIndent) {
            if (/^\d+\./.test(match[2])) listStyle = "ordered";
            const content = inlineMarkdownToHtml(match[3]);
            idx++;

            // Check for nested items
            const nested = parseNestedList(idx, minIndent + 2);
            items.push({ content, meta: {}, items: nested.items });
            idx = nested.nextIdx;
          } else {
            break;
          }
        }

        return { items, nextIdx: idx };
      };

      const result = parseNestedList(i, baseIndent);
      blocks.push({
        type: "nestedList",
        data: { style: listStyle, items: result.items },
      });
      i = result.nextIdx;
      continue;
    }

    // Toggle block (using HTML details/summary syntax)
    const toggleMatch = line.match(/^<details>\s*<summary>(.+)<\/summary>\s*$/);
    if (toggleMatch || line.trim().startsWith(":::toggle")) {
      const title = toggleMatch ? toggleMatch[1] : line.replace(":::toggle", "").trim();
      const content: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(":::") && !lines[i].trim().startsWith("</details>")) {
        content.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing
      blocks.push({
        type: "toggle",
        data: {
          title: title || "Toggle",
          items: content.length > 0 ? markdownToEditorJs(content.join("\n")).blocks : [],
        },
      });
      continue;
    }

    // Unfenced Mermaid diagram (e.g. pasted flowchart syntax without ```mermaid fences)
    if (isMermaidStartLine(line)) {
      const codeLines: string[] = [line];
      i++;
      while (i < lines.length) {
        const next = lines[i];
        if (!next.trim()) break;
        if (next.match(/^(#{1,3}|>|[-*]|\d+\.|```|!\[|---|\||:::toggle)/)) break;
        codeLines.push(next);
        i++;
      }
      blocks.push({
        type: "mermaid",
        data: { code: codeLines.join("\n") },
      });
      continue;
    }

    // Checklist
    if (line.startsWith("- [ ] ") || line.startsWith("- [x] ") || line.startsWith("- [X] ")) {
      const items: Array<{ text: string; checked: boolean }> = [];
      while (i < lines.length) {
        const currentLine = lines[i];
        if (currentLine.startsWith("- [ ] ")) {
          items.push({ text: inlineMarkdownToHtml(currentLine.slice(6)), checked: false });
          i++;
        } else if (currentLine.startsWith("- [x] ") || currentLine.startsWith("- [X] ")) {
          items.push({ text: inlineMarkdownToHtml(currentLine.slice(6)), checked: true });
          i++;
        } else break;
      }
      blocks.push({
        type: "checklist",
        data: { items },
      });
      continue;
    }

    // Notion attachment reference: !filename.gif
    const notionImageRef = line.match(/^!([^!\[\n]+\.(?:gif|jpe?g|png|webp|tiff|svg|bmp))$/i);
    if (notionImageRef) {
      const filename = notionImageRef[1].trim();
      blocks.push({
        type: "image",
        data: createImageBlockData(filename, filename.replace(/\.[^.]+$/, "")),
      });
      i++;
      continue;
    }

    // Image
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      const url = imageMatch[2];
      // Video embeds (YouTube, Vimeo) – use embed block
      if (/^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com\/)/.test(url)) {
        blocks.push({
          type: "embed",
          data: { service: url.includes("vimeo") ? "vimeo" : "youtube", source: url, embed: "", width: 580, height: 320, caption: imageMatch[1] },
        });
      } else {
        blocks.push({
          type: "image",
          data: { url, caption: imageMatch[1], withBorder: false, withBackground: false, stretched: false },
        });
      }
      i++;
      continue;
    }

    // Paragraph (collect until next block)
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length
      && lines[i].trim()
      && !lines[i].match(/^(#{1,3}|>|[-*]|\d+\.|```|!\[|---|\||:::toggle)/)
      && !lines[i].match(/^!([^!\[\n]+\.(?:gif|jpe?g|png|webp|tiff|svg|bmp))$/i)
      && !isMermaidStartLine(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    flushParagraph(paraLines);
  }

  return { time: Date.now(), version: "2.29.0", blocks };
}

// ── Editor.js JSON → Markdown ─────────────────────────────────
export function editorJsToMarkdown(data: EditorJsData): string {
  const blocks = data.blocks || [];
  const out: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "header": {
        const level = block.data.level || 2;
        const hashes = "#".repeat(level);
        out.push(`${hashes} ${decodeHtmlEntities(stripHtml(block.data.text || ""))}`);
        break;
      }
      case "paragraph": {
        const text = htmlToInlineMarkdown(block.data.text || "");
        out.push(text);
        break;
      }
      case "list": {
        const items = block.data.items || [];
        const style = block.data.style || "unordered";
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const content = typeof item === "string" ? item : item.content || "";
          const text = htmlToInlineMarkdown(content);
          if (style === "ordered") {
            out.push(`${idx + 1}. ${text}`);
          } else {
            out.push(`- ${text}`);
          }
        }
        break;
      }
      case "checklist": {
        const items = block.data.items || [];
        for (const item of items) {
          const checked = item.checked ? "x" : " ";
          const text = htmlToInlineMarkdown(item.text || "");
          out.push(`- [${checked}] ${text}`);
        }
        break;
      }
      case "code": {
        const language = block.data.language || "";
        out.push(`\`\`\`${language}`);
        out.push(block.data.code || "");
        out.push("```");
        break;
      }
      case "quote": {
        const text = htmlToInlineMarkdown(block.data.text || "");
        const lines = text.split("\n");
        for (const line of lines) {
          out.push(`> ${line}`);
        }
        break;
      }
      case "image": {
        const caption = block.data.caption || "";
        const url = block.data.url || "";
        out.push(`![${caption}](${url})`);
        break;
      }
      case "embed": {
        const caption = block.data.caption || "";
        const source = block.data.source || "";
        out.push(`![${caption}](${source})`);
        break;
      }
      case "table": {
        const content = block.data.content || [];
        if (content.length > 0) {
          const header = content[0];
          out.push(`| ${header.join(" | ")} |`);
          out.push(`| ${header.map(() => "---").join(" | ")} |`);
          for (let r = 1; r < content.length; r++) {
            out.push(`| ${content[r].join(" | ")} |`);
          }
        }
        break;
      }
      case "delimiter": {
        out.push("---");
        break;
      }
      case "warning": {
        out.push(`> **Warning:** ${block.data.title || ""}`);
        if (block.data.message) {
          out.push(`> ${block.data.message}`);
        }
        break;
      }
      case "nestedList": {
        const items = block.data.items || [];
        const style = block.data.style || "unordered";
        const renderNestedList = (items: any[], indent: number, style: string): string[] => {
          const lines: string[] = [];
          for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx];
            const content = typeof item === "string" ? item : item.content || "";
            const text = htmlToInlineMarkdown(content);
            const prefix = " ".repeat(indent) + (style === "ordered" ? `${idx + 1}. ` : "- ");
            lines.push(`${prefix}${text}`);
            if (item.items && item.items.length > 0) {
              lines.push(...renderNestedList(item.items, indent + 2, style));
            }
          }
          return lines;
        };
        out.push(...renderNestedList(items, 0, style));
        break;
      }
      case "toggle": {
        const title = block.data.title || "Toggle";
        out.push(`:::toggle ${title}`);
        const items = block.data.items || [];
        if (items.length > 0) {
          const nestedMd = editorJsToMarkdown({ time: Date.now(), version: "2.29.0", blocks: items });
          out.push(...nestedMd.split("\n"));
        }
        out.push(":::");
        break;
      }
      case "mermaid": {
        out.push("```mermaid");
        out.push(block.data.code || "");
        out.push("```");
        break;
      }
      default:
        break;
    }
  }

  return out.join("\n");
}

// ── Inline helpers ─────────────────────────────────────────────

const HTML_ENTITY_RE = /&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/;

/** Iteratively decode HTML entities (handles double-encoded Notion paste like &amp;amp;). */
export function decodeHtmlEntities(text: string): string {
  if (!text || !HTML_ENTITY_RE.test(text)) return text;

  let prev = "";
  let current = text;
  while (current !== prev) {
    prev = current;
    current = current
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  return current;
}

/** Normalize inline HTML stored in Editor.js blocks (decode stray entity text). */
export function normalizeEditorHtml(html: string): string {
  if (!html) return html;
  if (typeof document === "undefined") {
    return decodeHtmlEntities(html);
  }

  const el = document.createElement("div");
  el.innerHTML = html;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent || "";
    const decoded = decodeHtmlEntities(text);
    if (decoded !== text) {
      node.textContent = decoded;
    }
  }
  return el.innerHTML;
}

/** Clean clipboard HTML from Notion and similar sources before Editor.js ingests it. */
export function normalizePastedHtml(html: string): string {
  if (!html) return html;
  if (typeof document === "undefined") {
    return decodeHtmlEntities(html);
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("meta, style, script").forEach((el) => el.remove());

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent || "";
    const decoded = decodeHtmlEntities(text);
    if (decoded !== text) {
      node.textContent = decoded;
    }
  }

  return doc.body.innerHTML;
}

const BLOCK_TAGS = new Set([
  "P", "H1", "H2", "H3", "H4", "H5", "H6",
  "UL", "OL", "BLOCKQUOTE", "PRE", "TABLE", "HR", "LI",
]);

function hasBlockChildren(el: Element): boolean {
  return Array.from(el.children).some((child) => BLOCK_TAGS.has(child.tagName));
}

function getInlineHtml(el: Element): string {
  return normalizeEditorHtml(el.innerHTML);
}

function imageBlockFromElement(img: Element, caption = ""): EditorJsData["blocks"] {
  const src = img.getAttribute("src")?.trim();
  if (!src) return [];
  return [{
    type: "image",
    data: {
      url: src,
      caption: caption || decodeHtmlEntities(img.getAttribute("alt") || ""),
      withBorder: false,
      withBackground: false,
      stretched: false,
    },
  }];
}

function getSoleImage(el: Element): HTMLImageElement | null {
  if (el.tagName === "IMG") {
    return el as HTMLImageElement;
  }

  const imgs = Array.from(el.querySelectorAll("img"));
  if (imgs.length !== 1) return null;

  const img = imgs[0];
  const text = (el.textContent || "").trim();
  const alt = (img.getAttribute("alt") || "").trim();
  if (!text || text === alt) {
    return img;
  }

  return null;
}

function elementToBlocks(el: Element): EditorJsData["blocks"] {
  const tag = el.tagName.toLowerCase();

  if (tag === "img") {
    return imageBlockFromElement(el);
  }

  if (tag === "figure") {
    const img = el.querySelector("img");
    if (!img) return [];
    const caption = decodeHtmlEntities(el.querySelector("figcaption")?.textContent || "");
    return imageBlockFromElement(img, caption);
  }

  if (/^h[1-3]$/.test(tag)) {
    const html = getInlineHtml(el);
    if (!html.trim()) return [];
    return [{ type: "header", data: { text: html, level: Number(tag[1]) } }];
  }

  if (tag === "p" || (tag === "div" && !hasBlockChildren(el))) {
    const soleImg = getSoleImage(el);
    if (soleImg) {
      return imageBlockFromElement(soleImg);
    }

    const ref = isNotionImageReference(el.textContent || "");
    if (ref) {
      return [{
        type: "image",
        data: createImageBlockData(ref.filename, ref.filename.replace(/\.[^.]+$/, "")),
      }];
    }

    const html = getInlineHtml(el);
    if (!html.trim()) return [];
    return [{ type: "paragraph", data: { text: html } }];
  }

  if (tag === "ul" || tag === "ol") {
    const blocks: EditorJsData["blocks"] = [];
    let pendingItems: Array<{ content: string; meta: Record<string, any>; items: any[] }> = [];

    const flushList = () => {
      if (!pendingItems.length) return;
      blocks.push({
        type: "list",
        data: { style: tag === "ol" ? "ordered" : "unordered", items: pendingItems },
      });
      pendingItems = [];
    };

    for (const child of Array.from(el.children).filter((node) => node.tagName === "LI")) {
      const soleImg = getSoleImage(child);
      if (soleImg) {
        flushList();
        blocks.push(...imageBlockFromElement(soleImg));
        continue;
      }

      const ref = isNotionImageReference(child.textContent || "");
      if (ref) {
        flushList();
        blocks.push({
          type: "image",
          data: createImageBlockData(
            ref.filename,
            ref.filename.replace(/\.[^.]+$/, "")
          ),
        });
        continue;
      }

      const content = getInlineHtml(child);
      if (!content.trim()) continue;
      pendingItems.push({ content, meta: {}, items: [] });
    }

    flushList();
    return blocks;
  }

  if (tag === "blockquote") {
    const html = getInlineHtml(el);
    if (!html.trim()) return [];
    return [{ type: "quote", data: { text: html, alignment: "left" } }];
  }

  if (tag === "pre") {
    const codeEl = el.querySelector("code");
    const code = decodeHtmlEntities(codeEl?.textContent || el.textContent || "");
    if (!code.trim()) return [];
    const language = codeEl?.className.match(/language-(\S+)/)?.[1] || "";
    return [{ type: "code", data: { code, language } }];
  }

  if (tag === "hr") {
    return [{ type: "delimiter", data: {} }];
  }

  if (tag === "table") {
    const rows = Array.from(el.querySelectorAll("tr")).map((row) =>
      Array.from(row.querySelectorAll("th, td")).map((cell) =>
        decodeHtmlEntities(cell.textContent || "").trim()
      )
    ).filter((row) => row.some((cell) => cell));
    if (rows.length === 0) return [];
    return [{ type: "table", data: { withHeadings: true, content: rows } }];
  }

  if (tag === "div" || tag === "article" || tag === "section" || tag === "body") {
    const blocks: EditorJsData["blocks"] = [];
    for (const child of el.children) {
      blocks.push(...elementToBlocks(child));
    }
    return blocks;
  }

  return [];
}

/** Convert pasted HTML into Editor.js blocks with decoded entities. */
export function htmlToEditorJsBlocks(html: string): EditorJsData["blocks"] {
  if (!html.trim()) return [];
  if (typeof document === "undefined") return [];

  const normalized = normalizePastedHtml(html);
  const doc = new DOMParser().parseFromString(normalized, "text/html");
  const blocks = elementToBlocks(doc.body);

  if (blocks.length === 0) {
    const text = decodeHtmlEntities(doc.body.textContent || "").trim();
    if (text) {
      blocks.push({
        type: "paragraph",
        data: { text: escapeHtml(text).replace(/\n/g, "<br>") },
      });
    }
  }

  return blocks;
}

/** Decode entity artifacts across all text-bearing Editor.js block fields. */
export function sanitizeEditorJsData(data: EditorJsData): EditorJsData {
  const blocks = (data.blocks || []).map((block) => {
    const next = { ...block, data: { ...block.data } };

    if (typeof next.data.text === "string") {
      next.data.text = normalizeEditorHtml(next.data.text);
    }
    if (typeof next.data.title === "string") {
      next.data.title = decodeHtmlEntities(next.data.title);
    }
    if (Array.isArray(next.data.items)) {
      next.data.items = next.data.items.map((item: any) => {
        if (typeof item === "string") {
          return normalizeEditorHtml(item);
        }
        const copy = { ...item };
        if (typeof copy.content === "string") {
          copy.content = normalizeEditorHtml(copy.content);
        }
        if (typeof copy.text === "string") {
          copy.text = normalizeEditorHtml(copy.text);
        }
        if (Array.isArray(copy.items)) {
          copy.items = copy.items.map((nested: any) =>
            typeof nested === "string"
              ? normalizeEditorHtml(nested)
              : {
                  ...nested,
                  content: typeof nested.content === "string"
                    ? normalizeEditorHtml(nested.content)
                    : nested.content,
                }
          );
        }
        return copy;
      });
    }
    if (Array.isArray(next.data.content)) {
      next.data.content = next.data.content.map((row: string[]) =>
        row.map((cell) => decodeHtmlEntities(cell))
      );
    }
    if (typeof next.data.code === "string") {
      next.data.code = decodeHtmlEntities(next.data.code);
    }
    if (Array.isArray(next.data.items) && next.type === "toggle") {
      next.data.items = sanitizeEditorJsData({ blocks: next.data.items }).blocks;
    }

    return next;
  });

  return { ...data, blocks };
}

function inlineMarkdownToHtml(text: string): string {
  const decoded = decodeHtmlEntities(text);
  return decoded
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function htmlToInlineMarkdown(html: string): string {
  return decodeHtmlEntities(
    html
    .replace(/<strong><em>(.*?)<\/em><\/strong>/g, "***$1***")
    .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
    .replace(/<em>(.*?)<\/em>/g, "*$1*")
    .replace(/<code>(.*?)<\/code>/g, "`$1`")
    .replace(/<a href="([^"]+)">(.*?)<\/a>/g, "[$2]($1)")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/p>/g, "\n")
    .replace(/<[^>]+>/g, "")
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Extract headings from Editor.js data ───────────────────────
export function extractEditorJsHeadings(data: EditorJsData): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  for (const block of data.blocks || []) {
    if (block.type === "header") {
      headings.push({
        level: block.data.level || 2,
        text: stripHtml(block.data.text || ""),
      });
    }
  }
  return headings;
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ""));
}

// ── Export / Import helpers ───────────────────────────────────
export function editorJsToHtml(data: EditorJsData): string {
  const blocks = data.blocks || [];
  const out: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "header": {
        const level = block.data.level || 2;
        const tag = `h${level}`;
        out.push(`<${tag}>${block.data.text || ""}</${tag}>`);
        break;
      }
      case "paragraph": {
        out.push(`<p>${block.data.text || ""}</p>`);
        break;
      }
      case "list": {
        const items = block.data.items || [];
        const style = block.data.style || "unordered";
        const tag = style === "ordered" ? "ol" : "ul";
        const lis = items.map((item: any) => {
          const content = typeof item === "string" ? item : item.content || "";
          return `<li>${content}</li>`;
        }).join("");
        out.push(`<${tag}>${lis}</${tag}>`);
        break;
      }
      case "checklist": {
        const items = block.data.items || [];
        const lis = items.map((item: any) => {
          const checked = item.checked ? "checked" : "";
          return `<li style="list-style:none;"><input type="checkbox" disabled ${checked} style="margin-right:6px;">${item.text || ""}</li>`;
        }).join("");
        out.push(`<ul>${lis}</ul>`);
        break;
      }
      case "code": {
        const code = escapeHtml(block.data.code || "");
        out.push(`<pre><code>${code}</code></pre>`);
        break;
      }
      case "quote": {
        out.push(`<blockquote>${block.data.text || ""}</blockquote>`);
        break;
      }
      case "image": {
        const url = block.data.url || "";
        const caption = block.data.caption || "";
        out.push(`<img src="${url}" alt="${caption}" />`);
        break;
      }
      case "table": {
        const content = block.data.content || [];
        if (content.length > 0) {
          let html = "<table><thead><tr>";
          const header = content[0];
          header.forEach((c: string) => {
            html += `<th>${c}</th>`;
          });
          html += "</tr></thead><tbody>";
          for (let r = 1; r < content.length; r++) {
            html += "<tr>";
            content[r].forEach((c: string) => {
              html += `<td>${c}</td>`;
            });
            html += "</tr>";
          }
          html += "</tbody></table>";
          out.push(html);
        }
        break;
      }
      case "embed": {
        const embed = block.data.embed || "";
        const caption = block.data.caption || "";
        const width = block.data.width || 580;
        const height = block.data.height || 320;
        if (embed) {
          out.push(`<iframe src="${embed}" width="${width}" height="${height}" frameborder="0" allowfullscreen style="max-width:100%;"></iframe>`);
        }
        if (caption) {
          out.push(`<p style="text-align:center;font-size:13px;color:var(--muted);margin-top:8px;">${caption}</p>`);
        }
        break;
      }
      case "delimiter": {
        out.push("<hr>");
        break;
      }
      case "nestedList": {
        const items = block.data.items || [];
        const style = block.data.style || "unordered";
        const tag = style === "ordered" ? "ol" : "ul";
        const renderNestedHtml = (items: any[]): string => {
          return items.map((item: any) => {
            const content = typeof item === "string" ? item : item.content || "";
            let html = `<li>${content}`;
            if (item.items && item.items.length > 0) {
              html += `<${tag}>${renderNestedHtml(item.items)}</${tag}>`;
            }
            html += "</li>";
            return html;
          }).join("");
        };
        out.push(`<${tag}>${renderNestedHtml(items)}</${tag}>`);
        break;
      }
      case "toggle": {
        const title = block.data.title || "Toggle";
        const items = block.data.items || [];
        let innerHtml = "";
        if (items.length > 0) {
          innerHtml = editorJsToHtml({ time: Date.now(), version: "2.29.0", blocks: items });
        }
        out.push(`<details><summary>${title}</summary><div>${innerHtml}</div></details>`);
        break;
      }
      case "mermaid": {
        const code = escapeHtml(block.data.code || "");
        out.push(`<pre class="mermaid">${code}</pre>`);
        break;
      }
      default:
        break;
    }
  }

  return out.join("\n");
}
