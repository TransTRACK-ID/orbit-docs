// Shared UI utility helpers

export const defaultLatLng = [-0.7893, 113.9213]

export function isSameString(value: string, key: string) {
  try {
    return value.toLowerCase().includes(key.toLowerCase());
  } catch (_) {
    return false;
  }
}

export function isEmpty(value: any) {
  return !value || value.length === 0 || value === "";
}

export function constrain(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function timeAgo(dateStr: string | null | undefined, now = new Date()) {
  if (!dateStr) return "";
  const diff = Math.floor((now.getTime() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  const units: [number, number, string][] = [
    [86400, 3600, "hour"],
    [604800, 86400, "day"],
    [2419200, 604800, "week"],
    [Infinity, 2419200, "month"],
  ];
  const [, size, unit] = units.find(([limit]) => diff < limit)!;
  const n = Math.floor(diff / size);
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

export function plainTextPreview(text: string | null | undefined) {
  if (!text) return "";
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, " ")
    .replace(/\\([\\`*_{}[\]()#+\-.!|])/g, "$1")
    .replace(/[|*`~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
