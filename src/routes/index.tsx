import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  Mail,
  MessagesSquare,
  Menu,
  Phone,
  ShoppingCart,
  Users,
  UsersRound,
  X,
} from "lucide-react";

import logoUrl from "@/assets/nexora-logo.webp";
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  BrandMark,
  CONTACT_EMAIL,
  CONTACT_EMAIL_HREF,
  CONTACT_PHONE,
  CONTACT_PHONE_HREF,
  KarakalpakFlag,
} from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPlatformStats, formatCount } from "@/lib/public-stats";
import { t } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";

const TITLE = "NEXORA CRM — Qoraqalpog‘iston bizneslari uchun zamonaviy CRM";
const DESCRIPTION =
  "NEXORA CRM — Qoraqalpog‘iston bizneslari uchun mijozlar, savdo, murojaatlar va jamoani boshqarish platformasi. KETA.COMP tomonidan ishlab chiqilgan.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const NAV = [
  { href: "#about", label: "Biz haqimizda" },
  { href: "#features", label: "Afzalliklar" },
  { href: "#stats", label: "Statistika" },
  { href: "#contact", label: "Aloqa" },
];

const FEATURES = [
  { icon: Users, title: "Mijozlar", body: "Barcha mijozlaringizni bitta joyda boshqaring." },
  { icon: BarChart3, title: "Savdo", body: "Murojaatlarni nazorat qiling va savdoni oshiring." },
  { icon: Boxes, title: "Ombor", body: "Mahsulotlar va qoldiqlarni boshqaring." },
  { icon: MessagesSquare, title: "Murojaatlar", body: "Mijozlar murojaatlarini tartibga soling." },
  { icon: UsersRound, title: "Jamoa", body: "Operatorlar va vazifalarni boshqaring." },
  { icon: ShoppingCart, title: "Statistika", body: "Biznesingiz natijalarini kuzatib boring." },
];

function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const stats = useQuery({ queryKey: ["platform-stats"], queryFn: fetchPlatformStats });

  const statItems = [
    { key: "users", label: "Real foydalanuvchilar", icon: Users, value: stats.data?.users },
    { key: "businesses", label: "Ro‘yxatdan o‘tgan bizneslar", icon: Building2, value: stats.data?.businesses },
    { key: "crms", label: "Yaratilgan CRMlar", icon: BarChart3, value: stats.data?.crms },
  ].filter((item) => stats.isLoading || (item.value ?? 0) > 0);

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <BrandMark />
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors hover:text-foreground">
                {t(item.label)}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <KarakalpakFlag className="hidden sm:block" />
            <Button asChild size="sm" className="hidden rounded-full px-5 sm:inline-flex">
              <Link to="/auth" search={{ mode: "login", redirect: undefined }}>
                {t("Kabinaga kirish")}{" "}<ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              aria-label={t("Menyu")}
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-border/60 bg-background px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-3 text-sm font-medium">
              {NAV.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                  {t(item.label)}
                </a>
              ))}
            </nav>
            <Button asChild className="mt-4 w-full rounded-full">
              <Link to="/auth" search={{ mode: "login", redirect: undefined }}>
                {t("Kabinaga kirish")}
              </Link>
            </Button>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div>
          <span className="clay-raised inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-xs font-medium text-muted-foreground">
            <KarakalpakFlag /> {t("Qoraqalpog‘iston bizneslari uchun")}
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">
            {t("Biznesingiz uchun")}
            <br />
            zamonaviy <span className="text-metal">CRM</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            {t("Mijozlar, murojaatlar, savdo va jamoangizni bitta platformada boshqaring. Har qanday soha\n            uchun moslashadigan zamonaviy CRM.")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-7">
              <Link to="/auth" search={{ mode: "register", redirect: undefined }}>
                {t("Bepul boshlash")}{" "}<ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full bg-card px-7">
              <a href="#about">{t("Biz haqimizda")}</a>
            </Button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
            {["Tez ro‘yxatdan o‘tish", "Karta talab qilinmaydi", "Har qanday soha uchun mos"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="clay-metal relative grid place-items-center overflow-hidden p-10">
          <img
            src={logoUrl}
            alt={t("NEXORA CRM metallik logotipi")}
            className="w-full max-w-sm object-contain drop-shadow-2xl"
          />
          <div className="mt-6 text-center">
            <p className="font-display text-2xl font-bold tracking-tight text-foreground">{BRAND_NAME}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              {BRAND_TAGLINE}
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-6xl px-4 py-12">
        <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
          {t("Bir platformada barcha jarayonlar")}
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="clay-panel clay-hover p-6">
              <span className="clay-inset grid size-12 place-items-center">
                <feature.icon className="size-5 text-foreground" />
              </span>
              <p className="mt-4 font-display text-base font-semibold text-foreground">{feature.title}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Statistics — real database */}
      <section id="stats" className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="clay-panel p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-foreground">{t("Real statistika")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Barcha raqamlar NEXORA CRM bazasidan real vaqtda olinadi.")}
          </p>
          {stats.isError ? (
            <p className="mt-6 text-sm text-muted-foreground">
              {t("Statistikani hozir yuklab bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.")}
            </p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {statItems.map((item) => (
                <div key={item.key} className="clay-inset p-5">
                  <item.icon className="size-5 text-muted-foreground" />
                  {stats.isLoading ? (
                    <Skeleton className="mt-3 h-9 w-24" />
                  ) : (
                    <p className="mt-3 font-display text-3xl font-bold text-foreground">
                      {formatCount(item.value ?? 0)}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">{t(item.label)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="clay-raised inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-xs font-medium text-muted-foreground">
              <KarakalpakFlag /> {t("Qoraqalpog‘istonda yaratilgan")}
            </span>
            <h2 className="mt-5 font-display text-2xl font-semibold text-foreground sm:text-3xl">
              {t("NEXORA CRM — Qoraqalpog‘iston bizneslari uchun")}
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              {t("NEXORA CRM — Qoraqalpog‘istondagi bizneslar uchun yaratilgan zamonaviy CRM platformasi.\n              Bizning maqsadimiz — mahalliy bizneslarga mijozlar, savdo, jamoa va kundalik jarayonlarni\n              texnologiya orqali samarali boshqarishga yordam berish.")}
            </p>
            <p className="mt-4 text-sm font-medium text-foreground">
              <a
                href="https://keta.uz"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-border underline-offset-4 hover:decoration-foreground"
              >
                KETA.COMP
              </a>{" "}
              {t("tomonidan ishlab chiqilgan")}
            </p>
            <Button asChild className="mt-7 rounded-full px-6">
              <Link to="/auth" search={{ mode: "register", redirect: undefined }}>
                {t("Bepul boshlash")}{" "}<ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
          <div className="clay-panel p-6 sm:p-8">
            <ul className="space-y-5 text-sm">
              {[
                "Mahalliy bizneslar uchun yaratilgan",
                "Doimiy qo‘llab-quvvatlash",
                "Har qanday soha uchun moslashadi",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="clay-inset grid size-9 shrink-0 place-items-center">
                    <Check className="size-4 text-foreground" />
                  </span>
                  <span className="pt-2 text-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-7 border-t border-border pt-5 text-sm italic text-muted-foreground">
              {t("“Qoraqalpog‘iston uchun. Katta imkoniyatlar.”")}
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="mt-10 bg-primary text-primary-foreground">
        <div className="mx-auto w-full max-w-6xl px-4 py-12">
          <div className="grid gap-8 md:grid-cols-[1.2fr_1fr_1fr]">
            <BrandMark invert />
            <div>
              <p className="text-sm font-semibold">{t("Sahifalar")}</p>
              <ul className="mt-3 space-y-2 text-sm text-primary-foreground/70">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <a href={item.href} className="hover:text-primary-foreground">
                      {t(item.label)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold">{t("Aloqa")}</p>
              <ul className="mt-3 space-y-2 text-sm text-primary-foreground/70">
                <li>
                  <a href={CONTACT_PHONE_HREF} className="flex items-center gap-2 hover:text-primary-foreground">
                    <Phone className="size-4" /> {CONTACT_PHONE}
                  </a>
                </li>
                <li>
                  <a href={CONTACT_EMAIL_HREF} className="flex items-center gap-2 hover:text-primary-foreground">
                    <Mail className="size-4" /> {CONTACT_EMAIL}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-2 border-t border-primary-foreground/15 pt-6 text-xs text-primary-foreground/60 sm:flex-row sm:items-center sm:justify-between">
            <p>{t("© 2026 Nexora CRM — nexora-crm.uz. Barcha huquqlar himoyalangan.")}</p>
            <p>
              {t("Nexora CRM —")}{" "}
              <a href="https://keta.uz" target="_blank" rel="noreferrer" className="hover:text-primary-foreground">
                KETA.COMP
              </a>{" "}
              {t("tomonidan ishlab chiqilgan.")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
