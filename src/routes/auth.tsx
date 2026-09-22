import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { BrandMark } from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { recordFailedLogin, recordLogin, recordRegistration } from "@/lib/session.functions";
import { t } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";

const TITLE = "Kabinaga kirish — NEXORA CRM";
const DESCRIPTION =
  "NEXORA CRM kabinasiga kiring yoki bepul ro‘yxatdan o‘tib biznesingiz uchun CRM tizimini sozlang.";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search['mode'] === "register" ? ("register" as const) : ("login" as const),
    redirect:
      typeof search['redirect'] === "string" && search['redirect'].startsWith("/")
        ? (search['redirect'] as string)
        : undefined,
  }),
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
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { mode: initialMode, redirect: redirectTo } = Route.useSearch();
  const adminOnly = (redirectTo ?? "").startsWith("/super-admin");
  const [mode, setMode] = useState<"login" | "register">(adminOnly ? "login" : initialMode);
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirectTo ?? "/dashboard" });
    });
  }, [navigate, redirectTo]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim(), business_name: businessName.trim() || undefined },
          },
        });
        if (error) throw error;
        void recordRegistration().catch(() => undefined);
        navigate({ to: redirectTo ?? "/dashboard" });
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        void recordFailedLogin({ data: { email } }).catch(() => undefined);
        throw error;
      }
      void recordLogin().catch(() => undefined);
      navigate({ to: redirectTo ?? "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Kirishda xatolik yuz berdi"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-6 flex justify-end">
        <LanguageSwitcher showLabel />
      </div>
      <Link to="/" className="mb-8">
        <BrandMark />
      </Link>

      <div className="clay-panel w-full max-w-md p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {adminOnly ? t("Boshqaruv markaziga kirish") : mode === "login" ? "Kabinaga kirish" : "Bepul boshlash"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {adminOnly
            ? t("Bu bo‘lim faqat platforma administratorlari uchun.")
            : mode === "login"
              ? "Mijozlar, savdo va jamoangizni boshqarishni davom ettiring."
              : "Hisob yarating — keyin sohangizni tanlab CRMni sozlaymiz."}
        </p>

        {!adminOnly && (
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={mode === "login" ? "clay-raised bg-card py-2" : "rounded-xl py-2 text-muted-foreground"}
            >
              {t("Kirish")}
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={
                mode === "register" ? "clay-raised bg-card py-2" : "rounded-xl py-2 text-muted-foreground"
              }
            >
              {t("Ro‘yxatdan o‘tish")}
            </button>
          </div>
        )}


        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="full-name">{t("Ismingiz")}</Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder={t("Masalan: Nursultan")}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-name">{t("Biznes nomi")}</Label>
                <Input
                  id="business-name"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder={t("Masalan: Nexora klinikasi")}
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{t("Email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("siz@kompaniya.uz")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("Parol")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? t("Yuklanmoqda…") : mode === "login" ? "Kirish" : "Ro‘yxatdan o‘tish"}
          </Button>
        </form>

        <p className="mt-5 text-xs text-muted-foreground">
          {adminOnly
            ? t("Ro‘yxatdan o‘tish bu bo‘limda mavjud emas — faqat mavjud administrator hisobi bilan kiriladi.")
            : mode === "register"
              ? "Ro‘yxatdan o‘tgach biznes sohangizni tanlaysiz — CRM sizga moslab tayyorlanadi."
              : "Hisobingiz yo‘qmi? “Ro‘yxatdan o‘tish”ni tanlang — karta talab qilinmaydi."}
        </p>
      </div>

      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t("Bosh sahifaga")}
      </Link>
    </div>
  );
}
