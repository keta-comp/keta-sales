CREATE OR REPLACE FUNCTION public.platform_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'users', (SELECT count(*) FROM public.profiles),
    'businesses', (SELECT count(*) FROM public.businesses),
    'crms', (SELECT count(*) FROM public.crm_configs)
  )
$$;

GRANT EXECUTE ON FUNCTION public.platform_stats() TO anon, authenticated, service_role;