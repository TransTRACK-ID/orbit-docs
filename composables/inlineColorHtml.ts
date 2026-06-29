/** Shared helpers for inline text color markup in editor ↔ markdown ↔ preview. */

export const SAFE_INLINE_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isSafeInlineColor(color: string): boolean {
  return SAFE_INLINE_COLOR_RE.test(color.trim());
}

export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (!value) return false;
  if (/^(https?:\/\/|\/|#|mailto:)/i.test(value)) return true;
  return !/^[a-z][a-z0-9+.-]*:/i.test(value);
}

export function hasColorMarkup(html: string): boolean {
  return /<font\b/i.test(html) || /style="color:/i.test(html);
}

export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

export function serializeAnchorOpenTag(el: Pick<Element, "getAttribute">): string {
  const href = el.getAttribute("href") || "";
  if (!href) return "";

  const parts = [`href="${escapeHtmlAttr(href)}"`];
  for (const attr of ["target", "rel", "title"] as const) {
    const value = el.getAttribute(attr);
    if (value) parts.push(`${attr}="${escapeHtmlAttr(value)}"`);
  }
  return `<a ${parts.join(" ")}>`;
}

export function serializeColoredFont(el: Element, inner: string): string {
  const color = (el.getAttribute("color") || (el as HTMLElement).style?.color || "").trim();
  if (!isSafeInlineColor(color)) return inner;
  return `<font color="${color}">${inner}</font>`;
}

export function serializeColoredSpan(el: HTMLElement, inner: string): string {
  const color = el.style.color?.trim() || "";
  if (!isSafeInlineColor(color)) return inner;
  return `<span style="color:${color}">${inner}</span>`;
}

/** Allow only color-related inline HTML through the markdown preview escaper. */
export function allowColorHtmlInMarkdown(text: string): string {
  const trimmed = text.trim();
  const openAnchor = trimmed.match(
    /^<a\s+href="([^"]+)"(?:\s+target="_blank")?(?:\s+rel="[^"]*")?\s*>$/i
  );
  if (openAnchor) {
    return isSafeHref(openAnchor[1])
      ? text
      : escapePreviewHtml(text);
  }
  if (/^<font\s+color="(#[0-9a-fA-F]{3,6})"\s*>$/i.test(trimmed)) {
    return text;
  }
  if (/^<span\s+style="color:\s*(#[0-9a-fA-F]{3,6})"\s*>$/i.test(trimmed)) {
    return text;
  }
  if (/^<\/(?:a|font|span)\s*>$/i.test(trimmed)) {
    return text;
  }
  return escapePreviewHtml(text);
}

export function escapePreviewHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
