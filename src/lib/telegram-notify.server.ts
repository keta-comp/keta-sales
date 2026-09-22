/**
 * Important business notifications pushed to linked Telegram accounts.
 * Best-effort only: a Telegram failure must never break a CRM operation.
 */
type NotifyKind = "new_order" | "payment" | "lead" | "low_stock";

const FLAG: Record<NotifyKind, string> = {
  new_order: "notify_new_order",
  payment: "notify_payment",
  lead: "notify_lead",
  low_stock: "notify_low_stock",
};

export async function notifyBusiness(businessId: string, kind: NotifyKind, text: string) {
  try {
    const [{ supabaseAdmin }, single, bot] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("./single-bot.server"),
      import("./telegram-report.server"),
    ]);
    const { data } = await supabaseAdmin
      .from("telegram_links")
      .select(`telegram_chat_id, ${FLAG[kind]}`)
      .eq("business_id", businessId)
      .eq("status", "active");
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    const targets = rows.filter((row) => row[FLAG[kind]] === true);
    if (!targets.length) return;
    const token = single.singleBotToken();
    await Promise.all(
      targets.map((row) =>
        bot.sendMessage(token, String(row["telegram_chat_id"]), text).catch((error: unknown) => {
          console.error("[telegram-notify] send failed", error);
        }),
      ),
    );
  } catch (error) {
    console.error("[telegram-notify]", error);
  }
}

/** Convenience wrapper for server functions that only hold an RLS client. */
export async function notifyCurrentBusiness(
  supabase: { rpc: (fn: "current_business_id") => Promise<{ data: unknown }> },
  kind: NotifyKind,
  text: string,
) {
  try {
    const { data } = await supabase.rpc("current_business_id");
    if (typeof data === "string" && data) await notifyBusiness(data, kind, text);
  } catch (error) {
    console.error("[telegram-notify] business lookup", error);
  }
}
