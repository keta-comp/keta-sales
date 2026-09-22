CREATE TABLE public.platform_admins (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;

CREATE POLICY "Super admins read platform admins"
ON public.platform_admins FOR SELECT TO authenticated
USING (public.is_super_admin());

-- Platform level status / plan metadata
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS suspend_reason TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

CREATE POLICY "Super admins read all businesses"
ON public.businesses FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins read all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_super_admin());

-- Suspended workspaces lose data access, but nothing is deleted.
CREATE OR REPLACE FUNCTION public.is_business_member(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_members m
    JOIN public.businesses b ON b.id = m.business_id
    WHERE m.business_id = _business_id
      AND m.user_id = auth.uid()
      AND b.status <> 'suspended'
  );
$$;

CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_kind TEXT NOT NULL DEFAULT 'user',
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  target_label TEXT,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'success',
  ip TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);
CREATE INDEX audit_logs_action_idx ON public.audit_logs (action);
CREATE INDEX audit_logs_business_idx ON public.audit_logs (business_id);

CREATE TABLE public.ai_usage_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read ai usage"
ON public.ai_usage_events FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Members read their ai usage"
ON public.ai_usage_events FOR SELECT TO authenticated
USING (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE INDEX ai_usage_created_idx ON public.ai_usage_events (created_at DESC);
CREATE INDEX ai_usage_business_idx ON public.ai_usage_events (business_id);

CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_name TEXT NOT NULL DEFAULT 'KETA CRM',
  support_email TEXT NOT NULL DEFAULT 'keta.comp.dev@gmail.com',
  support_phone TEXT NOT NULL DEFAULT '+998 77 763 02 16',
  default_timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent',
  default_currency TEXT NOT NULL DEFAULT 'UZS',
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  maintenance_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone signed in reads system settings"
ON public.system_settings FOR SELECT TO authenticated
USING (true);

CREATE TRIGGER system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.system_settings (platform_name) VALUES ('KETA CRM');

CREATE TABLE public.feature_flags (
  key TEXT NOT NULL PRIMARY KEY,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  target_plan TEXT,
  target_business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed in users read feature flags"
ON public.feature_flags FOR SELECT TO authenticated
USING (true);

CREATE TRIGGER feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.feature_flags (key, label, enabled) VALUES
  ('ai_assistant', 'AI yordamchi', true),
  ('telegram_reports', 'Telegram hisobotlar', true),
  ('advanced_analytics', 'Kengaytirilgan analitika', true),
  ('excel_export', 'Excel eksport', true);

CREATE TABLE public.system_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info',
  target_kind TEXT NOT NULL DEFAULT 'all',
  target_value TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_notifications TO authenticated;
GRANT ALL ON public.system_notifications TO service_role;

ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed in users read system notifications"
ON public.system_notifications FOR SELECT TO authenticated
USING (true);

CREATE INDEX system_notifications_created_idx ON public.system_notifications (created_at DESC);
