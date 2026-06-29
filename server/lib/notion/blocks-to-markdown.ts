import type { NotionBlock } from "./client";

type BlockFetcher = (blockId: string) => Promise<NotionBlock[]>;

function richText(block: NotionBlock): string {
  const data = block[block.type] as { rich_text?: Array<{ plain_text: string }> } | undefined;
  return data?.rich_text?.map((t) => t.plain_text).join("") || "";
}

function escapeMd(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>])/g, "\\$1");
}

async function renderBlocks(
  blocks: NotionBlock[],
  fetchChildren: BlockFetcher,
  depth = 0
): Promise<string> {
  const lines: string[] = [];

  for (const block of blocks) {
    const type = block.type;
    switch (type) {
      case "paragraph": {
        const text = richText(block);
        if (text) lines.push(text);
        else lines.push("");
        break;
      }
      case "heading_1":
        lines.push(`# ${richText(block)}`);
        break;
      case "heading_2":
        lines.push(`## ${richText(block)}`);
        break;
      case "heading_3":
        lines.push(`### ${richText(block)}`);
        break;
      case "bulleted_list_item":
        lines.push(`${"  ".repeat(depth)}- ${richText(block)}`);
        break;
      case "numbered_list_item":
        lines.push(`${"  ".repeat(depth)}1. ${richText(block)}`);
        break;
      case "to_do": {
        const checked = (block.to_do as { checked?: boolean })?.checked;
        lines.push(`${"  ".repeat(depth)}- [${checked ? "x" : " "}] ${richText(block)}`);
        break;
      }
      case "quote":
        lines.push(`> ${richText(block)}`);
        break;
      case "code": {
        const lang = (block.code as { language?: string })?.language || "";
        lines.push("```" + lang);
        lines.push(richText(block));
        lines.push("```");
        break;
      }
      case "divider":
        lines.push("---");
        break;
      case "image": {
        const image = block.image as {
          type?: string;
          external?: { url?: string };
          file?: { url?: string };
          caption?: Array<{ plain_text: string }>;
        };
        const url = image?.external?.url || image?.file?.url || "";
        const alt = image?.caption?.map((c) => c.plain_text).join("") || "image";
        if (url) lines.push(`![${escapeMd(alt)}](${url})`);
        break;
      }
      case "callout":
        lines.push(`> ${richText(block)}`);
        break;
      case "toggle":
        lines.push(`**${richText(block)}**`);
        break;
      default:
        if (richText(block)) lines.push(richText(block));
        break;
    }

    if (block.has_children) {
      const children = await fetchChildren(block.id);
      const childMd = await renderBlocks(children, fetchChildren, depth + 1);
      if (childMd) lines.push(childMd);
    }
  }

  return lines.join("\n\n").trim();
}

export async function blocksToMarkdown(
  blocks: NotionBlock[],
  fetchChildren: BlockFetcher
): Promise<string> {
  return renderBlocks(blocks, fetchChildren);
}

/** Parse release category lines from markdown body (Added/Fixed/Changed sections). */
export function parseReleaseCategories(markdown: string): {
  added: string[];
  fixed: string[];
  changed: string[];
  deprecated: string[];
  security: string[];
} {
  const categories = {
    added: [] as string[],
    fixed: [] as string[],
    changed: [] as string[],
    deprecated: [] as string[],
    security: [] as string[],
  };

  const sectionMap: Record<string, keyof typeof categories> = {
    added: "added",
    fixed: "fixed",
    changed: "changed",
    deprecated: "deprecated",
    security: "security",
  };

  let current: keyof typeof categories | null = null;
  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    const heading = line.match(/^#{1,3}\s+(.+)$/i);
    if (heading) {
      const key = heading[1].trim().toLowerCase();
      current = sectionMap[key] || null;
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet && current) {
      categories[current].push(bullet[1].trim());
    }
  }

  return categories;
}
