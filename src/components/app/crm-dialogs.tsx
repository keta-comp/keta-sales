import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveCrmCustomer } from "@/lib/customers.functions";
import { savePayment } from "@/lib/payments.functions";
import { saveTask } from "@/lib/tasks.functions";
import { createQuickLead, createQuickOrder, listPickers } from "@/lib/quick.functions";
import {
  CUSTOMER_SOURCES,
  CUSTOMER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_RECORD_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  crmLabel,
  quickActionLabels,
  type QuickActionKey,
} from "@/lib/crm-core";
import { t } from "@/lib/i18n";

const NONE = "__none__";

export function usePickers(enabled = true) {
  const fetchPickers = useServerFn(listPickers);
  return useQuery({ queryKey: ["pickers"], queryFn: () => fetchPickers(), enabled, staleTime: 30_000 });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [
      "customers",
      "customer",
      "leads",
      "orders",
      "payments",
      "tasks",
      "kpis",
      "report",
      "pickers",
      "activities",
    ]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

type CustomerSeed = {
  id?: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  status?: string | null;
  source?: string | null;
  assigned_operator_id?: string | null;
  notes?: string | null;
};

export function CustomerDialog({
  open,
  onOpenChange,
  customer,
  title = "Yangi mijoz",
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  customer?: CustomerSeed | undefined;
  title?: string;
}) {
  const save = useServerFn(saveCrmCustomer);
  const invalidate = useInvalidate();
  const pickers = usePickers(open);
  const [form, setForm] = useState<CustomerSeed>({});

  useEffect(() => {
    if (open) setForm(customer ?? { status: "active", source: "manual" });
  }, [open, customer]);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...(form.id ? { id: form.id } : {}),
          full_name: (form.full_name ?? "").trim(),
          phone: form.phone ?? null,
          email: form.email ?? null,
          location: form.location ?? null,
          status: form.status ?? "active",
          source: form.source ?? "manual",
          assigned_operator_id: form.assigned_operator_id ?? null,
          notes: form.notes ?? null,
        },
      }),
    onSuccess: () => {
      toast.success(t("Mijoz saqlandi"));
      invalidate();
      onOpenChange(false);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : t("Saqlab bo‘lmadi")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? t("Mijozni tahrirlash") : title}</DialogTitle>
          <DialogDescription>{t("Faqat kerakli maydonlarni to‘ldiring.")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t("Ism *")}>
              <Input
                value={form.full_name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder={t("Ali Valiyev")}
              />
            </Field>
          </div>
          <Field label={t("Telefon")}>
            <Input
              value={form.phone ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+998 90 123 45 67"
            />
          </Field>
          <Field label={t("Email")}>
            <Input
              value={form.email ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
          <Field label={t("Holat")}>
            <Select
              value={form.status ?? "active"}
              onValueChange={(value) => setForm((f) => ({ ...f, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {crmLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("Manba")}>
            <Select
              value={form.source ?? "manual"}
              onValueChange={(value) => setForm((f) => ({ ...f, source: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {crmLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("Manzil")}>
            <Input
              value={form.location ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
          </Field>
          <Field label={t("Mas’ul")}>
            <Select
              value={form.assigned_operator_id ?? NONE}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, assigned_operator_id: value === NONE ? null : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Tanlanmagan")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("Tanlanmagan")}</SelectItem>
                {(pickers.data?.operators ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("Izoh")}>
              <Textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Bekor qilish")}
          </Button>
          <Button
            disabled={!form.full_name?.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t("Saqlash")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LeadDialog({
  open,
  onOpenChange,
  defaultCustomerId,
  stages,
  label = "Yangi murojaat",
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  defaultCustomerId?: string | undefined;
  stages?: string[] | undefined;
  label?: string;
}) {
  const create = useServerFn(createQuickLead);
  const pickers = usePickers(open);
  const invalidate = useInvalidate();
  const [form, setForm] = useState<{
    customer_id: string;
    requested_product: string;
    source: string;
    value: string;
    stage: string;
    next_action: string;
    assigned_operator_id: string;
    notes: string;
  }>({
    customer_id: defaultCustomerId ?? "",
    requested_product: "",
    source: "manual",
    value: "",
    stage: stages?.[0] ?? "Yangi",
    next_action: "",
    assigned_operator_id: NONE,
    notes: "",
  });

  useEffect(() => {
    if (open)
      setForm((f) => ({
        ...f,
        customer_id: defaultCustomerId ?? f.customer_id,
        stage: stages?.[0] ?? "Yangi",
      }));
  }, [open, defaultCustomerId, stages]);

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          customer_id: form.customer_id,
          requested_product: form.requested_product || null,
          source: form.source,
          value: Number(form.value || 0),
          stage: form.stage,
          next_action: form.next_action || null,
          notes: form.notes || null,
          assigned_operator_id: form.assigned_operator_id === NONE ? null : form.assigned_operator_id,
        },
      }),
    onSuccess: () => {
      toast.success(t("Murojaat yaratildi"));
      invalidate();
      onOpenChange(false);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : t("Saqlab bo‘lmadi")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{t("Mijozni tanlang — ma’lumotlarini qayta kiritish shart emas.")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t("Mijoz *")}>
              <Select
                value={form.customer_id}
                onValueChange={(value) => setForm((f) => ({ ...f, customer_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Mijozni tanlang")} />
                </SelectTrigger>
                <SelectContent>
                  {(pickers.data?.customers ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name ?? "Ismsiz"} {c.phone ? `· ${c.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label={t("Nima so‘ralgan")}>
            <Input
              value={form.requested_product}
              onChange={(e) => setForm((f) => ({ ...f, requested_product: e.target.value }))}
            />
          </Field>
          <Field label={t("Taxminiy summa")}>
            <Input
              type="number"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            />
          </Field>
          <Field label={t("Manba")}>
            <Select value={form.source} onValueChange={(value) => setForm((f) => ({ ...f, source: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {crmLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("Bosqich")}>
            <Select value={t(form.stage)} onValueChange={(value) => setForm((f) => ({ ...f, stage: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(stages ?? ["Yangi"]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("Mas’ul")}>
            <Select
              value={form.assigned_operator_id}
              onValueChange={(value) => setForm((f) => ({ ...f, assigned_operator_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Tanlanmagan")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("Tanlanmagan")}</SelectItem>
                {(pickers.data?.operators ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("Keyingi qadam")}>
            <Input
              value={form.next_action}
              onChange={(e) => setForm((f) => ({ ...f, next_action: e.target.value }))}
              placeholder={t("Ertaga qo‘ng‘iroq qilish")}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("Izoh")}>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Bekor qilish")}
          </Button>
          <Button disabled={!form.customer_id || mutation.isPending} onClick={() => mutation.mutate()}>
            {t("Saqlash")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type OrderLine = { product_id: string | null; product_name: string; quantity: string; unit_price: string };

export function OrderDialog({
  open,
  onOpenChange,
  defaultCustomerId,
  label = "Yangi buyurtma",
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  defaultCustomerId?: string | undefined;
  label?: string;
}) {
  const create = useServerFn(createQuickOrder);
  const pickers = usePickers(open);
  const invalidate = useInvalidate();
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([
    { product_id: null, product_name: "", quantity: "1", unit_price: "" },
  ]);

  useEffect(() => {
    if (open) {
      setCustomerId(defaultCustomerId ?? "");
      setLines([{ product_id: null, product_name: "", quantity: "1", unit_price: "" }]);
      setDiscount("");
      setNotes("");
    }
  }, [open, defaultCustomerId]);

  const gross = lines.reduce(
    (sum, l) => sum + Number(l.unit_price || 0) * Number(l.quantity || 0),
    0,
  );

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          customer_id: customerId,
          discount: Number(discount || 0),
          notes: notes || null,
          items: lines
            .filter((l) => l.product_name.trim())
            .map((l) => ({
              product_id: l.product_id,
              product_name: l.product_name.trim(),
              quantity: Number(l.quantity || 1),
              unit_price: Number(l.unit_price || 0),
            })),
        },
      }),
    onSuccess: () => {
      toast.success(t("Buyurtma yaratildi"));
      invalidate();
      onOpenChange(false);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : t("Saqlab bo‘lmadi")),
  });

  const setLine = (index: number, patch: Partial<OrderLine>) =>
    setLines((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{t("Mahsulotni katalogdan tanlang yoki xizmat nomini yozing.")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t("Mijoz *")}>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder={t("Mijozni tanlang")} />
              </SelectTrigger>
              <SelectContent>
                {(pickers.data?.customers ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name ?? "Ismsiz"} {c.phone ? `· ${c.phone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_5rem_8rem_2rem]">
                <Input
                  value={line.product_name}
                  placeholder={t("Mahsulot yoki xizmat")}
                  onChange={(e) => setLine(index, { product_name: e.target.value, product_id: null })}
                  list={`products-${index}`}
                />
                <datalist id={`products-${index}`}>
                  {(pickers.data?.products ?? []).map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
                <Input
                  type="number"
                  value={line.quantity}
                  onChange={(e) => setLine(index, { quantity: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder={t("Narx")}
                  value={line.unit_price}
                  onChange={(e) => setLine(index, { unit_price: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLines((rows) => rows.filter((_, i) => i !== index))}
                  aria-label={t("Qatorni o‘chirish")}
                >
                  ×
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setLines((rows) => [
                  ...rows,
                  { product_id: null, product_name: "", quantity: "1", unit_price: "" },
                ])
              }
            >
              <Plus className="mr-1 size-3" /> {t("Qator qo‘shish")}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("Chegirma")}>
              <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </Field>
            <Field label={t("Izoh")}>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("Jami:")}{" "}<span className="font-semibold text-foreground">{gross - Number(discount || 0)}</span>
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Bekor qilish")}
          </Button>
          <Button
            disabled={!customerId || !lines.some((l) => l.product_name.trim()) || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t("Saqlash")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PaymentSeed = {
  id?: string;
  customer_id?: string | null;
  order_id?: string | null;
  amount?: number | string | null;
  method?: string | null;
  status?: string | null;
  due_date?: string | null;
  note?: string | null;
};

export function PaymentDialog({
  open,
  onOpenChange,
  payment,
  defaultCustomerId,
  label = "Yangi to‘lov",
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  payment?: PaymentSeed | undefined;
  defaultCustomerId?: string | undefined;
  label?: string;
}) {
  const save = useServerFn(savePayment);
  const pickers = usePickers(open);
  const invalidate = useInvalidate();
  const [form, setForm] = useState<PaymentSeed>({});

  useEffect(() => {
    if (open)
      setForm(
        payment ?? {
          customer_id: defaultCustomerId ?? null,
          method: "cash",
          status: "paid",
          amount: "",
        },
      );
  }, [open, payment, defaultCustomerId]);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...(form.id ? { id: form.id } : {}),
          customer_id: form.customer_id ?? null,
          order_id: form.order_id ?? null,
          amount: Number(form.amount || 0),
          method: form.method ?? "cash",
          status: (form.status ?? "paid") as "pending" | "paid" | "partial" | "refunded",
          due_date: form.due_date || null,
          note: form.note || null,
        },
      }),
    onSuccess: () => {
      toast.success(t("To‘lov saqlandi"));
      invalidate();
      onOpenChange(false);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : t("Saqlab bo‘lmadi")),
  });

  const orders = (pickers.data?.orders ?? []).filter(
    (o) => !form.customer_id || o.customer_id === form.customer_id,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? t("To‘lovni tahrirlash") : label}</DialogTitle>
          <DialogDescription>{t("To‘lov buyurtma holatini avtomatik yangilaydi.")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Mijoz")}>
            <Select
              value={form.customer_id ?? NONE}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, customer_id: value === NONE ? null : value, order_id: null }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Tanlanmagan")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("Tanlanmagan")}</SelectItem>
                {(pickers.data?.customers ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name ?? "Ismsiz"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("Buyurtma")}>
            <Select
              value={form.order_id ?? NONE}
              onValueChange={(value) => setForm((f) => ({ ...f, order_id: value === NONE ? null : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Tanlanmagan")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("Tanlanmagan")}</SelectItem>
                {orders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    #{o.order_number} · {o.total}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("Summa *")}>
            <Input
              type="number"
              value={String(form.amount ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </Field>
          <Field label={t("Usul")}>
            <Select
              value={form.method ?? "cash"}
              onValueChange={(value) => setForm((f) => ({ ...f, method: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {crmLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("Holat")}>
            <Select
              value={form.status ?? "paid"}
              onValueChange={(value) => setForm((f) => ({ ...f, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_RECORD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {crmLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("Muddat")}>
            <Input
              type="date"
              value={form.due_date ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("Izoh")}>
              <Input
                value={form.note ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Bekor qilish")}
          </Button>
          <Button disabled={!Number(form.amount || 0) || mutation.isPending} onClick={() => mutation.mutate()}>
            {t("Saqlash")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type TaskSeed = {
  id?: string;
  title?: string;
  description?: string | null;
  assigned_operator_id?: string | null;
  customer_id?: string | null;
  order_id?: string | null;
  due_date?: string | null;
  priority?: string | null;
  status?: string | null;
};

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultCustomerId,
  label = "Yangi vazifa",
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  task?: TaskSeed | undefined;
  defaultCustomerId?: string | undefined;
  label?: string;
}) {
  const save = useServerFn(saveTask);
  const pickers = usePickers(open);
  const invalidate = useInvalidate();
  const [form, setForm] = useState<TaskSeed>({});

  useEffect(() => {
    if (open)
      setForm(
        task ?? {
          priority: "medium",
          status: "pending",
          customer_id: defaultCustomerId ?? null,
          title: "",
        },
      );
  }, [open, task, defaultCustomerId]);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...(form.id ? { id: form.id } : {}),
          title: (form.title ?? "").trim(),
          description: form.description ?? null,
          assigned_operator_id: form.assigned_operator_id ?? null,
          customer_id: form.customer_id ?? null,
          order_id: form.order_id ?? null,
          due_date: form.due_date || null,
          priority: (form.priority ?? "medium") as "low" | "medium" | "high",
          status: (form.status ?? "pending") as "pending" | "in_progress" | "completed",
        },
      }),
    onSuccess: () => {
      toast.success(t("Vazifa saqlandi"));
      invalidate();
      onOpenChange(false);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : t("Saqlab bo‘lmadi")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? t("Vazifani tahrirlash") : label}</DialogTitle>
          <DialogDescription>{t("Keyingi qadamni yozib qo‘ying — hech narsa esdan chiqmaydi.")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t("Sarlavha *")}>
              <Input
                value={t(form.title ?? "")}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={t("Ali Valiyevga qo‘ng‘iroq qilish")}
              />
            </Field>
          </div>
          <Field label={t("Mijoz")}>
            <Select
              value={form.customer_id ?? NONE}
              onValueChange={(value) => setForm((f) => ({ ...f, customer_id: value === NONE ? null : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Tanlanmagan")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("Tanlanmagan")}</SelectItem>
                {(pickers.data?.customers ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name ?? "Ismsiz"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("Mas’ul")}>
            <Select
              value={form.assigned_operator_id ?? NONE}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, assigned_operator_id: value === NONE ? null : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Tanlanmagan")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("Tanlanmagan")}</SelectItem>
                {(pickers.data?.operators ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("Muddat")}>
            <Input
              type="date"
              value={form.due_date ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </Field>
          <Field label={t("Muhimlik")}>
            <Select
              value={form.priority ?? "medium"}
              onValueChange={(value) => setForm((f) => ({ ...f, priority: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {crmLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("Holat")}>
            <Select
              value={form.status ?? "pending"}
              onValueChange={(value) => setForm((f) => ({ ...f, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {crmLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("Tavsif")}>
              <Textarea
                rows={2}
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Bekor qilish")}
          </Button>
          <Button disabled={!form.title?.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {t("Saqlash")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Universal "+ Yangi" entry point. Labels adapt to the configured industry. */
export function QuickNewButton({
  industry,
  stages,
  size = "default",
}: {
  industry?: string | null | undefined;
  stages?: string[] | undefined;
  size?: "default" | "sm";
}) {
  const labels = quickActionLabels(industry);
  const [openKey, setOpenKey] = useState<QuickActionKey | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={size} className="gap-1">
            <Plus className="size-4" /> {t("Yangi")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {(["customer", "lead", "order", "payment", "task"] as QuickActionKey[]).map((key) => (
            <DropdownMenuItem key={key} onSelect={() => setOpenKey(key)}>
              {labels[key]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <CustomerDialog
        open={openKey === "customer"}
        onOpenChange={(v) => setOpenKey(v ? "customer" : null)}
        title={t("Yangi {v0}", { v0: labels.customer.toLowerCase() })}
      />
      <LeadDialog
        open={openKey === "lead"}
        onOpenChange={(v) => setOpenKey(v ? "lead" : null)}
        stages={stages}
        label={t("Yangi {v0}", { v0: labels.lead.toLowerCase() })}
      />
      <OrderDialog
        open={openKey === "order"}
        onOpenChange={(v) => setOpenKey(v ? "order" : null)}
        label={labels.order.startsWith("Yangi") ? labels.order : t("Yangi {v0}", { v0: labels.order.toLowerCase() })}
      />
      <PaymentDialog
        open={openKey === "payment"}
        onOpenChange={(v) => setOpenKey(v ? "payment" : null)}
        label={t("Yangi {v0}", { v0: labels.payment.toLowerCase() })}
      />
      <TaskDialog
        open={openKey === "task"}
        onOpenChange={(v) => setOpenKey(v ? "task" : null)}
        label={t("Yangi {v0}", { v0: labels.task.toLowerCase() })}
      />
    </>
  );
}
