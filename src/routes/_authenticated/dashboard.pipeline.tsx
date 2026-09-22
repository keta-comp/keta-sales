import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { ErrorState, LoadingState, PageHeader } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getMyCrmConfig, listCrmRecords, saveCrmRecord } from "@/lib/crm-config.functions";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/pipeline")({
  head: () => ({ meta: [{ title: t("Pipeline — NEXORA CRM") }] }),
  component: PipelinePage,
});

type RecordRow = {
  id: string;
  module_key: string;
  title: string;
  stage: string | null;
  data: Record<string, unknown>;
};

function PipelinePage() {
  const queryClient = useQueryClient();
  const fetchConfig = useServerFn(getMyCrmConfig);
  const fetchRecords = useServerFn(listCrmRecords);
  const saveRecord = useServerFn(saveCrmRecord);

  const config = useQuery({ queryKey: ["crm-config"], queryFn: () => fetchConfig() });

  const pipelineModules = useMemo(
    () => (config.data?.config?.modules ?? []).filter((m) => m.pipeline && !m.link),
    [config.data],
  );

  const allRecords = useQuery({
    queryKey: ["crm-pipeline-records"],
    queryFn: async () => {
      const results = await Promise.all(
        pipelineModules.map((m) => fetchRecords({ data: { moduleKey: m.key } })),
      );
      const labels = new Map(pipelineModules.map((m) => [m.key, m.label]));
      return results.flat().map((r) => ({ ...r, moduleLabel: labels.get(r.module_key) ?? r.module_key }));
    },
    enabled: pipelineModules.length > 0,
  });

  useEffect(() => {
    const channel = supabase
      .channel("crm-pipeline-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_records" }, () => {
        void allRecords.refetch();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineModules.length]);

  const move = async (row: RecordRow, direction: -1 | 1) => {
    const stages = config.data?.config?.pipelineStages ?? [];
    const currentIndex = stages.indexOf(row.stage ?? "");
    const nextIndex = Math.min(Math.max(currentIndex + direction, 0), stages.length - 1);
    if (nextIndex === currentIndex) return;
    await saveRecord({
      data: {
        id: row.id,
        moduleKey: row.module_key,
        title: row.title,
        stage: stages[nextIndex],
        data: row.data,
      },
    });
    void allRecords.refetch();
    void queryClient.invalidateQueries({ queryKey: ["crm-widgets"] });
  };

  if (config.isPending) return <LoadingState />;
  if (config.error) return <ErrorState error={config.error} onRetry={() => void config.refetch()} />;

  const stages = config.data?.config?.pipelineStages ?? [];
  const rows = (allRecords.data ?? []) as unknown as (RecordRow & { moduleLabel: string })[];

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={t("Murojaat va buyurtmalarning bosqichma-bosqich harakati.")}
      />
      {stages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("Pipeline bosqichlari sozlanmagan.")}</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {stages.map((stage) => {
            const cards = rows.filter((r) => (r.stage ?? "") === stage);
            return (
              <div key={t(stage)} className="flex w-64 shrink-0 flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(stage)}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {cards.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 rounded-2xl bg-muted/40 p-2 min-h-24">
                  {cards.map((row) => {
                    const idx = stages.indexOf(row.stage ?? "");
                    return (
                      <article key={row.id} className="clay-raised rounded-xl bg-card p-3">
                        <p className="truncate text-sm font-medium">{row.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{row.moduleLabel}</p>
                        <div className="mt-2 flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={idx <= 0}
                            aria-label={t("Orqaga surish")}
                            onClick={() => void move(row, -1)}
                          >
                            <ArrowLeft className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={idx >= stages.length - 1}
                            aria-label={t("Oldinga surish")}
                            onClick={() => void move(row, 1)}
                          >
                            <ArrowRight className="size-3.5" />
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                  {cards.length === 0 && (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">{t("Bo‘sh")}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
