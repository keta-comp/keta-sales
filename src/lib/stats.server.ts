import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

function startOfToday() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export async function buildOverview(supabase: Client) {
  const today = startOfToday();

  const [leadsToday, newLeads, hotLeads, needsOperator, ordersToday, revenueRows, convToday, messages, currency] =
    await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", today),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("score", "hot"),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "needs_operator"),
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", today),
      supabase.from("orders").select("total, status, created_at").gte("created_at", today),
      supabase.from("conversations").select("id", { count: "exact", head: true }).gte("last_message_at", today),
      supabase
        .from("messages")
        .select("role, created_at, conversation_id")
        .gte("created_at", daysAgo(1).toISOString())
        .order("created_at", { ascending: true })
        .limit(2000),
      supabase.from("business_settings").select("currency").limit(1).maybeSingle(),
    ]);

  const revenueToday = (revenueRows.data ?? [])
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total), 0);

  const leadsTodayCount = leadsToday.count ?? 0;
  const ordersTodayCount = ordersToday.count ?? 0;

  // average AI response time: customer message -> next AI message in same conversation
  const rows = messages.data ?? [];
  const pending = new Map<string, number>();
  const deltas: number[] = [];
  for (const row of rows) {
    const ts = new Date(row.created_at).getTime();
    if (row.role === "customer") pending.set(row.conversation_id, ts);
    else if (row.role === "ai") {
      const started = pending.get(row.conversation_id);
      if (started) {
        deltas.push((ts - started) / 1000);
        pending.delete(row.conversation_id);
      }
    }
  }
  const avgResponseSeconds = deltas.length
    ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10
    : 0;

  return {
    currency: currency.data?.currency ?? "UZS",
    leadsToday: leadsTodayCount,
    newLeads: newLeads.count ?? 0,
    hotLeads: hotLeads.count ?? 0,
    humanHandoffs: needsOperator.count ?? 0,
    ordersToday: ordersTodayCount,
    revenueToday,
    aiConversationsToday: convToday.count ?? 0,
    conversionRate: leadsTodayCount ? Math.round((ordersTodayCount / leadsTodayCount) * 1000) / 10 : 0,
    avgResponseSeconds,
  };
}

export async function buildAnalytics(supabase: Client) {
  const from = daysAgo(29).toISOString();

  const [leads, orders, items, currency] = await Promise.all([
    supabase.from("leads").select("created_at, status, score").gte("created_at", from),
    supabase.from("orders").select("created_at, total, status").gte("created_at", from),
    supabase.from("order_items").select("product_name, quantity, line_total").limit(2000),
    supabase.from("business_settings").select("currency").limit(1).maybeSingle(),
  ]);

  const days: {
    date: string;
    label: string;
    leads: number;
    orders: number;
    revenue: number;
    conversion: number;
  }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      date: key,
      label: key.slice(5),
      leads: 0,
      orders: 0,
      revenue: 0,
      conversion: 0,
    });
  }
  const index = new Map(days.map((d) => [d.date, d]));

  for (const lead of leads.data ?? []) {
    const bucket = index.get(lead.created_at.slice(0, 10));
    if (bucket) bucket.leads += 1;
  }
  for (const order of orders.data ?? []) {
    const bucket = index.get(order.created_at.slice(0, 10));
    if (!bucket) continue;
    bucket.orders += 1;
    if (order.status !== "cancelled") bucket.revenue += Number(order.total);
  }
  for (const day of days) {
    day.conversion = day.leads ? Math.round((day.orders / day.leads) * 1000) / 10 : 0;
  }

  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const item of items.data ?? []) {
    const entry = productMap.get(item.product_name) ?? {
      name: item.product_name,
      quantity: 0,
      revenue: 0,
    };
    entry.quantity += item.quantity;
    entry.revenue += Number(item.line_total);
    productMap.set(item.product_name, entry);
  }
  const topProducts = [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  const leadRows = leads.data ?? [];
  const funnel = {
    total: leadRows.length,
    hot: leadRows.filter((l) => l.score === "hot").length,
    warm: leadRows.filter((l) => l.score === "warm").length,
    cold: leadRows.filter((l) => l.score === "cold").length,
    won: leadRows.filter((l) => l.status === "won").length,
    lost: leadRows.filter((l) => l.status === "lost").length,
  };

  return { days, topProducts, funnel, currency: currency.data?.currency ?? "UZS" };
}