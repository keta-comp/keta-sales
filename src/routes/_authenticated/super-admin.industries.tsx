import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ErrorState, LoadingState, PageHeader } from "@/components/app/primitives";
import { DataTable, NoData, Panel, fmtNumber } from "@/components/app/super-admin-ui";
import { getSaasAnalytics } from "@/lib/super-admin.functions";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/super-admin/industries")({
  head: () => ({
    meta: [
      { title: t("Sohalar — NEXORA CRM Control Center") },
      { name: "description", content: t("NEXORA CRM foydalanuvchilarining sohalari bo‘yicha taqsimoti.") },
      { property: "og:title", content: t("Sohalar — NEXORA CRM Control Center") },
      { property: "og:description", content: t("Organizationlar soha bo‘yicha taqsimoti.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IndustriesPage,
});

function IndustriesPage() {
  const range = useMemo(() => {
    const now = new Date();
    return {
      from: new Date(Date.UTC(now.getUTCFullYear() - 5, 0, 1)).toISOString(),
      to: now.toISOString(),
    };
  }, []);

  const load = useServerFn(getSaasAnalytics);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["super-admin-industries", range.from, range.to],
    queryFn: () => load({ data: range }),
  });

  if (isPending) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const rows = data?.industries ?? [];
  const total = rows.reduce((acc, r) => acc + r.count, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("Sohalar")} description={t("Organizationlar tanlagan sohalar — haqiqiy CRM sozlamalaridan.")} />

      <Panel title={t("Sohalar bo‘yicha organizationlar")}>
        {rows.length === 0 ? (
          <NoData label={t("Hali hech bir organization soha tanlamagan")} />
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="industry" fontSize={11} width={140} />
                <Tooltip />
                <Bar dataKey="count" name="Organization" fill="currentColor" radius={8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title={t("Ro‘yxat")}>
        {rows.length === 0 ? (
          <NoData />
        ) : (
          <DataTable columns={["Soha", "Organization", "Ulushi"]}>
            {rows.map((r) => (
              <tr key={r.industry}>
                <td className="px-3 py-2">{r.industry}</td>
                <td className="px-3 py-2 tabular-nums">{fmtNumber(r.count)}</td>
                <td className="px-3 py-2 tabular-nums">
                  {total ? `${Math.round((r.count / total) * 100)}%` : "—"}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
