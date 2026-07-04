-- Zones de livraison : table, RLS, seed communes Kinshasa

CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  city text,
  price numeric NOT NULL DEFAULT 0,
  zone_type text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS zone_type text;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS delivery_zones_name_city_uidx
  ON public.delivery_zones (lower(trim(name)), lower(trim(coalesce(city, ''))));

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active delivery zones" ON public.delivery_zones;
CREATE POLICY "Anyone can read active delivery zones"
  ON public.delivery_zones FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage delivery zones" ON public.delivery_zones;
CREATE POLICY "Admins manage delivery zones"
  ON public.delivery_zones FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.delivery_zones (name, city, price, zone_type, is_active)
SELECT v.name, 'Kinshasa', v.price, v.zone_type, true
FROM (VALUES
  ('Ngiri-Ngiri', 8000::numeric, 'proche'),
  ('Kalamu', 8000, 'proche'),
  ('Kasa-Vubu', 8000, 'proche'),
  ('Bumbu', 8500, 'proche'),
  ('Makala', 9000, 'proche'),
  ('Selembao', 10000, 'moyenne'),
  ('Bandalungwa', 10000, 'moyenne'),
  ('Lingwala', 10500, 'moyenne'),
  ('Kinshasa (commune)', 10500, 'moyenne'),
  ('Barumbu', 11000, 'moyenne'),
  ('Gombe', 11000, 'moyenne'),
  ('Kintambo', 11500, 'moyenne'),
  ('Lemba', 12000, 'moyenne'),
  ('Limete', 12000, 'moyenne'),
  ('Ngaba', 12000, 'moyenne'),
  ('Matete', 12500, 'moyenne'),
  ('Ngaliema', 13000, 'eloignee'),
  ('Mont-Ngafula', 14000, 'eloignee'),
  ('Kisenso', 14000, 'eloignee'),
  ('N''djili', 14500, 'eloignee'),
  ('Masina', 14500, 'eloignee'),
  ('Kimbanseke', 15000, 'eloignee'),
  ('N''sele', 15000, 'eloignee'),
  ('Maluku', 15000, 'eloignee')
) AS v(name, price, zone_type)
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_zones LIMIT 1);

NOTIFY pgrst, 'reload schema';
