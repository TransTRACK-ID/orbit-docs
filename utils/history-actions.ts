export function getHistoryActionLabel(action: string): string {
  switch (action) {
    case "publish":
    case "quick_release":
    case "article_release":
      return "Published";
    case "restore":
      return "Restored";
    default:
      return "Saved";
  }
}

export function getHistoryActionClass(action: string): string {
  switch (action) {
    case "publish":
    case "quick_release":
    case "article_release":
      return "pill-green";
    case "restore":
      return "pill-purple";
    default:
      return "pill-muted";
  }
}

export function isPublishAction(action: string): boolean {
  return action === "publish" || action === "quick_release" || action === "article_release";
}

export function formatDiffVersionLabel(
  action: string,
  actor: string | null,
  createdAt: string | null,
): string {
  const time = createdAt
    ? new Date(createdAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const who = actor || "Unknown";
  return `${getHistoryActionLabel(action)} · ${who} · ${time}`;
}
