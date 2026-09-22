import logoUrl from "@/assets/nexora-logo.webp";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export const BRAND_NAME = "NEXORA CRM";
export const BRAND_TAGLINE = "Qoraqalpog‘iston uchun";
export const CONTACT_PHONE = "+998 77 763 02 16";
export const CONTACT_PHONE_HREF = "tel:+998777630216";
export const CONTACT_EMAIL = "keta.comp.dev@gmail.com";
export const CONTACT_EMAIL_HREF = "mailto:keta.comp.dev@gmail.com";

/** Qoraqalpog‘iston bayrog‘i — kichik va minimal ko‘rinishda. */
export function KarakalpakFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 20"
      role="img"
      aria-label={t("Qoraqalpog‘iston bayrog‘i")}
      className={cn("h-3.5 w-5 rounded-[3px] shadow-sm", className)}
    >
      <rect width="30" height="20" fill="#1EB0E7" />
      <rect y="8" width="30" height="4" fill="#FFD400" />
      <rect y="12" width="30" height="8" fill="#26A65B" />
      <rect y="7.4" width="30" height="0.6" fill="#fff" />
      <rect y="12" width="30" height="0.6" fill="#fff" />
      <path d="M6.6 1.4a2.7 2.7 0 1 0 0 5 2.2 2.2 0 1 1 0-5z" fill="#fff" />
      <g fill="#fff">
        <circle cx="11" cy="2.2" r="0.6" />
        <circle cx="13.4" cy="3.4" r="0.6" />
        <circle cx="11" cy="4.6" r="0.6" />
        <circle cx="15.8" cy="2.2" r="0.6" />
        <circle cx="15.8" cy="4.6" r="0.6" />
      </g>
    </svg>
  );
}

export function BrandMark({
  className,
  size = "md",
  subtitle = true,
  invert = false,
}: {
  className?: string;
  size?: "sm" | "md";
  subtitle?: boolean;
  invert?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src={logoUrl}
        alt={t("NEXORA CRM logotipi")}
        className={cn("object-contain", size === "sm" ? "h-7 w-9" : "h-9 w-12")}
      />
      <div className="leading-tight">
        <p
          className={cn(
            "font-display font-bold tracking-tight",
            size === "sm" ? "text-sm" : "text-lg",
            invert ? "text-background" : "text-foreground",
          )}
        >
          {BRAND_NAME}
        </p>
        {subtitle && (
          <p
            className={cn(
              "text-[10px] uppercase tracking-[0.18em]",
              invert ? "text-background/70" : "text-muted-foreground",
            )}
          >
            {BRAND_TAGLINE}
          </p>
        )}
      </div>
    </div>
  );
}
