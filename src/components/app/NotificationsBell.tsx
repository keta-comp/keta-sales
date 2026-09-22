import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getDashboardKpis } from "@/lib/workspace.functions";
import { t } from "@/lib/i18n";

/** Notifications are derived from real CRM rows — never fabricated. */
export function NotificationsBell() {
  const navigate = useNavigate();
  const fetchKpis = useServerFn(getDashboardKpis);
  const { data } = useQuery({
    queryKey: ["kpis"],
    queryFn: () => fetchKpis(),
    refetchInterval: 60_000,
  });

  const todos = data?.todos ?? [];
  const total = todos.reduce((sum, t) => sum + t.count, 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label={t("Bildirishnomalar")}>
          <Bell className="size-4" />
          {total > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background">
              {total > 99 ? "99+" : total}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("Bildirishnomalar")}
        </p>
        {todos.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">{t("Hozircha yangilik yo‘q.")}</p>
        ) : (
          <div className="space-y-1">
            {todos.map((todo) => (
              <button
                key={todo.key}
                type="button"
                className="clay-hover flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm"
                onClick={() =>
                  void navigate({
                    to: todo.to,
                    ...(todo.search ? { search: todo.search } : {}),
                  } as never)
                }
              >
                <span className="clay-inset grid size-7 shrink-0 place-items-center text-xs font-semibold">
                  {todo.count}
                </span>
                <span className="text-muted-foreground">{t(todo.label)}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
