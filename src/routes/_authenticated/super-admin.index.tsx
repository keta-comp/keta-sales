import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Building2, Database, TrendingUp, Users, Wallet } from "lucide-react";

import { ErrorState, LoadingState, PageHeader } from "@/components/app/primitives";
import { DataTable, Field, MetricCard, NoData, Panel, fmtMoney, fmtNumber } from "@/components/app/super-admin-ui";
import { getPlatformOverview } from "@/lib/super-admin.functions";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/super-admin/")({
  head: () => ({
    meta: [
      { title: t("Control Center — NEXORA CRM") },
      { name: "description", content: t("NEXORA CRM platformasining umumiy ko‘rsatkichlari: organizationlar, foydalanuvchilar, AI ishlatilishi.") },
      { property: "og:title", content: t("Control Center — NEXORA CRM") },
      { property: "og:description", content: t("NEXORA CRM platforma darajasidagi real ko‘rsatkichlar.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const load = useServerFn(getPlatformOverview);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["super-admin-overview"],
    queryFn: () => load(),
  });

  if (isPending) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data) return <NoData />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("NEXORA CRM Control Center")}
        description={t("Platforma darajasidagi barcha ko‘rsatkichlar — faqat haqiqiy bazadagi ma’lumot.")}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t("Jami organization")} value={fmtNumber(data.organizations.total)} icon={<Building2 className="size-4" />} hint={t("Faol: {v0}", { v0: data.organizations.active })} />
        <MetricCard label={t("Bloklangan")} value={fmtNumber(data.organizations.suspended)} hint={t("Sinov: {v0}", { v0: data.organizations.trial })} />
        <MetricCard label={t("Jami foydalanuvchi")} value={fmtNumber(data.users.total)} icon={<Users className="size-4" />} hint={t("Faol: {v0}", { v0: data.users.active })} />
        <MetricCard label={t("7 kunda faol")} value={fmtNumber(data.users.activeLast7Days)} hint={t("Bu oy yangi: {v0}", { v0: data.users.newThisMonth })} />
        <MetricCard label={t("Bugun yangi organization")} value={fmtNumber(data.organizations.newToday)} icon={<TrendingUp className="size-4" />} />
        <MetricCard label={t("Bu oy yangi organization")} value={fmtNumber(data.organizations.newThisMonth)} />
        <MetricCard label={t("AI so‘rovlari (jami)")} value={fmtNumber(data.ai.total)} icon={<Bot className="size-4" />} hint={t("Bugun: {v0} · Bu oy: {v1}", { v0: data.ai.today, v1: data.ai.thisMonth })} />
        <MetricCard label={t("Jami yozuvlar")} value={fmtNumber(data.storage.totalRecords)} icon={<Database className="size-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("Moliya")} description={t("Bizneslarning CRM ichidagi haqiqiy tushumi. Platforma obunasi hali ulanmagan.")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Bizneslar tushumi (jami)")} value={fmtMoney(data.revenue.crmTurnoverTotal)} />
            <Field label={t("Bizneslar tushumi (bu oy)")} value={fmtMoney(data.revenue.crmTurnoverThisMonth)} />
            <Field label={t("Obuna tushumi")} value={<span className="text-muted-foreground">{t("To‘lov tizimi ulanmagan")}</span>} />
            <Field label="MRR" value={<span className="text-muted-foreground">{t("To‘lov tizimi ulanmagan")}</span>} />
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="size-3.5" /> {t("Obuna va MRR raqamlari faqat real to‘lov integratsiyasidan keyin ko‘rinadi.")}
          </p>
        </Panel>

        <Panel title={t("Tizim yuklamasi")} description={t("Bazadagi yozuvlar soni.")}>
          <DataTable columns={["Bo‘lim", "Yozuvlar"]}>
            {Object.entries({
              Mijozlar: data.records.customers,
              Murojaatlar: data.records.leads,
              Buyurtmalar: data.records.orders,
              "To‘lovlar": data.records.payments,
              Vazifalar: data.records.tasks,
              Mahsulotlar: data.records.products,
              Suhbatlar: data.records.conversations,
              Xabarlar: data.records.messages,
            }).map(([label, value]) => (
              <tr key={label}>
                <td className="px-3 py-2">{label}</td>
                <td className="px-3 py-2 tabular-nums">{fmtNumber(value)}</td>
              </tr>
            ))}
          </DataTable>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("Fayl va baza hajmi bo‘yicha aniq API mavjud emas — noto‘g‘ri raqam ko‘rsatilmaydi.")}
          </p>
        </Panel>
      </div>
    </div>
  );
}
