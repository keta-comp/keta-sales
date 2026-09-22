import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import logoUrl from "@/assets/nexora-logo.webp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getMyCrmConfig, generateCrmConfig } from "@/lib/crm-config.functions";
import { INDUSTRIES } from "@/lib/crm-config";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [{ title: t("CRMni sozlash — NEXORA CRM") }],
  }),
  component: Onboarding,
});

const AI_STEPS = [
  "AI biznesingiz uchun CRMni tayyorlamoqda...",
  "Pipeline yaratilmoqda...",
  "Maydonlar sozlanmoqda...",
  "Dashboard tayyorlanmoqda...",
];

const STEPS = ["Biznes", "Soha", "CRM sozlamalari", "Tayyor"];

function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState<string | null>(null);
  const [otherLabel, setOtherLabel] = useState("");
  const [aiStep, setAiStep] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useServerFn(generateCrmConfig);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (step !== 3) return;
    const timer = setInterval(() => setAiStep((s) => (s + 1) % AI_STEPS.length), 1400);
    return () => clearInterval(timer);
  }, [step]);

  const startGeneration = async () => {
    if (!industry) return;
    setError(null);
    setGenerating(true);
    setStep(3);
    try {
      const result = await generate({
        data: {
          industryKey: industry,
          industryOther: industry === "boshqa" ? otherLabel : undefined,
          businessDescription: description,
          businessName: businessName.trim() || undefined,
        },
      });
      void queryClient.invalidateQueries({ queryKey: ["crm-config"] });
      if (result.aiError) console.warn("CRM preset fallback:", result.aiError);
      setStep(4);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi. Qayta urinib ko‘ring.");
      setStep(2);
    } finally {
      setGenerating(false);
    }
  };

  const industryEmoji = useMemo(
    () => INDUSTRIES.find((i) => i.key === industry)?.emoji ?? "⚙️",
    [industry],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
        <div className="flex items-center gap-3">
          <span className="clay-raised grid size-12 place-items-center overflow-hidden rounded-2xl bg-card">
            <img src={logoUrl} alt={t("NEXORA CRM logotipi")} className="size-9 object-contain" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold">NEXORA CRM</p>
            <p className="text-sm text-muted-foreground">{t("O‘z CRMingizni sozlang")}</p>
          </div>
        </div>

        <ol className="flex items-center gap-2 text-xs font-medium">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const passed = step > n;
            return (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-xs",
                    active && "clay-raised bg-primary text-primary-foreground",
                    passed && "clay-raised bg-primary/15 text-primary",
                    !active && !passed && "bg-muted text-muted-foreground",
                  )}
                >
                  {passed ? "✓" : n}
                </span>
                <span className={cn("hidden sm:inline", !active && "text-muted-foreground")}>{label}</span>
                {n < STEPS.length && <span className="h-px flex-1 bg-border" />}
              </li>
            );
          })}
        </ol>

        {step === 1 && (
          <section className="clay-panel flex flex-col gap-5 p-6">
            <div>
              <h1 className="font-display text-xl font-semibold">{t("Biznesingiz haqida ma'lumot bering")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("Bir daqiqada CRMni sizning biznesingizga moslaymiz.")}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="biznes-nomi">{t("Biznes nomi")}</Label>
              <Input
                id="biznes-nomi"
                placeholder={t("Masalan: Nexora stomatologiya klinikasi")}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="biznes-tavsif">{t("Biznesingiz haqida qisqacha ma'lumot bering")}</Label>
              <Textarea
                id="biznes-tavsif"
                rows={5}
                placeholder={t("Masalan: Biz stomatologiya klinikasimiz. 3 ta shifokorimiz bor va mijozlar asosan Telegram orqali murojaat qiladi.")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button
              className="self-end"
              disabled={description.trim().length < 10}
              onClick={() => setStep(2)}
            >
              {t("Davom etish")}
            </Button>
          </section>
        )}

        {step === 2 && (
          <section className="clay-panel flex flex-col gap-5 p-6">
            <div>
              <h1 className="font-display text-xl font-semibold">{t("Biznesingiz qaysi sohada?")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("Shunga qarab modullar, pipeline va maydonlar tayyorlanadi.")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {INDUSTRIES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setIndustry(option.key)}
                  className={cn(
                    "flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-transparent bg-card px-3 py-4 text-center text-sm font-medium transition-all hover:shadow-clay",
                    industry === option.key && "clay-raised border-primary/40 ring-2 ring-primary/30",
                  )}
                >
                  <span className="text-2xl">{option.emoji}</span>
                  {t(option.label)}
                </button>
              ))}
            </div>
            {industry === "boshqa" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="soha-boshqa">{t("Sohangizni yozing")}</Label>
                <Input
                  id="soha-boshqa"
                  placeholder={t("Masalan: Veterinariya klinika")}
                  value={otherLabel}
                  onChange={(e) => setOtherLabel(e.target.value)}
                />
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                {t("Orqaga")}
              </Button>
              <Button
                disabled={!industry || (industry === "boshqa" && otherLabel.trim().length < 3)}
                onClick={() => void startGeneration()}
              >
                {t("CRM yaratish")}
              </Button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="clay-panel flex flex-col items-center gap-6 p-10 text-center">
            <div className="relative grid size-20 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
              <span className="clay-raised grid size-16 place-items-center rounded-full bg-card text-3xl">
                {industryEmoji}
              </span>
            </div>
            <p className="font-display text-lg font-semibold">{AI_STEPS[aiStep]}</p>
            <div className="h-2 w-64 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${((aiStep + 1) / AI_STEPS.length) * 100}%` }}
              />
            </div>
          </section>
        )}

        {done && step === 4 && (
          <section className="clay-panel flex flex-col items-center gap-6 p-10 text-center">
            <span className="clay-raised grid size-16 place-items-center rounded-full bg-card text-3xl">🚀</span>
            <div>
              <h1 className="font-display text-xl font-semibold">{t("CRM tayyor!")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("Dashboard, modullar va pipeline biznesingizga moslab tayyorlandi.")}
              </p>
            </div>
            <Button size="lg" onClick={() => navigate({ to: "/dashboard" })}>
              {t("CRMga kirish")}
            </Button>
            <Link to="/dashboard/crm-builder" className="text-xs text-primary hover:underline">
              {t("Keyinroq AI bilan CRMni moslash")}
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
