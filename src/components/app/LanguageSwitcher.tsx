import { Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGS, getLang, setLang, t, useLang } from "@/lib/i18n";

export function LanguageSwitcher({
  variant = "outline",
  showLabel = false,
}: {
  variant?: "outline" | "ghost";
  showLabel?: boolean;
}) {
  const lang = useLang();
  const active = LANGS.find((item) => item.code === lang) ?? LANGS[0]!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" className="gap-2" aria-label={t("Tilni tanlash")}>
          <Globe className="size-4" />
          <span className={showLabel ? "" : "hidden sm:inline"}>
            {t(showLabel ? active.label : active.short)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {LANGS.map((item) => (
          <DropdownMenuItem
            key={item.code}
            onClick={() => setLang(item.code)}
            className={item.code === getLang() ? "font-semibold" : ""}
          >
            <span className="mr-2 text-xs text-muted-foreground">{item.short}</span>
            {t(item.label)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
