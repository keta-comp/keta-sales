import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { getLead, listLeads, updateLead } from "@/lib/crm.functions";
import { listOperators } from "@/lib/orders.functions";
import { notifyLeadOperators } from "@/lib/settings.functions";
import { LEAD_SCORES, LEAD_STATUSES, type LeadScore, type LeadStatus } from "@/lib/types";
import { t } from "@/lib/i18n";

type LeadPatch = {
  id: string;
  status?: LeadStatus;
  score?: LeadScore;
  assigned_operator_id?: string | null;
  notes?: string;
};

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Yangi",
  needs_operator: "Operator kerak",
  assigned: "Biriktirilgan",
  contacted: "Bog'lanildi",
  negotiating: "Muzokara",
  won: "Yutildi",
  lost: "Yo'qotildi",
};

const LEAD_SCORE_LABELS: Record<LeadScore, string> = {
  hot: "Issiq",
  warm: "Iliq",
  cold: "Sovuq",
};

export const Route = createFileRoute("/_authenticated/dashboard/leads")({
  head: () => ({
    meta: [
      { title: t("Lidlar — NEXORA CRM") },
      { name: "description", content: t("AI tomonidan yaratilgan Telegram savdo lidlarini baholang, biriktiring va yakunlang.") },
      { property: "og:title", content: t("Lidlar — NEXORA CRM") },
      { property: "og:description", content: t("Operatorga biriktirish imkoniyati bilan AI baholagan Telegram savdo lidlari.") },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const queryClient = useQueryClient();
  const fetchLeads = useServerFn(listLeads);
  const fetchLead = useServerFn(getLead);
  const fetchOperators = useServerFn(listOperators);
  const saveLead = useServerFn(updateLead);
  const notify = useServerFn(notifyLeadOperators);

  const [status, setStatus] = useState("all");
  const [score, setScore] = useState("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const leads = useQuery({
    queryKey: ["leads", status, score, search],
    queryFn: () => fetchLeads({ data: { status, score, search } }),
  });

  const detail = useQuery({
    queryKey: ["lead", openId],
    queryFn: () => fetchLead({ data: { id: openId! } }),
    enabled: Boolean(openId),
  });

  const operators = useQuery({ queryKey: ["operators"], queryFn: () => fetchOperators() });

  useEffect(() => {
    const channel = supabase
      .channel("leads-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["leads"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const mutation = useMutation({
    mutationFn: (input: LeadPatch) => saveLead({ data: input }),
    onSuccess: () => {
      toast.success(t("Lid yangilandi"));
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["lead"] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : t("Lidni yangilab bo'lmadi")),
  });

  const notifyMutation = useMutation({
    mutationFn: (leadId: string) =>
      notify({ data: { leadId, reason: "Manual escalation from CRM" } }),
    onSuccess: () => toast.success(t("Operatorlar guruhiga yuborildi")),
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : t("Telegram xabarnomasi yuborilmadi")),
  });

  const lead = detail.data?.lead;

  return (
    <>
      <PageHeader title={t("Lidlar")} description={t("AI agenti aniqlagan, baholagan va yo'naltirgan har bir so'rov.")} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Label htmlFor="lead-search">{t("Mahsulot bo'yicha qidirish")}</Label>
          <Input
            id="lead-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("iPhone 15, krossovka…")}
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
              {LEAD_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(LEAD_STATUS_LABELS[value])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-36">
          <Label>{t("Baho")}</Label>
          <Select value={score} onValueChange={setScore}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Barchasi")}</SelectItem>
              {LEAD_SCORES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(LEAD_SCORE_LABELS[value])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {leads.isPending ? (
        <LoadingState />
      ) : leads.error ? (
        <ErrorState error={leads.error} onRetry={() => void leads.refetch()} />
      ) : leads.data.length === 0 ? (
        <EmptyState
          title={t("Bu filtrga mos lid topilmadi")}
          description={t("Mijozlar Telegram botingizga yozganda lidlar shu yerda avtomatik paydo bo'ladi.")}
        />
      ) : (
        <div className="clay-inset overflow-x-auto rounded-2xl">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("Mijoz")}</th>
                <th className="px-4 py-3">{t("Qiziqish")}</th>
                <th className="px-4 py-3">{t("Baho")}</th>
                <th className="px-4 py-3">{t("Holat")}</th>
                <th className="px-4 py-3">{t("Operator")}</th>
                <th className="px-4 py-3">{t("Yaratildi")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.data.map((row) => {
                const customer = row.customers as {
                  full_name: string | null;
                  telegram_username: string | null;
                  phone: string | null;
                } | null;
                const operator = row.operators as { full_name: string } | null;
                return (
                  <tr key={row.id} className="clay-hover">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {customer?.full_name ?? "Telegram mijozi"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {customer?.telegram_username ? `@${customer.telegram_username}` : (customer?.phone ?? "—")}
                      </p>
                    </td>
                    <td className="max-w-64 px-4 py-3 text-muted-foreground">
                      <p className="truncate">{row.requested_product ?? "—"}</p>
                      <p className="truncate text-xs">{row.ai_summary ?? ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={row.score} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={row.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{operator?.full_name ?? "Biriktirilmagan"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" className="clay-raised" onClick={() => setOpenId(row.id)}>
                        {t("Ochish")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={Boolean(openId)} onOpenChange={(next) => setOpenId(next ? openId : null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t("Lid tafsilotlari")}</SheetTitle>
          </SheetHeader>
          {detail.isPending ? (
            <LoadingState />
          ) : detail.error ? (
            <ErrorState error={detail.error} />
          ) : lead ? (
            <div className="space-y-5 px-4 pb-8">
              <div className="clay-panel p-4 text-sm">
                <p className="font-medium text-foreground">
                  {(lead.customers as { full_name: string | null } | null)?.full_name ?? "Telegram mijozi"}
                </p>
                <p className="text-xs text-muted-foreground">{lead.ai_summary ?? "AI xulosasi hali yo'q"}</p>
                {lead.handoff_reason ? (
                  <p className="mt-2 text-xs text-warning">{t("Uzatish sababi:")}{" "}{lead.handoff_reason}</p>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{t("Holat")}</Label>
                  <Select
                    value={lead.status}
                    onValueChange={(value) =>
                      mutation.mutate({ id: lead.id, status: value as LeadStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(LEAD_STATUS_LABELS[value])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Baho")}</Label>
                  <Select
                    value={lead.score}
                    onValueChange={(value) =>
                      mutation.mutate({ id: lead.id, score: value as LeadScore })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_SCORES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(LEAD_SCORE_LABELS[value])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>{t("Biriktirilgan operator")}</Label>
                  <Select
                    value={lead.assigned_operator_id ?? "none"}
                    onValueChange={(value) =>
                      mutation.mutate({
                        id: lead.id,
                        assigned_operator_id: value === "none" ? null : value,
                        ...(value === "none" ? {} : { status: "assigned" as LeadStatus }),
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

              <LeadNotes
                key={lead.id}
                initial={lead.notes ?? ""}
                onSave={(notes) => mutation.mutate({ id: lead.id, notes })}
              />

              <Button
                variant="secondary"
                className="w-full clay-raised"
                disabled={notifyMutation.isPending}
                onClick={() => notifyMutation.mutate(lead.id)}
              >
                {t("Operatorlar guruhiga yuborish")}
              </Button>

              <div>
                <p className="text-sm font-medium text-foreground">{t("Voqealar tarixi")}</p>
                <div className="mt-2 space-y-2">
                  {(detail.data?.events ?? []).map((event) => (
                    <div key={event.id} className="clay-inset rounded-xl p-2.5 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium capitalize text-foreground">
                          {event.event_type.replace(/_/g, " ")}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(event.created_at).toLocaleString()}
                        </span>
                      </div>
                      {event.detail ? <p className="mt-1 text-muted-foreground">{event.detail}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function LeadNotes({ initial, onSave }: { initial: string; onSave: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <div>
      <Label htmlFor="lead-notes">{t("Operator eslatmalari")}</Label>
      <Textarea
        id="lead-notes"
        value={value}
        rows={4}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("Juma kuniga yetkazib berish kelishildi, to'lov kutilmoqda…")}
      />
      <Button size="sm" variant="outline" className="mt-2 clay-raised" onClick={() => onSave(value)}>
        {t("Eslatmalarni saqlash")}
      </Button>
    </div>
  );
}
