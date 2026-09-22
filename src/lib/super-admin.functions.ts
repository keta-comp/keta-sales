import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Every function here verifies platform-level authorization inside the handler.
 *  Frontend route guards are convenience only — this is the real boundary. */
async function requireSuperAdmin(context: { supabase: any; userId: string; claims?: any }) {
  const { data, error } = await context.supabase.rpc("is_super_admin");
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Ruxsat yo‘q: faqat Super Admin");
  const { data: profile } = await context.supabase
    .from("profiles")
    .select("email")
    .eq("id", context.userId)
    .maybeSingle();
  return { email: (profile?.email as string | null) ?? null };
}

export const amISuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("is_super_admin");
    return data === true;
  });

export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context);
    const { buildOverview } = await import("./super-admin.server");
    return buildOverview();
  });

export const listOrganizationsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().optional(),
        industry: z.string().optional(),
        plan: z.string().optional(),
        status: z.string().optional(),
        sort: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { listOrganizations } = await import("./super-admin.server");
    return listOrganizations(data);
  });

export const getOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { getOrganizationDetail } = await import("./super-admin.server");
    return getOrganizationDetail(data.id);
  });

const ORG_STATUSES = ["active", "trial", "suspended", "cancelled"] as const;
const PLANS = ["free", "starter", "business", "enterprise"] as const;

export const setOrganizationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(ORG_STATUSES),
        reason: z.string().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./audit.server");

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("name, status")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("businesses")
      .update({
        status: data.status,
        suspended_at: data.status === "suspended" ? new Date().toISOString() : null,
        suspend_reason: data.status === "suspended" ? data.reason ?? null : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await logAudit({
      actorUserId: context.userId,
      actorEmail: actor.email,
      actorKind: "super_admin",
      action: data.status === "suspended" ? "organization_suspended" : "organization_reactivated",
      targetType: "organization",
      targetId: data.id,
      targetLabel: business?.name ?? null,
      businessId: data.id,
      metadata: { from: business?.status ?? null, to: data.status, reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const setOrganizationPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), plan: z.enum(PLANS) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./audit.server");

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("name, plan")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("businesses").update({ plan: data.plan }).eq("id", data.id);
    if (error) throw new Error(error.message);

    await logAudit({
      actorUserId: context.userId,
      actorEmail: actor.email,
      actorKind: "super_admin",
      action: "plan_changed",
      targetType: "organization",
      targetId: data.id,
      targetLabel: business?.name ?? null,
      businessId: data.id,
      metadata: { from: business?.plan ?? null, to: data.plan },
    });
    return { ok: true };
  });

export const listUsersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ search: z.string().optional(), status: z.string().optional(), role: z.string().optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { listPlatformUsers } = await import("./super-admin.server");
    return listPlatformUsers(data);
  });

export const getPlatformUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { getUserDetail } = await import("./super-admin.server");
    return getUserDetail(data.id);
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "suspended", "pending"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await requireSuperAdmin(context);
    if (data.id === context.userId) throw new Error("O‘z hisobingizni bloklay olmaysiz");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./audit.server");

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name, status")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("profiles").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);

    await logAudit({
      actorUserId: context.userId,
      actorEmail: actor.email,
      actorKind: "super_admin",
      action: data.status === "suspended" ? "user_suspended" : "user_reactivated",
      targetType: "user",
      targetId: data.id,
      targetLabel: target?.email ?? target?.full_name ?? null,
      metadata: { from: target?.status ?? null, to: data.status },
    });
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        role: z.enum(["owner", "admin", "manager", "operator"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./audit.server");

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("business_members")
      .update({ role: data.role })
      .eq("user_id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.role });

    await logAudit({
      actorUserId: context.userId,
      actorEmail: actor.email,
      actorKind: "super_admin",
      action: "role_changed",
      targetType: "user",
      targetId: data.id,
      targetLabel: target?.email ?? target?.full_name ?? null,
      metadata: { to: data.role },
    });
    return { ok: true };
  });

export const sendPasswordResetFor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const actor = await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./audit.server");

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.id)
      .maybeSingle();
    if (!target?.email) throw new Error("Email topilmadi");

    // Password itself is never readable — only a reset link can be issued.
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(target.email);
    if (error) throw new Error(error.message);

    await logAudit({
      actorUserId: context.userId,
      actorEmail: actor.email,
      actorKind: "super_admin",
      action: "password_reset_sent",
      targetType: "user",
      targetId: data.id,
      targetLabel: target.email,
    });
    return { ok: true };
  });

export const getSaasAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ from: z.string(), to: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { buildSaasAnalytics } = await import("./super-admin.server");
    return buildSaasAnalytics(data.from, data.to);
  });

export const getAiUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ from: z.string(), to: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { buildAiUsage } = await import("./super-admin.server");
    return buildAiUsage(data.from, data.to);
  });

export const getAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        action: z.string().optional(),
        businessId: z.string().optional(),
        search: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { listAuditLogs } = await import("./super-admin.server");
    return listAuditLogs(data);
  });

export const getSecurityOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context);
    const { buildSecurityOverview } = await import("./super-admin.server");
    return buildSecurityOverview();
  });

export const superAdminSearch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ term: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const term = data.term.trim();
    if (term.length < 2) return [];
    const { platformSearch } = await import("./super-admin.server");
    return platformSearch(term);
  });

export const getSystemSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("system_settings").select("*").limit(1).maybeSingle();
    return data;
  });

export const saveSystemSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        platform_name: z.string().min(1),
        support_email: z.string().email(),
        support_phone: z.string().min(3),
        default_timezone: z.string().min(1),
        default_currency: z.string().min(1),
        maintenance_mode: z.boolean(),
        maintenance_message: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./audit.server");

    const payload = { ...data, maintenance_message: data.maintenance_message ?? null };
    const { data: current } = await supabaseAdmin.from("system_settings").select("id").limit(1).maybeSingle();
    if (current) {
      const { error } = await supabaseAdmin.from("system_settings").update(payload).eq("id", current.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("system_settings").insert(payload);
      if (error) throw new Error(error.message);
    }

    await logAudit({
      actorUserId: context.userId,
      actorEmail: actor.email,
      actorKind: "super_admin",
      action: "system_settings_changed",
      targetType: "system",
      metadata: { maintenance_mode: data.maintenance_mode },
    });
    return { ok: true };
  });

export const getFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: flags }, { data: businesses }] = await Promise.all([
      supabaseAdmin.from("feature_flags").select("*").order("label"),
      supabaseAdmin.from("businesses").select("id, name, plan").order("name"),
    ]);
    return { flags: flags ?? [], businesses: businesses ?? [] };
  });

export const saveFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        key: z.string().min(1),
        label: z.string().min(1),
        enabled: z.boolean(),
        target_plan: z.string().nullable().optional(),
        target_business_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./audit.server");

    const { error } = await supabaseAdmin.from("feature_flags").upsert(
      {
        key: data.key,
        label: data.label,
        enabled: data.enabled,
        target_plan: data.target_plan ?? null,
        target_business_id: data.target_business_id ?? null,
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);

    await logAudit({
      actorUserId: context.userId,
      actorEmail: actor.email,
      actorKind: "super_admin",
      action: "feature_flag_changed",
      targetType: "feature_flag",
      targetId: data.key,
      targetLabel: data.label,
      metadata: { enabled: data.enabled, target_plan: data.target_plan ?? null },
    });
    return { ok: true };
  });

export const listSystemNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("system_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const sendSystemNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(2),
        body: z.string().min(2),
        kind: z.enum(["info", "warning", "maintenance"]),
        target_kind: z.enum(["all", "organization", "plan", "industry"]),
        target_value: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./audit.server");

    if (data.target_kind !== "all" && !data.target_value) throw new Error("Maqsadni tanlang");

    const { error } = await supabaseAdmin.from("system_notifications").insert({
      title: data.title,
      body: data.body,
      kind: data.kind,
      target_kind: data.target_kind,
      target_value: data.target_value ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);

    await logAudit({
      actorUserId: context.userId,
      actorEmail: actor.email,
      actorKind: "super_admin",
      action: "notification_sent",
      targetType: "notification",
      targetLabel: data.title,
      metadata: { kind: data.kind, target: data.target_kind, value: data.target_value ?? null },
    });
    return { ok: true };
  });

export const exportPlatformExcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(["organizations", "users", "analytics", "usage"]),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { buildWorkbookBase64 } = await import("./excel.server");
    const { listOrganizations, listPlatformUsers, buildSaasAnalytics, buildAiUsage } = await import(
      "./super-admin.server"
    );

    const from = data.from ?? new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const to = data.to ?? new Date().toISOString();

    if (data.kind === "organizations") {
      const { rows } = await listOrganizations({});
      return {
        filename: "organizations.xlsx",
        base64: buildWorkbookBase64([
          {
            name: "Organizations",
            rows: rows.map((r) => ({
              Organization: r.name,
              Owner: r.ownerName ?? "",
              Email: r.ownerEmail ?? "",
              Soha: r.industry ?? "",
              Foydalanuvchilar: r.users,
              Plan: r.plan,
              Holat: r.status,
              Yaratilgan: r.createdAt,
              "Oxirgi faollik": r.lastActiveAt ?? "",
            })),
          },
        ]),
      };
    }

    if (data.kind === "users") {
      const rows = await listPlatformUsers({});
      return {
        filename: "users.xlsx",
        base64: buildWorkbookBase64([
          {
            name: "Users",
            rows: rows.map((r) => ({
              Ism: r.name ?? "",
              Email: r.email ?? "",
              Telefon: r.phone ?? "",
              Organization: r.organization ?? "",
              Rol: r.role,
              Soha: r.industry ?? "",
              Holat: r.status,
              Yaratilgan: r.createdAt,
              "Oxirgi faollik": r.lastActiveAt ?? "",
            })),
          },
        ]),
      };
    }

    if (data.kind === "analytics") {
      const report = await buildSaasAnalytics(from, to);
      return {
        filename: "analytics.xlsx",
        base64: buildWorkbookBase64([
          {
            name: "Umumiy",
            rows: [
              { "Ko‘rsatkich": "Yangi organizationlar", Qiymat: report.newOrganizations },
              { "Ko‘rsatkich": "Yangi foydalanuvchilar", Qiymat: report.newUsers },
              { "Ko‘rsatkich": "Faol organizationlar", Qiymat: report.activeOrganizations },
              { "Ko‘rsatkich": "Faol foydalanuvchilar", Qiymat: report.activeUsers },
              { "Ko‘rsatkich": "Retention %", Qiymat: report.retention ?? "ma’lumot yetarli emas" },
              { "Ko‘rsatkich": "Churn %", Qiymat: report.churn ?? "ma’lumot yetarli emas" },
            ],
          },
          { name: "O‘sish", rows: report.growth },
          { name: "Sohalar", rows: report.industries },
        ]),
      };
    }

    const usage = await buildAiUsage(from, to);
    return {
      filename: "ai-usage.xlsx",
      base64: buildWorkbookBase64([
        {
          name: "Umumiy",
          rows: [
            { "Ko‘rsatkich": "Jami so‘rovlar", Qiymat: usage.totals.total },
            { "Ko‘rsatkich": "Bugun", Qiymat: usage.totals.today },
            { "Ko‘rsatkich": "Bu oy", Qiymat: usage.totals.thisMonth },
          ],
        },
        {
          name: "Organizationlar",
          rows: usage.byOrganization.map((o) => ({
            Organization: o.label,
            "So‘rovlar": o.requests,
            Tokenlar: o.tokens,
          })),
        },
        {
          name: "Foydalanuvchilar",
          rows: usage.byUser.map((u) => ({ Foydalanuvchi: u.label, "So‘rovlar": u.requests, Tokenlar: u.tokens })),
        },
      ]),
    };
  });
