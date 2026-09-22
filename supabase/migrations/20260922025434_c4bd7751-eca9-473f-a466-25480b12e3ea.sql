CREATE TABLE public.crm_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  industry TEXT NOT NULL,
  business_description TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  title TEXT NOT NULL,
  stage TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX crm_records_module_idx ON public.crm_records (business_id, module_key);
CREATE INDEX crm_records_stage_idx ON public.crm_records (business_id, stage);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_records TO authenticated;
GRANT ALL ON public.crm_configs TO service_role;
GRANT ALL ON public.crm_records TO service_role;

ALTER TABLE public.crm_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_configs_staff_all" ON public.crm_configs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_records_staff_all" ON public.crm_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER crm_configs_updated_at BEFORE UPDATE ON public.crm_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER crm_records_updated_at BEFORE UPDATE ON public.crm_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_records;