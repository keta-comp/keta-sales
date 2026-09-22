CREATE OR REPLACE FUNCTION public.my_workspace_status()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.status
  FROM public.business_members m
  JOIN public.businesses b ON b.id = m.business_id
  WHERE m.user_id = auth.uid()
  ORDER BY m.created_at ASC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.my_workspace_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_workspace_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_workspace_status() TO authenticated, service_role;
