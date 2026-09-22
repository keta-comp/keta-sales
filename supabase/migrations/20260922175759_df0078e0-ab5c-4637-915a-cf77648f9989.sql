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
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.business_id = _business_id
      AND m.user_id = auth.uid()
      AND b.status <> 'suspended'
      AND p.status <> 'suspended'
  );
$$;

CREATE OR REPLACE FUNCTION public.my_access_state()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'user_status', COALESCE((SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()), 'active'),
    'workspace_status', (
      SELECT b.status FROM public.business_members m
      JOIN public.businesses b ON b.id = m.business_id
      WHERE m.user_id = auth.uid()
      ORDER BY m.created_at ASC LIMIT 1
    ),
    'is_super_admin', public.is_super_admin(),
    'maintenance_mode', COALESCE((SELECT s.maintenance_mode FROM public.system_settings s LIMIT 1), false),
    'maintenance_message', (SELECT s.maintenance_message FROM public.system_settings s LIMIT 1)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.my_access_state() FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_access_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_access_state() TO authenticated, service_role;
