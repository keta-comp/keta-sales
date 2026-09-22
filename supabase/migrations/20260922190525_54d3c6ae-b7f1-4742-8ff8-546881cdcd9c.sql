DROP POLICY IF EXISTS "Signed in users read system notifications" ON public.system_notifications;
CREATE POLICY "Targeted users read system notifications" ON public.system_notifications FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR target_kind = 'all'
  OR (
    target_kind = 'organization'
    AND target_value ~ '^[0-9a-fA-F-]{36}$'
    AND public.is_business_member(target_value::uuid)
  )
  OR (
    target_kind = 'plan'
    AND EXISTS (
      SELECT 1 FROM public.business_members m
      JOIN public.businesses b ON b.id = m.business_id
      WHERE m.user_id = auth.uid() AND b.plan = target_value
    )
  )
  OR (
    target_kind = 'industry'
    AND EXISTS (
      SELECT 1 FROM public.business_members m
      JOIN public.crm_configs c ON c.business_id = m.business_id
      WHERE m.user_id = auth.uid() AND c.industry = target_value
    )
  )
);