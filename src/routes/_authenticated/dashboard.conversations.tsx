import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Send, UserRound } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  getConversation,
  listConversations,
  sendOperatorMessage,
  setConversationMode,
} from "@/lib/crm.functions";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/conversations")({
  head: () => ({
    meta: [
      { title: t("Suhbatlar — NEXORA CRM") },
      { name: "description", content: t("Jonli Telegram inbox: AI savdo suhbatlarini o'qing va operator sifatida ularni o'z qo'lingizga oling.") },
      { property: "og:title", content: t("Suhbatlar — NEXORA CRM") },
      { property: "og:description", content: t("Jonli AI va inson operator Telegram savdo inboxi.") },
    ],
  }),
  component: ConversationsPage,
});

const MODE_LABELS: Record<string, string> = {
  all: "Barchasi",
  ai: "AI",
  human: "Operator",
};

function ConversationsPage() {
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listConversations);
  const fetchOne = useServerFn(getConversation);
  const send = useServerFn(sendOperatorMessage);
  const switchMode = useServerFn(setConversationMode);

  const [mode, setMode] = useState("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversations = useQuery({
    queryKey: ["conversations", mode, search],
    queryFn: () => fetchList({ data: { mode, search } }),
  });

  const thread = useQuery({
    queryKey: ["conversation", activeId],
    queryFn: () => fetchOne({ data: { id: activeId! } }),
    enabled: Boolean(activeId),
  });

  useEffect(() => {
    const channel = supabase
      .channel("inbox-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["conversation"] });
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread.data?.messages.length]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => send({ data: { conversationId: activeId!, content } }),
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["conversation"] });
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : t("Xabar yuborilmadi")),
  });

  const modeMutation = useMutation({
    mutationFn: (next: "ai" | "human") => switchMode({ data: { id: activeId!, mode: next } }),
    onSuccess: () => {
      toast.success(t("Suhbat rejimi yangilandi"));
      void queryClient.invalidateQueries({ queryKey: ["conversation"] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : t("Yangilash amalga oshmadi")),
  });

  const conversation = thread.data?.conversation;

  return (
    <>
      <PageHeader
        title={t("Suhbatlar")}
        description={t("Har bir Telegram suhbati jonli rejimda. Xohlagan vaqtingizda AI’dan boshqaruvni o‘zingizga oling.")}
        actions={
          <div className="flex gap-2">
            {["all", "ai", "human"].map((value) => (
              <Button
                key={value}
                size="sm"
                variant={mode === value ? "default" : "outline"}
                onClick={() => setMode(value)}
              >
                {t(MODE_LABELS[value] ?? value)}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="clay-panel flex max-h-[70vh] flex-col overflow-hidden">
          <div className="border-b border-border p-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Mijoz yoki xabarni qidiring")}
            />
          </div>
          <div className="clay-inset m-2 flex-1 overflow-y-auto rounded-2xl">
            {conversations.isPending ? (
              <LoadingState />
            ) : conversations.error ? (
              <ErrorState error={conversations.error} onRetry={() => void conversations.refetch()} />
            ) : conversations.data.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t("Hozircha suhbatlar yo'q.")}</p>
            ) : (
              conversations.data.map((row) => {
                const customer = row.customers as { full_name: string | null; telegram_username: string | null } | null;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setActiveId(row.id)}
                    className={cn(
                      "clay-hover flex w-full flex-col gap-1 rounded-xl border-b border-border px-3 py-3 text-left transition-colors",
                      activeId === row.id && "bg-primary/10",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {customer?.full_name ?? customer?.telegram_username ?? "Mijoz"}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                          {row.channel === "instagram" ? "Instagram" : "Telegram"}
                        </span>
                        <StatusBadge value={row.mode} />
                      </span>
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      {row.last_message_preview ?? "Xabarlar yo'q"}
                    </span>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{new Date(row.last_message_at).toLocaleString()}</span>
                      {row.unread_count > 0 ? (
                        <span className="rounded-full bg-primary/20 px-1.5 text-primary">{row.unread_count}</span>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="clay-panel flex max-h-[70vh] flex-col overflow-hidden">
          {!activeId ? (
            <EmptyState title={t("Suhbatni tanlang")} description={t("O'qish va javob berish uchun chapdan biror suhbatni tanlang.")} />
          ) : thread.isPending ? (
            <LoadingState />
          ) : thread.error ? (
            <ErrorState error={thread.error} />
          ) : conversation ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {(conversation.customers as { full_name: string | null } | null)?.full_name ?? "Telegram mijozi"}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("Chat ID")}{" "}{conversation.telegram_chat_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={conversation.mode} />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={modeMutation.isPending}
                    onClick={() => modeMutation.mutate(conversation.mode === "ai" ? "human" : "ai")}
                  >
                    {conversation.mode === "ai" ? (
                      <>
                        <UserRound className="mr-1 size-4" /> {t("O'zim boshqaraman")}
                      </>
                    ) : (
                      <>
                        <Bot className="mr-1 size-4" /> {t("AI'ga qaytarish")}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="clay-inset m-3 flex-1 space-y-3 overflow-y-auto rounded-2xl p-4">
                {(thread.data?.messages ?? []).map((message) => {
                  const mine = message.role !== "customer";
                  return (
                    <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "clay-raised max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                          message.role === "customer" && "bg-muted text-foreground",
                          message.role === "ai" && "bg-primary/15 text-foreground",
                          message.role === "operator" && "bg-warning/15 text-foreground",
                          message.role === "system" && "bg-card text-muted-foreground",
                        )}
                      >
                        <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                          {message.role}
                        </p>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <form
                className="flex items-end gap-2 border-t border-border p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (draft.trim()) sendMutation.mutate(draft.trim());
                }}
              >
                <Textarea
                  value={draft}
                  rows={2}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={t("Mijozga Telegram orqali javob yozing…")}
                />
                <Button type="submit" disabled={sendMutation.isPending || !draft.trim()}>
                  <Send className="size-4" />
                </Button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
