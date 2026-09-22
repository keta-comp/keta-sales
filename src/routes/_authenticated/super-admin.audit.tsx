import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, LoadingState, PageHeader } from "@/components/app/primitives";
import { DataTable, NoData, Panel, Pill, fmtDate } from "@/components/app/super-admin-ui";
import { getAuditLogs } from "@/lib/super-admin.functions";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/super-admin/audit")({
  head: () => ({
    meta: [
      { title: t("Audit jurnali — NEXORA CRM Control Center") },
      { name: "description", content: t("Platformadagi barcha muhim amallar jurnali: kirishlar, bloklashlar, sozlama o‘zgarishlari.") },
      { property: "og:title", content: t("Audit jurnali — NEXORA CRM Control Center") },
      { property: "og:description", content: t("Kim, qachon va nima qilgani bo‘yicha to‘liq jurnal.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [businessId, setBusinessId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useServerFn(getAuditLogs);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["super-admin-audit", search, action, businessId, from, to],
    queryFn: () =>
      load({
        data: {
          search,
          action,
          businessId,
          from: from ? new Date(`${from}T00:00:00Z`).toISOString() : undefined,
          to: to ? new Date(`${to}T23:59:59Z`).toISOString() : undefined,
        },
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("Audit jurnali")} description={t("Muhim amallar o‘zgartirilmaydi — faqat o‘qish uchun.")} />

      <Panel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Kim, amal, nishon")} />
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger><SelectValue placeholder={t("Amal")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Barcha amallar")}</SelectItem>
              {(data?.actions ?? []).map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={businessId} onValueChange={setBusinessId}>
            <SelectTrigger><SelectValue placeholder={t("Organization")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Barcha organizationlar")}</SelectItem>
              {(data?.organizations ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Panel>

      <Panel>
        {isPending ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (data?.rows ?? []).length === 0 ? (
          <NoData label={t("Jurnalda yozuv yo‘q")} />
        ) : (
          <DataTable columns={["Vaqt", "Kim", "Amal", "Nishon", "Organization", "IP", "Holat"]}>
            {(data?.rows ?? []).map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-xs">{fmtDate(r.createdAt)}</td>
                <td className="px-3 py-2">
                  <span className="block">{r.actor}</span>
                  <span className="text-xs text-muted-foreground">{r.actorKind}</span>
                </td>
                <td className="px-3 py-2">{r.action}</td>
                <td className="px-3 py-2">{r.target ?? "—"}</td>
                <td className="px-3 py-2">{r.organization ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.ip ?? "—"}</td>
                <td className="px-3 py-2"><Pill value={r.status} /></td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
