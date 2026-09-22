import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { compact } from "./compact";

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [business, ai] = await Promise.all([
      context.supabase.from("business_settings").select("*").limit(1).maybeSingle(),
      context.supabase.from("ai_settings").select("*").limit(1).maybeSingle(),
    ]);
    if (business.error) throw new Error(business.error.message);
    if (ai.error) throw new Error(ai.error.message);
    return {
      business: business.data,
      ai: ai.data,
      aiKeyConfigured: Boolean(process.env["LOVABLE_API_KEY"]),
    };
  });

export const saveBusinessSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string(),
        business_name: z.string().min(1),
        business_description: z.string(),
        working_hours: z.string(),
        delivery_info: z.string(),
        payment_methods: z.string(),
        return_policy: z.string(),
        currency: z.string().min(1).max(8),
        operator_group_chat_id: z.string().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("business_settings")
      .update(compact(patch) as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    const [{ requireBusinessId }, { invalidateSettingsCache }] = await Promise.all([
      import("./tenant.server"),
      import("./agent.server"),
    ]);
    invalidateSettingsCache(await requireBusinessId(context.supabase));
    return { ok: true };
  });

export const saveAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string(),
        model: z.string().min(1),
        tone_of_voice: z.string(),
        sales_strategy: z.string(),
        language_instruction: z.string(),
        escalation_rules: z.string(),
        custom_instructions: z.string(),
        max_discount_percent: z.number().min(0).max(100),
        enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("ai_settings")
      .update(compact(patch) as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    const [{ requireBusinessId }, { invalidateSettingsCache }] = await Promise.all([
      import("./tenant.server"),
      import("./agent.server"),
    ]);
    invalidateSettingsCache(await requireBusinessId(context.supabase));
    return { ok: true };
  });

export const notifyLeadOperators = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ leadId: z.string(), reason: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireBusinessId } = await import("./tenant.server");
    const { notifyOperatorGroup } = await import("./agent.server");
    const businessId = await requireBusinessId(context.supabase);
    return notifyOperatorGroup(businessId, data.leadId, data.reason);
  });