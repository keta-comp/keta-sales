import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Successful sign-in: trustworthy, the caller is authenticated. */
export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./audit.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: membership } = await supabaseAdmin
      .from("business_members")
      .select("business_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    await supabaseAdmin
      .from("profiles")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", context.userId);

    await logAudit({
      actorUserId: context.userId,
      actorEmail: profile?.email ?? null,
      action: "login",
      targetType: "user",
      targetId: context.userId,
      businessId: membership?.business_id ?? null,
    });
    return { ok: true };
  });

/** Failed sign-in. Only the email is ever recorded — never the password. */
export const recordFailedLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ email: z.string().max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { logAudit } = await import("./audit.server");
    await logAudit({
      actorEmail: data.email.slice(0, 200),
      actorKind: "system",
      action: "login_failed",
      status: "failure",
    });
    return { ok: true };
  });

/** New account created through the public sign-up form. */
export const recordRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./audit.server");

    const { data: membership } = await supabaseAdmin
      .from("business_members")
      .select("business_id, businesses(name)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", context.userId)
      .maybeSingle();

    await logAudit({
      actorUserId: context.userId,
      actorEmail: profile?.email ?? null,
      action: "user_registered",
      targetType: "user",
      targetId: context.userId,
      businessId: membership?.business_id ?? null,
      metadata: { organization: (membership as { businesses?: { name?: string } } | null)?.businesses?.name ?? null },
    });

    if (membership?.business_id) {
      await logAudit({
        actorUserId: context.userId,
        actorEmail: profile?.email ?? null,
        action: "organization_created",
        targetType: "organization",
        targetId: membership.business_id,
        businessId: membership.business_id,
      });
    }
    return { ok: true };
  });
