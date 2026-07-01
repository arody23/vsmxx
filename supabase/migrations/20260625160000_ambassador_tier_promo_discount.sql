-- Ambassador tiers drive client discount + commission (promo codes follow tier dynamically)

CREATE TABLE IF NOT EXISTS public.ambassador_tiers (
  id text PRIMARY KEY,
  label text NOT NULL,
  client_discount_percent numeric NOT NULL CHECK (client_discount_percent >= 0 AND client_discount_percent <= 100),
  commission_percent numeric NOT NULL CHECK (commission_percent >= 0 AND commission_percent <= 100),
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO public.ambassador_tiers (id, label, client_discount_percent, commission_percent, sort_order)
VALUES
  ('bronze', 'Bronze', 10, 10, 1),
  ('silver', 'Silver', 13, 13, 2),
  ('gold', 'Gold', 16, 16, 3),
  ('platinum', 'Platinum', 20, 20, 4)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  client_discount_percent = EXCLUDED.client_discount_percent,
  commission_percent = EXCLUDED.commission_percent,
  sort_order = EXCLUDED.sort_order;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ambassador_tier text REFERENCES public.ambassador_tiers(id) DEFAULT 'bronze';

UPDATE public.profiles
SET ambassador_tier = 'bronze'
WHERE ambassador_tier IS NULL;

ALTER TABLE public.ambassador_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read ambassador tiers" ON public.ambassador_tiers;
CREATE POLICY "Anyone can read ambassador tiers"
  ON public.ambassador_tiers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage ambassador tiers" ON public.ambassador_tiers;
CREATE POLICY "Admins manage ambassador tiers"
  ON public.ambassador_tiers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Effective discount for a promo (ambassador tier overrides stored discount_value)
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
  v_tier_id text;
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
    SELECT COALESCE(p.ambassador_tier, 'bronze'), t.label, t.client_discount_percent
    INTO v_tier_id, v_tier_label, v_percent
    FROM public.profiles p
    JOIN public.ambassador_tiers t ON t.id = COALESCE(p.ambassador_tier, 'bronze')
    WHERE p.id = v_promo.ambassador_id;

    IF v_percent IS NULL THEN
      v_percent := 10;
      v_tier_id := 'bronze';
      v_tier_label := 'Bronze';
    END IF;

    v_amount := floor(p_subtotal * v_percent / 100);
    RETURN QUERY SELECT v_amount, v_percent, 'percent'::text, v_tier_id, v_tier_label;
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

-- Keep promo_codes.discount_value in sync when ambassador tier changes (display/admin)
CREATE OR REPLACE FUNCTION public.sync_ambassador_promo_discounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.ambassador_tier IS DISTINCT FROM OLD.ambassador_tier THEN
    UPDATE public.promo_codes pc
    SET
      discount_type = 'percent',
      discount_value = t.client_discount_percent
    FROM public.ambassador_tiers t
    WHERE pc.ambassador_id = NEW.id
      AND t.id = COALESCE(NEW.ambassador_tier, 'bronze');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_ambassador_promo_discounts ON public.profiles;
CREATE TRIGGER trg_sync_ambassador_promo_discounts
  AFTER UPDATE OF ambassador_tier ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ambassador_promo_discounts();

-- Backfill ambassador promo codes with current tier discount
UPDATE public.promo_codes pc
SET
  discount_type = 'percent',
  discount_value = t.client_discount_percent
FROM public.profiles p
JOIN public.ambassador_tiers t ON t.id = COALESCE(p.ambassador_tier, 'bronze')
WHERE pc.ambassador_id = p.id
  AND pc.ambassador_id IS NOT NULL;

-- Recompute promo discount server-side at checkout (do not trust client amount)
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  _customer_id uuid,
  _customer_name text,
  _customer_phone text,
  _delivery_address text,
  _delivery_date text,
  _delivery_fee numeric,
  _notes text,
  _promo_code_id bigint,
  _promo_discount numeric,
  _total_amount numeric,
  _source_link_id bigint,
  _items jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id bigint;
  v_item jsonb;
  v_product_id bigint;
  v_quantity integer;
  v_unit_price numeric;
  v_size text;
  v_color text;
  v_variant_stock integer;
  v_product_stock integer;
  v_ambassador_id uuid;
  v_items_total numeric := 0;
  v_merchandise_total numeric;
  v_promo_discount numeric := 0;
  v_resolved record;
BEGIN
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'La commande doit contenir au moins un article';
  END IF;

  IF _source_link_id IS NOT NULL THEN
    SELECT ambassador_id::uuid
    INTO v_ambassador_id
    FROM public.ambassador_links
    WHERE id = _source_link_id
      AND active = true;
  END IF;

  IF v_ambassador_id IS NULL AND _promo_code_id IS NOT NULL THEN
    SELECT ambassador_id::uuid
    INTO v_ambassador_id
    FROM public.promo_codes
    WHERE id = _promo_code_id
      AND ambassador_id IS NOT NULL;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::bigint;
    v_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::integer, 0);
    v_unit_price := COALESCE(NULLIF(v_item->>'unit_price', '')::numeric, 0);

    IF v_product_id IS NULL OR v_quantity <= 0 OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'Article invalide dans la commande';
    END IF;

    v_items_total := v_items_total + (v_unit_price * v_quantity);
  END LOOP;

  IF _promo_code_id IS NOT NULL THEN
    SELECT * INTO v_resolved
    FROM public.resolve_promo_discount(_promo_code_id, v_items_total);

    IF v_resolved IS NULL OR COALESCE(v_resolved.discount_amount, 0) <= 0 THEN
      RAISE EXCEPTION 'Code promo invalide ou expiré';
    END IF;

    v_promo_discount := v_resolved.discount_amount;
  END IF;

  v_merchandise_total := GREATEST(0, v_items_total - COALESCE(v_promo_discount, 0));

  IF v_merchandise_total <= 0 THEN
    RAISE EXCEPTION 'Montant articles invalide';
  END IF;

  INSERT INTO public.orders (
    customer_id,
    customer_name,
    customer_phone,
    delivery_address,
    delivery_date,
    delivery_fee,
    notes,
    promo_code_id,
    promo_discount,
    total_amount,
    status,
    source_link_id,
    ambassador_id
  )
  VALUES (
    _customer_id,
    NULLIF(_customer_name, ''),
    NULLIF(_customer_phone, ''),
    NULLIF(_delivery_address, ''),
    NULLIF(_delivery_date, ''),
    COALESCE(_delivery_fee, 0),
    NULLIF(_notes, ''),
    _promo_code_id,
    COALESCE(v_promo_discount, 0),
    v_merchandise_total,
    'nouvelle',
    _source_link_id,
    v_ambassador_id
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::bigint;
    v_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::integer, 0);
    v_unit_price := COALESCE(NULLIF(v_item->>'unit_price', '')::numeric, 0);
    v_size := NULLIF(v_item->>'size', '');
    v_color := NULLIF(v_item->>'color', '');

    IF v_size IS NOT NULL AND v_color IS NOT NULL THEN
      SELECT stock INTO v_variant_stock
      FROM public.product_variants
      WHERE product_id = v_product_id
        AND size = v_size
        AND color = v_color
      FOR UPDATE;

      IF v_variant_stock IS NULL THEN
        RAISE EXCEPTION 'Variante introuvable pour le produit % (% / %)', v_product_id, v_color, v_size;
      END IF;

      IF v_variant_stock < v_quantity THEN
        RAISE EXCEPTION 'Stock insuffisant pour le produit % (% / %)', v_product_id, v_color, v_size;
      END IF;
    ELSE
      SELECT COALESCE(stock, 0) INTO v_product_stock
      FROM public.products
      WHERE id = v_product_id
      FOR UPDATE;

      IF v_product_stock < v_quantity THEN
        RAISE EXCEPTION 'Stock insuffisant pour le produit %', v_product_id;
      END IF;
    END IF;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      size,
      color,
      quantity,
      unit_price
    )
    VALUES (
      v_order_id,
      v_product_id,
      COALESCE(NULLIF(v_item->>'product_name', ''), 'Produit'),
      v_size,
      v_color,
      v_quantity,
      v_unit_price
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;
