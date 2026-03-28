-- Align promo_codes with app column "active" + fix RLS (was is_active in old migration).

DROP POLICY IF EXISTS "Active promo codes are viewable" ON public.promo_codes;
DROP POLICY IF EXISTS "Ambassadors can view own promo codes" ON public.promo_codes;

-- Single column "active" used by CartContext / AdminDashboard
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'promo_codes' AND column_name = 'is_active'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'promo_codes' AND column_name = 'active'
  ) THEN
    ALTER TABLE public.promo_codes RENAME COLUMN is_active TO active;
  END IF;
END $$;

ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

UPDATE public.promo_codes SET active = true WHERE active IS NULL;

-- Checkout / panier : tout code actif lisible (validation par code)
CREATE POLICY "promo_codes_select_active"
  ON public.promo_codes FOR SELECT
  USING (active = true);

-- Ambassadeur : voir aussi ses codes (même inactifs) pour le dashboard
CREATE POLICY "promo_codes_select_own_ambassador"
  ON public.promo_codes FOR SELECT
  TO authenticated
  USING (ambassador_id = auth.uid());
