import { createFileRoute } from "@tanstack/react-router";

import type { InstagramMessagingEvent, InstagramWebhookPayload } from "@/lib/instagram.server";

export const Route = createFileRoute("/api/public/instagram/webhook")({
  server: {
    handlers: {
      // Meta dashboard handshake: verifies the callback URL once.
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token") ?? "";
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        const ig = await import("@/lib/instagram.server");
        if (mode === "subscribe" && challenge && ig.safeEqual(token, ig.instagramVerifyToken())) {
          return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const [ig, agentMod, single, { supabaseAdmin }, perf] = await Promise.all([
          import("@/lib/instagram.server"),
          import("@/lib/agent.server"),
          import("@/lib/single-bot.server"),
          import("@/integrations/supabase/client.server"),
          import("@/lib/perf.server"),
        ]);
        const timer = perf.createTimer();

        const rawBody = await request.text();
        if (!ig.verifyInstagramSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: InstagramWebhookPayload;
        try {
          payload = JSON.parse(rawBody) as InstagramWebhookPayload;
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }

        const events = (payload.entry ?? []).flatMap((entry) => entry.messaging ?? []);
        // Only real customer text messages; echoes and non-text events are ignored.
        const incoming = events.filter((e) => e.message && !e.message.is_echo && e.message.text?.trim());
        if (incoming.length === 0) return Response.json({ ok: true, ignored: true });

        const businessId = await single.singleBusinessId();

        // Idempotency: Meta retries deliveries. Unique mid rejects duplicates.
        const fresh: typeof incoming = [];
        for (const event of incoming) {
          const { error } = await supabaseAdmin
            .from("instagram_events")
            .insert({ mid: event.message!.mid, payload: event as never });
          if (!error) fresh.push(event);
        }
        if (fresh.length === 0) return Response.json({ ok: true, duplicate: true });

        timer.mark("webhook_ack_ms");
        const ackMs = timer.total();

        const task = perf.runBackground(async () => {
          const work = perf.createTimer();
          for (const event of fresh) {
            const senderId = event.sender.id;
            const text = event.message!.text!.trim();
            try {
              const profile = await ig.getInstagramProfile(senderId);
              const customer = await agentMod.getOrCreateCustomer({
                businessId,
                instagramUserId: senderId,
                fullName: profile.name,
                instagramUsername: profile.username,
              });
              work.mark("customer_lookup_ms");

              const conversation = await agentMod.getOrCreateConversation(
                businessId,
                customer.id,
                senderId,
                "instagram",
              );
              work.mark("conversation_lookup_ms");

              const [, settingsRes, currentRes] = await Promise.all([
                agentMod.saveMessage({
                  businessId,
                  conversationId: conversation.id,
                  role: "customer",
                  content: text,
                  metadata: { channel: "instagram", instagram_mid: event.message!.mid },
                }),
                agentMod.getSettings(businessId),
                supabaseAdmin
                  .from("conversations")
                  .select("mode, last_message_at")
                  .eq("id", conversation.id)
                  .maybeSingle(),
              ]);

              supabaseAdmin
                .from("conversations")
                .update({ unread_count: (conversation.unread_count ?? 0) + 1 })
                .eq("id", conversation.id)
                .then(undefined, (e: unknown) => console.error("[unread]", e));

              if (settingsRes.ai?.enabled === false) continue;

              // Same human-takeover rule as Telegram: operator active → AI silent,
              // resumes on /start or after 30 idle minutes.
              if (currentRes.data?.mode === "human") {
                const { data: lastOperator } = await supabaseAdmin
                  .from("messages")
                  .select("created_at")
                  .eq("conversation_id", conversation.id)
                  .eq("role", "operator")
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                const lastAt = lastOperator?.created_at ? Date.parse(lastOperator.created_at) : 0;
                if (!/^\/start\b/.test(text) && Date.now() - lastAt < 30 * 60 * 1000) continue;
                await supabaseAdmin.from("conversations").update({ mode: "ai" }).eq("id", conversation.id);
              }

              const result = await agentMod.runSalesAgent({
                businessId,
                customerId: customer.id,
                conversationId: conversation.id,
                latestText: text,
              });

              if (result.error) {
                await ig.sendInstagramMessage(
                  senderId,
                  "Bir ozdan keyin yana urinib ko'ring yoki operator bilan bog'lanishingiz mumkin.",
                );
                console.error("[instagram-latency]", { ...work.result(), webhook_ack_ms: ackMs, ai_error: result.error });
                continue;
              }

              const sendStart = Date.now();
              const sent = await ig.sendInstagramMessage(senderId, result.reply);
              work.set("instagram_send_ms", Date.now() - sendStart);

              const timings = { webhook_ack_ms: ackMs, ...work.result(), ...(result.timings ?? {}) };
              console.error("[instagram-latency]", timings);

              perf.runBackground(
                () =>
                  agentMod.saveMessage({
                    businessId,
                    conversationId: conversation.id,
                    role: "ai",
                    content: result.reply,
                    metadata: {
                      channel: "instagram",
                      instagram_mid: sent.message_id,
                      escalated: result.escalated,
                      lead_id: result.leadId,
                      timings,
                    },
                  }),
                "save-ai-message",
              );
            } catch (error) {
              console.error("[instagram-webhook]", error);
              try {
                await ig.sendInstagramMessage(
                  senderId,
                  "Bir ozdan keyin yana urinib ko'ring yoki operator bilan bog'lanishingiz mumkin.",
                );
              } catch (sendError) {
                console.error("[instagram-webhook] fallback send failed", sendError);
              }
            }
          }
        }, "instagram-message");

        if (!perf.hasWaitUntil()) {
          await task;
          await perf.drainBackground();
        }

        return Response.json({ ok: true, ack_ms: ackMs });
      },
    },
  },
});
