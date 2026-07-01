-- Phase 3: staff POS/courier auth, variant barcodes, product reviews

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Staff accounts (badge + password login)
CREATE TABLE IF NOT EXISTS public.staff_members (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  badge text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('pos', 'courier')),
  password_hash text NOT NULL,
  courier_id bigint REFERENCES public.couriers(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_members_role_idx ON public.staff_members(role);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage staff members" ON public.staff_members;
CREATE POLICY "Admins manage staff members"
  ON public.staff_members
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Variant barcodes for POS scanning
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS barcode text;

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_barcode_uidx
  ON public.product_variants(barcode)
  WHERE barcode IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_variant_barcode_value(p_variant_id bigint)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'VSM' || lpad(p_variant_id::text, 10, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_variant_barcode_after()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.barcode IS NULL OR btrim(NEW.barcode) = '' THEN
    UPDATE public.product_variants
    SET barcode = public.generate_variant_barcode_value(NEW.id)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_variant_barcode_after ON public.product_variants;
CREATE TRIGGER trg_ensure_variant_barcode_after
  AFTER INSERT ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_variant_barcode_after();

UPDATE public.product_variants
SET barcode = public.generate_variant_barcode_value(id)
WHERE barcode IS NULL OR btrim(barcode) = '';

-- Product reviews (public submit)
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_reviews_product_id_idx ON public.product_reviews(product_id);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read product reviews" ON public.product_reviews;
CREATE POLICY "Anyone can read product reviews"
  ON public.product_reviews FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can submit product reviews" ON public.product_reviews;
CREATE POLICY "Anyone can submit product reviews"
  ON public.product_reviews FOR INSERT
  WITH CHECK (true);

-- Admin: create POS / courier staff account
CREATE OR REPLACE FUNCTION public.admin_create_staff_member(
  p_badge text,
  p_password text,
  p_full_name text,
  p_role text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    RAISE EXCEPTION 'Badge invalide (min 3 caracteres)';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Mot de passe min 6 caracteres';
  END IF;

  IF v_role NOT IN ('pos', 'courier') THEN
    RAISE EXCEPTION 'Role invalide (pos ou courier)';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.admin_create_staff_member(text, text, text, text) TO authenticated;

-- Staff login (badge + password)
CREATE OR REPLACE FUNCTION public.staff_authenticate(
  p_badge text,
  p_password text
)
RETURNS TABLE (
  id bigint,
  badge text,
  full_name text,
  role text,
  courier_id bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT sm.id, sm.badge, sm.full_name, sm.role, sm.courier_id
  FROM public.staff_members sm
  WHERE sm.badge = upper(trim(p_badge))
    AND sm.is_active = true
    AND sm.password_hash = crypt(p_password, sm.password_hash);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_authenticate(text, text) TO anon, authenticated;

-- Lookup variant by barcode (POS + admin scan)
CREATE OR REPLACE FUNCTION public.lookup_variant_by_barcode(p_barcode text)
RETURNS TABLE (
  variant_id bigint,
  product_id bigint,
  product_name text,
  color text,
  size text,
  stock integer,
  unit_price numeric,
  unit_cost numeric,
  barcode text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    pv.id AS variant_id,
    pv.product_id,
    p.name AS product_name,
    pv.color,
    pv.size,
    pv.stock,
    COALESCE(p.price, 0) AS unit_price,
    COALESCE(p.unit_cost, 0) AS unit_cost,
    pv.barcode
  FROM public.product_variants pv
  JOIN public.products p ON p.id = pv.product_id
  WHERE upper(trim(pv.barcode)) = upper(trim(p_barcode))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_variant_by_barcode(text) TO anon, authenticated;

-- POS staff dashboard data
CREATE OR REPLACE FUNCTION public.pos_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_pos_orders integer;
  v_pos_revenue numeric;
  v_stock_units bigint;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(total_amount - COALESCE(delivery_fee, 0)), 0)
  INTO v_pos_orders, v_pos_revenue
  FROM public.orders
  WHERE order_source = 'pos'
    AND status IN ('traitée', 'expédiée')
    AND created_at::date = v_today;

  SELECT COALESCE(SUM(stock), 0) INTO v_stock_units FROM public.product_variants;

  RETURN jsonb_build_object(
    'today_orders', v_pos_orders,
    'today_revenue', v_pos_revenue,
    'stock_units', v_stock_units
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_dashboard_stats() TO anon, authenticated;

-- Courier assigned + history orders
CREATE OR REPLACE FUNCTION public.courier_dashboard_orders(p_courier_id bigint)
RETURNS SETOF public.orders
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.*
  FROM public.orders o
  WHERE o.courier_id = p_courier_id
  ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.courier_dashboard_orders(bigint) TO anon, authenticated;

-- POS order creation (staff badge validated)
CREATE OR REPLACE FUNCTION public.create_pos_order(
  p_staff_badge text,
  p_customer_name text,
  p_items jsonb,
  p_notes text DEFAULT NULL
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
  v_unit_cost numeric;
  v_product_name text;
  v_size text;
  v_color text;
  v_total_items numeric := 0;
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
    v_total_items := v_total_items + (v_unit_price * v_quantity);
  END LOOP;

  INSERT INTO public.orders (
    customer_name, delivery_fee, notes, promo_discount, total_amount, status, order_source
  )
  VALUES (
    COALESCE(NULLIF(trim(p_customer_name), ''), 'Client POS'),
    0,
    NULLIF(p_notes, ''),
    0,
    v_total_items,
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

-- Courier mark order shipped
CREATE OR REPLACE FUNCTION public.courier_mark_order_shipped(
  p_staff_badge text,
  p_order_id bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_courier_id bigint;
BEGIN
  SELECT courier_id INTO v_courier_id
  FROM public.staff_members
  WHERE badge = upper(trim(p_staff_badge))
    AND role = 'courier'
    AND is_active = true;

  IF v_courier_id IS NULL THEN
    RAISE EXCEPTION 'Compte livreur invalide';
  END IF;

  UPDATE public.orders
  SET status = 'expédiée'
  WHERE id = p_order_id
    AND courier_id = v_courier_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.courier_mark_order_shipped(text, bigint) TO anon, authenticated;

