/**
 * Telegram report bot. Telegram is ONLY a delivery channel: account linking,
 * on-demand reports, Excel files and notifications. No AI chat, no CRM writes.
 * The bot is fully independent from the web UI — CRM works without it.
 */
import { randomBytes } from "node:crypto";

import { telegramCall, webhookBaseUrl } from "./telegram.server";
import {
  buildReportExcel,
  formatReportMessage,
  generateReport,
  type ReportKind,
} from "./report-service.server";

export const GENERIC_ERROR =
  "⚠️ Hisobotni yaratishda xatolik yuz berdi. Iltimos, birozdan keyin qayta urinib ko‘ring.";

export interface TelegramLinkRow {
  id: string;
  business_id: string;
  telegram_chat_id: string;
  telegram_username: string | null;
  timezone: string;
  report_time: string;
  daily_reports: boolean;
  notify_new_order: boolean;
  notify_payment: boolean;
  notify_lead: boolean;
  notify_low_stock: boolean;
  linked_at: string;
}

const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "📊 Bugungi hisobot" }, { text: "📅 Kechagi hisobot" }],
    [{ text: "📈 Haftalik hisobot" }, { text: "📆 Oylik hisobot" }],
    [{ text: "📥 Excel yuklab olish" }, { text: "⚙️ Sozlamalar" }],
  ],
  resize_keyboard: true,
};

export async function sendMessage(
  token: string,
  chatId: string | number,
  text: string,
  replyMarkup?: unknown,
) {
  return telegramCall<{ message_id: number }>(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function sendMenu(token: string, chatId: string | number, text: string) {
  return sendMessage(token, chatId, text, MAIN_KEYBOARD);
}

/** Uploads an .xlsx to the chat. Telegram needs multipart for documents. */
export async function sendDocument(
  token: string,
  chatId: string | number,
  base64: string,
  filename: string,
  caption: string,
) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  form.append(
    "document",
    new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename,
  );
  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error(`sendDocument failed: ${response.status} ${await response.text()}`);
}

export async function findLink(telegramUserId: string): Promise<TelegramLinkRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("telegram_links")
    .select(
      "id, business_id, telegram_chat_id, telegram_username, timezone, report_time, daily_reports, notify_new_order, notify_payment, notify_lead, notify_low_stock, linked_at",
    )
    .eq("telegram_user_id", telegramUserId)
    .eq("status", "active")
    .maybeSingle();
  return (data as TelegramLinkRow | null) ?? null;
}

/** Fresh one-time linking code. The password is never asked for inside Telegram. */
export async function createLinkRequest(input: {
  telegramUserId: string;
  telegramChatId: string;
  telegramUsername: string | null;
}): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const code = randomBytes(24).toString("base64url");
  const { error } = await supabaseAdmin.from("telegram_link_requests").insert({
    code,
    telegram_user_id: input.telegramUserId,
    telegram_chat_id: input.telegramChatId,
    telegram_username: input.telegramUsername,
  });
  if (error) throw new Error(error.message);
  return code;
}

export function linkUrl(code: string): string {
  return `${webhookBaseUrl()}/dashboard/telegram?code=${encodeURIComponent(code)}`;
}

async function sendConnectPrompt(
  token: string,
  chatId: string | number,
  telegramUserId: string,
  username: string | null,
  intro: string,
) {
  const code = await createLinkRequest({
    telegramUserId,
    telegramChatId: String(chatId),
    telegramUsername: username,
  });
  await sendMessage(token, chatId, intro, {
    inline_keyboard: [[{ text: "🔗 NEXORA CRM akkauntini ulash", url: linkUrl(code) }]],
  });
}

const REPORT_TRIGGERS: { match: RegExp; kind: ReportKind }[] = [
  { match: /^(\/today|\/report|📊\s*bugungi hisobot|bugungi hisobot)$/i, kind: "today" },
  { match: /^(\/yesterday|📅\s*kechagi hisobot|kechagi hisobot)$/i, kind: "yesterday" },
  { match: /^(\/week|📈\s*haftalik hisobot|haftalik hisobot)$/i, kind: "week" },
  { match: /^(\/month|📆\s*oylik hisobot|oylik hisobot)$/i, kind: "month" },
];

const HELP_TEXT = [
  "ℹ️ <b>NEXORA CRM bot buyruqlari</b>",
  "",
  "/today — bugungi hisobot",
  "/yesterday — kechagi hisobot",
  "/week — haftalik hisobot",
  "/month — oylik hisobot",
  "/excel — Excel hisobot",
  "/settings — sozlamalar",
  "/help — yordam",
  "",
  "Asosiy CRM ish joyi NEXORA CRM veb platformasida.",
].join("\n");

export async function sendReport(
  token: string,
  link: TelegramLinkRow,
  kind: ReportKind,
  withExcelButton = true,
) {
  const { report, comparison } = await generateReport(link.business_id, kind, link.timezone);
  const markup = withExcelButton
    ? { inline_keyboard: [[{ text: "📥 Excel yuklab olish", callback_data: `excel:${kind}` }]] }
    : undefined;
  await sendMessage(token, link.telegram_chat_id, formatReportMessage(report, comparison), markup);
}

export async function sendExcel(token: string, link: TelegramLinkRow, kind: ReportKind) {
  const { report } = await generateReport(link.business_id, kind, link.timezone);
  const file = buildReportExcel(report);
  await sendDocument(
    token,
    link.telegram_chat_id,
    file.base64,
    file.filename,
    `📥 Excel hisobot — ${report.range.label}`,
  );
}

function settingsText(link: TelegramLinkRow): string {
  const onOff = (value: boolean) => (value ? "🟢 Yoniq" : "⚪️ O‘chiq");
  return [
    "⚙️ <b>Sozlamalar</b>",
    "",
    `Kunlik hisobot: ${onOff(link.daily_reports)} (${link.report_time})`,
    `Vaqt mintaqasi: ${link.timezone}`,
    "",
    `Yangi buyurtma: ${onOff(link.notify_new_order)}`,
    `To‘lov: ${onOff(link.notify_payment)}`,
    `Muhim lead: ${onOff(link.notify_lead)}`,
    `Ombor qoldig‘i: ${onOff(link.notify_low_stock)}`,
    "",
    "Sozlamalarni NEXORA CRM → Sozlamalar → Telegram bo‘limida o‘zgartirishingiz mumkin.",
  ].join("\n");
}

/** Handles one text message. Everything is authenticated through the stored link. */
export async function handleTelegramText(input: {
  token: string;
  chatId: number | string;
  telegramUserId: string;
  username: string | null;
  text: string;
}) {
  const { token, chatId, telegramUserId, username, text } = input;
  const normalized = text.trim().replace(/@\w+$/, "");
  const link = await findLink(telegramUserId);

  if (!link) {
    const intro = /^\/start\b/.test(normalized)
      ? "👋 NEXORA CRM'ga xush kelibsiz.\n\nTelegram akkauntingizni NEXORA CRM bilan ulang va biznesingiz hisobotlarini Telegram orqali oling."
      : "Avval NEXORA CRM akkauntingizni ulang.";
    await sendConnectPrompt(token, chatId, telegramUserId, username, intro);
    return;
  }

  if (String(link.telegram_chat_id) !== String(chatId)) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("telegram_links")
      .update({ telegram_chat_id: String(chatId) })
      .eq("id", link.id);
    link.telegram_chat_id = String(chatId);
  }

  if (/^\/start\b/.test(normalized)) {
    await sendMenu(token, chatId, "✅ Akkauntingiz ulangan. Kerakli hisobotni tanlang:");
    return;
  }
  if (/^\/help\b/.test(normalized)) {
    await sendMenu(token, chatId, HELP_TEXT);
    return;
  }
  if (/^(\/settings|⚙️\s*sozlamalar|sozlamalar)$/i.test(normalized)) {
    await sendMessage(token, chatId, settingsText(link), {
      inline_keyboard: [[{ text: "⚙️ Veb sozlamalar", url: `${webhookBaseUrl()}/dashboard/telegram` }]],
    });
    return;
  }
  if (/^(\/excel|📥\s*excel yuklab olish|excel)$/i.test(normalized)) {
    await sendMessage(token, chatId, "📥 Qaysi davr uchun Excel kerak?", {
      inline_keyboard: [
        [
          { text: "Bugun", callback_data: "excel:today" },
          { text: "Hafta", callback_data: "excel:week" },
          { text: "Oy", callback_data: "excel:month" },
        ],
      ],
    });
    return;
  }

  const trigger = REPORT_TRIGGERS.find((item) => item.match.test(normalized));
  if (trigger) {
    await sendReport(token, link, trigger.kind);
    return;
  }

  await sendMenu(token, chatId, "Quyidagi bo‘limlardan birini tanlang 👇");
}

/** Handles inline button presses (Excel period choice). */
export async function handleTelegramCallback(input: {
  token: string;
  callbackId: string;
  chatId: number | string;
  telegramUserId: string;
  data: string;
}) {
  const { token, callbackId, chatId, telegramUserId, data } = input;
  await telegramCall(token, "answerCallbackQuery", { callback_query_id: callbackId }).catch(() => {});
  const link = await findLink(telegramUserId);
  if (!link) {
    await sendMessage(token, chatId, "Avval NEXORA CRM akkauntingizni ulang.");
    return;
  }
  const match = /^excel:(today|yesterday|week|month)$/.exec(data);
  if (!match) return;
  await sendMessage(token, chatId, "📥 Excel hisobot tayyorlanmoqda...");
  await sendExcel(token, link, match[1] as ReportKind);
}
