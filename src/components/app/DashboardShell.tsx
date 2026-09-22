import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  BarChart3,
  Book,
  Bot,
  Boxes,
  Building,
  Calendar,
  Car,
  Check,
  Eye,
  Handshake,
  Home,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  ListChecks,
  LogOut,
  Menu,
  MessagesSquare,
  Package,
  Settings,
  Send,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Target,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import logoAsset from "@/assets/keta-crm-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { GlobalSearch } from "@/components/app/GlobalSearch";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { QuickNewButton } from "@/components/app/crm-dialogs";
import { getMyCrmConfig } from "@/lib/crm-config.functions";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";

const ICONS: Record<string, LucideIcon> = {
  target: Target,
  users: Users,
  messages: MessagesSquare,
  cart: ShoppingCart,
  package: Package,
  boxes: Boxes,
  calendar: Calendar,
  book: Book,
  layers: Layers,
  user: UserRound,
  check: Check,
  car: Car,
  wrench: Wrench,
  stethoscope: Stethoscope,
  activity: Activity,
  home: Home,
  eye: Eye,
  handshake: Handshake,
  building: Building,
};

const CORE_LINKS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/dashboard/customers", label: "Mijozlar", icon: Users },
  { to: "/dashboard/leads", label: "Murojaatlar", icon: Target },
  { to: "/dashboard/orders", label: "Buyurtmalar", icon: ShoppingCart },
];

const STATIC_TAIL: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/dashboard/payments", label: "To‘lovlar", icon: Wallet },
  { to: "/dashboard/tasks", label: "Vazifalar", icon: ListChecks },
  { to: "/dashboard/operators", label: "Jamoa", icon: UserRound },
  { to: "/dashboard/analytics", label: "Hisobotlar", icon: BarChart3 },
  { to: "/dashboard/assistant", label: "AI yordamchi", icon: Bot },
  { to: "/dashboard/crm-builder", label: "AI CRM sozlash", icon: Sparkles },
  { to: "/dashboard/telegram", label: "Telegram", icon: Send },
  { to: "/dashboard/settings", label: "Sozlamalar", icon: Settings },
];

type NavItem = { to: string; label: string; icon: LucideIcon };

function buildNav(crm: Awaited<ReturnType<typeof getMyCrmConfig>> | undefined): NavItem[] {
  const items: NavItem[] = [{ to: "/dashboard", label: "Umumiy ko‘rinish", icon: LayoutDashboard }];
  const hasPipeline = crm?.config?.modules.some((m) => m.pipeline && !m.link);
  if (crm?.config?.pipelineStages.length && hasPipeline) {
    items.push({ to: "/dashboard/pipeline", label: "Pipeline", icon: LayoutGrid });
  }
  const seen = new Set<string>();
  for (const module of crm?.config?.modules ?? []) {
    const to = module.link ?? `/dashboard/crm/${module.key}`;
    seen.add(to);
    items.push({ to, label: module.label, icon: ICONS[module.icon ?? ""] ?? LayoutGrid });
  }
  // The CRM core is always reachable, even when the industry config renames modules.
  for (const core of CORE_LINKS) {
    if (!seen.has(core.to)) items.push(core);
  }
  items.push(...STATIC_TAIL);
  return items;
}


function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fetchConfig = useServerFn(getMyCrmConfig);
  const { data: crm } = useQuery({ queryKey: ["crm-config"], queryFn: () => fetchConfig() });
  const nav = buildNav(crm);

  return (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => {
        const active =
          item.to === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.to);
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
                : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground hover:shadow-clay-sm",
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

export function DashboardShell({
  children,
  email,
}: {
  children: React.ReactNode;
  email?: string | undefined;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const fetchConfig = useServerFn(getMyCrmConfig);
  const { data: crm } = useQuery({ queryKey: ["crm-config"], queryFn: () => fetchConfig() });

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/" });
  };

  const brand = (
    <div className="flex items-center gap-2 px-3 py-4">
      <span className="clay-raised grid size-10 place-items-center overflow-hidden rounded-2xl bg-card">
        <img src={logoAsset.url} alt={t("NEXORA CRM logotipi")} className="size-8 object-contain" />
      </span>
      <div className="leading-tight">
        <p className="font-display text-sm font-semibold">NEXORA CRM</p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{t("Qoraqalpog‘iston uchun")}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border/60 bg-sidebar px-3 shadow-clay lg:flex">
        {brand}
        <NavLinks />
        <div className="mt-auto border-t border-sidebar-border py-4">
          <p className="truncate px-3 pb-2 text-xs text-muted-foreground">{email ?? ""}</p>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={signOut}>
            <LogOut className="size-4" /> {t("Chiqish")}
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label={t("Menyuni ochish")}>
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar px-3 shadow-clay-lg">
                {brand}
                <NavLinks onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="font-display text-sm font-semibold lg:hidden">NEXORA CRM</span>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <LanguageSwitcher />
            <NotificationsBell />
            <QuickNewButton industry={crm?.industry} stages={crm?.config?.pipelineStages} size="sm" />
            <span className="hidden text-xs text-muted-foreground lg:inline">{email}</span>
            <Button variant="outline" size="sm" className="gap-2" onClick={signOut}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">{t("Chiqish")}</span>
            </Button>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
