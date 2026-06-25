-- Fix orders visibility for admin/ambassador dashboards and reinforce promo attribution.

-- Ensure order creation attributes ambassador from active source link OR promo code owner.
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

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  text,
  bigint,
  numeric,
  numeric,
  bigint,
  jsonb
) TO anon, authenticated;

-- Ensure historical promo orders are linked to the right ambassador.
UPDATE public.orders o
SET ambassador_id = p.ambassador_id
FROM public.promo_codes p
WHERE o.promo_code_id = p.id
  AND p.ambassador_id IS NOT NULL
  AND o.ambassador_id IS NULL;

-- Harden RLS for orders/order_items visibility.
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
CREATE POLICY "Admins can manage orders"
  ON public.orders
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

DROP POLICY IF EXISTS "admin_all_order_items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can manage order items" ON public.order_items;
CREATE POLICY "Admins can manage order items"
  ON public.order_items
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Safe RPCs for dashboards (resilient even when table policies drift).
CREATE OR REPLACE FUNCTION public.admin_dashboard_orders()
RETURNS SETOF public.orders
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.*
  FROM public.orders o
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY o.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_order_items()
RETURNS SETOF public.order_items
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT oi.*
  FROM public.order_items oi
  WHERE public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.ambassador_dashboard_orders()
RETURNS SETOF public.orders
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.*
  FROM public.orders o
  WHERE auth.uid() IS NOT NULL
    AND (
      o.ambassador_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.promo_codes pc
        WHERE pc.id = o.promo_code_id
          AND pc.ambassador_id = auth.uid()
      )
    )
  ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_order_items() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambassador_dashboard_orders() TO authenticated;
