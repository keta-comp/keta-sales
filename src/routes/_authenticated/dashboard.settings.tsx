import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { ErrorState, LoadingState, PageHeader } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getSettings, saveAiSettings, saveBusinessSettings } from "@/lib/settings.functions";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  head: () => ({
    meta: [
      { title: t("Sozlamalar — NEXORA CRM") },
      { name: "description", content: t("Telegram botni, biznes bilimlarini va AI savdo xatti-harakatini sozlang.") },
      { property: "og:title", content: t("Sozlamalar — NEXORA CRM") },
      { property: "og:description", content: t("Telegram, biznes va AI agent sozlamalari.") },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getSettings);
  const saveBusiness = useServerFn(saveBusinessSettings);
  const saveAi = useServerFn(saveAiSettings);

  const settings = useQuery({ queryKey: ["settings"], queryFn: () => fetchSettings() });

  const businessMutation = useMutation({
    mutationFn: (input: Parameters<typeof saveBusiness>[0] extends { data: infer D } ? D : never) =>
      saveBusiness({ data: input }),
    onSuccess: () => {
      toast.success(t("Biznes sozlamalari saqlandi"));
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : t("Saqlash amalga oshmadi")),
  });

  const aiMutation = useMutation({
    mutationFn: (input: Parameters<typeof saveAi>[0] extends { data: infer D } ? D : never) =>
      saveAi({ data: input }),
    onSuccess: () => {
      toast.success(t("AI sozlamalari saqlandi"));
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : t("Saqlash amalga oshmadi")),
  });

  if (settings.isPending) return <LoadingState />;
  if (settings.error) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;

  const business = settings.data.business;
  const ai = settings.data.ai;

  return (
    <>
      <PageHeader title={t("Sozlamalar")} description={t("Biznes bilimlari va AI savdo agentining xatti-harakati.")} />

      {business ? (
        <BusinessForm
          key={business.id}
          initial={business}
          onSave={(values) => businessMutation.mutate(values as never)}
          saving={businessMutation.isPending}
        />
      ) : null}

      {ai ? (
        <AiForm
          key={ai.id}
          initial={ai}
          aiKeyConfigured={settings.data.aiKeyConfigured}
          onSave={(values) => aiMutation.mutate(values as never)}
          saving={aiMutation.isPending}
        />
      ) : null}
    </>
  );
}

type BusinessRow = {
  id: string;
  business_name: string;
  business_description: string;
  working_hours: string;
  delivery_info: string;
  payment_methods: string;
  return_policy: string;
  currency: string;
  operator_group_chat_id: string | null;
};

function BusinessForm({
  initial,
  onSave,
  saving,
}: {
  initial: BusinessRow;
  onSave: (values: BusinessRow) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<BusinessRow>(initial);
  const field = (key: keyof BusinessRow) => ({
    value: (form[key] ?? "") as string,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: event.target.value }),
  });

  return (
    <form
      className="clay-panel space-y-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ ...form, operator_group_chat_id: form.operator_group_chat_id || null });
      }}
    >
      <h2 className="font-display text-base font-semibold">{t("Biznes bilimlari")}</h2>
      <p className="text-sm text-muted-foreground">{t("AI agent mijozlarga shu ma'lumotlarni aytadi.")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="b-name">{t("Biznes nomi")}</Label>
          <Input id="b-name" {...field("business_name")} required />
        </div>
        <div>
          <Label htmlFor="b-currency">{t("Valyuta")}</Label>
          <Input id="b-currency" {...field("currency")} required />
        </div>
        <div>
          <Label htmlFor="b-hours">{t("Ish vaqti")}</Label>
          <Input id="b-hours" {...field("working_hours")} />
        </div>
        <div>
          <Label htmlFor="b-group">{t("Operatorlar guruh chat ID")}</Label>
          <Input id="b-group" {...field("operator_group_chat_id")} placeholder="-1001234567890" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="b-desc">{t("Biznes nima sotadi")}</Label>
          <Textarea id="b-desc" rows={3} {...field("business_description")} />
        </div>
        <div>
          <Label htmlFor="b-delivery">{t("Yetkazib berish haqida")}</Label>
          <Textarea id="b-delivery" rows={3} {...field("delivery_info")} />
        </div>
        <div>
          <Label htmlFor="b-payment">{t("To'lov usullari")}</Label>
          <Textarea id="b-payment" rows={3} {...field("payment_methods")} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="b-return">{t("Qaytarish siyosati")}</Label>
          <Textarea id="b-return" rows={2} {...field("return_policy")} />
        </div>
      </div>
      <Button type="submit" disabled={saving}>
        {t("Biznes sozlamalarini saqlash")}
      </Button>
    </form>
  );
}

type AiRow = {
  id: string;
  model: string;
  tone_of_voice: string;
  sales_strategy: string;
  language_instruction: string;
  escalation_rules: string;
  custom_instructions: string;
  max_discount_percent: number;
  enabled: boolean;
};

function AiForm({
  initial,
  aiKeyConfigured,
  onSave,
  saving,
}: {
  initial: AiRow;
  aiKeyConfigured: boolean;
  onSave: (values: AiRow) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<AiRow>(initial);

  return (
    <form
      className="clay-panel space-y-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(form);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">{t("AI savdo agenti")}</h2>
          <p className="text-sm text-muted-foreground">
            {aiKeyConfigured ? t("Lovable AI ulangan.") : t("AI kaliti yo'q — javoblar ishlamaydi.")}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          {t("Agent yoqilgan")}
          <Switch checked={form.enabled} onCheckedChange={(checked) => setForm({ ...form, enabled: checked })} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="a-model">{t("Model")}</Label>
          <Input id="a-model" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
        </div>
        <div>
          <Label htmlFor="a-discount">{t("Maksimal chegirma %")}</Label>
          <Input
            id="a-discount"
            type="number"
            min={0}
            max={100}
            value={form.max_discount_percent}
            onChange={(event) => setForm({ ...form, max_discount_percent: Number(event.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="a-tone">{t("Muloqot ohangi")}</Label>
          <Textarea
            id="a-tone"
            rows={2}
            value={form.tone_of_voice}
            onChange={(event) => setForm({ ...form, tone_of_voice: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="a-language">{t("Til qoidalari")}</Label>
          <Textarea
            id="a-language"
            rows={2}
            value={form.language_instruction}
            onChange={(event) => setForm({ ...form, language_instruction: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="a-strategy">{t("Savdo strategiyasi")}</Label>
          <Textarea
            id="a-strategy"
            rows={3}
            value={form.sales_strategy}
            onChange={(event) => setForm({ ...form, sales_strategy: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="a-escalation">{t("Eskalatsiya qoidalari")}</Label>
          <Textarea
            id="a-escalation"
            rows={3}
            value={form.escalation_rules}
            onChange={(event) => setForm({ ...form, escalation_rules: event.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="a-custom">{t("Qo'shimcha ko'rsatmalar")}</Label>
          <Textarea
            id="a-custom"
            rows={4}
            value={form.custom_instructions}
            onChange={(event) => setForm({ ...form, custom_instructions: event.target.value })}
          />
        </div>
      </div>
      <Button type="submit" disabled={saving}>
        {t("AI sozlamalarini saqlash")}
      </Button>
    </form>
  );
}
