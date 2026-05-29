import { toast } from "vue3-toastify";
import type { ReleaseCategories } from "~/types";

/**
 * Format changelog categories as markdown text
 */
export function formatChangelogMarkdown(
  categories: ReleaseCategories | null,
  opts?: {
    version?: string;
    appName?: string;
    releaseDate?: string | null;
  }
): string {
  const lines: string[] = [];

  if (opts?.version || opts?.appName) {
    const title = [opts.appName, opts.version].filter(Boolean).join(" ");
    lines.push(`# ${title}`);
    lines.push("");
  }

  if (opts?.releaseDate) {
    const d = new Date(opts.releaseDate);
    lines.push(`Released ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`);
    lines.push("");
  }

  if (!categories) {
    return lines.join("\n") || "No changelog available.";
  }

  const categoryOrder = ["added", "changed", "fixed", "deprecated", "security"] as const;
  const categoryLabels: Record<string, string> = {
    added: "Added",
    fixed: "Fixed",
    changed: "Changed",
    deprecated: "Deprecated",
    security: "Security",
  };

  for (const key of categoryOrder) {
    const items = categories[key as keyof ReleaseCategories];
    if (items && items.length > 0) {
      lines.push(`## ${categoryLabels[key] || key}`);
      lines.push("");
      for (const item of items) {
        lines.push(`- ${item}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n").trim();
}

/**
 * Copy text to clipboard with toast feedback
 */
export async function copyToClipboard(text: string, label?: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label ? `${label} copied to clipboard` : "Copied to clipboard");
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      toast.success(label ? `${label} copied to clipboard` : "Copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

/**
 * Copy changelog categories to clipboard
 */
export async function copyChangelogToClipboard(
  categories: ReleaseCategories | null,
  opts?: {
    version?: string;
    appName?: string;
    releaseDate?: string | null;
  }
): Promise<void> {
  const markdown = formatChangelogMarkdown(categories, opts);
  await copyToClipboard(markdown, "Changelog");
}
