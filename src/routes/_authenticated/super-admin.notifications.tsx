import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, LoadingState, PageHeader } from "@/components/app/primitives";
import { DataTable, NoData, Panel, Pill, fmtDate } from "@/components/app/super-admin-ui";
import { getFeatureFlags, listSystemNotifications, sendSystemNotification } from "@/lib/super-admin.functions";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/super-admin/notifications")({
  head: () => ({
    meta: [
      { title: t("E’lonlar — NEXORA CRM Control Center") },
      { name: "description", content: t("Platforma e’lonlari: texnik ishlar, ogohlantirish va yangilik xabarlari.") },
      { property: "og:title", content: t("E’lonlar — NEXORA CRM Control Center") },
      { property: "og:description", content: t("Organizationlarga platforma e’lonlarini yuborish.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

const PLANS = ["free", "starter", "business", "enterprise"];

function NotificationsPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(listSystemNotifications);
  const loadTargets = useServerFn(getFeatureFlags);
  const sendFn = useServerFn(sendSystemNotification);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"info" | "warning" | "maintenance">("info");
  const [targetKind, setTargetKind] = useState<"all" | "organization" | "plan" | "industry">("all");
  const [targetValue, setTargetValue] = useState("");
  const [confirm, setConfirm] = useState(false);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["super-admin-notifications"],
    queryFn: () => load(),
  });
  const targets = useQuery({ queryKey: ["super-admin-flag-targets"], queryFn: () => loadTargets() });

  const send = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          title: title.trim(),
          body: body.trim(),
          kind,
          target_kind: targetKind,
          target_value: targetKind === "all" ? null : targetValue || null,
        },
      }),
    onSuccess: () => {
      toast.success(t("E’lon yuborildi"));
      setTitle("");
      setBody("");
      setTargetValue("");
      setConfirm(false);
      void queryClient.invalidateQueries({ queryKey: ["super-admin-notifications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("Yuborilmadi")),
  });

  const canSend = title.trim().length >= 2 && body.trim().length >= 2 && (targetKind === "all" || !!targetValue);

  return (
    <div className="space-y-6">
      <PageHeader title={t("Platforma e’lonlari")} description={t("Barcha yoki tanlangan bizneslarga xabar yuborish.")} />

      <Panel title={t("Yangi e’lon")}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">{t("Sarlavha")}</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("Texnik ishlar")} />
          </div>
          <div className="space-y-2">
            <Label>{t("Turi")}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">{t("Ma’lumot")}</SelectItem>
                <SelectItem value="warning">{t("Ogohlantirish")}</SelectItem>
                <SelectItem value="maintenance">{t("Texnik ishlar")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="body">{t("Matn")}</Label>
            <Textarea id="body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("Kimga")}</Label>
            <Select
              value={targetKind}
              onValueChange={(v) => {
                setTargetKind(v as typeof targetKind);
                setTargetValue("");
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Barcha organizationlar")}</SelectItem>
                <SelectItem value="organization">{t("Tanlangan organization")}</SelectItem>
                <SelectItem value="plan">{t("Plan bo‘yicha")}</SelectItem>
                <SelectItem value="industry">{t("Soha bo‘yicha")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {targetKind !== "all" ? (
            <div className="space-y-2">
              <Label>{t("Maqsad")}</Label>
              {targetKind === "plan" ? (
                <Select value={targetValue} onValueChange={setTargetValue}>
                  <SelectTrigger><SelectValue placeholder={t("Plan tanlang")} /></SelectTrigger>
                  <SelectContent>
                    {PLANS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : targetKind === "organization" ? (
                <Select value={targetValue} onValueChange={setTargetValue}>
                  <SelectTrigger><SelectValue placeholder={t("Organization tanlang")} /></SelectTrigger>
                  <SelectContent>
                    {(targets.data?.businesses ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder={t("Soha nomi")} />
              )}
            </div>
          ) : null}
        </div>
        <div className="mt-4">
          <Button size="sm" disabled={!canSend} onClick={() => setConfirm(true)}>
            <Send className="size-4" /> {t("Yuborish")}
          </Button>
        </div>
      </Panel>

      <Panel title={t("Yuborilgan e’lonlar")}>
        {isPending ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (data ?? []).length === 0 ? (
          <NoData label={t("Hali e’lon yuborilmagan")} />
        ) : (
          <DataTable columns={["Vaqt", "Sarlavha", "Turi", "Kimga", "Holat"]}>
            {(data ?? []).map((n) => (
              <tr key={n.id}>
                <td className="px-3 py-2 text-xs">{fmtDate(n.created_at)}</td>
                <td className="px-3 py-2">
                  <span className="block font-medium">{n.title}</span>
                  <span className="text-xs text-muted-foreground">{n.body}</span>
                </td>
                <td className="px-3 py-2">{n.kind}</td>
                <td className="px-3 py-2 text-xs">
                  {n.target_kind === "all" ? t("Barchasi") : `${n.target_kind}: ${n.target_value ?? "—"}`}
                </td>
                <td className="px-3 py-2"><Pill value="active" /></td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("E’lonni yuborishni tasdiqlaysizmi?")}</DialogTitle>
            <DialogDescription>
              {targetKind === "all" ? t("Barcha organizationlar") : t("Tanlangan maqsad")} {t("bu xabarni ko‘radi.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>{t("Bekor qilish")}</Button>
            <Button disabled={send.isPending} onClick={() => send.mutate()}>{t("Yuborish")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
