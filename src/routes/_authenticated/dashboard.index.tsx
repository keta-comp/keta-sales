import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  ClipboardList,
  ShoppingCart,
  Target,
  TrendingUp,
  UserRoundPlus,
  Wallet,
} from "lucide-react";

import { ErrorState, LoadingState, PageHeader, StatCard, StatusBadge } from "@/components/app/primitives";
import { QuickNewButton } from "@/components/app/crm-dialogs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getMyCrmConfig, getWidgetStats } from "@/lib/crm-config.functions";
import { getDashboardKpis } from "@/lib/workspace.functions";
import { listLeads } from "@/lib/crm.functions";
import { listOrders } from "@/lib/orders.functions";
import { formatMoney } from "@/lib/types";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({
    meta: [
      { title: t("Ish ekrani — NEXORA CRM") },
      {
        name: "description",
        content: t("Bugungi tushum, yangi mijozlar, murojaatlar va bajarilishi kerak bo‘lgan ishlar bir ekranda."),
      },
      { property: "og:title", content: t("Ish ekrani — NEXORA CRM") },
      { property: "og:description", content: t("Biznesingizning bugungi holati real ma’lumotlar asosida.") },
    ],
  }),
  component: Overview,
});

function Overview() {
  const navigate = useNavigate();
  const fetchKpis = useServerFn(getDashboardKpis);
  const fetchLeads = useServerFn(listLeads);
  const fetchOrders = useServerFn(listOrders);
  const fetchConfig = useServerFn(getMyCrmConfig);
  const fetchWidgets = useServerFn(getWidgetStats);

  const kpis = useQuery({ queryKey: ["kpis"], queryFn: () => fetchKpis() });
  const leads = useQuery({ queryKey: ["leads", "recent"], queryFn: () => fetchLeads({ data: {} }) });
  const orders = useQuery({ queryKey: ["orders", "recent"], queryFn: () => fetchOrders({ data: {} }) });
  const crmConfig = useQuery({ queryKey: ["crm-config"], queryFn: () => fetchConfig() });
  const widgetStats = useQuery({
    queryKey: ["crm-widgets"],
    queryFn: () => fetchWidgets(),
    enabled: !!crmConfig.data?.hasConfig,
  });

  useEffect(() => {
    const channel = supabase
      .channel("workspace-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        void kpis.refetch();
        void leads.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void kpis.refetch();
        void orders.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => {
        void kpis.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        void kpis.refetch();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (kpis.isPending) return <LoadingState label={t("Ko‘rsatkichlar yuklanmoqda…")} />;
  if (kpis.error) return <ErrorState error={kpis.error} onRetry={() => void kpis.refetch()} />;

  const data = kpis.data.kpis;
  const todos = kpis.data.todos;
  const currency = data.currency;
  const terms = crmConfig.data?.config?.terminology ?? {};

  return (
    <>
      <PageHeader
        title={t("Ish ekrani")}
        description={t("Bugungi holat — barcha raqamlar bazadagi real ma’lumotlardan.")}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/analytics">{t("Hisobotlar")}</Link>
            </Button>
            <QuickNewButton
              industry={crmConfig.data?.industry}
              stages={crmConfig.data?.config?.pipelineStages}
              size="sm"
            />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={t("Bugungi tushum")}
          value={formatMoney(data.revenueToday, currency)}
          hint={`Bu oy: ${formatMoney(data.revenueMonth, currency)}`}
          icon={<TrendingUp className="size-4" />}
        />
        <StatCard
          label={terms["customer"] ? t("Yangi {v0}", { v0: terms["customer"].toLowerCase() }) : t("Yangi mijozlar")}
          value={data.newCustomers}
          hint={t("Bugun qo‘shilgan")}
          icon={<UserRoundPlus className="size-4" />}
        />
        <StatCard
          label={t("Yangi murojaatlar")}
          value={data.newLeads}
          hint={t("Faol: {v0}", { v0: data.activeLeads })}
          icon={<Target className="size-4" />}
        />
        <StatCard
          label={t("Yangi buyurtmalar")}
          value={data.newOrders}
          hint={t("Bugun yaratilgan")}
          icon={<ShoppingCart className="size-4" />}
        />
        <StatCard
          label={t("Kutilayotgan to‘lovlar")}
          value={formatMoney(data.pendingPaymentsAmount, currency)}
          hint={t("{v0} ta to‘lov", { v0: data.pendingPaymentsCount })}
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label={t("Yaqin vazifalar")}
          value={data.dueTasks}
          hint={t("3 kun ichida bajarilishi kerak")}
          icon={<ClipboardList className="size-4" />}
        />
      </div>

      <section className="clay-panel p-5">
        <h2 className="font-display text-lg font-semibold">{t("Bugun nima qilish kerak?")}</h2>
        {todos.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("Hammasi joyida — kechiktirilgan ish yo‘q.")}
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {todos.map((todo) => (
              <button
                key={todo.key}
                type="button"
                onClick={() =>
                  void navigate({
                    to: todo.to,
                    ...(todo.search ? { search: todo.search } : {}),
                  } as never)
                }
                className="clay-inset clay-hover flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left"
              >
                <span className="text-sm">
                  <span className="font-semibold tabular-nums">{todo.count}</span>{" "}{t("ta")} {t(todo.label)}
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </section>

      {crmConfig.data?.hasConfig && (crmConfig.data.config?.dashboardWidgets?.length ?? 0) > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(crmConfig.data.config?.dashboardWidgets ?? []).map((widget) => (
            <StatCard
              key={widget.key}
              label={t(widget.label)}
              value={
                widget.kind === "legacy_today_revenue" || widget.kind === "field_sum"
                  ? formatMoney(widgetStats.data?.widgets?.[widget.key] ?? 0, currency)
                  : (widgetStats.data?.widgets?.[widget.key] ?? 0)
              }
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="clay-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">{t("Oxirgi murojaatlar")}</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard/leads">{t("Barchasi")}</Link>
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {(leads.data ?? []).slice(0, 5).map((lead) => {
              const customer = lead.customers as { full_name: string | null } | null;
              return (
                <div key={lead.id} className="clay-inset flex items-center justify-between gap-3 rounded-2xl px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {customer?.full_name ?? "Ismsiz mijoz"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lead.requested_product ?? "—"}
                    </p>
                  </div>
                  <StatusBadge value={lead.status} />
                </div>
              );
            })}
            {(leads.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("Hozircha murojaat yo‘q.")}</p>
            ) : null}
          </div>
        </section>

        <section className="clay-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">{t("Oxirgi buyurtmalar")}</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard/orders">{t("Barchasi")}</Link>
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {(orders.data ?? []).slice(0, 5).map((order) => (
              <div key={order.id} className="clay-inset flex items-center justify-between gap-3 rounded-2xl px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">#{order.order_number}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatMoney(order.total, currency)}
                  </p>
                </div>
                <StatusBadge value={order.status} />
              </div>
            ))}
            {(orders.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("Hozircha buyurtma yo‘q.")}</p>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
