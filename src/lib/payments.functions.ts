import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { compact } from "./compact";

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.string().optional(),
        method: z.string().optional(),
        search: z.string().optional(),
        customerId: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("payments")
      .select(
        "*, customers(id, full_name, phone), orders(id, order_number, total)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status && data.status !== "all") query = query.eq("status", data.status);
    if (data.method && data.method !== "all") query = query.eq("method", data.method);
    if (data.customerId) query = query.eq("customer_id", data.customerId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const term = data.search?.trim().toLowerCase();
    if (!term) return rows ?? [];
    return (rows ?? []).filter((row) => {
      const customer = row.customers as { full_name: string | null } | null;
      const order = row.orders as { order_number: string | null } | null;
      return (
        (customer?.full_name ?? "").toLowerCase().includes(term) ||
        (order?.order_number ?? "").toLowerCase().includes(term) ||
        (row.note ?? "").toLowerCase().includes(term)
      );
    });
  });

export const savePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().optional(),
        customer_id: z.string().nullable().optional(),
        order_id: z.string().nullable().optional(),
        amount: z.number().nonnegative(),
        method: z.string(),
        status: z.enum(["pending", "paid", "partial", "refunded"]),
        due_date: z.string().nullable().optional(),
        note: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { logActivity } = await import("./activity.server");
    const { id, ...payload } = data;
    const paidAt = payload.status === "paid" || payload.status === "partial" ? new Date().toISOString() : null;
    const row = { ...payload, paid_at: paidAt, created_by: context.userId };

    if (id) {
      const { error } = await context.supabase
        .from("payments")
        .update(compact(row) as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
      await logActivity(context.supabase, {
        entityType: "payment",
        entityId: id,
        customerId: payload.customer_id ?? null,
        action: "payment_updated",
        detail: `To‘lov yangilandi: ${payload.amount}`,
        actorUserId: context.userId,
      });
      return { id };
    }

    const { data: created, error } = await context.supabase
      .from("payments")
      .insert(compact(row) as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logActivity(context.supabase, {
      entityType: "payment",
      entityId: created.id,
      customerId: payload.customer_id ?? null,
      action: payload.status === "paid" ? "payment_received" : "payment_created",
      detail: `To‘lov: ${payload.amount}`,
      actorUserId: context.userId,
    });

    // Keep the order's payment status aligned with the money actually recorded.
    if (payload.order_id) await syncOrderPaymentStatus(context.supabase, payload.order_id);

    if (payload.status === "paid") {
      const { notifyCurrentBusiness } = await import("./telegram-notify.server");
      await notifyCurrentBusiness(
        context.supabase as never,
        "payment",
        `💳 <b>To‘lov qabul qilindi</b>\n${Math.round(payload.amount).toLocaleString("ru-RU")}`,
      );
    }
    return created;
  });

export const deletePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("payments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type AnyClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => Promise<{ data: unknown }> & {
        single: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
    update: (patch: unknown) => { eq: (col: string, val: string) => Promise<unknown> };
  };
};

async function syncOrderPaymentStatus(supabase: unknown, orderId: string) {
  const client = supabase as AnyClient;
  const paid = (await client.from("payments").select("amount, status").eq("order_id", orderId)) as {
    data: { amount: number | string; status: string }[] | null;
  };
  const order = (await client.from("orders").select("total").eq("id", orderId).single()) as {
    data: { total: number | string } | null;
  };
  if (!order.data) return;
  const total = Number(order.data.total ?? 0);
  const sum = (paid.data ?? [])
    .filter((p) => p.status === "paid" || p.status === "partial")
    .reduce((acc, p) => acc + Number(p.amount), 0);
  const status = sum <= 0 ? "unpaid" : sum >= total ? "paid" : "partial";
  await client.from("orders").update({ payment_status: status }).eq("id", orderId);
}
