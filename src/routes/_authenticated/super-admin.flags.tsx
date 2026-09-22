import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, LoadingState, PageHeader } from "@/components/app/primitives";
import { NoData, Panel } from "@/components/app/super-admin-ui";
import { getFeatureFlags, saveFeatureFlag } from "@/lib/super-admin.functions";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/super-admin/flags")({
  head: () => ({
    meta: [
      { title: t("Funksiyalar — NEXORA CRM Control Center") },
      { name: "description", content: t("NEXORA CRM funksiyalarini plan yoki organization bo‘yicha yoqish va o‘chirish.") },
      { property: "og:title", content: t("Funksiyalar — NEXORA CRM Control Center") },
      { property: "og:description", content: t("Funksiya boshqaruvi: AI yordamchi, Telegram hisobotlar va boshqalar.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FlagsPage,
});

const PLANS = ["free", "starter", "business", "enterprise"];

function FlagsPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(getFeatureFlags);
  const saveFn = useServerFn(saveFeatureFlag);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["super-admin-flags"],
    queryFn: () => load(),
  });

  const save = useMutation({
    mutationFn: (input: {
      key: string;
      label: string;
      enabled: boolean;
      target_plan: string | null;
      target_business_id: string | null;
    }) => saveFn({ data: input }),
    onSuccess: () => {
      toast.success(t("Saqlandi"));
      void queryClient.invalidateQueries({ queryKey: ["super-admin-flags"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("Saqlanmadi")),
  });

  if (isPending) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const flags = data?.flags ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Funksiya boshqaruvi")}
        description={t("Har bir funksiyani umumiy, plan yoki bitta organization uchun yoqing.")}
      />

      {flags.length === 0 ? (
        <Panel><NoData label={t("Funksiyalar ro‘yxati bo‘sh")} /></Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {flags.map((flag) => (
            <Panel key={flag.key} title={t(flag.label)} description={flag.key}>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">{flag.enabled ? t("Yoqilgan") : t("O‘chirilgan")}</span>
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={(checked) =>
                      save.mutate({
                        key: flag.key,
                        label: flag.label,
                        enabled: checked,
                        target_plan: flag.target_plan ?? null,
                        target_business_id: flag.target_business_id ?? null,
                      })
                    }
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    value={flag.target_plan ?? "none"}
                    onValueChange={(v) =>
                      save.mutate({
                        key: flag.key,
                        label: flag.label,
                        enabled: flag.enabled,
                        target_plan: v === "none" ? null : v,
                        target_business_id: null,
                      })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder={t("Plan")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("Plan cheklovi yo‘q")}</SelectItem>
                      {PLANS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select
                    value={flag.target_business_id ?? "none"}
                    onValueChange={(v) =>
                      save.mutate({
                        key: flag.key,
                        label: flag.label,
                        enabled: flag.enabled,
                        target_plan: null,
                        target_business_id: v === "none" ? null : v,
                      })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder={t("Organization")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("Organization cheklovi yo‘q")}</SelectItem>
                      {(data?.businesses ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
