-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TYPE public.app_role AS ENUM ('admin','operator');
CREATE TYPE public.lead_status AS ENUM ('new','needs_operator','assigned','contacted','negotiating','won','lost');
CREATE TYPE public.lead_score AS ENUM ('hot','warm','cold');
CREATE TYPE public.order_status AS ENUM ('new','confirming','confirmed','preparing','delivered','cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid','partial','paid','refunded');
CREATE TYPE public.message_role AS ENUM ('customer','ai','operator','system');
CREATE TYPE public.conversation_mode AS ENUM ('ai','human');

-- ============ profiles / roles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by staff" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles readable by staff" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ settings ============
CREATE TABLE public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL DEFAULT 'My Store',
  business_description TEXT NOT NULL DEFAULT '',
  working_hours TEXT NOT NULL DEFAULT '09:00 - 20:00',
  delivery_info TEXT NOT NULL DEFAULT '',
  payment_methods TEXT NOT NULL DEFAULT '',
  return_policy TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'UZS',
  operator_group_chat_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.business_settings TO authenticated;
GRANT ALL ON public.business_settings TO service_role;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings staff read" ON public.business_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings staff write" ON public.business_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "settings staff insert" ON public.business_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE TRIGGER business_settings_updated_at BEFORE UPDATE ON public.business_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model TEXT NOT NULL DEFAULT 'google/gemini-3.7-flash',
  tone_of_voice TEXT NOT NULL DEFAULT 'friendly, professional, concise',
  sales_strategy TEXT NOT NULL DEFAULT 'Consultative selling: qualify need, recommend in-stock products, handle objections, close politely.',
  language_instruction TEXT NOT NULL DEFAULT 'Reply in the same language the customer writes in (Uzbek, Russian or English).',
  escalation_rules TEXT NOT NULL DEFAULT 'Escalate on discount requests, complaints, payment or delivery problems, or when the customer asks for a human.',
  max_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  custom_instructions TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai settings staff read" ON public.ai_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai settings staff write" ON public.ai_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ai settings staff insert" ON public.ai_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE TRIGGER ai_settings_updated_at BEFORE UPDATE ON public.ai_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.business_settings (business_name, business_description, delivery_info, payment_methods, return_policy)
VALUES ('My Store', 'Electronics and accessories retailer.', 'Delivery within the city in 1-2 days.', 'Cash, card, bank transfer.', '14-day return on unused items.');
INSERT INTO public.ai_settings DEFAULT VALUES;

-- ============ catalog ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories staff all" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(14,2) NOT NULL DEFAULT 0,
  compare_at_price NUMERIC(14,2),
  cost_price NUMERIC(14,2),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON public.products(category_id);
CREATE INDEX products_name_idx ON public.products USING gin (to_tsvector('simple', name || ' ' || description));
CREATE INDEX products_active_idx ON public.products(is_active, is_archived);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products staff all" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  change INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX inventory_movements_product_idx ON public.inventory_movements(product_id, created_at DESC);
GRANT SELECT, INSERT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movements staff read" ON public.inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "movements staff insert" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (true);

-- ============ operators ============
CREATE TABLE public.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  telegram_username TEXT,
  telegram_user_id TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operators TO authenticated;
GRANT ALL ON public.operators TO service_role;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operators staff all" ON public.operators FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER operators_updated_at BEFORE UPDATE ON public.operators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ customers ============
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id TEXT UNIQUE,
  telegram_username TEXT,
  full_name TEXT,
  phone TEXT,
  location TEXT,
  notes TEXT,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC(14,2) NOT NULL DEFAULT 0,
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX customers_last_interaction_idx ON public.customers(last_interaction_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers staff all" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ conversations / messages ============
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'telegram',
  telegram_chat_id TEXT,
  mode public.conversation_mode NOT NULL DEFAULT 'ai',
  assigned_operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX conversations_customer_idx ON public.conversations(customer_id);
CREATE INDEX conversations_last_message_idx ON public.conversations(last_message_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations staff all" ON public.conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role public.message_role NOT NULL,
  content TEXT NOT NULL,
  telegram_message_id BIGINT,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON public.messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages staff all" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.telegram_updates (
  update_id BIGINT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.telegram_updates TO authenticated;
GRANT ALL ON public.telegram_updates TO service_role;
ALTER TABLE public.telegram_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "telegram updates staff read" ON public.telegram_updates FOR SELECT TO authenticated USING (true);

-- ============ leads ============
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'telegram',
  requested_product TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  budget TEXT,
  location TEXT,
  phone TEXT,
  score public.lead_score NOT NULL DEFAULT 'cold',
  status public.lead_status NOT NULL DEFAULT 'new',
  assigned_operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  ai_summary TEXT,
  handoff_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leads_status_idx ON public.leads(status);
CREATE INDEX leads_created_idx ON public.leads(created_at DESC);
CREATE INDEX leads_customer_idx ON public.leads(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads staff all" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  detail TEXT,
  actor TEXT NOT NULL DEFAULT 'ai',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lead_events_lead_idx ON public.lead_events(lead_id, created_at DESC);
GRANT SELECT, INSERT ON public.lead_events TO authenticated;
GRANT ALL ON public.lead_events TO service_role;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead events staff read" ON public.lead_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead events staff insert" ON public.lead_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.operator_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id, operator_id)
);
GRANT SELECT, INSERT, DELETE ON public.operator_assignments TO authenticated;
GRANT ALL ON public.operator_assignments TO service_role;
ALTER TABLE public.operator_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments staff all" ON public.operator_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ orders ============
CREATE SEQUENCE public.order_number_seq START 1000;
GRANT USAGE ON SEQUENCE public.order_number_seq TO authenticated, service_role;

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT ('ORD-' || nextval('public.order_number_seq')::text),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'new',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  delivery_address TEXT,
  phone TEXT,
  notes TEXT,
  assigned_operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  stock_applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_status_idx ON public.orders(status);
CREATE INDEX orders_created_idx ON public.orders(created_at DESC);
CREATE INDEX orders_customer_idx ON public.orders(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders staff all" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order items staff all" ON public.order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ transactional stock on confirm/cancel ============
CREATE OR REPLACE FUNCTION public.apply_order_stock(_order_id UUID, _actor UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it RECORD; applied BOOLEAN;
BEGIN
  SELECT stock_applied INTO applied FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF applied IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF applied THEN RETURN; END IF;
  FOR it IN SELECT * FROM public.order_items WHERE order_id = _order_id AND product_id IS NOT NULL LOOP
    UPDATE public.products SET stock_quantity = stock_quantity - it.quantity
    WHERE id = it.product_id AND stock_quantity >= it.quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock for product %', it.product_name; END IF;
    INSERT INTO public.inventory_movements (product_id, change, reason, reference_id, created_by)
    VALUES (it.product_id, -it.quantity, 'order_confirmed', _order_id, _actor);
  END LOOP;
  UPDATE public.orders SET stock_applied = true WHERE id = _order_id;
END; $$;

CREATE OR REPLACE FUNCTION public.revert_order_stock(_order_id UUID, _actor UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it RECORD; applied BOOLEAN;
BEGIN
  SELECT stock_applied INTO applied FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF applied IS NOT TRUE THEN RETURN; END IF;
  FOR it IN SELECT * FROM public.order_items WHERE order_id = _order_id AND product_id IS NOT NULL LOOP
    UPDATE public.products SET stock_quantity = stock_quantity + it.quantity WHERE id = it.product_id;
    INSERT INTO public.inventory_movements (product_id, change, reason, reference_id, created_by)
    VALUES (it.product_id, it.quantity, 'order_cancelled', _order_id, _actor);
  END LOOP;
  UPDATE public.orders SET stock_applied = false WHERE id = _order_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.apply_order_stock(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revert_order_stock(UUID, UUID) TO authenticated, service_role;

-- keep customer totals in sync when an order is delivered
CREATE OR REPLACE FUNCTION public.sync_customer_totals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.customers c SET
    total_orders = (SELECT count(*) FROM public.orders o WHERE o.customer_id = c.id AND o.status <> 'cancelled'),
    total_spent = COALESCE((SELECT sum(o.total) FROM public.orders o WHERE o.customer_id = c.id AND o.status <> 'cancelled'), 0)
  WHERE c.id = COALESCE(NEW.customer_id, OLD.customer_id);
  RETURN NULL;
END; $$;
CREATE TRIGGER orders_sync_customer_totals AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_customer_totals();

-- ============ realtime ============
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;