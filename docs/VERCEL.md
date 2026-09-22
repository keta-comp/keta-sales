# NEXORA CRM — Vercel'ga joylash

Loyiha Vercel uchun sozlangan: `vercel.json` mavjud va qurish jarayoni
Vercel'da avtomatik ravishda `vercel` preseti bilan ishlaydi
(Cloudflare varianti ham buzilmadi — o'sha holida qoladi).

---

## 1. Loyihani Vercel'ga ulash

1. Kodni GitHub repozitoriyaga yuklang.
2. https://vercel.com/new → repozitoriyani tanlang.
3. Framework Preset: **Other** (`vercel.json` qolganini o'zi hal qiladi).
4. Build Command: `npm run build` · Output Directory: `.vercel/output`
   (bular `vercel.json` da yozilgan, o'zgartirish shart emas).

## 2. Environment Variables (Project Settings → Environment Variables)

Production va Preview uchun quyidagilarni qo'shing:

| Nom | Qiymat |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://pertsgqadpoaewihezhs.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (ochiq kalit) |
| `VITE_SUPABASE_PROJECT_ID` | `pertsgqadpoaewihezhs` |
| `SUPABASE_URL` | `https://pertsgqadpoaewihezhs.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` (maxfiy) |
| `OPENROUTER_API_KEY` | `sk-or-...` (AI uchun) |
| `OPENROUTER_MODEL` | `google/gemini-2.5-flash` (ixtiyoriy) |
| `GEMINI_API_KEY` | ixtiyoriy zaxira |
| `TELEGRAM_BOT_TOKEN` | BotFather tokeni |
| `PUBLIC_APP_URL` | saytning haqiqiy manzili, masalan `https://nexora-crm.uz` |
| `LOVABLE_CRON_SECRET` | kunlik hisobot cron chaqiruvi uchun maxfiy so'z |
| `BOT_TOKEN_ENCRYPTION_KEY` | ixtiyoriy, 64 belgi |
| `INSTAGRAM_PAGE_ACCESS_TOKEN`, `META_APP_SECRET` | Instagram uchun, ixtiyoriy |

`VITE_` bilan boshlanadigan qiymatlar qurish vaqtida kerak — ularni
qo'shgandan keyin qayta **Redeploy** qiling.

## 3. Domen

Project Settings → **Domains** → `nexora-crm.uz` (va `www`) qo'shib,
registrarda Vercel ko'rsatgan DNS yozuvlarini kiritasiz.

## 4. Telegram webhook'ni yangi manzilga ko'chirish

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://nexora-crm.uz/api/public/telegram/webhook"
```

## 5. Kunlik hisobot jadvali (ixtiyoriy)

Vercel Cron (`vercel.json` ga qo'shish mumkin) yoki tashqi scheduler orqali
har 15 daqiqada `POST /api/public/cron/daily-report` chaqiriladi va
`x-cron-secret` sarlavhasiga `LOVABLE_CRON_SECRET` qiymati qo'yiladi.

---

Eslatma: Lovable ichidagi ko'rish oynasi avvalgidek ishlaydi — bu sozlamalar
faqat Vercel'dagi qurishga ta'sir qiladi.
