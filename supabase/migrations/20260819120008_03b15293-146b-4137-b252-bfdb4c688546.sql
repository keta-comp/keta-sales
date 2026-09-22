-- MULTI-TENANCY: businesses, members, telegram bots, RLS

CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Business',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.business_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);
CREATE INDEX idx_business_members_user ON public.business_members(user_id);
GRANT SELECT ON public.business_members TO authenticated;
GRANT ALL ON public.business_members TO service_role;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_business_member(_business_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = _business_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.current_business_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT business_id FROM public.business_members
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.is_business_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_business_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_business_id() TO authenticated, service_role;

CREATE POLICY "businesses member read" ON public.businesses
  FOR SELECT TO authenticated USING (public.is_business_member(id));
CREATE POLICY "businesses owner update" ON public.businesses
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "members read own business" ON public.business_members
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));

CREATE TABLE public.telegram_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  bot_token_encrypted TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  bot_username TEXT,
  bot_first_name TEXT,
  telegram_bot_id BIGINT,
  webhook_url TEXT,
  webhook_status TEXT NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT false,
  last_error TEXT,
  last_checked_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_telegram_bots_business_active
  ON public.telegram_bots(business_id) WHERE is_active;
CREATE UNIQUE INDEX idx_telegram_bots_telegram_id_active
  ON public.telegram_bots(telegram_bot_id) WHERE is_active;
GRANT ALL ON public.telegram_bots TO service_role;
ALTER TABLE public.telegram_bots ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER telegram_bots_updated_at BEFORE UPDATE ON public.telegram_bots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER businesses_updated_at BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.business_settings ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.ai_settings ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_movements ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.operators ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.customers ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.leads ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.lead_events ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.operator_assignments ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.order_items ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.telegram_updates ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;

INSERT INTO public.businesses (owner_id, name)
SELECT p.id, COALESCE(p.full_name, p.email, 'My Business')
FROM public.profiles p;

INSERT INTO public.business_members (business_id, user_id, role)
SELECT b.id, b.owner_id, 'admin' FROM public.businesses b
ON CONFLICT DO NOTHING;

DO $$
DECLARE first_business UUID;
BEGIN
  SELECT id INTO first_business FROM public.businesses ORDER BY created_at ASC LIMIT 1;
  IF first_business IS NULL THEN
    DELETE FROM public.order_items; DELETE FROM public.orders;
    DELETE FROM public.lead_events; DELETE FROM public.operator_assignments;
    DELETE FROM public.leads; DELETE FROM public.messages;
    DELETE FROM public.conversations; DELETE FROM public.customers;
    DELETE FROM public.inventory_movements; DELETE FROM public.products;
    DELETE FROM public.categories; DELETE FROM public.operators;
    DELETE FROM public.telegram_updates;
    DELETE FROM public.business_settings; DELETE FROM public.ai_settings;
  ELSE
    UPDATE public.business_settings SET business_id = first_business WHERE business_id IS NULL;
    UPDATE public.ai_settings SET business_id = first_business WHERE business_id IS NULL;
    UPDATE public.categories SET business_id = first_business WHERE business_id IS NULL;
    UPDATE public.products SET business_id = first_business WHERE business_id IS NULL;
    UPDATE public.inventory_movements SET business_id = first_business WHERE business_id IS NULL;
    UPDATE public.operators SET business_id = first_business WHERE business_id IS NULL;
    UPDATE public.customers SET business_id = first_business WHERE business_id IS NULL;
    UPDATE public.conversations SET business_id = first_business WHERE business_id IS NULL;
    UPDATE public.messages SET business_id = first_business WHERE business_id IS NULL;
    UPDATE public.leads SET business_id = first_business WHERE business_id IS NULL;
    UPDATE public.lead_events SET business_id = first_business WHERE business_id IS NULL;
    UPDATE public.operator_assignments SET business_id = first_business WHERE business_id IS NULL;
    UPDATE public.orders SET business_id = first_business WHERE business_id IS NULL;
    UPDATE public.order_items SET business_id = first_business WHERE business_id IS NULL;
    UPDATE public.telegram_updates SET business_id = first_business WHERE business_id IS NULL;
  END IF;
END $$;

INSERT INTO public.business_settings (business_id, business_name)
SELECT b.id, b.name FROM public.businesses b
WHERE NOT EXISTS (SELECT 1 FROM public.business_settings s WHERE s.business_id = b.id);

INSERT INTO public.ai_settings (business_id)
SELECT b.id FROM public.businesses b
WHERE NOT EXISTS (SELECT 1 FROM public.ai_settings a WHERE a.business_id = b.id);

ALTER TABLE public.business_settings ALTER COLUMN business_id SET NOT NULL,
  ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.ai_settings ALTER COLUMN business_id SET NOT NULL,
  ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.categories ALTER COLUMN business_id SET NOT NULL,
  ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.products ALTER COLUMN business_id SET NOT NULL,
  ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.inventory_movements ALTER COLUMN business_id SET NOT NULL,
  ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.operators ALTER COLUMN business_id SET NOT NULL,
  ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.customers ALTER COLUMN business_id SET NOT NULL,
  ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.conversations ALTER COLUMN business_id SET NOT NULL,
  ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.messages ALTER COLUMN business_id SET NOT NULL,
  ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.leads ALTER COLUMN business_id SET NOT NULL,
  ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.lead_events ALTER COLUMN business_id SET NOT NULL,
  ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.operator_assignments ALTER COLUMN business_id SET NOT NULL,
  ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.orders ALTER COLUMN business_id SET NOT NULL,
  ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.order_items ALTER COLUMN business_id SET NOT NULL,
  ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.telegram_updates ALTER COLUMN business_id SET NOT NULL;

ALTER TABLE public.business_settings ADD CONSTRAINT business_settings_business_unique UNIQUE (business_id);
ALTER TABLE public.ai_settings ADD CONSTRAINT ai_settings_business_unique UNIQUE (business_id);

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_key;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_slug_key;
ALTER TABLE public.categories ADD CONSTRAINT categories_business_name_unique UNIQUE (business_id, name);
ALTER TABLE public.categories ADD CONSTRAINT categories_business_slug_unique UNIQUE (business_id, slug);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE public.products ADD CONSTRAINT products_business_sku_unique UNIQUE (business_id, sku);

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_telegram_user_id_key;
ALTER TABLE public.customers ADD CONSTRAINT customers_business_telegram_unique UNIQUE (business_id, telegram_user_id);

ALTER TABLE public.telegram_updates DROP CONSTRAINT IF EXISTS telegram_updates_pkey;
ALTER TABLE public.telegram_updates ADD CONSTRAINT telegram_updates_pkey PRIMARY KEY (business_id, update_id);

CREATE INDEX idx_products_business ON public.products(business_id);
CREATE INDEX idx_customers_business ON public.customers(business_id);
CREATE INDEX idx_conversations_business ON public.conversations(business_id);
CREATE INDEX idx_messages_business ON public.messages(business_id);
CREATE INDEX idx_leads_business ON public.leads(business_id);
CREATE INDEX idx_orders_business ON public.orders(business_id);

DROP POLICY IF EXISTS "settings staff read" ON public.business_settings;
DROP POLICY IF EXISTS "settings staff write" ON public.business_settings;
DROP POLICY IF EXISTS "settings staff insert" ON public.business_settings;
DROP POLICY IF EXISTS "ai settings staff read" ON public.ai_settings;
DROP POLICY IF EXISTS "ai settings staff write" ON public.ai_settings;
DROP POLICY IF EXISTS "ai settings staff insert" ON public.ai_settings;
DROP POLICY IF EXISTS "categories staff all" ON public.categories;
DROP POLICY IF EXISTS "products staff all" ON public.products;
DROP POLICY IF EXISTS "movements staff read" ON public.inventory_movements;
DROP POLICY IF EXISTS "movements staff insert" ON public.inventory_movements;
DROP POLICY IF EXISTS "operators staff all" ON public.operators;
DROP POLICY IF EXISTS "customers staff all" ON public.customers;
DROP POLICY IF EXISTS "conversations staff all" ON public.conversations;
DROP POLICY IF EXISTS "messages staff all" ON public.messages;
DROP POLICY IF EXISTS "leads staff all" ON public.leads;
DROP POLICY IF EXISTS "lead events staff read" ON public.lead_events;
DROP POLICY IF EXISTS "lead events staff insert" ON public.lead_events;
DROP POLICY IF EXISTS "assignments staff all" ON public.operator_assignments;
DROP POLICY IF EXISTS "orders staff all" ON public.orders;
DROP POLICY IF EXISTS "order items staff all" ON public.order_items;
DROP POLICY IF EXISTS "telegram updates staff read" ON public.telegram_updates;
DROP POLICY IF EXISTS "profiles readable by staff" ON public.profiles;
DROP POLICY IF EXISTS "roles readable by staff" ON public.user_roles;

CREATE POLICY "business_settings tenant" ON public.business_settings FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "ai_settings tenant" ON public.ai_settings FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "categories tenant" ON public.categories FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "products tenant" ON public.products FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "inventory_movements tenant read" ON public.inventory_movements FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));
CREATE POLICY "inventory_movements tenant insert" ON public.inventory_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "operators tenant" ON public.operators FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "customers tenant" ON public.customers FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "conversations tenant" ON public.conversations FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "messages tenant" ON public.messages FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "leads tenant" ON public.leads FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "lead_events tenant read" ON public.lead_events FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));
CREATE POLICY "lead_events tenant insert" ON public.lead_events FOR INSERT TO authenticated
  WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "operator_assignments tenant" ON public.operator_assignments FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "orders tenant" ON public.orders FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "order_items tenant" ON public.order_items FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "telegram_updates tenant read" ON public.telegram_updates FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_my_telegram_bot()
RETURNS TABLE (
  id UUID, business_id UUID, bot_username TEXT, bot_first_name TEXT,
  telegram_bot_id BIGINT, webhook_url TEXT, webhook_status TEXT,
  is_active BOOLEAN, last_error TEXT, last_checked_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ, created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.business_id, t.bot_username, t.bot_first_name, t.telegram_bot_id,
         t.webhook_url, t.webhook_status, t.is_active, t.last_error, t.last_checked_at,
         t.connected_at, t.created_at
  FROM public.telegram_bots t
  WHERE public.is_business_member(t.business_id)
  ORDER BY t.is_active DESC, t.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_my_telegram_bot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_telegram_bot() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_business UUID;
  display_name TEXT;
  business_name TEXT;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  business_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'business_name', ''), display_name);

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, display_name)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;

  INSERT INTO public.businesses (owner_id, name) VALUES (NEW.id, business_name)
  RETURNING id INTO new_business;

  INSERT INTO public.business_members (business_id, user_id, role)
  VALUES (new_business, NEW.id, 'admin') ON CONFLICT DO NOTHING;

  INSERT INTO public.business_settings (business_id, business_name)
  VALUES (new_business, business_name);

  INSERT INTO public.ai_settings (business_id) VALUES (new_business);

  INSERT INTO public.operators (business_id, user_id, full_name)
  VALUES (new_business, NEW.id, display_name);

  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.apply_order_stock(_order_id UUID, _actor UUID DEFAULT NULL::UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it RECORD; applied BOOLEAN; biz UUID;
BEGIN
  SELECT stock_applied, business_id INTO applied, biz FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF applied IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF applied THEN RETURN; END IF;
  FOR it IN SELECT * FROM public.order_items WHERE order_id = _order_id AND product_id IS NOT NULL LOOP
    UPDATE public.products SET stock_quantity = stock_quantity - it.quantity
    WHERE id = it.product_id AND business_id = biz AND stock_quantity >= it.quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock for product %', it.product_name; END IF;
    INSERT INTO public.inventory_movements (business_id, product_id, change, reason, reference_id, created_by)
    VALUES (biz, it.product_id, -it.quantity, 'order_confirmed', _order_id, _actor);
  END LOOP;
  UPDATE public.orders SET stock_applied = true WHERE id = _order_id;
END; $$;

CREATE OR REPLACE FUNCTION public.revert_order_stock(_order_id UUID, _actor UUID DEFAULT NULL::UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it RECORD; applied BOOLEAN; biz UUID;
BEGIN
  SELECT stock_applied, business_id INTO applied, biz FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF applied IS NOT TRUE THEN RETURN; END IF;
  FOR it IN SELECT * FROM public.order_items WHERE order_id = _order_id AND product_id IS NOT NULL LOOP
    UPDATE public.products SET stock_quantity = stock_quantity + it.quantity
    WHERE id = it.product_id AND business_id = biz;
    INSERT INTO public.inventory_movements (business_id, product_id, change, reason, reference_id, created_by)
    VALUES (biz, it.product_id, it.quantity, 'order_cancelled', _order_id, _actor);
  END LOOP;
  UPDATE public.orders SET stock_applied = false WHERE id = _order_id;
END; $$;