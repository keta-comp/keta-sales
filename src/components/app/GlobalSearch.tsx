import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { globalSearch } from "@/lib/workspace.functions";
import { t } from "@/lib/i18n";

export function GlobalSearch() {
  const navigate = useNavigate();
  const search = useServerFn(globalSearch);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), 200);
    return () => clearTimeout(id);
  }, [term]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => search({ data: { term: debounced } }),
    enabled: open && debounced.trim().length >= 2,
  });

  const groups = new Map<string, NonNullable<typeof results.data>>();
  for (const hit of results.data ?? []) {
    const list = groups.get(hit.type) ?? [];
    list.push(hit);
    groups.set(hit.type, list);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">{t("Qidirish…")}</span>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={t("Mijoz, murojaat, buyurtma, to‘lov yoki vazifa…")}
          value={term}
          onValueChange={setTerm}
        />
        <CommandList>
          {debounced.trim().length < 2 ? (
            <CommandEmpty>{t("Kamida 2 harf yozing.")}</CommandEmpty>
          ) : results.isFetching ? (
            <CommandEmpty>{t("Qidirilmoqda…")}</CommandEmpty>
          ) : (results.data ?? []).length === 0 ? (
            <CommandEmpty>{t("Hech narsa topilmadi.")}</CommandEmpty>
          ) : null}
          {[...groups.entries()].map(([type, hits]) => (
            <CommandGroup key={type} heading={type}>
              {hits.map((hit) => (
                <CommandItem
                  key={`${hit.type}-${hit.id}`}
                  value={t(`${hit.type}-${hit.id}-${hit.title}`)}
                  onSelect={() => {
                    setOpen(false);
                    void navigate({ to: hit.to });
                  }}
                >
                  <span className="truncate">{hit.title}</span>
                  {hit.subtitle ? (
                    <span className="ml-2 truncate text-xs text-muted-foreground">{hit.subtitle}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
