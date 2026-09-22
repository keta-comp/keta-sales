import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader, StatCard, StatusBadge } from "@/components/app/primitives";
import { PaymentDialog } from "@/components/app/crm-dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { crmLabel, PAYMENT_METHODS, PAYMENT_RECORD_STATUSES } from "@/lib/crm-core";
import { deletePayment, listPayments } from "@/lib/payments.functions";
import { formatMoney } from "@/lib/types";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/payments")({
  head: () => ({
    meta: [
      { title: t("To‘lovlar — NEXORA CRM") },
      { name: "description", content: t("Kirim-chiqim, qarzdorlik va to‘lov usullari bo‘yicha hisob.") },
      { property: "og:title", content: t("To‘lovlar — NEXORA CRM") },
      { property: "og:description", content: t("To‘lovlarni qayd qiling va qarzdorlikni kuzatib boring.") },
    ],
  }),
  component: PaymentsPage,
});

type PaymentRow = Awaited<ReturnType<typeof listPayments>>[number];

function PaymentsPage() {
  const fetchPayments = useServerFn(listPayments);
  const remove = useServerFn(deletePayment);
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PaymentRow | null>(null);
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["payments", status, method, search],
    queryFn: () => fetchPayments({ data: { status, method, search } }),
  });

  const totals = useMemo(() => {
    const rows = query.data ?? [];
    const paid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);
    const pending = rows
      .filter((r) => r.status === "pending" || r.status === "partial")
      .reduce((s, r) => s + Number(r.amount), 0);
    return { paid, pending, count: rows.length };
  }, [query.data]);

  const currency = "UZS";

  return (
    <>
      <PageHeader
        title={t("To‘lovlar")}
        description={t("Har bir to‘lov mijoz va buyurtma bilan bog‘lanadi.")}
        actions={
          <Button
            size="sm"
            className="gap-1"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> {t("Yangi to‘lov")}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("To‘langan")} value={formatMoney(totals.paid, currency)} />
        <StatCard label={t("Kutilmoqda")} value={formatMoney(totals.pending, currency)} />
        <StatCard label={t("Yozuvlar")} value={totals.count} />
      </div>

      <div className="clay-panel flex flex-wrap items-center gap-2 p-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Mijoz, buyurtma yoki izoh…")}
          className="h-9 w-full sm:w-64"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder={t("Holat")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("Barcha holat")}</SelectItem>
            {PAYMENT_RECORD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {crmLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder={t("Usul")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("Barcha usul")}</SelectItem>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {crmLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isPending ? (
        <LoadingState label={t("To‘lovlar yuklanmoqda…")} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          title={t("To‘lov topilmadi")}
          description={t("Birinchi to‘lovni qo‘shib, kassani yuritishni boshlang.")}
        />
      ) : (
        <div className="clay-panel overflow-x-auto p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Mijoz")}</TableHead>
                <TableHead>{t("Buyurtma")}</TableHead>
                <TableHead>{t("Summa")}</TableHead>
                <TableHead>{t("Usul")}</TableHead>
                <TableHead>{t("Holat")}</TableHead>
                <TableHead>{t("Sana")}</TableHead>
                <TableHead className="text-right">{t("Amal")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data ?? []).map((row) => {
                const customer = row.customers as { full_name: string | null } | null;
                const order = row.orders as { order_number: string | null } | null;
                const methodLabel = crmLabel(row.method);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{customer?.full_name ?? "—"}</TableCell>
                    <TableCell>{order?.order_number ? `#${order.order_number}` : "—"}</TableCell>
                    <TableCell className="tabular-nums">{formatMoney(row.amount, currency)}</TableCell>
                    <TableCell>{methodLabel}</TableCell>
                    <TableCell>
                      <StatusBadge value={row.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.paid_at ?? row.created_at).toLocaleDateString("uz-UZ")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("Tahrirlash")}
                          onClick={() => {
                            setEditing(row);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("O‘chirish")}
                          onClick={async () => {
                            if (!window.confirm(t("To‘lovni o‘chirasizmi?"))) return;
                            try {
                              await remove({ data: { id: row.id } });
                              toast.success(t("To‘lov o‘chirildi"));
                              void query.refetch();
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : t("Xatolik"));
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PaymentDialog
        open={open}
        onOpenChange={setOpen}
        payment={
          editing
            ? {
                id: editing.id,
                customer_id: editing.customer_id,
                order_id: editing.order_id,
                amount: String(editing.amount),
                method: editing.method,
                status: editing.status as "pending" | "paid" | "partial" | "refunded",
                due_date: editing.due_date,
                note: editing.note,
              }
            : undefined
        }
        label={editing ? t("To‘lovni tahrirlash") : t("Yangi to‘lov")}
      />
    </>
  );
}
