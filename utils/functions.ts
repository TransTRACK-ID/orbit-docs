import { format, parseISO } from "date-fns";

export function roundToDecimal(value: any) {
  if (!value) {
    return "-";
  }
  return (Math.round(value * 10) / 10).toFixed(1);
}

export function formatDate(value: any, outputFormat = "yyyy-MM-dd HH:mm:ss") {
  const date = parseISO(value);
  return format(date, outputFormat);
}

export function changesToFiltersOptions(list: any) {
  if (!list || list.length === 0) return [];

  return list.map((item: any) => ({
    text: item,
    value: item,
  }));
}

export function capitalizeString(str: string, separator: string | null = null) {
  if (!str) return;

  if (!separator) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  } else {
    return str
      .toLowerCase()
      .split(separator)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
  }
}
