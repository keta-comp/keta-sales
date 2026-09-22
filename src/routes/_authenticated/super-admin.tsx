import { useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  Building2,
  Bot,
  FileBarChart,
  Gauge,
  LayoutGrid,
  LogOut,
  Menu,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Puzzle,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import logoUrl from "@/assets/nexora-logo.webp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LoadingState } from "@/components/app/primitives";
import { amISuperAdmin, superAdminSearch } from "@/lib/super-admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";

const NAV: { to: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { to: "/super-admin", label: "Umumiy ko‘rinish", icon: Gauge, exact: true },
  { to: "/super-admin/organizations", label: "Organizationlar", icon: Building2 },
  { to: "/super-admin/users", label: "Foydalanuvchilar", icon: Users },
  { to: "/super-admin/analytics", label: "Analitika", icon: FileBarChart },
  { to: "/super-admin/ai-usage", label: "AI ishlatilishi", icon: Bot },
  { to: "/super-admin/industries", label: "Sohalar", icon: LayoutGrid },
  { to: "/super-admin/notifications", label: "E’lonlar", icon: Bell },
  { to: "/super-admin/flags", label: "Funksiyalar", icon: Puzzle },
  { to: "/super-admin/security", label: "Xavfsizlik", icon: ShieldCheck },
  { to: "/super-admin/audit", label: "Audit jurnali", icon: ScrollText },
  { to: "/super-admin/settings", label: "Tizim sozlamalari", icon: Settings },
];

export const Route = createFileRoute("/_authenticated/super-admin")({
  ssr: false,
  component: SuperAdminLayout,
});

function AccessDenied() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="clay-inset grid size-16 place-items-center rounded-3xl">
        <ShieldCheck className="size-7 text-muted-foreground" />
      </span>
      <div>
        <p className="font-display text-xl font-semibold">{t("403 — Ruxsat yo‘q")}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {t("Bu bo‘lim faqat NEXORA CRM platforma administratori uchun. Siz o‘z CRM kabinangizga\n          qaytishingiz mumkin.")}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/dashboard">{t("CRM kabinaga qaytish")}</Link>
      </Button>
    </div>
  );
}

function ControlSearch() {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const run = useServerFn(superAdminSearch);
  const { data } = useQuery({
    queryKey: ["super-admin-search", term],
    queryFn: () => run({ data: { term } }),
    enabled: term.trim().length >= 2,
  });

  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={t("Organization, foydalanuvchi, buyurtma…")}
        className="pl-9"
      />
      {open && term.trim().length >= 2 ? (
        <div className="clay-panel absolute z-40 mt-2 max-h-80 w-full overflow-auto p-2">
          {(data ?? []).length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">{t("Natija topilmadi")}</p>
          ) : (
            (data ?? []).map((item, index) => (
              <Link
                key={`${item.to}-${index}`}
                to={item.to}
                className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm hover:bg-muted"
              >
                <span className="truncate font-medium">{t(item.label)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{item.kind}</span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "clay-raised bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {t(item.label)}
          </Link>
        );
      })}
    </nav>
  );
}

function SuperAdminLayout() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const check = useServerFn(amISuperAdmin);
  const { data: allowed, isPending } = useQuery({
    queryKey: ["am-i-super-admin"],
    queryFn: () => check(),
  });

  if (isPending) return <LoadingState label={t("Tekshirilmoqda…")} />;
  if (!allowed) return <AccessDenied />;

  const brand = (
    <div className="flex items-center gap-2 px-3 py-4">
      <span className="clay-raised grid size-10 place-items-center overflow-hidden rounded-2xl bg-card">
        <img src={logoUrl} alt="NEXORA CRM" className="size-8 object-contain" />
      </span>
      <div className="leading-tight">
        <p className="font-display text-sm font-semibold">NEXORA CRM</p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{t("Control Center")}</p>
      </div>
    </div>
  );

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border/60 bg-sidebar px-3 shadow-clay lg:flex">
        {brand}
        <div className="flex-1 overflow-y-auto pb-4">
          <NavList />
        </div>
        <div className="border-t border-sidebar-border py-4">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" asChild>
            <Link to="/dashboard">
              <LayoutGrid className="size-4" /> {t("CRM kabina")}
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={signOut}>
            <LogOut className="size-4" /> {t("Chiqish")}
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur-xl lg:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label={t("Menyu")}>
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar px-3">
              {brand}
              <NavList onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <ControlSearch />
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
          </div>
          <span className="hidden rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium sm:inline">
            {t("Super Admin")}
          </span>
        </header>
        <main className="space-y-6 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
