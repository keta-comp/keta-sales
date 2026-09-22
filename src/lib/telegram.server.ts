import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

const TELEGRAM_API = "https://api.telegram.org";

/** Public base URL Telegram must call. Stable production host, overridable per environment. */
export function webhookBaseUrl(): string {
  return (process.env["PUBLIC_APP_URL"] || "https://keta-sales.lovable.app").replace(/\/$/, "");
}

function encryptionKey(): Buffer {
  const raw = process.env["BOT_TOKEN_ENCRYPTION_KEY"];
  if (!raw) throw new Error("BOT_TOKEN_ENCRYPTION_KEY is not configured");
  return createHash("sha256").update(raw).digest();
}

/** AES-256-GCM: iv.tag.ciphertext, all base64url. */
export function encryptBotToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(
    ".",
  );
}

export function decryptBotToken(payload: string): string {
  const [ivPart, tagPart, dataPart] = payload.split(".");
  if (!ivPart || !tagPart || !dataPart) throw new Error("Stored bot token is corrupted");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function newWebhookSecret(): string {
  return randomBytes(32).toString("base64url");
}

/** Header secret Telegram sends back; derived so it never equals the URL path secret. */
export function webhookHeaderSecret(webhookSecret: string): string {
  return createHmac("sha256", encryptionKey()).update(`telegram-header:${webhookSecret}`).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const TELEGRAM_TOKEN_PATTERN = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;

export class TelegramError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Calls the Telegram Bot API with a specific business bot token. */
export async function telegramCall<T = unknown>(
  token: string,
  method: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error(`[telegram] ${method} network failure`, error);
    throw new TelegramError("Telegram could not be reached. Please try again.", 0);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: T;
    description?: string;
  };
  if (!response.ok || !payload.ok) {
    throw new TelegramError(payload.description ?? `Telegram ${method} failed`, response.status);
  }
  return payload.result as T;
}

export type TelegramBotInfo = {
  id: number;
  username: string;
  first_name: string;
};

export type TelegramWebhookInfo = {
  url: string;
  pending_update_count: number;
  last_error_message?: string;
  last_error_date?: number;
};

export async function getMe(token: string) {
  return telegramCall<TelegramBotInfo>(token, "getMe");
}

export async function getWebhookInfo(token: string) {
  return telegramCall<TelegramWebhookInfo>(token, "getWebhookInfo");
}

export function botWebhookUrl(botId: string, webhookSecret: string): string {
  return `${webhookBaseUrl()}/api/public/telegram/webhook/${botId}/${webhookSecret}`;
}

export async function registerWebhook(token: string, botId: string, webhookSecret: string) {
  const url = botWebhookUrl(botId, webhookSecret);
  await telegramCall(token, "setWebhook", {
    url,
    secret_token: webhookHeaderSecret(webhookSecret),
    allowed_updates: ["message", "edited_message"],
    drop_pending_updates: true,
    max_connections: 40,
  });
  return url;
}

export async function deleteWebhook(token: string) {
  return telegramCall(token, "deleteWebhook", { drop_pending_updates: true });
}

export async function sendTelegramMessage(token: string, chatId: string | number, text: string) {
  return telegramCall<{ message_id: number }>(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}
