import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Current Telegram link for the signed-in user's business (or null). */
export const getTelegramLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("telegram_links")
      .select(
        "id, telegram_user_id, telegram_username, status, daily_reports, report_time, timezone, notify_new_order, notify_payment, notify_lead, notify_low_stock, linked_at",
      )
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

/** Details of a pending link request so the confirm screen can show the account. */
export const getTelegramLinkRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => z.object({ code: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("telegram_link_requests")
      .select("code, telegram_username, telegram_user_id, expires_at, consumed_at")
      .eq("code", data.code)
      .maybeSingle();
    if (!row) return { valid: false as const, reason: "not_found" as const };
    if (row.consumed_at) return { valid: false as const, reason: "used" as const };
    if (Date.parse(row.expires_at) < Date.now()) return { valid: false as const, reason: "expired" as const };
    return {
      valid: true as const,
      username: row.telegram_username,
      telegramUserId: row.telegram_user_id,
    };
  });

/** Consumes a link code and binds the Telegram account to the user's business. */
export const confirmTelegramLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => z.object({ code: z.string().min(10) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: member, error: memberError } = await context.supabase
      .from("business_members")
      .select("business_id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (!member) throw new Error("Biznes topilmadi");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("telegram_link_requests")
      .select("code, telegram_user_id, telegram_chat_id, telegram_username, expires_at, consumed_at")
      .eq("code", data.code)
      .maybeSingle();
    if (!row) throw new Error("Ulanish kodi topilmadi");
    if (row.consumed_at) throw new Error("Bu kod allaqachon ishlatilgan");
    if (Date.parse(row.expires_at) < Date.now()) throw new Error("Kod muddati tugagan");

    // One Telegram account belongs to exactly one organization.
    const { error: upsertError } = await supabaseAdmin
      .from("telegram_links")
      .upsert(
        {
          telegram_user_id: row.telegram_user_id,
          telegram_chat_id: row.telegram_chat_id,
          telegram_username: row.telegram_username,
          user_id: context.userId,
          business_id: member.business_id,
          status: "active",
          linked_at: new Date().toISOString(),
        },
        { onConflict: "telegram_user_id" },
      );
    if (upsertError) throw new Error(upsertError.message);

    await supabaseAdmin
      .from("telegram_link_requests")
      .update({ consumed_at: new Date().toISOString() })
      .eq("code", row.code);

    const [single, bot] = await Promise.all([
      import("@/lib/single-bot.server"),
      import("@/lib/telegram-report.server"),
    ]);
    try {
      await bot.sendMenu(
        single.singleBotToken(),
        row.telegram_chat_id,
        "✅ Telegram muvaffaqiyatli ulandi.\n\nKerakli hisobotni tanlang:",
      );
    } catch (error) {
      console.error("[telegram-link] confirm message failed", error);
    }

    return { ok: true, username: row.telegram_username };
  });

const settingsSchema = z.object({
  dailyReports: z.boolean(),
  reportTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().min(2).max(64),
  notifyNewOrder: z.boolean(),
  notifyPayment: z.boolean(),
  notifyLead: z.boolean(),
  notifyLowStock: z.boolean(),
});

export const updateTelegramSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof settingsSchema>) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: link } = await context.supabase.from("telegram_links").select("id").limit(1).maybeSingle();
    if (!link) throw new Error("Telegram ulanmagan");
    const { error } = await context.supabase
      .from("telegram_links")
      .update({
        daily_reports: data.dailyReports,
        report_time: data.reportTime,
        timezone: data.timezone,
        notify_new_order: data.notifyNewOrder,
        notify_payment: data.notifyPayment,
        notify_lead: data.notifyLead,
        notify_low_stock: data.notifyLowStock,
      })
      .eq("id", link.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unlinkTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: link } = await context.supabase.from("telegram_links").select("id").limit(1).maybeSingle();
    if (!link) return { ok: true };
    const { error } = await context.supabase.from("telegram_links").delete().eq("id", link.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
