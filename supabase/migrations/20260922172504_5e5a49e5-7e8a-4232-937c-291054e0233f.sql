ALTER TABLE public.payments ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.tasks ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.activities ALTER COLUMN business_id SET DEFAULT public.current_business_id();