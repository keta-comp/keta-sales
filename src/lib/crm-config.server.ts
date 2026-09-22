import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CrmAgentContext = {
  industry: string | null;
  description: string | null;
  terminology: Record<string, string> | null;
  moduleLabels: string[];
  pipelineStages: string[];
};

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: CrmAgentContext | null }>();

/**
 * Industry configuration for the AI sales agent — terminology, pipeline stages
 * and module labels from the business's dynamic CRM config. Cached briefly.
 */
export async function getCrmAgentContext(businessId: string): Promise<CrmAgentContext | null> {
  const cached = cache.get(businessId);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const { data } = await supabaseAdmin
    .from("crm_configs")
    .select("industry, business_description, config")
    .eq("business_id", businessId)
    .maybeSingle();

  let value: CrmAgentContext | null = null;
  if (data) {
    const cfg = (data.config ?? {}) as {
      modules?: { key: string; label: string }[];
      terminology?: Record<string, string>;
      pipeline_stages?: string[];
      pipelineStages?: string[];
    };
    value = {
      industry: data.industry,
      description: data.business_description,
      terminology: cfg.terminology ?? null,
      moduleLabels: (cfg.modules ?? []).map((m) => m.label),
      pipelineStages: cfg.pipelineStages ?? cfg.pipeline_stages ?? [],
    };
  }
  cache.set(businessId, { at: Date.now(), value });
  return value;
}

/** Called after the CRM config changes so the agent uses fresh terminology. */
export function invalidateCrmAgentContext(businessId: string) {
  cache.delete(businessId);
}
