import { createFileRoute } from "@tanstack/react-router";

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: { id: number; type: string };
  from?: { id: number; username?: string; first_name?: string; last_name?: string };
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: {
    id: string;
    data?: string;
    from: { id: number; username?: string };
    message?: { chat: { id: number } };
  };
};

/**
 * NEXORA CRM report bot webhook. Answers Telegram in milliseconds and does the
 * report work in the background. No AI sales chat here — Telegram is only a
 * reporting/notification channel.
 */
export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [telegram, single, bot, perf] = await Promise.all([
          import("@/lib/telegram.server"),
          import("@/lib/single-bot.server"),
          import("@/lib/telegram-report.server"),
          import("@/lib/perf.server"),
        ]);

        let token: string;
        try {
          token = single.singleBotToken();
        } catch (error) {
          console.error("[telegram-webhook] missing token", error);
          return Response.json({ ok: false, error: "bot_not_configured" }, { status: 500 });
        }

        const header = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!telegram.safeEqual(header, single.singleBotHeaderSecret(token))) {
          return new Response("Unauthorized", { status: 401 });
        }

        let update: TelegramUpdate;
        try {
          update = (await request.json()) as TelegramUpdate;
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }

        const callback = update.callback_query;
        const message = update.message ?? update.edited_message;

        const task = perf.runBackground(async () => {
          try {
            if (callback?.message?.chat?.id) {
              await bot.handleTelegramCallback({
                token,
                callbackId: callback.id,
                chatId: callback.message.chat.id,
                telegramUserId: String(callback.from.id),
                data: callback.data ?? "",
              });
              return;
            }
            if (message?.from && message.text) {
              await bot.handleTelegramText({
                token,
                chatId: message.chat.id,
                telegramUserId: String(message.from.id),
                username: message.from.username ?? null,
                text: message.text,
              });
            }
          } catch (error) {
            console.error("[telegram-webhook]", error);
            const chatId = callback?.message?.chat?.id ?? message?.chat.id;
            if (chatId) {
              await bot.sendMessage(token, chatId, bot.GENERIC_ERROR).catch(() => {});
            }
          }
        }, "telegram-report");

        if (!perf.hasWaitUntil()) {
          await task;
          await perf.drainBackground();
        }

        return Response.json({ ok: true });
      },
    },
  },
});
