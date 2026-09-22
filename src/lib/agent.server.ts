import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gatewayErrorMessage, resolveAiRuntime } from "./ai-gateway.server";
import { getActiveBot } from "./bots.server";
import { getCrmAgentContext, type CrmAgentContext } from "./crm-config.server";
import { createTimer, runBackground, withTimeout, type Timings } from "./perf.server";
import { sendTelegramMessage } from "./telegram.server";

type Json = Record<string, unknown>;

export type AgentResult = {
  reply: string;
  escalated: boolean;
  leadId: string | null;
  error?: string;
  timings?: Timings;
};

function money(value: number | null, currency: string) {
  if (value === null || value === undefined) return "-";
  return `${new Intl.NumberFormat("en-US").format(Number(value))} ${currency}`;
}

function availability(stock: number, reserved: number, threshold: number) {
  const free = stock - reserved;
  if (free <= 0) return "out_of_stock";
  if (free <= threshold) return "low_stock";
  return "in_stock";
}

type BusinessSettingsRow = {
  business_name: string | null;
  business_description: string | null;
  working_hours: string | null;
  delivery_info: string | null;
  payment_methods: string | null;
  return_policy: string | null;
  currency: string | null;
  operator_group_chat_id: string | null;
};

type AiSettingsRow = {
  model: string | null;
  tone_of_voice: string | null;
  sales_strategy: string | null;
  language_instruction: string | null;
  escalation_rules: string | null;
  max_discount_percent: number | null;
  custom_instructions: string | null;
  enabled: boolean | null;
};

type SettingsBundle = {
  business: BusinessSettingsRow | null;
  ai: AiSettingsRow | null;
};

const SETTINGS_TTL_MS = 60_000;
const settingsCache = new Map<string, { at: number; value: SettingsBundle }>();

/** Business + AI settings change rarely, so they are cached per business for a short window. */
export async function getSettings(businessId: string, useCache = true): Promise<SettingsBundle> {
  const cached = settingsCache.get(businessId);
  if (useCache && cached && Date.now() - cached.at < SETTINGS_TTL_MS) return cached.value;

  const [{ data: business }, { data: ai }] = await Promise.all([
    supabaseAdmin
      .from("business_settings")
      .select(
        "business_name, business_description, working_hours, delivery_info, payment_methods, return_policy, currency, operator_group_chat_id",
      )
      .eq("business_id", businessId)
      .maybeSingle(),
    supabaseAdmin
      .from("ai_settings")
      .select(
        "model, tone_of_voice, sales_strategy, language_instruction, escalation_rules, max_discount_percent, custom_instructions, enabled",
      )
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);
  const value: SettingsBundle = { business, ai };
  settingsCache.set(businessId, { at: Date.now(), value });
  return value;
}

/** Called after the dashboard changes settings so the next message uses fresh values. */
export function invalidateSettingsCache(businessId: string) {
  settingsCache.delete(businessId);
}

export async function getOrCreateCustomer(input: {
  businessId: string;
  telegramUserId?: string;
  instagramUserId?: string;
  telegramUsername?: string | null;
  instagramUsername?: string | null;
  fullName?: string | null;
}) {
  const channelColumn = input.instagramUserId ? "instagram_user_id" : "telegram_user_id";
  const channelValue = input.instagramUserId ?? input.telegramUserId;
  if (!channelValue) throw new Error("customer channel id is required");

  const { data: existing } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, phone, location, telegram_username")
    .eq("business_id", input.businessId)
    .eq(channelColumn, channelValue)
    .maybeSingle();

  if (existing) {
    // Touch-up write is not on the reply path.
    runBackground(
      () =>
        supabaseAdmin
          .from("customers")
          .update({
            last_interaction_at: new Date().toISOString(),
            telegram_username: input.telegramUsername ?? existing.telegram_username,
            full_name: existing.full_name ?? input.fullName ?? null,
          })
          .eq("id", existing.id) as unknown as Promise<unknown>,
      "customer-touch",
    );
    return existing;
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .insert({
      business_id: input.businessId,
      telegram_user_id: input.telegramUserId ?? null,
      instagram_user_id: input.instagramUserId ?? null,
      telegram_username: input.telegramUsername ?? input.instagramUsername ?? null,
      full_name: input.fullName ?? null,
    })
    .select("id, full_name, phone, location, telegram_username")
    .single();
  if (error) throw error;
  return data;
}

export async function getOrCreateConversation(
  businessId: string,
  customerId: string,
  telegramChatId: string,
  channel: "telegram" | "instagram" = "telegram",
) {
  const { data: existing } = await supabaseAdmin
    .from("conversations")
    .select("id, mode, unread_count")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("telegram_chat_id", telegramChatId)
    .eq("channel", channel)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from("conversations")
    .insert({ business_id: businessId, customer_id: customerId, telegram_chat_id: telegramChatId, channel })
    .select("id, mode, unread_count")
    .single();
  if (error) throw error;
  return data;
}

export async function saveMessage(input: {
  businessId: string;
  conversationId: string;
  role: "customer" | "ai" | "operator" | "system";
  content: string;
  telegramMessageId?: number | null;
  operatorId?: string | null;
  metadata?: Json;
}) {
  // Both writes are independent — run them concurrently and skip the read-back.
  const [{ error }] = await Promise.all([
    supabaseAdmin.from("messages").insert({
      business_id: input.businessId,
      conversation_id: input.conversationId,
      role: input.role,
      content: input.content,
      telegram_message_id: input.telegramMessageId ?? null,
      operator_id: input.operatorId ?? null,
      metadata: (input.metadata ?? {}) as never,
    }),
    supabaseAdmin
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: input.content.slice(0, 160),
      })
      .eq("id", input.conversationId),
  ]);
  if (error) throw error;
  return { ok: true };
}

const SIMPLE_PATTERNS =
  /^(salom|assalom\w*|assalomu alaykum|hayrli\s\w+|hi|hello|hey|good (morning|evening|afternoon)|rahmat|thanks|thank you|ok|xayr|bye)[\s!.,?]*$/i;

/** Small talk needs no catalog tools — one fast LLM call is enough. */
function isSmallTalk(text: string | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return trimmed.length <= 30 && SIMPLE_PATTERNS.test(trimmed);
}

export async function notifyOperatorGroup(businessId: string, leadId: string, reason: string) {
  const { business } = await getSettings(businessId);
  const chatId = business?.operator_group_chat_id;
  if (!chatId) return { sent: false, reason: "operator_group_chat_id is not configured" };

  const bot = await getActiveBot(businessId);
  if (!bot) return { sent: false, reason: "no active Telegram bot for this business" };

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("*, customers(full_name, telegram_username, phone, location)")
    .eq("business_id", businessId)
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { sent: false, reason: "lead not found" };

  const customer = lead.customers as {
    full_name: string | null;
    telegram_username: string | null;
    phone: string | null;
    location: string | null;
  } | null;

  const icon = lead.score === "hot" ? "🔥" : lead.score === "warm" ? "🟡" : "🔵";
  const text = [
    `${icon} <b>NEW ${lead.score.toUpperCase()} LEAD</b>`,
    "",
    `<b>Business:</b> ${business?.business_name ?? "-"}`,
    `<b>Customer:</b> ${customer?.full_name ?? "Unknown"}`,
    `<b>Telegram:</b> ${customer?.telegram_username ? "@" + customer.telegram_username : "-"}`,
    `<b>Phone:</b> ${lead.phone ?? customer?.phone ?? "-"}`,
    `<b>Product:</b> ${lead.requested_product ?? "-"}`,
    `<b>Budget:</b> ${lead.budget ?? "-"}`,
    `<b>Location:</b> ${lead.location ?? customer?.location ?? "-"}`,
    `<b>Status:</b> ${lead.status}`,
    "",
    `<b>Reason for handoff:</b>`,
    reason || lead.handoff_reason || "-",
    "",
    `<b>Conversation summary:</b>`,
    lead.ai_summary ?? "-",
  ].join("\n");

  try {
    await sendTelegramMessage(bot.token, chatId, text);
    await supabaseAdmin.from("lead_events").insert({
      business_id: businessId,
      lead_id: leadId,
      event_type: "operator_notified",
      detail: "Lead sent to operator group",
      actor: "system",
    });
    return { sent: true };
  } catch (error) {
    console.error("[operator-notify]", error);
    return { sent: false, reason: error instanceof Error ? error.message : "telegram error" };
  }
}

const PRODUCT_SELECT =
  "id, sku, name, description, price, compare_at_price, stock_quantity, reserved_quantity, low_stock_threshold, tags, specifications, category_id, categories(name)";

function shapeProductRow(p: Record<string, any>, currency: string) {
  return {
    id: p["id"],
    sku: p["sku"],
    name: p["name"],
    category: p["categories"]?.name ?? null,
    description: p["description"],
    price: money(p["price"], currency),
    price_raw: Number(p["price"]),
    compare_at_price: p["compare_at_price"] ? money(p["compare_at_price"], currency) : null,
    availability: availability(p["stock_quantity"], p["reserved_quantity"], p["low_stock_threshold"]),
    available_units: Math.max(0, p["stock_quantity"] - p["reserved_quantity"]),
    specifications: p["specifications"],
    tags: p["tags"],
  };
}

const STOPWORDS = new Set([
  "salom","assalomu","alaykum","rahmat","narxi","qancha","bormi","bor","yoq","yo'q","men","siz","bu",
  "the","a","is","hi","hello","how","much","price","do","you","have","want","need","and","for","what",
]);

/**
 * Targeted catalog pre-search from the customer's own words, so the model usually
 * needs zero tool round trips to answer a product question.
 */
export async function prefetchProducts(businessId: string, text: string, currency: string) {
  const terms = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
    .slice(0, 4);
  if (!terms.length) return [];
  const or = terms.map((t) => `name.ilike.%${t}%,description.ilike.%${t}%,sku.ilike.%${t}%`).join(",");
  const { data } = await supabaseAdmin
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("business_id", businessId)
    .eq("is_active", true)
    .eq("is_archived", false)
    .or(or)
    .limit(6);
  return (data ?? []).map((row) => shapeProductRow(row as Record<string, any>, currency));
}

function buildSystemPrompt(
  business: BusinessSettingsRow | null,
  ai: AiSettingsRow | null,
  customer: { full_name: string | null; phone: string | null; location: string | null },
  prefetched: ReturnType<typeof shapeProductRow>[],
  crmContext?: CrmAgentContext | null,
) {
  const crmBlock = crmContext
    ? [
        "BUSINESS DOMAIN CONTEXT (from the owner's CRM setup — reflect it in your wording):",
        `Industry: ${crmContext.industry}`,
        crmContext.description ? `Industry notes: ${crmContext.description}` : "",
        `CRM terminology to use for this business: ${JSON.stringify(crmContext.terminology)}`,
        `Sales pipeline stages: ${crmContext.pipelineStages.join(" → ")}`,
        `Active CRM modules: ${crmContext.moduleLabels.join(", ")}`,
      ]
    : [];
  return [
    `You are the AI sales agent for "${business?.business_name ?? "the business"}".`,
    `Business description: ${business?.business_description ?? "-"}`,
    `Working hours: ${business?.working_hours ?? "-"}`,
    `Delivery: ${business?.delivery_info ?? "-"}`,
    `Payment methods: ${business?.payment_methods ?? "-"}`,
    `Return policy: ${business?.return_policy ?? "-"}`,
    `Currency: ${business?.currency ?? "UZS"}`,
    `Maximum discount you may mention: ${ai?.max_discount_percent ?? 0}%`,
    ...crmBlock,
    `Tone of voice: ${ai?.tone_of_voice ?? "professional"}`,
    `Sales strategy: ${ai?.sales_strategy ?? ""}`,
    `Language: ${ai?.language_instruction ?? "Reply in the customer's language."}`,
    `Escalation rules: ${ai?.escalation_rules ?? ""}`,
    ai?.custom_instructions ? `Extra instructions: ${ai.custom_instructions}` : "",
    "",
    "GOAL: maximize sales honestly. Understand intent, find matching products with tools,",
    "explain value, handle objections, offer in-stock alternatives, upsell relevant accessories,",
    "ask for purchase intent, collect name/phone/address, then create a lead and an order.",
    "",
    "HARD RULES:",
    "- NEVER invent products, stock, prices, discounts, specs or delivery promises. Every fact must come from a tool result.",
    "- If a product is out of stock, say so plainly and offer real alternatives from search_alternatives.",
    "- Keep replies short (max ~4 sentences), no markdown tables, no emoji spam.",
    "- Business facts above (hours, delivery, payment, returns) are already final: answer those directly, never call a tool for them.",
    "- Prefer the PRE-FETCHED CATALOG RESULTS below; only call search_products when they do not answer the question.",
    "- Answer in ONE turn whenever possible. Do not chain tool calls you do not need.",
    "- Call create_lead (or update_lead) once you know what the customer wants; skip it for pure small talk.",
    "- Set lead score: hot when the customer signals buying (olaman, buyurtma, payment/delivery questions, gives phone), warm when interested, cold when just browsing.",
    "- Call request_human_operator when the customer asks for a human, negotiates a discount above the allowed maximum, complains, has a payment/delivery problem, or is a high-value ready buyer.",
    "- Only call create_order after the customer confirmed the product, quantity, phone and delivery address.",
    "",
    `Known customer info: name=${customer.full_name ?? "unknown"}, phone=${customer.phone ?? "unknown"}, location=${customer.location ?? "unknown"}.`,
    prefetched.length
      ? `\nPRE-FETCHED CATALOG RESULTS (live data, matched to the customer's last message):\n${JSON.stringify(prefetched)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runSalesAgent(params: {
  businessId: string;
  customerId: string;
  conversationId: string;
  latestText?: string;
}): Promise<AgentResult> {
  const timer = createTimer();
  const runtime = resolveAiRuntime();
  if ("error" in runtime) {
    return { reply: "", escalated: false, leadId: null, error: runtime.error };
  }

  // Settings come from the short-lived cache; the rest loads concurrently.
  const settings = await getSettings(params.businessId);
  const business = settings.business;
  const ai = settings.ai;
  const currency = business?.currency ?? "UZS";
  timer.mark("settings_ms");

  const [customerRes, historyRes, leadRes, prefetched] = await Promise.all([
    supabaseAdmin
      .from("customers")
      .select("id, full_name, phone, location")
      .eq("business_id", params.businessId)
      .eq("id", params.customerId)
      .maybeSingle(),
    supabaseAdmin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", params.conversationId)
      .order("created_at", { ascending: false })
      .limit(14),
    supabaseAdmin
      .from("leads")
      .select("id")
      .eq("business_id", params.businessId)
      .eq("customer_id", params.customerId)
      .not("status", "in", "(won,lost)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    params.latestText && !isSmallTalk(params.latestText)
      ? prefetchProducts(params.businessId, params.latestText, currency).catch(() => [])
      : Promise.resolve([]),
  ]);
  timer.mark("context_load_ms");

  const customer = customerRes.data;
  const history = (historyRes.data ?? []).slice().reverse();
  const openLead = leadRes.data;

  let leadId: string | null = openLead?.id ?? null;
  let escalated = false;

  const productSelect =
    "id, sku, name, description, price, compare_at_price, stock_quantity, reserved_quantity, low_stock_threshold, tags, specifications, category_id, categories(name)";

  const shapeProduct = (p: Record<string, any>) => ({
    id: p["id"],
    sku: p["sku"],
    name: p["name"],
    category: p["categories"]?.name ?? null,
    description: p["description"],
    price: money(p["price"], currency),
    price_raw: Number(p["price"]),
    compare_at_price: p["compare_at_price"] ? money(p["compare_at_price"], currency) : null,
    availability: availability(p["stock_quantity"], p["reserved_quantity"], p["low_stock_threshold"]),
    available_units: Math.max(0, p["stock_quantity"] - p["reserved_quantity"]),
    specifications: p["specifications"],
    tags: p["tags"],
  });

  const upsertLead = async (input: Record<string, unknown>) => {
    if (leadId) {
      const { data, error } = await supabaseAdmin
        .from("leads")
        .update(input as never)
        .eq("business_id", params.businessId)
        .eq("id", leadId)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    }
    const { data, error } = await supabaseAdmin
      .from("leads")
      .insert({
        business_id: params.businessId,
        customer_id: params.customerId,
        conversation_id: params.conversationId,
        ...(input as object),
      } as never)
      .select("id")
      .single();
    if (error) throw error;
    leadId = data.id;
    return data.id;
  };

  const tools = {
    search_products: tool({
      description: "Search the real product inventory by keywords. Use this before naming any product.",
      inputSchema: z.object({ query: z.string(), only_available: z.boolean().optional() }),
      execute: async ({ query, only_available }) => {
        const terms = query.split(/\s+/).filter(Boolean).slice(0, 4);
        let builder = supabaseAdmin
          .from("products")
          .select(productSelect)
          .eq("business_id", params.businessId)
          .eq("is_active", true)
          .eq("is_archived", false)
          .limit(12);
        if (terms.length) {
          const or = terms
            .map((t) => `name.ilike.%${t}%,description.ilike.%${t}%,sku.ilike.%${t}%`)
            .join(",");
          builder = builder.or(or);
        }
        const { data, error } = await builder;
        if (error) return { error: error.message };
        let items = (data ?? []).map(shapeProduct);
        if (only_available) items = items.filter((i) => i.availability !== "out_of_stock");
        return { count: items.length, products: items };
      },
    }),
    get_product: tool({
      description: "Get full details for one product by id.",
      inputSchema: z.object({ product_id: z.string() }),
      execute: async ({ product_id }) => {
        const { data, error } = await supabaseAdmin
          .from("products")
          .select(productSelect)
          .eq("business_id", params.businessId)
          .eq("id", product_id)
          .maybeSingle();
        if (error) return { error: error.message };
        if (!data) return { error: "not_found" };
        return shapeProduct(data);
      },
    }),
    check_stock: tool({
      description: "Check live stock availability of a product.",
      inputSchema: z.object({ product_id: z.string() }),
      execute: async ({ product_id }) => {
        const { data, error } = await supabaseAdmin
          .from("products")
          .select("name, stock_quantity, reserved_quantity, low_stock_threshold")
          .eq("business_id", params.businessId)
          .eq("id", product_id)
          .maybeSingle();
        if (error) return { error: error.message };
        if (!data) return { error: "not_found" };
        return {
          name: data.name,
          available_units: Math.max(0, data.stock_quantity - data.reserved_quantity),
          availability: availability(
            data.stock_quantity,
            data.reserved_quantity,
            data.low_stock_threshold,
          ),
        };
      },
    }),
    search_alternatives: tool({
      description:
        "Find in-stock alternatives to a product, optionally within a maximum budget. Use when a product is unavailable or too expensive.",
      inputSchema: z.object({
        product_id: z.string().optional(),
        category: z.string().optional(),
        max_price: z.number().optional(),
      }),
      execute: async ({ product_id, category, max_price }) => {
        let categoryId: string | null = null;
        if (product_id) {
          const { data } = await supabaseAdmin
            .from("products")
            .select("category_id")
            .eq("business_id", params.businessId)
            .eq("id", product_id)
            .maybeSingle();
          categoryId = data?.category_id ?? null;
        }
        if (!categoryId && category) {
          const { data } = await supabaseAdmin
            .from("categories")
            .select("id")
            .eq("business_id", params.businessId)
            .ilike("name", `%${category}%`)
            .maybeSingle();
          categoryId = data?.id ?? null;
        }
        let builder = supabaseAdmin
          .from("products")
          .select(productSelect)
          .eq("business_id", params.businessId)
          .eq("is_active", true)
          .eq("is_archived", false)
          .gt("stock_quantity", 0)
          .order("price", { ascending: true })
          .limit(10);
        if (categoryId) builder = builder.eq("category_id", categoryId);
        if (product_id) builder = builder.neq("id", product_id);
        if (max_price) builder = builder.lte("price", max_price);
        const { data, error } = await builder;
        if (error) return { error: error.message };
        return { products: (data ?? []).map(shapeProduct) };
      },
    }),
    create_lead: tool({
      description: "Create or update the CRM lead for this customer with what you learned.",
      inputSchema: z.object({
        requested_product: z.string().optional(),
        product_id: z.string().optional(),
        budget: z.string().optional(),
        location: z.string().optional(),
        phone: z.string().optional(),
        customer_name: z.string().optional(),
        score: z.enum(["hot", "warm", "cold"]).optional(),
        ai_summary: z.string().optional(),
      }),
      execute: async (input) => {
        const patch: Record<string, unknown> = {};
        if (input.requested_product) patch["requested_product"] = input.requested_product;
        if (input.product_id) patch["product_id"] = input.product_id;
        if (input.budget) patch["budget"] = input.budget;
        if (input.location) patch["location"] = input.location;
        if (input.phone) patch["phone"] = input.phone;
        if (input.score) patch["score"] = input.score;
        if (input.ai_summary) patch["ai_summary"] = input.ai_summary;
        const id = await upsertLead(patch);
        if (input.customer_name || input.phone || input.location) {
          await supabaseAdmin
            .from("customers")
            .update({
              ...(input.customer_name ? { full_name: input.customer_name } : {}),
              ...(input.phone ? { phone: input.phone } : {}),
              ...(input.location ? { location: input.location } : {}),
            })
            .eq("id", params.customerId);
        }
        runBackground(
          () =>
            supabaseAdmin.from("lead_events").insert({
              business_id: params.businessId,
              lead_id: id,
              event_type: "lead_updated_by_ai",
              detail: input.ai_summary ?? "Lead details captured",
            }) as unknown as Promise<unknown>,
          "lead-event",
        );
        return { lead_id: id, ok: true };
      },
    }),
    update_lead: tool({
      description: "Update the existing lead status, score or summary.",
      inputSchema: z.object({
        score: z.enum(["hot", "warm", "cold"]).optional(),
        status: z.enum(["new", "needs_operator", "contacted", "negotiating", "won", "lost"]).optional(),
        ai_summary: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async (input) => {
        const id = await upsertLead(input as Record<string, unknown>);
        return { lead_id: id, ok: true };
      },
    }),
    create_order: tool({
      description:
        "Create a real order. Only call after the customer confirmed products, quantity, phone and delivery address.",
      inputSchema: z.object({
        items: z.array(z.object({ product_id: z.string(), quantity: z.number() })),
        phone: z.string(),
        delivery_address: z.string(),
        notes: z.string().optional(),
      }),
      execute: async (input) => {
        if (!input.items.length) return { error: "no items" };
        const ids = input.items.map((i) => i.product_id);
        const { data: products, error: prodErr } = await supabaseAdmin
          .from("products")
          .select("id, name, sku, price, stock_quantity, reserved_quantity")
          .eq("business_id", params.businessId)
          .in("id", ids);
        if (prodErr) return { error: prodErr.message };
        if (!products?.length) return { error: "products not found" };

        const lines = input.items.map((item) => {
          const product = products.find((p) => p.id === item.product_id);
          if (!product) throw new Error("Product not found");
          const free = product.stock_quantity - product.reserved_quantity;
          if (free < item.quantity) {
            throw new Error(`Only ${Math.max(0, free)} units of ${product.name} available`);
          }
          const quantity = Math.max(1, Math.floor(item.quantity));
          return {
            product_id: product.id,
            product_name: product.name,
            sku: product.sku,
            quantity,
            unit_price: Number(product.price),
            line_total: Number(product.price) * quantity,
          };
        });

        const total = lines.reduce((sum, l) => sum + l.line_total, 0);
        const leadRef = await upsertLead({ status: "negotiating", score: "hot" });
        const { data: order, error } = await supabaseAdmin
          .from("orders")
          .insert({
            business_id: params.businessId,
            customer_id: params.customerId,
            conversation_id: params.conversationId,
            lead_id: leadRef,
            phone: input.phone,
            delivery_address: input.delivery_address,
            notes: input.notes ?? null,
            total,
          })
          .select("id, order_number")
          .single();
        if (error) return { error: error.message };

        const { error: itemsError } = await supabaseAdmin
          .from("order_items")
          .insert(lines.map((l) => ({ ...l, order_id: order.id, business_id: params.businessId })));
        if (itemsError) return { error: itemsError.message };

        escalated = true;
        // Customer never waits for CRM side effects or the operator notification.
        runBackground(async () => {
          await Promise.all([
            supabaseAdmin
              .from("customers")
              .update({ phone: input.phone, location: input.delivery_address })
              .eq("id", params.customerId),
            supabaseAdmin.from("lead_events").insert({
              business_id: params.businessId,
              lead_id: leadRef,
              event_type: "order_created",
              detail: `Order ${order.order_number} created by AI`,
            }),
          ]);
          await notifyOperatorGroup(
            params.businessId,
            leadRef,
            `New order ${order.order_number} needs confirmation.`,
          );
        }, "order-side-effects");
        return {
          ok: true,
          order_number: order.order_number,
          total: money(total, currency),
        };
      },
    }),
    request_human_operator: tool({
      description: "Hand the conversation over to a human operator and notify the operator group.",
      inputSchema: z.object({
        reason: z.string(),
        summary: z.string(),
        score: z.enum(["hot", "warm", "cold"]).optional(),
      }),
      execute: async ({ reason, summary, score }) => {
        const id = await upsertLead({
          status: "needs_operator",
          handoff_reason: reason,
          ai_summary: summary,
          ...(score ? { score } : {}),
        });
        await supabaseAdmin
          .from("conversations")
          .update({ mode: "human" })
          .eq("id", params.conversationId);
        escalated = true;
        runBackground(async () => {
          await supabaseAdmin.from("lead_events").insert({
            business_id: params.businessId,
            lead_id: id,
            event_type: "handoff_requested",
            detail: reason,
          });
          await notifyOperatorGroup(params.businessId, id, reason);
        }, "handoff-notify");
        return { ok: true, lead_id: id, operator_notified: true };
      },
    }),
  } as const;

  // Low-latency default model for normal sales chat.
  const model = ai?.model || runtime.defaultModel;

  try {
    const crmContext = await getCrmAgentContext(params.businessId).catch(() => null);
    const llmStart = Date.now();
    const smallTalk = isSmallTalk(params.latestText);
    const result = await withTimeout(
      generateText({
        model: runtime.model(model),
        system: buildSystemPrompt(
          business,
          ai,
          {
            full_name: customer?.full_name ?? null,
            phone: customer?.phone ?? null,
            location: customer?.location ?? null,
          },
          prefetched,
          crmContext,
        ),
        messages: history.map((m) => ({
          role: m.role === "customer" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        })),
        // Small talk skips the tool catalog entirely: one round trip, no tool hops.
        ...(smallTalk ? {} : { tools, stopWhen: stepCountIs(4) }),
        // Short sales replies generate faster and read better in Telegram.
        maxOutputTokens: 400,
        abortSignal: AbortSignal.timeout(12_000),
      }),
      13_000,
      "AI generation",
    );
    timer.set("llm_total_ms", Date.now() - llmStart);
    timer.set("llm_steps", result.steps?.length ?? 1);

    const reply = result.text.trim();
    return {
      reply: reply || "Kechirasiz, savolingizni qayta yozib yuborsangiz — yordam beraman.",
      escalated,
      leadId,
      timings: timer.result(),
    };
  } catch (error) {
    console.error("[ai-agent]", error);
    return { reply: "", escalated, leadId, error: gatewayErrorMessage(error), timings: timer.result() };
  }
}