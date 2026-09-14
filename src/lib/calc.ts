export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

export type LineLike = {
  quantity: number;
  unitPrice: number;
  discount?: number; // line discount amount
  taxRate?: number; // percent
  transport?: number; // transportation charge added on top of the line total
};

/**
 * Line total = (quantity x unit price - discount) + tax + transport.
 * Transport is a pass-through charge: it is added to the customer's total but is
 * not itself taxed, and it is not part of the item value or cost of goods.
 */
export function calcLine(line: LineLike) {
  const qty = Number(line.quantity) || 0;
  const price = Number(line.unitPrice) || 0;
  const discount = Math.min(Math.max(Number(line.discount) || 0, 0), qty * price);
  const taxRate = Math.max(Number(line.taxRate) || 0, 0);
  const transport = Math.max(Number(line.transport) || 0, 0);
  const gross = round2(qty * price);
  const net = round2(gross - discount);
  const tax = round2((net * taxRate) / 100);
  const total = round2(net + tax + transport);
  return { gross, discount: round2(discount), net, tax, transport: round2(transport), total };
}

export function calcTotals(lines: LineLike[]) {
  let subtotal = 0;
  let discount = 0;
  let tax = 0;
  let transport = 0;
  let total = 0;
  for (const l of lines) {
    const c = calcLine(l);
    subtotal += c.gross;
    discount += c.discount;
    tax += c.tax;
    transport += c.transport;
    total += c.total;
  }
  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    tax: round2(tax),
    transport: round2(transport),
    total: round2(total),
  };
}

/** Parses "yyyy-mm-dd" from a date input into a local-noon Date (avoids timezone day shifts). */
export function parseDateInput(value: string | null | undefined, fallback: Date | null = new Date()): Date | null {
  if (!value) return fallback;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return fallback;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const todayInput = () => toDateInput(new Date());

export const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Digital Wallet", "Other"] as const;
