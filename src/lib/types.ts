export type LeadStatus =
  | "new"
  | "needs_operator"
  | "assigned"
  | "contacted"
  | "negotiating"
  | "won"
  | "lost";
export type LeadScore = "hot" | "warm" | "cold";
export type OrderStatus =
  | "new"
  | "confirming"
  | "confirmed"
  | "preparing"
  | "delivered"
  | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "needs_operator",
  "assigned",
  "contacted",
  "negotiating",
  "won",
  "lost",
];
export const LEAD_SCORES: LeadScore[] = ["hot", "warm", "cold"];
export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "confirming",
  "confirmed",
  "preparing",
  "delivered",
  "cancelled",
];
export const PAYMENT_STATUSES: PaymentStatus[] = ["unpaid", "partial", "paid", "refunded"];

/** Uzbek display labels for backend status/score values. Never send these to the API. */
export const STATUS_LABELS: Record<string, string> = {
  new: "Yangi",
  needs_operator: "Operator kerak",
  assigned: "Tayinlangan",
  contacted: "Bog'lanildi",
  negotiating: "Muzokara",
  won: "Yopildi",
  lost: "Yo'qotildi",
  hot: "Qaynoq",
  warm: "Iliq",
  cold: "Sovuq",
  confirming: "Tasdiqlanmoqda",
  confirmed: "Tasdiqlangan",
  preparing: "Tayyorlanmoqda",
  delivered: "Yetkazildi",
  cancelled: "Bekor qilindi",
  unpaid: "To'lanmagan",
  partial: "Qismiy to'lov",
  paid: "To'langan",
  refunded: "Qaytarilgan",
  in_stock: "Omborda",
  low_stock: "Kam qoldi",
  out_of_stock: "Tugagan",
  ai: "AI",
  human: "Operator",
};

export function statusLabel(value: string | null | undefined) {
  const key = (value ?? "").toLowerCase();
  return STATUS_LABELS[key] ?? key.replace(/_/g, " ");
}

export function formatMoney(value: number | string | null | undefined, currency = "UZS") {
  const n = Number(value ?? 0);
  return `${new Intl.NumberFormat("en-US").format(Math.round(n))} ${currency}`;
}

export function stockState(stock: number, reserved: number, threshold: number) {
  const free = stock - reserved;
  if (free <= 0) return "out_of_stock" as const;
  if (free <= threshold) return "low_stock" as const;
  return "in_stock" as const;
}