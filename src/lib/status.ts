export type Tone = "green" | "red" | "amber" | "blue" | "slate" | "indigo";

export const poTone = (s: string | null | undefined): Tone =>
  s === "RECEIVED" ? "green" : s === "PARTIALLY_RECEIVED" ? "blue" : s === "ORDERED" ? "amber" : s === "CANCELLED" ? "red" : "slate";

export const label = (s: string | null | undefined) => (s ?? "").replace(/_/g, " ");

export const PO_ACTIONS: Record<string, { status: "ORDERED" | "CANCELLED" | "RECEIVED"; label: string; confirm: string; style: "primary" | "secondary" | "danger" }[]> = {
  DRAFT: [
    { status: "ORDERED", label: "Mark as Ordered", confirm: "Mark this order as sent to the supplier? It can no longer be edited afterwards.", style: "primary" },
    { status: "CANCELLED", label: "Cancel Order", confirm: "Cancel this draft order?", style: "danger" },
  ],
  ORDERED: [
    { status: "RECEIVED", label: "Mark Complete", confirm: "Close this order without receiving more goods?", style: "secondary" },
    { status: "CANCELLED", label: "Cancel Order", confirm: "Cancel this order? Nothing has been received against it.", style: "danger" },
  ],
  PARTIALLY_RECEIVED: [
    { status: "RECEIVED", label: "Mark Complete", confirm: "Close this order? Remaining quantities will not be received.", style: "secondary" },
  ],
};

export const soTone = (s: string | null | undefined): Tone =>
  s === "DELIVERED" || s === "COMPLETED" ? "green" : s === "PARTIALLY_DELIVERED" ? "blue" : s === "CONFIRMED" ? "amber" : s === "CANCELLED" ? "red" : "slate";

export const SO_ACTIONS: Record<string, { status: "CONFIRMED" | "CANCELLED" | "COMPLETED"; label: string; confirm: string; style: "primary" | "secondary" | "danger" }[]> = {
  DRAFT: [
    { status: "CONFIRMED", label: "Confirm Order", confirm: "Confirm this order? It can no longer be edited afterwards.", style: "primary" },
    { status: "CANCELLED", label: "Cancel Order", confirm: "Cancel this draft order?", style: "danger" },
  ],
  CONFIRMED: [
    { status: "COMPLETED", label: "Mark Complete", confirm: "Close this order without delivering the rest?", style: "secondary" },
    { status: "CANCELLED", label: "Cancel Order", confirm: "Cancel this order? Nothing has been delivered yet.", style: "danger" },
  ],
  PARTIALLY_DELIVERED: [
    { status: "COMPLETED", label: "Mark Complete", confirm: "Close this order? Remaining quantities will not be delivered.", style: "secondary" },
  ],
};

export const invTone = (status: string | null | undefined, cancelled?: boolean): Tone => {
  if (cancelled) return "slate";
  return status === "PAID" ? "green" : status === "PARTIALLY_PAID" ? "blue" : status === "UNPAID" ? "amber" : "red";
};
