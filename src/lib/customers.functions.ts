import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { compact } from "./compact";

const customerInput = z.object({
  id: z.string().optional(),
  full_name: z.string().min(1, "Ism kiritilishi shart"),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  assigned_operator_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const listCrmCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().optional(),
        status: z.string().optional(),
        source: z.string().optional(),
        operatorId: z.string().optional(),
        sort: z.enum(["recent", "name", "spent"]).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("customers")
      .select(
        "id, full_name, phone, email, location, status, source, notes, total_orders, total_spent, last_contact_at, last_interaction_at, created_at, assigned_operator_id, telegram_username, operators(id, full_name)",
      )
      .limit(500);

    if (data.status && data.status !== "all") query = query.eq("status", data.status);
    if (data.source && data.source !== "all") query = query.eq("source", data.source);
    if (data.operatorId && data.operatorId !== "all")
      query = query.eq("assigned_operator_id", data.operatorId);
    if (data.search) {
      const term = data.search.replace(/[,()]/g, " ");
      query = query.or(
        `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%,telegram_username.ilike.%${term}%`,
      );
    }

    if (data.sort === "name") query = query.order("full_name", { ascending: true });
    else if (data.sort === "spent") query = query.order("total_spent", { ascending: false });
    else query = query.order("last_interaction_at", { ascending: false });

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveCrmCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => customerInput.parse(input))
  .handler(async ({ data, context }) => {
    const { logActivity } = await import("./activity.server");
    const { id, ...payload } = data;

    if (id) {
      const { error } = await context.supabase
        .from("customers")
        .update(compact(payload) as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
      await logActivity(context.supabase, {
        entityType: "customer",
        entityId: id,
        customerId: id,
        action: "customer_updated",
        detail: `${payload.full_name} ma’lumotlari yangilandi`,
        actorUserId: context.userId,
      });
      return { id };
    }

    const { data: created, error } = await context.supabase
      .from("customers")
      .insert(compact(payload) as never)
      .select("id, full_name")
      .single();
    if (error) throw new Error(error.message);
    await logActivity(context.supabase, {
      entityType: "customer",
      entityId: created.id,
      customerId: created.id,
      action: "customer_created",
      detail: `${created.full_name ?? "Mijoz"} yaratildi`,
      actorUserId: context.userId,
    });
    return created;
  });

export const getCustomerProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const [customer, leads, orders, payments, tasks, activities, conversations] = await Promise.all([
      context.supabase
        .from("customers")
        .select("*, operators(id, full_name)")
        .eq("id", data.id)
        .single(),
      context.supabase
        .from("leads")
        .select("id, status, stage, score, source, value, next_action, created_at, requested_product")
        .eq("customer_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("orders")
        .select("id, order_number, status, payment_status, total, discount, created_at")
        .eq("customer_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("payments")
        .select("id, amount, method, status, paid_at, due_date, note, created_at, order_id")
        .eq("customer_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("tasks")
        .select("id, title, status, priority, due_date, created_at")
        .eq("customer_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("activities")
        .select("id, action, detail, actor, created_at")
        .eq("customer_id", data.id)
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("conversations")
        .select("id, channel, mode, last_message_preview, last_message_at")
        .eq("customer_id", data.id)
        .order("last_message_at", { ascending: false }),
    ]);
    if (customer.error) throw new Error(customer.error.message);
    return {
      customer: customer.data,
      leads: leads.data ?? [],
      orders: orders.data ?? [],
      payments: payments.data ?? [],
      tasks: tasks.data ?? [],
      activities: activities.data ?? [],
      conversations: conversations.data ?? [],
    };
  });

export const deleteCrmCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("customers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
