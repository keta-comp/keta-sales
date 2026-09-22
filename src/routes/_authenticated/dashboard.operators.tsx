import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { deleteOperator, listOperators, saveOperator } from "@/lib/orders.functions";
import { formatMoney } from "@/lib/types";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/operators")({
  head: () => ({
    meta: [
      { title: t("Operatorlar — NEXORA CRM") },
      { name: "description", content: t("Inson savdo operatorlarini boshqaring va ularning konversiya natijalarini kuzating.") },
      { property: "og:title", content: t("Operatorlar — NEXORA CRM") },
      { property: "og:description", content: t("AI savdo jamoangiz uchun operatorlar ro'yxati va natijalari.") },
    ],
  }),
  component: OperatorsPage,
});

function OperatorsPage() {
  const queryClient = useQueryClient();
  const fetchOperators = useServerFn(listOperators);
  const save = useServerFn(saveOperator);
  const remove = useServerFn(deleteOperator);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const [phone, setPhone] = useState("");

  const operators = useQuery({ queryKey: ["operators"], queryFn: () => fetchOperators() });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["operators"] });

  const saveMutation = useMutation({
    mutationFn: (input: {
      id?: string;
      full_name: string;
      telegram_username?: string | null;
      telegram_user_id?: string | null;
      phone?: string | null;
      is_active: boolean;
    }) => save({ data: input }),
    onSuccess: () => {
      toast.success(t("Operator saqlandi"));
      setFullName("");
      setUsername("");
      setTelegramId("");
      setPhone("");
      invalidate();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : t("Saqlash amalga oshmadi")),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success(t("Operator o'chirildi"));
      invalidate();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : t("O'chirish amalga oshmadi")),
  });

  return (
    <>
      <PageHeader title={t("Operatorlar")} description={t("AI eskalatsiya qilgan lidlarni yopadigan insonlar.")} />

      <form
        className="clay-panel grid gap-3 p-4 sm:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate({
            full_name: fullName,
            telegram_username: username || null,
            telegram_user_id: telegramId || null,
            phone: phone || null,
            is_active: true,
          });
        }}
      >
        <div className="sm:col-span-2">
          <Label htmlFor="op-name">{t("To'liq ism")}</Label>
          <Input id="op-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        </div>
        <div>
          <Label htmlFor="op-username">{t("Telegram @")}</Label>
          <Input id="op-username" value={username} onChange={(event) => setUsername(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="op-phone">{t("Telefon")}</Label>
          <Input id="op-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
            {t("Operator qo'shish")}
          </Button>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="op-tgid">{t("Telegram foydalanuvchi ID (ixtiyoriy)")}</Label>
          <Input id="op-tgid" value={telegramId} onChange={(event) => setTelegramId(event.target.value)} />
        </div>
      </form>

      {operators.isPending ? (
        <LoadingState />
      ) : operators.error ? (
        <ErrorState error={operators.error} onRetry={() => void operators.refetch()} />
      ) : operators.data.length === 0 ? (
        <EmptyState title={t("Hozircha operatorlar yo'q")} description={t("AI qizigan lidlarni topshira olishi uchun savdo xodimlaringizni qo'shing.")} />
      ) : (
        <div className="clay-panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("Operator")}</th>
                <th className="px-4 py-3">{t("Tayinlangan")}</th>
                <th className="px-4 py-3">{t("Bog'lanilgan")}</th>
                <th className="px-4 py-3">{t("Yopilgan")}</th>
                <th className="px-4 py-3">{t("Konversiya")}</th>
                <th className="px-4 py-3">{t("Daromad")}</th>
                <th className="px-4 py-3">{t("Faol")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {operators.data.map((operator) => (
                <tr key={operator.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{operator.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {operator.telegram_username ? `@${operator.telegram_username}` : (operator.phone ?? "—")}
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{operator.assigned_leads}</td>
                  <td className="px-4 py-3 tabular-nums">{operator.contacted_leads}</td>
                  <td className="px-4 py-3 tabular-nums">{operator.won_leads}</td>
                  <td className="px-4 py-3 tabular-nums">{operator.conversion_rate}%</td>
                  <td className="px-4 py-3 tabular-nums">{formatMoney(operator.revenue)}</td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={operator.is_active}
                      onCheckedChange={(checked) =>
                        saveMutation.mutate({
                          id: operator.id,
                          full_name: operator.full_name,
                          telegram_username: operator.telegram_username,
                          telegram_user_id: operator.telegram_user_id,
                          phone: operator.phone,
                          is_active: checked,
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("Operatorni o'chirish")}
                      onClick={() => removeMutation.mutate(operator.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
