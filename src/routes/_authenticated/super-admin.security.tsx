import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { ErrorState, LoadingState, PageHeader } from "@/components/app/primitives";
import { DataTable, MetricCard, NoData, Panel, Pill, fmtDate, fmtNumber } from "@/components/app/super-admin-ui";
import { getSecurityOverview } from "@/lib/super-admin.functions";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/super-admin/security")({
  head: () => ({
    meta: [
      { title: t("Xavfsizlik — NEXORA CRM Control Center") },
      { name: "description", content: t("Kirishlar, muvaffaqiyatsiz urinishlar va admin amallari bo‘yicha xavfsizlik ko‘rinishi.") },
      { property: "og:title", content: t("Xavfsizlik — NEXORA CRM Control Center") },
      { property: "og:description", content: t("Kirish tarixi va shubhali faollik.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  const load = useServerFn(getSecurityOverview);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["super-admin-security"],
    queryFn: () => load(),
  });

  if (isPending) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data) return <NoData />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("Xavfsizlik")} description={t("Audit jurnalidan olingan haqiqiy kirish va admin amallari.")} />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label={t("Oxirgi kirishlar")} value={fmtNumber(data.recentLogins.length)} />
        <MetricCard label={t("24 soatda muvaffaqiyatsiz kirish")} value={fmtNumber(data.failedLast24h)} />
        <MetricCard label={t("Shubhali manbalar")} value={fmtNumber(data.suspicious.length)} hint={t("24 soatda 3+ xato urinish")} />
      </div>

      <Panel title={t("Shubhali faollik")}>
        {data.suspicious.length === 0 ? (
          <NoData label={t("Shubhali faollik aniqlanmadi")} />
        ) : (
          <DataTable columns={["Manba", "Xato urinishlar"]}>
            {data.suspicious.map((s) => (
              <tr key={s.actor}>
                <td className="px-3 py-2">{s.actor}</td>
                <td className="px-3 py-2 tabular-nums">{fmtNumber(s.count)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("Oxirgi kirishlar")}>
          {data.recentLogins.length === 0 ? (
            <NoData />
          ) : (
            <DataTable columns={["Vaqt", "Kim", "IP"]}>
              {data.recentLogins.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-xs">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-2">{r.actor_email ?? r.actor_user_id ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.ip ?? "—"}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>

        <Panel title={t("Muvaffaqiyatsiz kirishlar")}>
          {data.failedLogins.length === 0 ? (
            <NoData />
          ) : (
            <DataTable columns={["Vaqt", "Email", "IP"]}>
              {data.failedLogins.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-xs">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-2">{r.actor_email ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.ip ?? "—"}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      </div>

      <Panel title={t("Super Admin amallari")}>
        {data.adminActions.length === 0 ? (
          <NoData />
        ) : (
          <DataTable columns={["Vaqt", "Amal", "Kim", "Nishon", "Holat"]}>
            {data.adminActions.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2 text-xs">{fmtDate(r.created_at)}</td>
                <td className="px-3 py-2">{r.action}</td>
                <td className="px-3 py-2">{r.actor_email ?? "—"}</td>
                <td className="px-3 py-2">{r.target_label ?? r.target_id ?? "—"}</td>
                <td className="px-3 py-2"><Pill value={r.status} /></td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
