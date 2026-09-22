import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export function dayStart(offsetDays = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

const num = (v: unknown) => Number(v ?? 0);

/** Dashboard KPI strip — every value comes from the live database. */
export async function buildKpis(supabase: Client) {
  const today = dayStart().toISOString();
  const monthStart = (() => {
    const d = dayStart();
    d.setUTCDate(1);
    return d.toISOString();
  })();
  const soon = dayStart(3).toISOString().slice(0, 10);

  const [settings, paidToday, paidMonth, newCustomers, newLeads, activeLeads, newOrders, pendingPayments, openTasks] =
    await Promise.all([
      supabase.from("business_settings").select("currency").limit(1).maybeSingle(),
      supabase.from("payments").select("amount").in("status", ["paid", "partial"]).gte("paid_at", today),
      supabase.from("payments").select("amount").in("status", ["paid", "partial"]).gte("paid_at", monthStart),
      supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", today),
      supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", today),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .in("status", ["new", "needs_operator", "assigned", "contacted", "negotiating"]),
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", today),
      supabase.from("payments").select("amount, due_date").eq("status", "pending"),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .neq("status", "completed")
        .lte("due_date", soon),
    ]);

  const revenueToday = (paidToday.data ?? []).reduce((s, r) => s + num(r.amount), 0);
  const revenueMonth = (paidMonth.data ?? []).reduce((s, r) => s + num(r.amount), 0);
  const pendingRows = pendingPayments.data ?? [];
  const pendingAmount = pendingRows.reduce((s, r) => s + num(r.amount), 0);

  return {
    currency: settings.data?.currency ?? "UZS",
    revenueToday,
    revenueMonth,
    newCustomers: newCustomers.count ?? 0,
    newLeads: newLeads.count ?? 0,
    activeLeads: activeLeads.count ?? 0,
    newOrders: newOrders.count ?? 0,
    pendingPaymentsCount: pendingRows.length,
    pendingPaymentsAmount: pendingAmount,
    dueTasks: openTasks.count ?? 0,
  };
}

export interface TodoAction {
  key: string;
  count: number;
  label: string;
  to: string;
  search?: Record<string, string>;
  tone: "danger" | "warning" | "info";
}

/** "Bugun nima qilish kerak?" — derived only from real CRM rows. */
export async function buildTodoActions(supabase: Client): Promise<TodoAction[]> {
  const staleBefore = dayStart(-3).toISOString();
  const soon = dayStart(3).toISOString().slice(0, 10);
  const todayDate = dayStart().toISOString().slice(0, 10);

  const [followUp, unconfirmedOrders, duePayments, waitingLeads, overdueTasks] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .in("status", ["contacted", "negotiating", "assigned"])
      .or(`last_contact_at.is.null,last_contact_at.lt.${staleBefore}`),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "confirming"]),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lte("due_date", soon),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "needs_operator"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .neq("status", "completed")
      .lte("due_date", todayDate),
  ]);

  const actions: TodoAction[] = [
    {
      key: "follow-up",
      count: followUp.count ?? 0,
      label: "mijozga qayta aloqa qilish kerak",
      to: "/dashboard/leads",
      search: { view: "list", follow: "stale" },
      tone: "warning",
    },
    {
      key: "orders",
      count: unconfirmedOrders.count ?? 0,
      label: "buyurtma tasdiqlanmagan",
      to: "/dashboard/orders",
      search: { status: "new" },
      tone: "info",
    },
    {
      key: "payments",
      count: duePayments.count ?? 0,
      label: "to‘lov muddati yaqin",
      to: "/dashboard/payments",
      search: { status: "pending" },
      tone: "danger",
    },
    {
      key: "handoff",
      count: waitingLeads.count ?? 0,
      label: "yangi lead operatorni kutmoqda",
      to: "/dashboard/leads",
      search: { view: "list", status: "needs_operator" },
      tone: "danger",
    },
    {
      key: "tasks",
      count: overdueTasks.count ?? 0,
      label: "vazifa muddati bugun yoki kechikdi",
      to: "/dashboard/tasks",
      search: { status: "pending" },
      tone: "warning",
    },
  ];

  return actions.filter((a) => a.count > 0);
}

export async function buildSearch(supabase: Client, term: string) {
  const like = `%${term.replace(/[,()]/g, " ")}%`;
  const [customers, leads, orders, payments, tasks] = await Promise.all([
    supabase
      .from("customers")
      .select("id, full_name, phone")
      .or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
      .limit(5),
    supabase
      .from("leads")
      .select("id, requested_product, status, customers(full_name)")
      .or(`requested_product.ilike.${like},notes.ilike.${like}`)
      .limit(5),
    supabase.from("orders").select("id, order_number, total, status").ilike("order_number", like).limit(5),
    supabase.from("payments").select("id, amount, status, note").ilike("note", like).limit(5),
    supabase.from("tasks").select("id, title, status").ilike("title", like).limit(5),
  ]);

  type Hit = { type: string; id: string; title: string; subtitle: string; to: string };
  const hits: Hit[] = [];
  for (const c of customers.data ?? [])
    hits.push({
      type: "Mijoz",
      id: c.id,
      title: c.full_name ?? "Ismsiz mijoz",
      subtitle: c.phone ?? "",
      to: `/dashboard/customers/${c.id}`,
    });
  for (const l of leads.data ?? []) {
    const cust = l.customers as { full_name: string | null } | null;
    hits.push({
      type: "Murojaat",
      id: l.id,
      title: l.requested_product ?? cust?.full_name ?? "Murojaat",
      subtitle: cust?.full_name ?? "",
      to: `/dashboard/leads`,
    });
  }
  for (const o of orders.data ?? [])
    hits.push({
      type: "Buyurtma",
      id: o.id,
      title: `#${o.order_number}`,
      subtitle: String(o.total),
      to: `/dashboard/orders`,
    });
  for (const p of payments.data ?? [])
    hits.push({
      type: "To‘lov",
      id: p.id,
      title: String(p.amount),
      subtitle: p.note ?? "",
      to: `/dashboard/payments`,
    });
  for (const t of tasks.data ?? [])
    hits.push({ type: "Vazifa", id: t.id, title: t.title, subtitle: "", to: `/dashboard/tasks` });

  return hits;
}

export interface ReportResult {
  currency: string;
  from: string;
  to: string;
  kpis: {
    revenue: number;
    orders: number;
    completedOrders: number;
    leads: number;
    wonLeads: number;
    conversionRate: number;
    averageOrderValue: number;
    newCustomers: number;
    pendingPayments: number;
  };
  days: { date: string; label: string; revenue: number; orders: number; leads: number }[];
  bySource: { name: string; leads: number; customers: number }[];
  byOperator: { name: string; orders: number; revenue: number; leads: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
}

export async function buildReport(supabase: Client, from: string, to: string): Promise<ReportResult> {
  const [settings, orders, leads, customers, payments, operators, items] = await Promise.all([
    supabase.from("business_settings").select("currency").limit(1).maybeSingle(),
    supabase
      .from("orders")
      .select("id, total, status, created_at, assigned_operator_id")
      .gte("created_at", from)
      .lte("created_at", to),
    supabase
      .from("leads")
      .select("id, status, source, created_at, assigned_operator_id")
      .gte("created_at", from)
      .lte("created_at", to),
    supabase.from("customers").select("id, source, created_at").gte("created_at", from).lte("created_at", to),
    supabase.from("payments").select("amount, status, paid_at, created_at").gte("created_at", from).lte("created_at", to),
    supabase.from("operators").select("id, full_name"),
    supabase
      .from("order_items")
      .select("product_name, quantity, line_total, created_at")
      .gte("created_at", from)
      .lte("created_at", to)
      .limit(5000),
  ]);

  const orderRows = (orders.data ?? []).filter((o) => o.status !== "cancelled");
  const paymentRows = payments.data ?? [];
  const revenue = paymentRows
    .filter((p) => p.status === "paid" || p.status === "partial")
    .reduce((s, p) => s + num(p.amount), 0);
  const pendingPayments = paymentRows.filter((p) => p.status === "pending").reduce((s, p) => s + num(p.amount), 0);
  const leadRows = leads.data ?? [];
  const wonLeads = leadRows.filter((l) => l.status === "won").length;
  const completedOrders = orderRows.filter((o) => o.status === "delivered").length;
  const orderTotal = orderRows.reduce((s, o) => s + num(o.total), 0);

  // day buckets
  const dayMap = new Map<string, { date: string; label: string; revenue: number; orders: number; leads: number }>();
  const cursor = new Date(from);
  const end = new Date(to);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    dayMap.set(key, { date: key, label: key.slice(5), revenue: 0, orders: 0, leads: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  for (const p of paymentRows) {
    if (p.status !== "paid" && p.status !== "partial") continue;
    const key = (p.paid_at ?? p.created_at).slice(0, 10);
    const bucket = dayMap.get(key);
    if (bucket) bucket.revenue += num(p.amount);
  }
  for (const o of orderRows) {
    const bucket = dayMap.get(o.created_at.slice(0, 10));
    if (bucket) bucket.orders += 1;
  }
  for (const l of leadRows) {
    const bucket = dayMap.get(l.created_at.slice(0, 10));
    if (bucket) bucket.leads += 1;
  }

  // sources
  const sourceMap = new Map<string, { name: string; leads: number; customers: number }>();
  const bumpSource = (name: string, field: "leads" | "customers") => {
    const key = name || "other";
    const entry = sourceMap.get(key) ?? { name: key, leads: 0, customers: 0 };
    entry[field] += 1;
    sourceMap.set(key, entry);
  };
  for (const l of leadRows) bumpSource(l.source ?? "other", "leads");
  for (const c of customers.data ?? []) bumpSource(c.source ?? "other", "customers");

  // operators
  const operatorNames = new Map((operators.data ?? []).map((o) => [o.id, o.full_name]));
  const operatorMap = new Map<string, { name: string; orders: number; revenue: number; leads: number }>();
  const operatorEntry = (id: string | null) => {
    const key = id ?? "unassigned";
    const name = id ? (operatorNames.get(id) ?? "Operator") : "Tayinlanmagan";
    const entry = operatorMap.get(key) ?? { name, orders: 0, revenue: 0, leads: 0 };
    operatorMap.set(key, entry);
    return entry;
  };
  for (const o of orderRows) {
    const entry = operatorEntry(o.assigned_operator_id);
    entry.orders += 1;
    entry.revenue += num(o.total);
  }
  for (const l of leadRows) operatorEntry(l.assigned_operator_id).leads += 1;

  // products
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const item of items.data ?? []) {
    const entry = productMap.get(item.product_name) ?? { name: item.product_name, quantity: 0, revenue: 0 };
    entry.quantity += item.quantity;
    entry.revenue += num(item.line_total);
    productMap.set(item.product_name, entry);
  }

  return {
    currency: settings.data?.currency ?? "UZS",
    from,
    to,
    kpis: {
      revenue,
      orders: orderRows.length,
      completedOrders,
      leads: leadRows.length,
      wonLeads,
      conversionRate: leadRows.length ? Math.round((wonLeads / leadRows.length) * 1000) / 10 : 0,
      averageOrderValue: orderRows.length ? Math.round(orderTotal / orderRows.length) : 0,
      newCustomers: (customers.data ?? []).length,
      pendingPayments,
    },
    days: [...dayMap.values()],
    bySource: [...sourceMap.values()].sort((a, b) => b.leads + b.customers - (a.leads + a.customers)),
    byOperator: [...operatorMap.values()].sort((a, b) => b.revenue - a.revenue),
    topProducts: [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
  };
}
