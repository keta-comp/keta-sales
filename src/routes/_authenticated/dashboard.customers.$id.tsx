import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ErrorState, LoadingState, StatCard, StatusBadge } from "@/components/app/primitives";
import { CustomerDialog, PaymentDialog, TaskDialog } from "@/components/app/crm-dialogs";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { crmLabel } from "@/lib/crm-core";
import { deleteCrmCustomer, getCustomerProfile } from "@/lib/customers.functions";
import { formatMoney } from "@/lib/types";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/customers/$id")({
  head: () => ({
    meta: [
      { title: t("Mijoz profili — NEXORA CRM") },
      {
        name: "description",
        content: t("Mijozning murojaatlari, buyurtmalari, to‘lovlari, vazifalari va aloqa tarixi."),
      },
      { property: "og:title", content: t("Mijoz profili — NEXORA CRM") },
      { property: "og:description", content: t("Bitta ekranda mijoz haqida hamma narsa.") },
    ],
  }),
  component: CustomerProfile,
});

function CustomerProfile() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getCustomerProfile);
  const remove = useServerFn(deleteCrmCustomer);
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  const query = useQuery({
    queryKey: ["customer-profile", id],
    queryFn: () => fetchProfile({ data: { id } }),
  });

  if (query.isPending) return <LoadingState label={t("Profil yuklanmoqda…")} />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const { customer, leads, orders, payments, tasks, activities, conversations } = query.data;
  const operator = customer.operators as { full_name: string | null } | null;
  const currency = "UZS";
  const paid = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const debt = payments
    .filter((p) => p.status === "pending" || p.status === "partial")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" aria-label={t("Orqaga")}>
            <Link to="/dashboard/customers">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-2xl font-semibold">{customer.full_name ?? "Ismsiz mijoz"}</h1>
            <p className="text-sm text-muted-foreground">
              {[customer.phone, customer.email, customer.location].filter(Boolean).join(" • ") ||
                "Aloqa ma’lumoti kiritilmagan"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge value={customer.status} />
              <span className="text-xs text-muted-foreground">{t("Manba:")}{" "}{crmLabel(customer.source)}</span>
              {operator?.full_name ? (
                <span className="text-xs text-muted-foreground">{t("Mas’ul:")}{" "}{operator.full_name}</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setTaskOpen(true)}>
            <Plus className="size-4" /> {t("Vazifa")}
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setPaymentOpen(true)}>
            <Plus className="size-4" /> {t("To‘lov")}
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> {t("Tahrirlash")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            onClick={async () => {
              if (!window.confirm(t("Mijozni o‘chirasizmi? Bu amalni qaytarib bo‘lmaydi."))) return;
              try {
                await remove({ data: { id } });
                toast.success(t("Mijoz o‘chirildi"));
                void navigate({ to: "/dashboard/customers" });
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t("Xatolik"));
              }
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("Buyurtmalar")} value={customer.total_orders} />
        <StatCard label={t("Umumiy xarid")} value={formatMoney(customer.total_spent, currency)} />
        <StatCard label={t("To‘langan")} value={formatMoney(paid, currency)} />
        <StatCard label={t("Qarzdorlik")} value={formatMoney(debt, currency)} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">{t("Umumiy")}</TabsTrigger>
          <TabsTrigger value="leads">{t("Murojaatlar (")}{leads.length})</TabsTrigger>
          <TabsTrigger value="orders">{t("Buyurtmalar (")}{orders.length})</TabsTrigger>
          <TabsTrigger value="payments">{t("To‘lovlar (")}{payments.length})</TabsTrigger>
          <TabsTrigger value="tasks">{t("Vazifalar (")}{tasks.length})</TabsTrigger>
          <TabsTrigger value="activity">{t("Tarix")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="clay-panel mt-3 space-y-3 p-5">
          <Field label={t("Izoh")} value={customer.notes || "—"} />
          <Field
            label={t("Oxirgi aloqa")}
            value={
              customer.last_contact_at
                ? new Date(customer.last_contact_at).toLocaleString("uz-UZ")
                : new Date(customer.last_interaction_at).toLocaleString("uz-UZ")
            }
          />
          <Field label="Telegram" value={customer.telegram_username ? `@${customer.telegram_username}` : "—"} />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Suhbatlar")}</p>
            <div className="mt-2 space-y-2">
              {conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("Suhbat yo‘q.")}</p>
              ) : (
                conversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    to="/dashboard/conversations"
                    className="clay-inset clay-hover block rounded-2xl px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{crmLabel(conversation.channel)}</span>
                    <span className="ml-2 text-muted-foreground">
                      {conversation.last_message_preview ?? "—"}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leads" className="mt-3 space-y-2">
          {leads.length === 0 ? (
            <Empty text="Murojaat yo‘q." />
          ) : (
            leads.map((lead) => (
              <Row
                key={lead.id}
                title={lead.requested_product ?? "Murojaat"}
                subtitle={[
                  lead.stage,
                  lead.value ? formatMoney(lead.value, currency) : null,
                  new Date(lead.created_at).toLocaleDateString("uz-UZ"),
                ]
                  .filter(Boolean)
                  .join(" • ")}
                badge={lead.status}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-3 space-y-2">
          {orders.length === 0 ? (
            <Empty text="Buyurtma yo‘q." />
          ) : (
            orders.map((order) => (
              <Row
                key={order.id}
                title={`#${order.order_number}`}
                subtitle={`${formatMoney(order.total, currency)} • ${new Date(
                  order.created_at,
                ).toLocaleDateString("uz-UZ")}`}
                badge={order.status}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-3 space-y-2">
          {payments.length === 0 ? (
            <Empty text="To‘lov yo‘q." />
          ) : (
            payments.map((payment) => (
              <Row
                key={payment.id}
                title={formatMoney(payment.amount, currency)}
                subtitle={`${crmLabel(payment.method)} • ${new Date(
                  payment.paid_at ?? payment.created_at,
                ).toLocaleDateString("uz-UZ")}${payment.note ? ` • ${payment.note}` : ""}`}
                badge={payment.status}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-3 space-y-2">
          {tasks.length === 0 ? (
            <Empty text="Vazifa yo‘q." />
          ) : (
            tasks.map((task) => (
              <Row
                key={task.id}
                title={task.title}
                subtitle={
                  task.due_date
                    ? t("Muddat: {v0}", { v0: new Date(task.due_date).toLocaleDateString("uz-UZ") })
                    : t("Muddat belgilanmagan")
                }
                badge={task.status}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-3 space-y-2">
          {activities.length === 0 ? (
            <Empty text="Tarix bo‘sh." />
          ) : (
            activities.map((activity) => (
              <Row
                key={activity.id}
                title={activity.detail ?? activity.action}
                subtitle={`${activity.actor} • ${new Date(activity.created_at).toLocaleString("uz-UZ")}`}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <CustomerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={{
          id: customer.id,
          full_name: customer.full_name,
          phone: customer.phone,
          email: customer.email,
          location: customer.location,
          status: customer.status,
          source: customer.source,
          assigned_operator_id: customer.assigned_operator_id,
          notes: customer.notes,
        }}
        title={t("Mijozni tahrirlash")}
      />
      <PaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} defaultCustomerId={id} />
      <TaskDialog open={taskOpen} onOpenChange={setTaskOpen} defaultCustomerId={id} />
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="clay-panel p-5 text-sm text-muted-foreground">{text}</p>;
}

function Row({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: string | null;
}) {
  return (
    <div className="clay-panel flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {badge ? <StatusBadge value={badge} /> : null}
    </div>
  );
}
