/**
 * Instagram Messaging (Meta Graph API). Single-account mode, mirroring the
 * single Telegram bot: credentials live in server secrets only.
 *   INSTAGRAM_PAGE_ACCESS_TOKEN — page access token with instagram_manage_messages
 *   META_APP_SECRET             — Meta app secret (webhook signature + verify token)
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH_API = "https://graph.facebook.com/v21.0";

export function instagramAccessToken(): string {
  const token = process.env["INSTAGRAM_PAGE_ACCESS_TOKEN"];
  if (!token) throw new Error("INSTAGRAM_PAGE_ACCESS_TOKEN is not configured");
  return token.trim();
}

export function metaAppSecret(): string {
  const secret = process.env["META_APP_SECRET"];
  if (!secret) throw new Error("META_APP_SECRET is not configured");
  return secret.trim();
}

/** Webhook verify token pasted into the Meta dashboard. Prefer the explicit shared secret. */
export function instagramVerifyToken(): string {
  const explicit = process.env["INSTAGRAM_VERIFY_TOKEN"];
  if (explicit) return explicit.trim();
  return createHmac("sha256", metaAppSecret()).update("instagram-webhook-verify").digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Meta signs every webhook POST with the app secret (X-Hub-Signature-256). */
export function verifyInstagramSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected =
    "sha256=" + createHmac("sha256", metaAppSecret()).update(rawBody, "utf8").digest("hex");
  return safeEqual(signatureHeader, expected);
}

export type InstagramMessagingEvent = {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: { mid: string; text?: string; is_echo?: boolean };
};

export type InstagramWebhookPayload = {
  object: string;
  entry?: Array<{ id: string; time: number; messaging?: InstagramMessagingEvent[] }>;
};

export async function sendInstagramMessage(recipientId: string, text: string) {
  const response = await fetch(
    `${GRAPH_API}/me/messages?access_token=${encodeURIComponent(instagramAccessToken())}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: text.slice(0, 1000) },
        messaging_type: "RESPONSE",
      }),
    },
  );
  const body = (await response.json().catch(() => null)) as
    | { message_id?: string; error?: { message?: string } }
    | null;
  if (!response.ok || body?.error) {
    throw new Error(`Instagram send failed [${response.status}]: ${JSON.stringify(body)}`);
  }
  return { message_id: body?.message_id ?? null };
}

/** Best-effort profile lookup for a display name; never throws. */
export async function getInstagramProfile(userId: string): Promise<{ name: string | null; username: string | null }> {
  try {
    const response = await fetch(
      `${GRAPH_API}/${encodeURIComponent(userId)}?fields=name,username&access_token=${encodeURIComponent(instagramAccessToken())}`,
    );
    if (!response.ok) return { name: null, username: null };
    const body = (await response.json()) as { name?: string; username?: string };
    return { name: body.name ?? null, username: body.username ?? null };
  } catch {
    return { name: null, username: null };
  }
}
