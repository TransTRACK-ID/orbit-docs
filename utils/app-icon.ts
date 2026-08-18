const APP_ICON_HUES = [25, 145, 255, 85, 300, 45, 200, 15];

export function appInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function appIconStyle(name: string): Record<string, string> {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = APP_ICON_HUES[Math.abs(hash) % APP_ICON_HUES.length];
  return {
    background: `color-mix(in oklch, oklch(72% 0.12 ${hue}) 18%, var(--surface))`,
    color: `oklch(42% 0.12 ${hue})`,
  };
}
