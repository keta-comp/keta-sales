import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { compact } from "./compact";

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.string().optional(),
        priority: z.string().optional(),
        operatorId: z.string().optional(),
        customerId: z.string().optional(),
        search: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("tasks")
      .select("*, customers(id, full_name), operators(id, full_name), orders(id, order_number)")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status && data.status !== "all") query = query.eq("status", data.status);
    if (data.priority && data.priority !== "all") query = query.eq("priority", data.priority);
    if (data.operatorId && data.operatorId !== "all")
      query = query.eq("assigned_operator_id", data.operatorId);
    if (data.customerId) query = query.eq("customer_id", data.customerId);
    if (data.search) query = query.ilike("title", `%${data.search}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().optional(),
        title: z.string().min(1, "Sarlavha kerak"),
        description: z.string().nullable().optional(),
        assigned_operator_id: z.string().nullable().optional(),
        customer_id: z.string().nullable().optional(),
        lead_id: z.string().nullable().optional(),
        order_id: z.string().nullable().optional(),
        due_date: z.string().nullable().optional(),
        priority: z.enum(["low", "medium", "high"]),
        status: z.enum(["pending", "in_progress", "completed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { logActivity } = await import("./activity.server");
    const { id, ...payload } = data;
    const row = {
      ...payload,
      completed_at: payload.status === "completed" ? new Date().toISOString() : null,
      created_by: context.userId,
    };

    if (id) {
      const { error } = await context.supabase
        .from("tasks")
        .update(compact(row) as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
      await logActivity(context.supabase, {
        entityType: "task",
        entityId: id,
        customerId: payload.customer_id ?? null,
        action: payload.status === "completed" ? "task_completed" : "task_updated",
        detail: payload.title,
        actorUserId: context.userId,
      });
      return { id };
    }

    const { data: created, error } = await context.supabase
      .from("tasks")
      .insert(compact(row) as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logActivity(context.supabase, {
      entityType: "task",
      entityId: created.id,
      customerId: payload.customer_id ?? null,
      action: "task_created",
      detail: payload.title,
      actorUserId: context.userId,
    });
    return created;
  });

export const setTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string(), status: z.enum(["pending", "in_progress", "completed"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks")
      .update({
        status: data.status,
        completed_at: data.status === "completed" ? new Date().toISOString() : null,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
