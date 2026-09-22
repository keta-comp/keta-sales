DROP POLICY IF EXISTS "crm_configs_staff_all" ON public.crm_configs;
CREATE POLICY "crm_configs tenant" ON public.crm_configs FOR ALL TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

DROP POLICY IF EXISTS "crm_records_staff_all" ON public.crm_records;
CREATE POLICY "crm_records tenant" ON public.crm_records FOR ALL TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

DROP POLICY IF EXISTS "instagram_events staff read" ON public.instagram_events;
CREATE POLICY "instagram_events admin read" ON public.instagram_events FOR SELECT TO authenticated
  USING (public.is_super_admin());