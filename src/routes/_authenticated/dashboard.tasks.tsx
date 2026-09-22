import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/app/primitives";
import { TaskDialog } from "@/components/app/crm-dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crmLabel, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/crm-core";
import { deleteTask, listTasks, setTaskStatus } from "@/lib/tasks.functions";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/tasks")({
  head: () => ({
    meta: [
      { title: t("Vazifalar — NEXORA CRM") },
      { name: "description", content: t("Jamoa vazifalari, muddatlari va bajarilish holati.") },
      { property: "og:title", content: t("Vazifalar — NEXORA CRM") },
      { property: "og:description", content: t("Hech bir ish e’tibordan chetda qolmasin.") },
    ],
  }),
  component: TasksPage,
});

type TaskRow = Awaited<ReturnType<typeof listTasks>>[number];

function TasksPage() {
  const fetchTasks = useServerFn(listTasks);
  const changeStatus = useServerFn(setTaskStatus);
  const remove = useServerFn(deleteTask);
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["tasks", status, priority, search],
    queryFn: () => fetchTasks({ data: { status, priority, search } }),
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <>
      <PageHeader
        title={t("Vazifalar")}
        description={t("Qo‘ng‘iroq qilish, uchrashuv, kuzatuv — hammasi bir joyda.")}
        actions={
          <Button
            size="sm"
            className="gap-1"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> {t("Yangi vazifa")}
          </Button>
        }
      />

      <div className="clay-panel flex flex-wrap items-center gap-2 p-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Vazifa nomi…")}
          className="h-9 w-full sm:w-64"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder={t("Holat")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("Barcha holat")}</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {crmLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder={t("Muhimlik")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("Barcha muhimlik")}</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {crmLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isPending ? (
        <LoadingState label={t("Vazifalar yuklanmoqda…")} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState title={t("Vazifa yo‘q")} description={t("Yangi vazifa qo‘shib, ishni rejalashtiring.")} />
      ) : (
        <div className="space-y-2">
          {(query.data ?? []).map((task) => {
            const customer = task.customers as { full_name: string | null } | null;
            const operator = task.operators as { full_name: string | null } | null;
            const overdue =
              task.due_date && task.status !== "completed" && new Date(task.due_date) < today;
            return (
              <div
                key={task.id}
                className="clay-panel flex flex-wrap items-center gap-3 p-4"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("Bajarildi")}
                  className={task.status === "completed" ? "text-foreground" : "text-muted-foreground"}
                  onClick={async () => {
                    try {
                      await changeStatus({
                        data: {
                          id: task.id,
                          status: task.status === "completed" ? "pending" : "completed",
                        },
                      });
                      void query.refetch();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : t("Xatolik"));
                    }
                  }}
                >
                  <CheckCircle2 className="size-5" />
                </Button>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-medium ${
                      task.status === "completed" ? "line-through opacity-60" : ""
                    }`}
                  >
                    {task.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      customer?.full_name,
                      operator?.full_name ? `Mas’ul: ${operator.full_name}` : null,
                      task.due_date
                        ? `Muddat: ${new Date(task.due_date).toLocaleDateString("uz-UZ")}`
                        : null,
                      overdue ? "kechikkan" : null,
                    ]
                      .filter(Boolean)
                      .join(" • ") || "Qo‘shimcha ma’lumot yo‘q"}
                  </p>
                </div>
                <StatusBadge value={task.priority} />
                <StatusBadge value={task.status} />
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("Tahrirlash")}
                    onClick={() => {
                      setEditing(task);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("O‘chirish")}
                    onClick={async () => {
                      if (!window.confirm(t("Vazifani o‘chirasizmi?"))) return;
                      try {
                        await remove({ data: { id: task.id } });
                        toast.success(t("Vazifa o‘chirildi"));
                        void query.refetch();
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : t("Xatolik"));
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskDialog
        open={open}
        onOpenChange={setOpen}
        task={
          editing
            ? {
                id: editing.id,
                title: editing.title,
                description: editing.description,
                assigned_operator_id: editing.assigned_operator_id,
                customer_id: editing.customer_id,
                order_id: editing.order_id,
                due_date: editing.due_date,
                priority: editing.priority as "low" | "medium" | "high",
                status: editing.status as "pending" | "in_progress" | "completed",
              }
            : undefined
        }
        label={editing ? t("Vazifani tahrirlash") : t("Yangi vazifa")}
      />
    </>
  );
}
