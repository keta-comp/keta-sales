import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { compact } from "./compact";

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.string().optional(),
        score: z.string().optional(),
        search: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("leads")
      .select(
        "*, customers(id, full_name, telegram_username, phone, location), operators(id, full_name), products(id, name)",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status && data.status !== "all") query = query.eq("status", data.status as never);
    if (data.score && data.score !== "all") query = query.eq("score", data.score as never);
    if (data.search) query = query.ilike("requested_product", `%${data.search}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows;
  });

export const getLead = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const [lead, events] = await Promise.all([
      context.supabase
        .from("leads")
        .select("*, customers(*), operators(id, full_name), conversations(id)")
        .eq("id", data.id)
        .single(),
      context.supabase
        .from("lead_events")
        .select("*")
        .eq("lead_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    if (lead.error) throw new Error(lead.error.message);
    return { lead: lead.data, events: events.data ?? [] };
  });

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string(),
        status: z
          .enum(["new", "needs_operator", "assigned", "contacted", "negotiating", "won", "lost"])
          .optional(),
        score: z.enum(["hot", "warm", "cold"]).optional(),
        assigned_operator_id: z.string().nullable().optional(),
        notes: z.string().optional(),
        phone: z.string().optional(),
        budget: z.string().optional(),
        location: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("leads").update(compact(patch) as never).eq("id", id);
    if (error) throw new Error(error.message);
    if (patch.assigned_operator_id) {
      await context.supabase
        .from("operator_assignments")
        .upsert(
          { lead_id: id, operator_id: patch.assigned_operator_id, assigned_by: context.userId },
          { onConflict: "lead_id,operator_id" },
        );
    }
    await context.supabase.from("lead_events").insert({
      lead_id: id,
      event_type: "lead_updated",
      detail: Object.keys(patch).join(", "),
      actor: "operator",
    });
    return { ok: true };
  });

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ search: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("customers")
      .select("*")
      .order("last_interaction_at", { ascending: false })
      .limit(300);
    if (data.search)
      query = query.or(
        `full_name.ilike.%${data.search}%,telegram_username.ilike.%${data.search}%,phone.ilike.%${data.search}%`,
      );
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows;
  });

export const getCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const [customer, leads, orders, conversations] = await Promise.all([
      context.supabase.from("customers").select("*").eq("id", data.id).single(),
      context.supabase
        .from("leads")
        .select("*")
        .eq("customer_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("orders")
        .select("*")
        .eq("customer_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("conversations")
        .select("*")
        .eq("customer_id", data.id)
        .order("last_message_at", { ascending: false }),
    ]);
    if (customer.error) throw new Error(customer.error.message);
    return {
      customer: customer.data,
      leads: leads.data ?? [],
      orders: orders.data ?? [],
      conversations: conversations.data ?? [],
    };
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string(),
        full_name: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        location: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("customers").update(compact(patch) as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ mode: z.string().optional(), search: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("conversations")
      .select("*, customers(id, full_name, telegram_username), operators(id, full_name)")
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (data.mode && data.mode !== "all") query = query.eq("mode", data.mode as never);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const term = data.search?.toLowerCase();
    const filtered = term
      ? (rows ?? []).filter((row) => {
          const c = row.customers as { full_name: string | null; telegram_username: string | null } | null;
          return (
            (c?.full_name ?? "").toLowerCase().includes(term) ||
            (c?.telegram_username ?? "").toLowerCase().includes(term) ||
            (row.last_message_preview ?? "").toLowerCase().includes(term)
          );
        })
      : (rows ?? []);

    const ids = filtered.map((r) => r.id);
    const leadMap: Record<string, { status: string; score: string }> = {};
    if (ids.length) {
      const { data: leadRows } = await context.supabase
        .from("leads")
        .select("conversation_id, status, score")
        .in("conversation_id", ids);
      for (const lead of leadRows ?? []) {
        if (lead.conversation_id) leadMap[lead.conversation_id] = { status: lead.status, score: lead.score };
      }
    }
    return filtered.map((row) => ({ ...row, lead: leadMap[row.id] ?? null }));
  });

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const [conversation, messages] = await Promise.all([
      context.supabase
        .from("conversations")
        .select("*, customers(*), operators(id, full_name)")
        .eq("id", data.id)
        .single(),
      context.supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", data.id)
        .order("created_at", { ascending: true }),
    ]);
    if (conversation.error) throw new Error(conversation.error.message);
    await context.supabase.from("conversations").update({ unread_count: 0 }).eq("id", data.id);
    return { conversation: conversation.data, messages: messages.data ?? [] };
  });

export const setConversationMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string(), mode: z.enum(["ai", "human"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("conversations")
      .update({ mode: data.mode })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendOperatorMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: z.string(), content: z.string().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: conversation, error } = await context.supabase
      .from("conversations")
      .select("id, telegram_chat_id, business_id, channel")
      .eq("id", data.conversationId)
      .single();
    if (error) throw new Error(error.message);
    if (!conversation.telegram_chat_id) throw new Error("Suhbatga bog'langan chat topilmadi");

    let telegramMessageId: number | null = null;
    if ((conversation as { channel?: string }).channel === "instagram") {
      const { sendInstagramMessage } = await import("./instagram.server");
      try {
        await sendInstagramMessage(conversation.telegram_chat_id, data.content);
      } catch (sendError) {
        console.error("[operator-message]", sendError);
        throw new Error(
          sendError instanceof Error ? sendError.message : "Instagram xabarini yetkazib bo'lmadi",
        );
      }
    } else {
      const { getActiveBot } = await import("./bots.server");
      const { sendTelegramMessage } = await import("./telegram.server");
      const bot = await getActiveBot(conversation.business_id);
      if (!bot) throw new Error("Connect your Telegram bot in Settings before replying.");
      try {
        const sent = await sendTelegramMessage(bot.token, conversation.telegram_chat_id, data.content);
        telegramMessageId = sent.message_id;
      } catch (sendError) {
        console.error("[operator-message]", sendError);
        throw new Error(
          sendError instanceof Error ? sendError.message : "Could not deliver the Telegram message",
        );
      }
    }

    const { error: insertError } = await context.supabase.from("messages").insert({
      conversation_id: data.conversationId,
      role: "operator",
      content: data.content,
      telegram_message_id: telegramMessageId,
    });
    if (insertError) throw new Error(insertError.message);
    await context.supabase
      .from("conversations")
      .update({
        mode: "human",
        last_message_at: new Date().toISOString(),
        last_message_preview: data.content.slice(0, 160),
      })
      .eq("id", data.conversationId);
    return { ok: true };
  });