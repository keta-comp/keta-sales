import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().optional(),
        categoryId: z.string().optional(),
        availability: z.enum(["all", "in_stock", "low_stock", "out_of_stock"]).optional(),
        sort: z.enum(["newest", "name", "price_asc", "price_desc", "stock"]).optional(),
        includeArchived: z.boolean().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase.from("products").select("*, categories(id, name)");
    if (!data.includeArchived) query = query.eq("is_archived", false);
    if (data.search) query = query.or(`name.ilike.%${data.search}%,sku.ilike.%${data.search}%`);
    if (data.categoryId && data.categoryId !== "all") query = query.eq("category_id", data.categoryId);
    if (data.sort === "name") query = query.order("name");
    else if (data.sort === "price_asc") query = query.order("price", { ascending: true });
    else if (data.sort === "price_desc") query = query.order("price", { ascending: false });
    else if (data.sort === "stock") query = query.order("stock_quantity", { ascending: true });
    else query = query.order("created_at", { ascending: false });

    const { data: rows, error } = await query.limit(500);
    if (error) throw new Error(error.message);

    const filtered = (rows ?? []).filter((p) => {
      if (!data.availability || data.availability === "all") return true;
      const free = p.stock_quantity - p.reserved_quantity;
      if (data.availability === "out_of_stock") return free <= 0;
      if (data.availability === "low_stock") return free > 0 && free <= p.low_stock_threshold;
      return free > p.low_stock_threshold;
    });
    return filtered;
  });

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().optional(),
        sku: z.string().min(1),
        name: z.string().min(1),
        category_id: z.string().nullable().optional(),
        description: z.string(),
        price: z.number().nonnegative(),
        compare_at_price: z.number().nonnegative().nullable().optional(),
        stock_quantity: z.number().int().min(0),
        low_stock_threshold: z.number().int().min(0),
        images: z.array(z.string()),
        tags: z.array(z.string()),
        specifications: z.record(z.string(), z.string()),
        is_active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      sku: data.sku,
      name: data.name,
      category_id: data.category_id || null,
      description: data.description,
      price: data.price,
      compare_at_price: data.compare_at_price ?? null,
      stock_quantity: data.stock_quantity,
      low_stock_threshold: data.low_stock_threshold,
      images: data.images,
      tags: data.tags,
      specifications: data.specifications,
      is_active: data.is_active,
    };

    if (data.id) {
      const { data: previous } = await context.supabase
        .from("products")
        .select("stock_quantity")
        .eq("id", data.id)
        .single();
      const { error } = await context.supabase.from("products").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      const delta = data.stock_quantity - (previous?.stock_quantity ?? 0);
      if (delta !== 0) {
        await context.supabase.from("inventory_movements").insert({
          product_id: data.id,
          change: delta,
          reason: "manual_adjustment",
          created_by: context.userId,
        });
      }
      return { id: data.id };
    }

    const { data: created, error } = await context.supabase
      .from("products")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.stock_quantity > 0) {
      await context.supabase.from("inventory_movements").insert({
        product_id: created.id,
        change: data.stock_quantity,
        reason: "initial_stock",
        created_by: context.userId,
      });
    }
    return { id: created.id };
  });

export const setProductArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string(), archived: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("products")
      .update({ is_archived: data.archived, is_active: !data.archived })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adjustStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string(), change: z.number().int(), reason: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: product, error: readError } = await context.supabase
      .from("products")
      .select("stock_quantity")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error(readError.message);
    const next = product.stock_quantity + data.change;
    if (next < 0) throw new Error("Stock cannot go below zero");
    const { error } = await context.supabase
      .from("products")
      .update({ stock_quantity: next })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("inventory_movements").insert({
      product_id: data.id,
      change: data.change,
      reason: data.reason,
      created_by: context.userId,
    });
    return { stock_quantity: next };
  });

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("categories").select("*").order("name");
    if (error) throw new Error(error.message);
    return data;
  });

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().optional(), name: z.string().min(1), description: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (data.id) {
      const { error } = await context.supabase
        .from("categories")
        .update({ name: data.name, slug, description: data.description ?? null })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("categories")
      .insert({ name: data.name, slug, description: data.description ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listInventoryMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("inventory_movements")
      .select("*, products(name, sku)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data;
  });