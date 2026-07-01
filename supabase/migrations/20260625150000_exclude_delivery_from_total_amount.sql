-- total_amount = marchandises uniquement (hors frais de livraison)
-- delivery_fee reste séparé ; total client = total_amount + delivery_fee

UPDATE public.orders
SET total_amount = GREATEST(0, total_amount - COALESCE(delivery_fee, 0))
WHERE COALESCE(delivery_fee, 0) > 0
  AND total_amount >= COALESCE(delivery_fee, 0);

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

  v_merchandise_total := GREATEST(0, v_items_total - COALESCE(_promo_discount, 0));

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
    COALESCE(_promo_discount, 0),
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

CREATE OR REPLACE FUNCTION public.create_manual_order_admin(
  _customer_name text,
  _customer_phone text,
  _delivery_address text,
  _delivery_fee numeric,
  _items jsonb,
  _order_source text DEFAULT 'manual',
  _notes text DEFAULT NULL,
  _status text DEFAULT 'traitée'
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
  v_product_name text;
  v_quantity integer;
  v_unit_price numeric;
  v_unit_cost numeric;
  v_total_items numeric := 0;
  v_source text := lower(coalesce(_order_source, 'manual'));
  v_status text := coalesce(_status, 'traitée');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acces reserve aux administrateurs';
  END IF;

  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Au moins un article est requis';
  END IF;

  IF v_source NOT IN ('website', 'pos', 'manual') THEN
    RAISE EXCEPTION 'Source invalide';
  END IF;

  IF v_status NOT IN ('nouvelle', 'traitée', 'expédiée', 'annulée') THEN
    RAISE EXCEPTION 'Statut invalide';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::bigint;
    v_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::integer, 0);
    v_unit_price := COALESCE(NULLIF(v_item->>'unit_price', '')::numeric, 0);

    IF v_product_id IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Article invalide';
    END IF;

    v_total_items := v_total_items + (v_unit_price * v_quantity);
  END LOOP;

  INSERT INTO public.orders (
    customer_id,
    customer_name,
    customer_phone,
    delivery_address,
    delivery_fee,
    notes,
    promo_discount,
    total_amount,
    status,
    order_source
  )
  VALUES (
    NULL,
    NULLIF(_customer_name, ''),
    NULLIF(_customer_phone, ''),
    NULLIF(_delivery_address, ''),
    COALESCE(_delivery_fee, 0),
    NULLIF(_notes, ''),
    0,
    v_total_items,
    v_status,
    v_source
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::bigint;
    v_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::integer, 0);
    v_unit_price := COALESCE(NULLIF(v_item->>'unit_price', '')::numeric, 0);

    SELECT name, COALESCE(unit_cost, 0)
    INTO v_product_name, v_unit_cost
    FROM public.products WHERE id = v_product_id;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, size, color, quantity, unit_price, unit_cost
    )
    VALUES (
      v_order_id,
      v_product_id,
      COALESCE(v_product_name, 'Produit'),
      NULLIF(v_item->>'size', ''),
      NULLIF(v_item->>'color', ''),
      v_quantity,
      v_unit_price,
      COALESCE(v_unit_cost, 0)
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pos_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today_orders bigint;
  v_today_revenue numeric;
  v_stock_units bigint;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
  INTO v_today_orders, v_today_revenue
  FROM public.orders
  WHERE order_source = 'pos'
    AND status IN ('traitée', 'expédiée')
    AND created_at >= date_trunc('day', now());

  SELECT COALESCE(SUM(stock), 0)
  INTO v_stock_units
  FROM public.product_variants;

  RETURN json_build_object(
    'today_orders', v_today_orders,
    'today_revenue', v_today_revenue,
    'stock_units', v_stock_units
  );
END;
$$;
