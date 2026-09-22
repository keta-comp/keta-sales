import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/** Appends one row to the CRM activity history. Never throws — history must not break writes. */
export async function logActivity(
  supabase: Client,
  entry: {
    entityType: string;
    entityId?: string | null;
    customerId?: string | null;
    action: string;
    detail?: string | null;
    actor?: string;
    actorUserId?: string | null;
  },
) {
  try {
    await supabase.from("activities").insert({
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      customer_id: entry.customerId ?? null,
      action: entry.action,
      detail: entry.detail ?? null,
      actor: entry.actor ?? "operator",
      actor_user_id: entry.actorUserId ?? null,
    } as never);
  } catch (error) {
    console.error("[activity]", error);
  }
}
