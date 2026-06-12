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
