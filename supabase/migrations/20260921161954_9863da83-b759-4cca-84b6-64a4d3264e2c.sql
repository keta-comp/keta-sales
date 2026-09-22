ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS instagram_user_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS customers_instagram_user_uidx ON public.customers(instagram_user_id) WHERE instagram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS conversations_channel_idx ON public.conversations(channel);
CREATE TABLE public.instagram_events (
  mid TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.instagram_events TO authenticated;
GRANT ALL ON public.instagram_events TO service_role;
ALTER TABLE public.instagram_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "instagram_events staff read" ON public.instagram_events FOR SELECT TO authenticated USING (true);