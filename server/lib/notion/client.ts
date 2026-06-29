const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/** Notion accepts dashed UUIDs; normalize 32-char IDs pasted from URLs. */
export function normalizeNotionId(id: string): string {
  const cleaned = id.replace(/-/g, "").trim();
  if (cleaned.length !== 32) return id.trim();
  return `${cleaned.slice(0, 8)}-${cleaned.slice(8, 12)}-${cleaned.slice(12, 16)}-${cleaned.slice(16, 20)}-${cleaned.slice(20)}`;
}

export type NotionPropertyValue =
  | { type: "title"; title: Array<{ plain_text: string }> }
  | { type: "rich_text"; rich_text: Array<{ plain_text: string }> }
  | { type: "select"; select: { name: string } | null }
  | { type: "multi_select"; multi_select: Array<{ name: string }> }
  | { type: "status"; status: { name: string } | null }
  | { type: "date"; date: { start: string } | null }
  | { type: "number"; number: number | null }
  | { type: "checkbox"; checkbox: boolean }
  | { type: string; [key: string]: unknown };

export interface NotionPage {
  id: string;
  properties: Record<string, NotionPropertyValue>;
  last_edited_time?: string;
}

export interface NotionDatabase {
  id: string;
  title: Array<{ plain_text: string }>;
  properties: Record<string, { id: string; name: string; type: string }>;
}

export interface NotionBlock {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
}

export class NotionApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "NotionApiError";
  }
}

export class NotionClient {
  constructor(private readonly apiKey: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${NOTION_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        (body as { message?: string })?.message ||
        `Notion API error (${res.status})`;
      throw new NotionApiError(message, res.status, body);
    }
    return body as T;
  }

  async getDatabase(databaseId: string): Promise<NotionDatabase> {
    return this.request<NotionDatabase>(`/databases/${normalizeNotionId(databaseId)}`);
  }

  async queryDatabase(databaseId: string): Promise<NotionPage[]> {
    const pages: NotionPage[] = [];
    let cursor: string | undefined;

    do {
      const data = await this.request<{
        results: NotionPage[];
        has_more: boolean;
        next_cursor: string | null;
      }>(`/databases/${normalizeNotionId(databaseId)}/query`, {
        method: "POST",
        body: JSON.stringify({
          page_size: 100,
          start_cursor: cursor,
        }),
      });
      pages.push(...data.results);
      cursor = data.has_more ? data.next_cursor || undefined : undefined;
    } while (cursor);

    return pages;
  }

  async getBlockChildren(blockId: string): Promise<NotionBlock[]> {
    const blocks: NotionBlock[] = [];
    let cursor: string | undefined;

    do {
      const data = await this.request<{
        results: NotionBlock[];
        has_more: boolean;
        next_cursor: string | null;
      }>(`/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
      blocks.push(...data.results);
      cursor = data.has_more ? data.next_cursor || undefined : undefined;
    } while (cursor);

    return blocks;
  }

  async getPageMarkdown(pageId: string): Promise<string> {
    const { blocksToMarkdown } = await import("./blocks-to-markdown");
    const blocks = await this.getBlockChildren(pageId);
    return blocksToMarkdown(blocks, (id) => this.getBlockChildren(id));
  }
}

export function getPlainTextFromProperty(prop: NotionPropertyValue | undefined): string {
  if (!prop) return "";
  switch (prop.type) {
    case "title":
      return prop.title.map((t) => t.plain_text).join("");
    case "rich_text":
      return prop.rich_text.map((t) => t.plain_text).join("");
    case "select":
      return prop.select?.name || "";
    case "status":
      return prop.status?.name || "";
    case "multi_select":
      return prop.multi_select.map((o) => o.name).join(", ");
    case "number":
      return prop.number != null ? String(prop.number) : "";
    case "checkbox":
      return prop.checkbox ? "true" : "false";
    case "date":
      return prop.date?.start || "";
    default:
      return "";
  }
}

export function getTitleFromPage(page: NotionPage): string {
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "title") {
      return getPlainTextFromProperty(prop);
    }
  }
  return "Untitled";
}

export function findPropertyByName(
  properties: Record<string, NotionPropertyValue>,
  name: string
): NotionPropertyValue | undefined {
  const normalized = name.trim().toLowerCase();
  const entry = Object.entries(properties).find(
    ([key]) => key.trim().toLowerCase() === normalized
  );
  return entry?.[1];
}

export function listSelectPropertyNames(database: NotionDatabase): string[] {
  return Object.values(database.properties)
    .filter((p) => p.type === "select" || p.type === "status")
    .map((p) => p.name);
}
