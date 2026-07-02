-- POS: stock check, promo/remise, recent orders, staff listing for admin

CREATE OR REPLACE FUNCTION public.admin_list_staff_members()
RETURNS TABLE (
  id bigint,
  badge text,
  full_name text,
  role text,
  courier_id bigint,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acces reserve aux administrateurs';
  END IF;

  RETURN QUERY
  SELECT sm.id, sm.badge, sm.full_name, sm.role, sm.courier_id, sm.is_active, sm.created_at
  FROM public.staff_members sm
  ORDER BY sm.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_staff_members() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_staff_member(
  p_badge text,
  p_password text,
  p_full_name text,
  p_role text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_id bigint;
  v_courier_id bigint;
  v_badge text := upper(trim(p_badge));
  v_role text := lower(trim(p_role));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acces reserve aux administrateurs';
  END IF;

  IF v_badge IS NULL OR length(v_badge) < 3 THEN
    RAISE EXCEPTION 'Badge invalide (minimum 3 caracteres)';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Mot de passe minimum 6 caracteres';
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) < 2 THEN
    RAISE EXCEPTION 'Nom requis';
  END IF;

  IF v_role NOT IN ('pos', 'courier') THEN
    RAISE EXCEPTION 'Role invalide (pos ou courier)';
  END IF;

  IF EXISTS (SELECT 1 FROM public.staff_members WHERE badge = v_badge) THEN
    RAISE EXCEPTION 'Ce badge existe deja';
  END IF;

  v_courier_id := NULL;
  IF v_role = 'courier' THEN
    INSERT INTO public.couriers (full_name, phone, notes, is_active)
    VALUES (trim(p_full_name), NULL, 'Compte livreur ' || v_badge, true)
    RETURNING id INTO v_courier_id;
  END IF;

  INSERT INTO public.staff_members (badge, full_name, role, password_hash, courier_id)
  VALUES (
    v_badge,
    trim(p_full_name),
    v_role,
    crypt(p_password, gen_salt('bf')),
    v_courier_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pos_recent_orders(p_limit integer DEFAULT 15)
RETURNS TABLE (
  id bigint,
  customer_name text,
  total_amount numeric,
  promo_discount numeric,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT o.id, o.customer_name, o.total_amount, COALESCE(o.promo_discount, 0), o.status, o.created_at
  FROM public.orders o
  WHERE o.order_source = 'pos'
  ORDER BY o.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 15), 50));
$$;

GRANT EXECUTE ON FUNCTION public.pos_recent_orders(integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pos_stock_overview(p_limit integer DEFAULT 50)
RETURNS TABLE (
  variant_id bigint,
  product_id bigint,
  product_name text,
  color text,
  size text,
  stock integer,
  barcode text,
  unit_price numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT
    pv.id,
    pv.product_id,
    p.name,
    pv.color,
    pv.size,
    pv.stock,
    pv.barcode,
    COALESCE(p.price, 0)
  FROM public.product_variants pv
  JOIN public.products p ON p.id = pv.product_id
  WHERE p.is_active = true
  ORDER BY pv.stock ASC, p.name ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;

GRANT EXECUTE ON FUNCTION public.pos_stock_overview(integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_pos_order(
  p_staff_badge text,
  p_customer_name text,
  p_items jsonb,
  p_notes text DEFAULT NULL,
  p_promo_code_id bigint DEFAULT NULL,
  p_promo_discount numeric DEFAULT 0,
  p_manual_discount numeric DEFAULT 0
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_order_id bigint;
  v_item jsonb;
  v_product_id bigint;
  v_quantity integer;
  v_unit_price numeric;
  v_unit_cost numeric;
  v_product_name text;
  v_size text;
  v_color text;
  v_items_subtotal numeric := 0;
  v_promo_discount numeric := 0;
  v_manual_discount numeric := 0;
  v_total numeric;
  v_variant_stock integer;
  v_product_stock integer;
  v_resolved record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE badge = upper(trim(p_staff_badge))
      AND role = 'pos'
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Compte POS invalide';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Au moins un article est requis';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::bigint;
    v_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::integer, 0);
    v_unit_price := COALESCE(NULLIF(v_item->>'unit_price', '')::numeric, 0);
    IF v_product_id IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Article invalide';
    END IF;
    v_items_subtotal := v_items_subtotal + (v_unit_price * v_quantity);
  END LOOP;

  IF p_promo_code_id IS NOT NULL THEN
    SELECT * INTO v_resolved
    FROM public.resolve_promo_discount(p_promo_code_id, v_items_subtotal);
    IF v_resolved IS NULL OR COALESCE(v_resolved.discount_amount, 0) <= 0 THEN
      RAISE EXCEPTION 'Code promo invalide';
    END IF;
    v_promo_discount := v_resolved.discount_amount;
  END IF;

  v_manual_discount := GREATEST(0, COALESCE(p_manual_discount, 0));
  v_total := GREATEST(0, v_items_subtotal - v_promo_discount - v_manual_discount);

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Montant total invalide';
  END IF;

  INSERT INTO public.orders (
    customer_name,
    delivery_fee,
    notes,
    promo_code_id,
    promo_discount,
    total_amount,
    status,
    order_source
  )
  VALUES (
    COALESCE(NULLIF(trim(p_customer_name), ''), 'Client POS'),
    0,
    NULLIF(p_notes, ''),
    p_promo_code_id,
    v_promo_discount + v_manual_discount,
    v_total,
    'traitée',
    'pos'
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::bigint;
    v_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::integer, 0);
    v_unit_price := COALESCE(NULLIF(v_item->>'unit_price', '')::numeric, 0);
    v_size := NULLIF(v_item->>'size', '');
    v_color := NULLIF(v_item->>'color', '');

    IF v_size IS NOT NULL AND v_color IS NOT NULL THEN
      SELECT stock INTO v_variant_stock
      FROM public.product_variants
      WHERE product_id = v_product_id AND size = v_size AND color = v_color
      FOR UPDATE;

      IF v_variant_stock IS NULL THEN
        RAISE EXCEPTION 'Variante introuvable (% / %)', v_color, v_size;
      END IF;
      IF v_variant_stock < v_quantity THEN
        RAISE EXCEPTION 'Stock insuffisant (% / %)', v_color, v_size;
      END IF;
    ELSE
      SELECT COALESCE(stock, 0) INTO v_product_stock
      FROM public.products WHERE id = v_product_id FOR UPDATE;
      IF v_product_stock < v_quantity THEN
        RAISE EXCEPTION 'Stock insuffisant produit %', v_product_id;
      END IF;
    END IF;

    SELECT name, COALESCE(unit_cost, 0)
    INTO v_product_name, v_unit_cost
    FROM public.products WHERE id = v_product_id;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, size, color, quantity, unit_price, unit_cost
    )
    VALUES (
      v_order_id, v_product_id, COALESCE(v_product_name, 'Produit'),
      v_size, v_color, v_quantity, v_unit_price, COALESCE(v_unit_cost, 0)
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_pos_order(text, text, jsonb, text, bigint, numeric, numeric) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
