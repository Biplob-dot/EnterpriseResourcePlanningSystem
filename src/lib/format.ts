export const CURRENCY = "Rs.";

export function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function money(value: unknown): string {
  const n = num(value);
  return `${CURRENCY} ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function qty(value: unknown): string {
  const n = num(value);
  const rounded = Math.round(n * 10000) / 10000;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function dateShort(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function dateTime(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return `${dateShort(d)} ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Sheet area in sq.ft from length/width given in feet. */
export function sheetArea(lengthFt: unknown, widthFt: unknown): number {
  const l = num(lengthFt);
  const w = num(widthFt);
  if (l <= 0 || w <= 0) return 0;
  return Math.round(l * w * 100) / 100;
}
