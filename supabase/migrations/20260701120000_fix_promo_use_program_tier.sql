-- Use existing ambassador program tier (sales-based) for promo discounts.
-- Remove wrongly added ambassador_tiers table and profiles.ambassador_tier column.

DROP TRIGGER IF EXISTS trg_sync_ambassador_promo_discounts ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_ambassador_promo_discounts();

ALTER TABLE public.profiles DROP COLUMN IF EXISTS ambassador_tier;

DROP TABLE IF EXISTS public.ambassador_tiers CASCADE;

-- Align tier thresholds with programme ambassadeur (Starter → Elite, incl. Gold).
CREATE OR REPLACE FUNCTION public.get_ambassador_program_tier(p_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sales INTEGER;
BEGIN
  sales := public.ambassador_confirmed_sales_count(p_user_id);
  IF sales >= 75 THEN RETURN 'Elite';
  ELSIF sales >= 35 THEN RETURN 'Gold';
  ELSIF sales >= 15 THEN RETURN 'Silver';
  ELSIF sales >= 11 THEN RETURN 'Bronze';
  ELSE RETURN 'Starter';
  END IF;
END;
$$;

-- Client discount % per programme tier (same rates as commission tiers).
CREATE OR REPLACE FUNCTION public.get_ambassador_program_discount_percent(p_tier text)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT CASE lower(trim(COALESCE(p_tier, '')))
    WHEN 'starter' THEN 10
    WHEN 'bronze' THEN 11
    WHEN 'silver' THEN 13
    WHEN 'gold' THEN 15
    WHEN 'elite' THEN 20
    ELSE 10
  END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ambassador_program_discount_percent(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_promo_discount(
  p_promo_code_id bigint,
  p_subtotal numeric
)
RETURNS TABLE (
  discount_amount numeric,
  discount_percent numeric,
  discount_type text,
  tier_id text,
  tier_label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_promo public.promo_codes%ROWTYPE;
  v_percent numeric;
  v_amount numeric;
  v_tier_label text;
BEGIN
  IF p_promo_code_id IS NULL OR COALESCE(p_subtotal, 0) <= 0 THEN
    RETURN;
  END IF;

  SELECT * INTO v_promo
  FROM public.promo_codes
  WHERE id = p_promo_code_id
    AND active = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_promo.max_usage IS NOT NULL AND v_promo.usage_count >= v_promo.max_usage THEN
    RETURN;
  END IF;

  IF v_promo.ambassador_id IS NOT NULL THEN
    v_tier_label := public.get_ambassador_program_tier(v_promo.ambassador_id);
    v_percent := public.get_ambassador_program_discount_percent(v_tier_label);
    v_amount := floor(p_subtotal * v_percent / 100);
    RETURN QUERY SELECT
      v_amount,
      v_percent,
      'percent'::text,
      lower(v_tier_label),
      v_tier_label;
    RETURN;
  END IF;

  IF v_promo.discount_type = 'percent' THEN
    v_percent := v_promo.discount_value;
    v_amount := floor(p_subtotal * v_promo.discount_value / 100);
    RETURN QUERY SELECT v_amount, v_percent, 'percent'::text, NULL::text, NULL::text;
  ELSE
    v_amount := v_promo.discount_value;
    RETURN QUERY SELECT v_amount, NULL::numeric, 'fixed'::text, NULL::text, NULL::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_promo_code(
  p_code text,
  p_subtotal numeric
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_promo public.promo_codes%ROWTYPE;
  v_resolved record;
  v_normalized text := upper(trim(p_code));
BEGIN
  IF v_normalized IS NULL OR v_normalized = '' THEN
    RETURN json_build_object('valid', false, 'message', 'Code requis');
  END IF;

  IF COALESCE(p_subtotal, 0) <= 0 THEN
    RETURN json_build_object('valid', false, 'message', 'Panier vide');
  END IF;

  SELECT * INTO v_promo
  FROM public.promo_codes
  WHERE upper(code) = v_normalized
    AND active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'message', 'Code promo invalide');
  END IF;

  IF v_promo.max_usage IS NOT NULL AND v_promo.usage_count >= v_promo.max_usage THEN
    RETURN json_build_object('valid', false, 'message', 'Code promo épuisé');
  END IF;

  SELECT * INTO v_resolved
  FROM public.resolve_promo_discount(v_promo.id, p_subtotal);

  IF v_resolved IS NULL OR COALESCE(v_resolved.discount_amount, 0) <= 0 THEN
    RETURN json_build_object('valid', false, 'message', 'Réduction non applicable');
  END IF;

  RETURN json_build_object(
    'valid', true,
    'promo_id', v_promo.id,
    'code', v_promo.code,
    'discount_amount', v_resolved.discount_amount,
    'discount_percent', v_resolved.discount_percent,
    'discount_type', v_resolved.discount_type,
    'tier_id', v_resolved.tier_id,
    'tier_label', v_resolved.tier_label
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_promo_discount(bigint, numeric) TO anon, authenticated;

-- Sync profiles.level with computed programme tier.
SELECT public.sync_profile_program_tier(id)
FROM public.profiles
WHERE role = 'ambassador';

NOTIFY pgrst, 'reload schema';
