import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled daily report delivery. Called every 15 minutes by a scheduler with
 * the LOVABLE_CRON_SECRET header. Each linked account gets its report at its own
 * local time (timezone stored per link, never hardcoded).
 */
export const Route = createFileRoute("/api/public/telegram/daily-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"];
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!secret || provided !== secret) return new Response("Unauthorized", { status: 401 });

        const [{ supabaseAdmin }, single, bot, reports] = await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("@/lib/single-bot.server"),
          import("@/lib/telegram-report.server"),
          import("@/lib/report-service.server"),
        ]);

        let token: string;
        try {
          token = single.singleBotToken();
        } catch {
          return Response.json({ ok: false, error: "bot_not_configured" }, { status: 500 });
        }

        const { data, error } = await supabaseAdmin
          .from("telegram_links")
          .select(
            "id, business_id, telegram_chat_id, telegram_username, timezone, report_time, daily_reports, notify_new_order, notify_payment, notify_lead, notify_low_stock, linked_at, last_report_date",
          )
          .eq("status", "active")
          .eq("daily_reports", true);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const now = new Date();
        let sent = 0;

        for (const row of data ?? []) {
          try {
            const local = reports.zoneNowParts(row.timezone, now);
            const [hourRaw, minuteRaw] = String(row.report_time).split(":");
            const target = Number(hourRaw) * 60 + Number(minuteRaw ?? 0);
            const current = local.hour * 60 + local.minute;
            if (current < target || current - target > 30) continue;
            if (row.last_report_date === local.dateKey) continue;

            await bot.sendReport(token, row as never, "today");
            await supabaseAdmin
              .from("telegram_links")
              .update({ last_report_date: local.dateKey })
              .eq("id", row.id);
            sent += 1;
          } catch (sendError) {
            console.error("[telegram-daily-report]", row.id, sendError);
          }
        }

        return Response.json({ ok: true, sent });
      },
    },
  },
});
