-- roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

-- customers extra fields
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS assigned_operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;

-- leads extra fields
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS value NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS stage TEXT,
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;

-- orders discount
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount NUMERIC NOT NULL DEFAULT 0;

-- payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  due_date DATE,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members manage tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- activities
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT,
  actor TEXT NOT NULL DEFAULT 'operator',
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members read activities" ON public.activities
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "Business members write activities" ON public.activities
  FOR INSERT TO authenticated WITH CHECK (public.is_business_member(business_id));

-- indexes
CREATE INDEX IF NOT EXISTS payments_business_status_idx ON public.payments (business_id, status);
CREATE INDEX IF NOT EXISTS payments_business_paid_idx ON public.payments (business_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS payments_customer_idx ON public.payments (customer_id);
CREATE INDEX IF NOT EXISTS payments_order_idx ON public.payments (order_id);
CREATE INDEX IF NOT EXISTS tasks_business_status_idx ON public.tasks (business_id, status, due_date);
CREATE INDEX IF NOT EXISTS tasks_customer_idx ON public.tasks (customer_id);
CREATE INDEX IF NOT EXISTS activities_business_created_idx ON public.activities (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activities_customer_idx ON public.activities (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customers_business_status_idx ON public.customers (business_id, status);
CREATE INDEX IF NOT EXISTS customers_business_source_idx ON public.customers (business_id, source);
CREATE INDEX IF NOT EXISTS leads_business_stage_idx ON public.leads (business_id, stage);
CREATE INDEX IF NOT EXISTS orders_business_created_idx ON public.orders (business_id, created_at DESC);

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;