import type { NavConfig, NavGroup, NavExternalLink, NavOpenApiOperation } from "~/server/database/schema";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSiteSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function normaliseNavConfig(input: unknown): NavConfig {
  if (!input || typeof input !== "object") return {};
  const cfg = input as Partial<NavConfig>;
  const groups = Array.isArray(cfg.groups) ? cfg.groups.filter(isValidGroup).map(normaliseGroup) : [];
  const pages = Array.isArray(cfg.pages) ? cfg.pages.filter((p) => typeof p === "string") : [];
  const external = Array.isArray(cfg.external) ? cfg.external.filter(isValidExternal).map(normaliseExternal) : [];
  const openapi = Array.isArray(cfg.openapi) ? cfg.openapi.filter(isValidOpenApiOperation).map(normaliseOpenApiOperation) : [];
  return { groups, pages, external, openapi };
}

function isValidOpenApiOperation(o: unknown): o is NavOpenApiOperation {
  return (
    !!o &&
    typeof o === "object" &&
    typeof (o as NavOpenApiOperation).method === "string" &&
    typeof (o as NavOpenApiOperation).path === "string" &&
    typeof (o as NavOpenApiOperation).slug === "string" &&
    typeof (o as NavOpenApiOperation).label === "string"
  );
}

function normaliseOpenApiOperation(o: NavOpenApiOperation): NavOpenApiOperation {
  const out: NavOpenApiOperation = {
    id: typeof o.id === "string" ? o.id : crypto.randomUUID(),
    slug: o.slug,
    method: o.method.toUpperCase(),
    path: o.path,
    label: o.label,
  };
  if (typeof o.operationId === "string") out.operationId = o.operationId;
  if (typeof o.tag === "string") out.tag = o.tag;
  return out;
}

function isValidGroup(g: unknown): g is NavGroup {
  return !!g && typeof g === "object" && typeof (g as NavGroup).label === "string";
}

function normaliseGroup(g: NavGroup): NavGroup {
  const out: NavGroup = {
    id: typeof g.id === "string" ? g.id : crypto.randomUUID(),
    label: g.label,
  };
  if (typeof g.icon === "string") out.icon = g.icon;
  if (typeof g.expanded === "boolean") out.expanded = g.expanded;
  if (Array.isArray(g.pages)) out.pages = g.pages.filter((p) => typeof p === "string");
  if (Array.isArray(g.groups)) out.groups = g.groups.filter(isValidGroup).map(normaliseGroup);
  return out;
}

function isValidExternal(e: unknown): e is NavExternalLink {
  return !!e && typeof e === "object" && typeof (e as NavExternalLink).label === "string" && typeof (e as NavExternalLink).url === "string";
}

function normaliseExternal(e: NavExternalLink): NavExternalLink {
  const out: NavExternalLink = {
    id: typeof e.id === "string" ? e.id : crypto.randomUUID(),
    label: e.label,
    url: e.url,
  };
  if (typeof e.icon === "string") out.icon = e.icon;
  return out;
}

/** Collect every page slug referenced anywhere in a nav config (recursive). */
export function collectReferencedSlugs(cfg: NavConfig): string[] {
  const slugs = new Set<string>();
  const visitGroup = (g: NavGroup) => {
    if (g.pages) g.pages.forEach((p) => slugs.add(p));
    if (g.groups) g.groups.forEach(visitGroup);
  };
  if (cfg.pages) cfg.pages.forEach((p) => slugs.add(p));
  if (cfg.groups) cfg.groups.forEach(visitGroup);
  return [...slugs];
}
