CREATE TABLE public.telegram_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_user_id TEXT NOT NULL UNIQUE,
  telegram_chat_id TEXT NOT NULL,
  telegram_username TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  daily_reports BOOLEAN NOT NULL DEFAULT true,
  report_time TEXT NOT NULL DEFAULT '21:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent',
  last_report_date DATE,
  notify_new_order BOOLEAN NOT NULL DEFAULT true,
  notify_payment BOOLEAN NOT NULL DEFAULT true,
  notify_lead BOOLEAN NOT NULL DEFAULT true,
  notify_low_stock BOOLEAN NOT NULL DEFAULT false,
  linked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_links TO authenticated;
GRANT ALL ON public.telegram_links TO service_role;

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage their business telegram links"
ON public.telegram_links FOR ALL TO authenticated
USING (public.is_business_member(business_id))
WITH CHECK (public.is_business_member(business_id));

CREATE INDEX telegram_links_business_idx ON public.telegram_links (business_id);
CREATE INDEX telegram_links_daily_idx ON public.telegram_links (daily_reports, report_time);

CREATE TRIGGER telegram_links_updated_at
BEFORE UPDATE ON public.telegram_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.telegram_link_requests (
  code TEXT NOT NULL PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  telegram_chat_id TEXT NOT NULL,
  telegram_username TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 minutes'),
  consumed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.telegram_link_requests TO service_role;

ALTER TABLE public.telegram_link_requests ENABLE ROW LEVEL SECURITY;
