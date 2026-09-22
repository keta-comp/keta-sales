# NEXORA CRM — mustaqil serverda ishga tushirish

Baza allaqachon **sizning Supabase loyihangizga** (`pertsgqadpoaewihezhs`)
o'rnatildi: 33 jadval, xavfsizlik qoidalari (RLS), funksiyalar, triggerlar va
realtime sozlamalari tayyor. Quyida qolgan bosqichlar.

---

## 1. Supabase sozlamalari (brauzerdan, 2 daqiqa)

1. **Authentication → Sign In / Providers → Email**
   - "Allow new users to sign up" = **ON** (ko'p foydalanuvchili CRM)
   - "Confirm email" = **OFF** (ro'yxatdan o'tgach darhol kirsin)
2. **Project Settings → API keys** → `secret (service_role)` kalitini oling —
   u faqat serverda ishlatiladi, hech qachon frontendga qo'yilmaydi.

## 2. Muhit o'zgaruvchilari

`.env.example` faylidan `.env` yarating — Supabase manzili va ochiq kaliti
allaqachon to'ldirilgan. Qo'shishingiz kerak bo'lgani:

- `SUPABASE_SERVICE_ROLE_KEY` — 1-bosqichda olgan secret kalit
- `OPENROUTER_API_KEY` — https://openrouter.ai/keys (AI uchun, tavsiya etiladi)
- yoki `GEMINI_API_KEY` — https://aistudio.google.com/apikey (bepul)
- `TELEGRAM_BOT_TOKEN` — BotFather'dan
- `PUBLIC_APP_URL` — saytning haqiqiy manzili (masalan `https://nexora-crm.uz`)

## 3. Cloudflare Workers'ga joylash

```bash
npm i -g wrangler
wrangler login

wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put OPENROUTER_API_KEY
wrangler secret put GEMINI_API_KEY
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put LOVABLE_CRON_SECRET

npm install
npm run build
wrangler deploy
```

`wrangler.toml` ichidagi `[vars]` da Supabase manzili, ochiq kaliti va
`PUBLIC_APP_URL` turadi — domeningiz boshqacha bo'lsa shu yerda o'zgartiring.

## 4. Super Admin hisobini yaratish

1. Saytga kirib odatdagidek ro'yxatdan o'ting (masalan
   `nursultansayyora@gmail.com`).
2. Supabase → **SQL Editor** da bir marta bajaring:

```sql
insert into public.platform_admins (user_id, email)
select id, email from auth.users where email = 'nursultansayyora@gmail.com'
on conflict do nothing;
```

Shundan keyin `/super-admin` bo'limi shu hisobga ochiladi.

## 5. Telegram webhook

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://SIZNING-DOMEN/api/public/telegram/webhook
```

`PUBLIC_APP_URL` to'g'ri bo'lsa tizim buni o'zi ham sozlaydi.

## 6. Kunlik hisobot jadvali (ixtiyoriy)

Supabase → SQL Editor:

```sql
select cron.schedule('nexora-daily-report', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://SIZNING-DOMEN/api/public/telegram/daily-report',
    headers := '{"x-cron-secret":"SIZNING_CRON_SECRET"}'::jsonb
  );
$$);
```

---

## Tekshirish ro'yxati

- [ ] Sayt o'z domeningizda ochiladi, ro'yxatdan o'tish va kirish ishlaydi
- [ ] Yangi hisob uchun onboarding (soha tanlash) ishlaydi
- [ ] `/super-admin` faqat platform_admins ro'yxatidagi hisobga ochiladi
- [ ] Telegram bot /start ga javob beradi va hisobot yuboradi

## Lovable'ga bog'liqlik qoldimi?

Yo'q. `OPENROUTER_API_KEY` (yoki `GEMINI_API_KEY`) berilgach AI mustaqil ishlaydi;
baza, login, fayllar — hammasi sizning Supabase va Cloudflare hisobingizda.
