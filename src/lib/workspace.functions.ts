import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayErrorMessage, resolveAiRuntime } from "./ai-gateway.server";
import { crmLabel } from "./crm-core";

export const getDashboardKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildKpis, buildTodoActions } = await import("./workspace.server");
    const [kpis, todos] = await Promise.all([
      buildKpis(context.supabase),
      buildTodoActions(context.supabase),
    ]);
    return { kpis, todos };
  });

export const globalSearch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ term: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const term = data.term.trim();
    if (term.length < 2) return [];
    const { buildSearch } = await import("./workspace.server");
    return buildSearch(context.supabase, term);
  });

export const getReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ from: z.string(), to: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { buildReport } = await import("./workspace.server");
    return buildReport(context.supabase, data.from, data.to);
  });

export const exportReportExcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ from: z.string(), to: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { buildReport } = await import("./workspace.server");
    const { buildWorkbookBase64 } = await import("./excel.server");

    const [report, customers, leads, orders, payments] = await Promise.all([
      buildReport(context.supabase, data.from, data.to),
      context.supabase
        .from("customers")
        .select("full_name, phone, email, status, source, total_orders, total_spent, created_at")
        .gte("created_at", data.from)
        .lte("created_at", data.to),
      context.supabase
        .from("leads")
        .select("requested_product, status, score, source, value, phone, created_at")
        .gte("created_at", data.from)
        .lte("created_at", data.to),
      context.supabase
        .from("orders")
        .select("order_number, status, payment_status, total, discount, created_at")
        .gte("created_at", data.from)
        .lte("created_at", data.to),
      context.supabase
        .from("payments")
        .select("amount, method, status, paid_at, due_date, note, created_at")
        .gte("created_at", data.from)
        .lte("created_at", data.to),
    ]);

    const base64 = buildWorkbookBase64([
      {
        name: "Xulosa",
        rows: [
          { "Ko‘rsatkich": "Tushum", "Qiymat": report.kpis.revenue },
          { "Ko‘rsatkich": "Buyurtmalar", "Qiymat": report.kpis.orders },
          { "Ko‘rsatkich": "Yakunlangan buyurtmalar", "Qiymat": report.kpis.completedOrders },
          { "Ko‘rsatkich": "Murojaatlar", "Qiymat": report.kpis.leads },
          { "Ko‘rsatkich": "Konversiya (%)", "Qiymat": report.kpis.conversionRate },
          { "Ko‘rsatkich": "O‘rtacha buyurtma", "Qiymat": report.kpis.averageOrderValue },
          { "Ko‘rsatkich": "Yangi mijozlar", "Qiymat": report.kpis.newCustomers },
          { "Ko‘rsatkich": "Kutilayotgan to‘lovlar", "Qiymat": report.kpis.pendingPayments },
        ],
      },
      {
        name: "Mijozlar",
        rows: (customers.data ?? []).map((c) => ({
          Ism: c.full_name,
          Telefon: c.phone,
          Email: c.email,
          Holat: crmLabel(c.status),
          Manba: crmLabel(c.source),
          Buyurtmalar: c.total_orders,
          "Jami xarid": c.total_spent,
          Yaratilgan: c.created_at,
        })),
      },
      {
        name: "Murojaatlar",
        rows: (leads.data ?? []).map((l) => ({
          Mahsulot: l.requested_product,
          Holat: l.status,
          "Baho": l.score,
          Manba: crmLabel(l.source),
          Summa: l.value,
          Telefon: l.phone,
          Yaratilgan: l.created_at,
        })),
      },
      {
        name: "Buyurtmalar",
        rows: (orders.data ?? []).map((o) => ({
          Raqam: o.order_number,
          Holat: o.status,
          "To‘lov holati": o.payment_status,
          Summa: o.total,
          Chegirma: o.discount,
          Yaratilgan: o.created_at,
        })),
      },
      {
        name: "To‘lovlar",
        rows: (payments.data ?? []).map((p) => ({
          Summa: p.amount,
          Usul: crmLabel(p.method),
          Holat: crmLabel(p.status),
          "To‘langan sana": p.paid_at,
          Muddat: p.due_date,
          Izoh: p.note,
        })),
      },
    ]);

    return { base64, filename: `nexora-crm-hisobot-${data.from.slice(0, 10)}_${data.to.slice(0, 10)}.xlsx` };
  });

export const askBusinessAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ question: z.string().min(2).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const runtime = resolveAiRuntime();
    if ("error" in runtime) throw new Error(runtime.error);

    const { buildKpis, buildReport, buildTodoActions, dayStart } = await import("./workspace.server");
    const from = dayStart(-29).toISOString();
    const to = new Date().toISOString();

    const [kpis, report, todos, followUps, openTasks] = await Promise.all([
      buildKpis(context.supabase),
      buildReport(context.supabase, from, to),
      buildTodoActions(context.supabase),
      context.supabase
        .from("leads")
        .select("requested_product, status, last_contact_at, customers(full_name, phone)")
        .in("status", ["contacted", "negotiating", "assigned", "needs_operator"])
        .order("last_contact_at", { ascending: true, nullsFirst: true })
        .limit(15),
      context.supabase
        .from("tasks")
        .select("title, due_date, priority, status")
        .neq("status", "completed")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(15),
    ]);

    const snapshot = {
      valyuta: kpis.currency,
      bugun: {
        tushum: kpis.revenueToday,
        yangi_mijozlar: kpis.newCustomers,
        yangi_murojaatlar: kpis.newLeads,
        yangi_buyurtmalar: kpis.newOrders,
      },
      oylik_tushum: kpis.revenueMonth,
      faol_leadlar: kpis.activeLeads,
      kutilayotgan_tolovlar: {
        soni: kpis.pendingPaymentsCount,
        summa: kpis.pendingPaymentsAmount,
      },
      oxirgi_30_kun: report.kpis,
      kunlik_dinamika: report.days.slice(-14),
      manbalar: report.bySource,
      operatorlar: report.byOperator,
      top_mahsulotlar: report.topProducts,
      bugungi_vazifalar: todos.map((t) => `${t.count} ${t.label}`),
      qayta_aloqa_kerak: (followUps.data ?? []).map((l) => {
        const c = l.customers as { full_name: string | null; phone: string | null } | null;
        return {
          mijoz: c?.full_name ?? null,
          telefon: c?.phone ?? null,
          holat: l.status,
          oxirgi_aloqa: l.last_contact_at,
          mahsulot: l.requested_product,
        };
      }),
      ochiq_vazifalar: openTasks.data ?? [],
    };

    const prompt = [
      "Siz NEXORA CRM ichidagi biznes tahlilchisisiz. Faqat berilgan REAL ma'lumotlar asosida javob bering.",
      "Qoidalar:",
      "- Hech qachon taxminiy yoki uydirma raqam bermang.",
      "- Agar ma'lumot yetarli bo'lmasa, aynan shu gapni yozing: \"Bu ma'lumotni aniqlash uchun yetarli ma'lumot mavjud emas.\"",
      "- O'zbek tilida, qisqa va aniq javob bering. Raqamlarni valyuta bilan ko'rsating.",
      "- Kerak bo'lsa 3-5 punktli ro'yxat ishlating.",
      "",
      "REAL MA'LUMOTLAR (JSON):",
      JSON.stringify(snapshot),
      "",
      `SAVOL: ${data.question}`,
    ].join("\n");

    try {
      const result = await generateText({
        model: runtime.model(runtime.defaultModel),
        prompt,
        maxOutputTokens: 700,
      });
      const answer = result.text.trim();
      return {
        answer: answer || "Bu ma'lumotni aniqlash uchun yetarli ma'lumot mavjud emas.",
      };
    } catch (error) {
      throw new Error(gatewayErrorMessage(error));
    }
  });
