import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { deleteCrmRecord, getMyCrmConfig, listCrmRecords, saveCrmRecord } from "@/lib/crm-config.functions";
import type { CrmField } from "@/lib/crm-config";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/crm/$moduleKey")({
  head: () => ({ meta: [{ title: t("CRM moduli — NEXORA CRM") }] }),
  component: CrmModulePage,
});

type RecordRow = {
  id: string;
  title: string;
  stage: string | null;
  data: Record<string, unknown>;
  created_at: string;
};

function CrmModulePage() {
  const { moduleKey } = Route.useParams();
  const queryClient = useQueryClient();

  const fetchConfig = useServerFn(getMyCrmConfig);
  const fetchRecords = useServerFn(listCrmRecords);
  const saveRecord = useServerFn(saveCrmRecord);
  const removeRecord = useServerFn(deleteCrmRecord);

  const config = useQuery({ queryKey: ["crm-config"], queryFn: () => fetchConfig() });
  const [search, setSearch] = useState("");

  const records = useQuery({
    queryKey: ["crm-records", moduleKey],
    queryFn: () => fetchRecords({ data: { moduleKey } }),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`crm-records-${moduleKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_records" }, () => {
        void records.refetch();
        void queryClient.invalidateQueries({ queryKey: ["crm-widgets"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  const module = useMemo(() => {
    const cfg = config.data?.config;
    return cfg?.modules.find((m) => m.key === moduleKey && !m.link) ?? null;
  }, [config.data, moduleKey]);

  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    const initial: Record<string, string> = {};
    (module?.fields ?? []).forEach((f) => (initial[f.key] = ""));
    setForm(initial);
    setStage(module?.pipeline ? (config.data?.config?.pipelineStages[0] ?? "") : "");
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (row: RecordRow) => {
    const initial: Record<string, string> = {};
    (module?.fields ?? []).forEach((f) => {
      const v = row.data?.[f.key];
      initial[f.key] = v === null || v === undefined ? "" : String(v);
    });
    setForm(initial);
    setStage(row.stage ?? "");
    setEditing(row);
    setCreating(false);
  };

  const submit = async () => {
    if (!module) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {};
      (module.fields ?? []).forEach((f) => (data[f.key] = form[f.key] ?? ""));
      const title = String(form[module.fields?.[0]?.key ?? ""] ?? "").trim() || "Nomsiz";
      await saveRecord({
        data: { id: editing?.id, moduleKey: module.key, title, stage: stage || null, data },
      });
      await records.refetch();
      void queryClient.invalidateQueries({ queryKey: ["crm-widgets"] });
      setCreating(false);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await removeRecord({ data: { id: editing.id } });
      await records.refetch();
      void queryClient.invalidateQueries({ queryKey: ["crm-widgets"] });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  if (config.isPending) return <LoadingState />;
  if (config.error) return <ErrorState error={config.error} onRetry={() => void config.refetch()} />;
  if (!module) {
    return <EmptyState title={t("Modul topilmadi")} description={t("Bu modul CRM konfiguratsiyasida mavjud emas.")} />;
  }

  const fields = module.fields ?? [];
  const rows = (records.data ?? []) as unknown as RecordRow[];
  const filtered = rows.filter((r) =>
    search ? r.title.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <>
      <PageHeader
        title={t(module.label)}
        description={module.pipeline ? t("Pipeline bosqichlari bilan kuzatiladi") : ""}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-44 pl-9 sm:w-60"
                placeholder={t("Qidirish…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" /> {t("Yangi qo‘shish")}
            </Button>
          </div>
        }
      />

      <section className="clay-panel overflow-hidden">
        {records.isPending ? (
          <LoadingState />
        ) : records.error ? (
          <ErrorState error={records.error} onRetry={() => void records.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={t("Hozircha yozuv yo‘q")}
            description={t("\"{v0}\" bo‘limiga birinchi yozuvni qo‘shing.", { v0: module.label })}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  {fields.slice(0, 5).map((f) => (
                    <th key={f.key} className="px-4 py-3 font-medium">
                      {t(f.label)}
                    </th>
                  ))}
                  {module.pipeline && <th className="px-4 py-3 font-medium">{t("Bosqich")}</th>}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-card"
                    onClick={() => openEdit(row)}
                  >
                    {fields.slice(0, 5).map((f) => (
                      <td key={f.key} className="max-w-56 truncate px-4 py-3">
                        {String(row.data?.[f.key] ?? "—")}
                      </td>
                    ))}
                    {module.pipeline && (
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {t(row.stage ?? "—")}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <Trash2
                        className="ml-auto size-4 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          void removeRecord({ data: { id: row.id } }).then(() => void records.refetch());
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={creating || !!editing} onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("{v0}ni tahrirlash", { v0: module.label }) : t("Yangi {v0}", { v0: module.label.toLowerCase() })}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {fields.map((field) => (
              <FieldInput
                key={field.key}
                field={field}
                value={form[field.key] ?? ""}
                onChange={(v) => setForm((prev) => ({ ...prev, [field.key]: v }))}
              />
            ))}
            {module.pipeline && (
              <div className="flex flex-col gap-2">
                <Label>{t("Bosqich")}</Label>
                <Select value={t(stage)} onValueChange={setStage}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Bosqichni tanlang")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(config.data?.config?.pipelineStages ?? []).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {editing && (
              <Button variant="destructive" size="sm" onClick={() => void remove()} disabled={saving}>
                <Trash2 className="size-4" /> {t("O‘chirish")}
              </Button>
            )}
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? t("Saqlanmoqda…") : t("Saqlash")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: CrmField;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = (
    <Label>
      {t(field.label)}
      {field.required && <span className="text-destructive"> *</span>}
    </Label>
  );
  if (field.type === "select") {
    return (
      <div className="flex flex-col gap-2">
        {label}
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={t("Tanlang")} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div className="flex flex-col gap-2">
        {label}
        <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  const inputType =
    field.type === "number" || field.type === "money"
      ? "number"
      : field.type === "date"
        ? "date"
        : field.type === "phone"
          ? "tel"
          : "text";
  return (
    <div className="flex flex-col gap-2">
      {label}
      <Input type={inputType} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
