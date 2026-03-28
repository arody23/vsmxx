-- 1) Attribute ambassador from promo code when no tracking link (or link has no ambassador)
-- 2) Backfill historical orders
-- 3) Withdrawal requests + RPC + RLS
-- 4) Ambassadors can SELECT their attributed orders

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
BEGIN
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'La commande doit contenir au moins un article';
  END IF;

  IF COALESCE(_total_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Montant total invalide';
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
    COALESCE(_promo_discount, 0),
    _total_amount,
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

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Produit invalide dans la commande';
    END IF;

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantité invalide pour le produit %', v_product_id;
    END IF;

    IF v_unit_price < 0 THEN
      RAISE EXCEPTION 'Prix unitaire invalide pour le produit %', v_product_id;
    END IF;

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

-- Backfill: orders that used an ambassador promo but had no ambassador_id
UPDATE public.orders o
SET ambassador_id = p.ambassador_id
FROM public.promo_codes p
WHERE o.promo_code_id = p.id
  AND p.ambassador_id IS NOT NULL
  AND o.ambassador_id IS NULL;

CREATE TABLE IF NOT EXISTS public.ambassador_withdrawal_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ambassador_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  mobile_operator text NOT NULL
    CHECK (mobile_operator IN ('airtel', 'mpesa', 'orange')),
  msisdn text NOT NULL,
  beneficiary_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  admin_note text
);

CREATE INDEX IF NOT EXISTS ambassador_withdrawal_requests_ambassador_id_idx
  ON public.ambassador_withdrawal_requests (ambassador_id);

CREATE INDEX IF NOT EXISTS ambassador_withdrawal_requests_status_idx
  ON public.ambassador_withdrawal_requests (status);

ALTER TABLE public.ambassador_withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ambassador_confirmed_sales_count(_uid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM public.orders o
  WHERE o.status IN ('traitée', 'expédiée')
    AND (
      o.ambassador_id = _uid
      OR EXISTS (
        SELECT 1
        FROM public.promo_codes p
        WHERE p.id = o.promo_code_id
          AND p.ambassador_id = _uid
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.request_ambassador_withdrawal(
  p_mobile_operator text,
  p_msisdn text,
  p_beneficiary_name text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
  v_pending integer;
  v_new_id bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF NOT public.has_role(v_uid, 'ambassador') THEN
    RAISE EXCEPTION 'Réservé aux ambassadeurs';
  END IF;

  IF p_mobile_operator IS NULL OR lower(trim(p_mobile_operator)) NOT IN ('airtel', 'mpesa', 'orange') THEN
    RAISE EXCEPTION 'Opérateur invalide (airtel, mpesa, orange)';
  END IF;

  IF trim(coalesce(p_msisdn, '')) = '' OR trim(coalesce(p_beneficiary_name, '')) = '' THEN
    RAISE EXCEPTION 'Numéro et nom du bénéficiaire sont obligatoires';
  END IF;

  v_count := public.ambassador_confirmed_sales_count(v_uid);
  IF v_count < 10 THEN
    RAISE EXCEPTION 'Il faut au moins 10 commandes confirmées (actuellement %)', v_count;
  END IF;

  SELECT COUNT(*)::integer INTO v_pending
  FROM public.ambassador_withdrawal_requests
  WHERE ambassador_id = v_uid
    AND status = 'pending';

  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Vous avez déjà une demande de retrait en attente';
  END IF;

  INSERT INTO public.ambassador_withdrawal_requests (
    ambassador_id,
    mobile_operator,
    msisdn,
    beneficiary_name
  )
  VALUES (
    v_uid,
    lower(trim(p_mobile_operator)),
    trim(p_msisdn),
    trim(p_beneficiary_name)
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_ambassador_withdrawal(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambassador_confirmed_sales_count(uuid) TO authenticated;

DROP POLICY IF EXISTS "Ambassadors view own withdrawal requests" ON public.ambassador_withdrawal_requests;
CREATE POLICY "Ambassadors view own withdrawal requests"
  ON public.ambassador_withdrawal_requests
  FOR SELECT
  TO authenticated
  USING (ambassador_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage withdrawal requests" ON public.ambassador_withdrawal_requests;
CREATE POLICY "Admins manage withdrawal requests"
  ON public.ambassador_withdrawal_requests
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Ambassadors view attributed orders" ON public.orders;
CREATE POLICY "Ambassadors view attributed orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    ambassador_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.promo_codes pc
      WHERE pc.id = orders.promo_code_id
        AND pc.ambassador_id = auth.uid()
    )
  );
