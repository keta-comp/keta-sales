import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { listOperators, listOrders, updateOrder } from "@/lib/orders.functions";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  formatMoney,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/types";
import { t } from "@/lib/i18n";

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Yangi",
  confirming: "Tasdiqlanmoqda",
  confirmed: "Tasdiqlangan",
  preparing: "Tayyorlanmoqda",
  delivered: "Yetkazildi",
  cancelled: "Bekor qilindi",
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "To'lanmagan",
  partial: "Qisman to'langan",
  paid: "To'langan",
  refunded: "Qaytarilgan",
};

export const Route = createFileRoute("/_authenticated/dashboard/orders")({
  head: () => ({
    meta: [
      { title: t("Buyurtmalar — NEXORA CRM") },
      { name: "description", content: t("AI agenti Telegramda yakunlagan buyurtmalarni kuzating va bajaring.") },
      { property: "og:title", content: t("Buyurtmalar — NEXORA CRM") },
      { property: "og:description", content: t("Avtomatik ombor zaxirasi bilan buyurtmalarni bajarish.") },
    ],
  }),
  component: OrdersPage,
});

type OrderPatch = {
  id: string;
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  assigned_operator_id?: string | null;
};

function OrdersPage() {
  const queryClient = useQueryClient();
  const fetchOrders = useServerFn(listOrders);
  const fetchOperators = useServerFn(listOperators);
  const save = useServerFn(updateOrder);

  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const orders = useQuery({
    queryKey: ["orders", status, search],
    queryFn: () => fetchOrders({ data: { status, search } }),
  });
  const operators = useQuery({ queryKey: ["operators"], queryFn: () => fetchOperators() });

  useEffect(() => {
    const channel = supabase
      .channel("orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const mutation = useMutation({
    mutationFn: (input: OrderPatch) => save({ data: input }),
    onSuccess: () => {
      toast.success(t("Buyurtma yangilandi"));
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : t("Yangilash amalga oshmadi")),
  });

  return (
    <>
      <PageHeader
        title={t("Buyurtmalar")}
        description={t("Buyurtmani tasdiqlash ombordan zaxiralaydi; bekor qilish uni bo'shatadi — bu ma'lumotlar bazasida avtomatik amalga oshadi.")}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Label htmlFor="order-search">{t("Buyurtma raqamini qidirish")}</Label>
          <Input
            id="order-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("ORD-")}
          />
        </div>
        <div className="w-44">
          <Label>{t("Holat")}</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Barcha holatlar")}</SelectItem>
              {ORDER_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(ORDER_STATUS_LABELS[value])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {orders.isPending ? (
        <LoadingState />
      ) : orders.error ? (
        <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
      ) : orders.data.length === 0 ? (
        <EmptyState title={t("Hali buyurtmalar yo'q")} description={t("AI agenti yoki operator savdoni yakunlaganda buyurtmalar shu yerda paydo bo'ladi.")} />
      ) : (
        <div className="space-y-4">
          {orders.data.map((order) => {
            const customer = order.customers as { full_name: string | null; telegram_username: string | null } | null;
            const items = (order.order_items ?? []) as {
              id: string;
              product_name: string;
              quantity: number;
              line_total: number;
            }[];
            return (
              <div key={order.id} className="clay-panel clay-hover p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display text-base font-semibold text-foreground">{order.order_number}</p>
                      <StatusBadge value={order.status} />
                      <StatusBadge value={order.payment_status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {customer?.full_name ?? customer?.telegram_username ?? "Telegram mijozi"} ·{" "}
                      {order.phone ?? "telefon yo'q"} · {new Date(order.created_at).toLocaleString()}
                    </p>
                    {order.delivery_address ? (
                      <p className="text-sm text-muted-foreground">{t("Yetkazib berish manzili:")}{" "}{order.delivery_address}</p>
                    ) : null}
                  </div>
                  <p className="font-display text-lg font-semibold tabular-nums text-success">
                    {formatMoney(order.total)}
                  </p>
                </div>

                <ul className="clay-inset mt-3 space-y-1 rounded-xl p-3 text-sm">
                  {items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2 text-muted-foreground">
                      <span>
                        {item.product_name} × {item.quantity}
                      </span>
                      <span className="tabular-nums">{formatMoney(item.line_total)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>{t("Buyurtma holati")}</Label>
                    <Select
                      value={order.status}
                      onValueChange={(value) => mutation.mutate({ id: order.id, status: value as OrderStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {t(ORDER_STATUS_LABELS[value])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("To'lov")}</Label>
                    <Select
                      value={order.payment_status}
                      onValueChange={(value) =>
                        mutation.mutate({ id: order.id, payment_status: value as PaymentStatus })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_STATUSES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {t(PAYMENT_STATUS_LABELS[value])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("Operator")}</Label>
                    <Select
                      value={order.assigned_operator_id ?? "none"}
                      onValueChange={(value) =>
                        mutation.mutate({
                          id: order.id,
                          assigned_operator_id: value === "none" ? null : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("Biriktirilmagan")}</SelectItem>
                        {(operators.data ?? []).map((operator) => (
                          <SelectItem key={operator.id} value={operator.id}>
                            {operator.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
