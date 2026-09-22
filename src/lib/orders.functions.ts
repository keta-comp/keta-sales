import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { compact } from "./compact";

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ status: z.string().optional(), search: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("orders")
      .select(
        "*, customers(id, full_name, telegram_username), operators(id, full_name), order_items(id, product_name, quantity, unit_price, line_total)",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status && data.status !== "all") query = query.eq("status", data.status as never);
    if (data.search) query = query.ilike("order_number", `%${data.search}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows;
  });

export const updateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string(),
        status: z
          .enum(["new", "confirming", "confirmed", "preparing", "delivered", "cancelled"])
          .optional(),
        payment_status: z.enum(["unpaid", "partial", "paid", "refunded"]).optional(),
        assigned_operator_id: z.string().nullable().optional(),
        delivery_address: z.string().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: current, error: readError } = await context.supabase
      .from("orders")
      .select("status, stock_applied")
      .eq("id", id)
      .single();
    if (readError) throw new Error(readError.message);

    // Inventory is applied exactly once, transactionally, inside the database.
    const confirming = ["confirmed", "preparing", "delivered"];
    if (patch.status && confirming.includes(patch.status) && !current.stock_applied) {
      const { error } = await context.supabase.rpc("apply_order_stock", {
        _order_id: id,
        _actor: context.userId,
      });
      if (error) throw new Error(error.message);
    }
    if (patch.status === "cancelled" && current.stock_applied) {
      const { error } = await context.supabase.rpc("revert_order_stock", {
        _order_id: id,
        _actor: context.userId,
      });
      if (error) throw new Error(error.message);
    }

    const { error } = await context.supabase.from("orders").update(compact(patch) as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        customer_id: z.string(),
        phone: z.string().optional(),
        delivery_address: z.string().optional(),
        notes: z.string().optional(),
        items: z
          .array(z.object({ product_id: z.string(), quantity: z.number().int().positive() }))
          .min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: products, error: productError } = await context.supabase
      .from("products")
      .select("id, name, sku, price")
      .in(
        "id",
        data.items.map((i) => i.product_id),
      );
    if (productError) throw new Error(productError.message);

    const lines = data.items.map((item) => {
      const product = products?.find((p) => p.id === item.product_id);
      if (!product) throw new Error("Product not found");
      return {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unit_price: Number(product.price),
        line_total: Number(product.price) * item.quantity,
      };
    });
    const total = lines.reduce((sum, l) => sum + l.line_total, 0);

    const { data: order, error } = await context.supabase
      .from("orders")
      .insert({
        customer_id: data.customer_id,
        phone: data.phone ?? null,
        delivery_address: data.delivery_address ?? null,
        notes: data.notes ?? null,
        total,
      })
      .select("id, order_number")
      .single();
    if (error) throw new Error(error.message);

    const { error: itemError } = await context.supabase
      .from("order_items")
      .insert(lines.map((l) => ({ ...l, order_id: order.id })));
    if (itemError) throw new Error(itemError.message);
    return order;
  });

export const listOperators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [operators, leads, orders] = await Promise.all([
      context.supabase.from("operators").select("*").order("created_at", { ascending: false }),
      context.supabase.from("leads").select("assigned_operator_id, status"),
      context.supabase.from("orders").select("assigned_operator_id, total, status"),
    ]);
    if (operators.error) throw new Error(operators.error.message);

    return (operators.data ?? []).map((operator) => {
      const own = (leads.data ?? []).filter((l) => l.assigned_operator_id === operator.id);
      const won = own.filter((l) => l.status === "won").length;
      const lost = own.filter((l) => l.status === "lost").length;
      const contacted = own.filter((l) =>
        ["contacted", "negotiating", "won", "lost"].includes(l.status),
      ).length;
      const revenue = (orders.data ?? [])
        .filter((o) => o.assigned_operator_id === operator.id && o.status !== "cancelled")
        .reduce((sum, o) => sum + Number(o.total), 0);
      return {
        ...operator,
        assigned_leads: own.length,
        contacted_leads: contacted,
        won_leads: won,
        lost_leads: lost,
        conversion_rate: own.length ? Math.round((won / own.length) * 1000) / 10 : 0,
        revenue,
      };
    });
  });

export const saveOperator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().optional(),
        full_name: z.string().min(1),
        telegram_username: z.string().nullable().optional(),
        telegram_user_id: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        is_active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { id, ...payload } = data;
    if (id) {
      const { error } = await context.supabase.from("operators").update(compact(payload) as never).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: created, error } = await context.supabase
      .from("operators")
      .insert(compact(payload) as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const deleteOperator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("operators").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });