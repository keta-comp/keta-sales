import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export function fmtNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("uz-UZ").format(value);
}

export function fmtMoney(value: number | null | undefined, currency = "UZS") {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("uz-UZ").format(Math.round(value))} ${currency}`;
}

export function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtDay(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "Ma'lumot yo'q" — never a fabricated number. */
export function NoData({ label = "Ma’lumot hali yo‘q" }: { label?: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>;
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("clay-panel p-5", className)}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="font-display text-base font-semibold">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string | undefined;
  icon?: ReactNode | undefined;
}) {
  return (
    <div className="clay-panel clay-hover p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon ? <span className="clay-inset grid size-8 place-items-center">{icon}</span> : null}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  active: "Faol",
  trial: "Sinov",
  suspended: "Bloklangan",
  cancelled: "Bekor qilingan",
  pending: "Kutilmoqda",
  success: "Muvaffaqiyatli",
  failure: "Xatolik",
};

export function Pill({ value, tone }: { value: string | null | undefined; tone?: "muted" | "danger" | "ok" }) {
  const key = (value ?? "").toLowerCase();
  const resolved =
    tone ??
    (key === "suspended" || key === "cancelled" || key === "failure"
      ? "danger"
      : key === "active" || key === "success"
        ? "ok"
        : "muted");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        resolved === "danger" && "border-destructive/30 bg-destructive/10 text-destructive",
        resolved === "ok" && "border-border bg-muted text-foreground",
        resolved === "muted" && "border-border bg-muted/60 text-muted-foreground",
      )}
    >
      {t(STATUS_LABELS[key] ?? value ?? "—")}
    </span>
  );
}

export function DataTable({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">{children}</tbody>
      </table>
    </div>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value ?? "—"}</p>
    </div>
  );
}

export function downloadBase64Xlsx(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
