-- Phase 2: finance + operations + POS/manual order foundations.

-- Product cost basis
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit_cost numeric NOT NULL DEFAULT 0;

-- Persist cost snapshot per sold line
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_cost numeric NOT NULL DEFAULT 0;

-- Track source and courier assignment
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_source text NOT NULL DEFAULT 'website'
    CHECK (order_source IN ('website', 'pos', 'manual'));

CREATE TABLE IF NOT EXISTS public.couriers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name text NOT NULL,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_id bigint REFERENCES public.couriers(id) ON DELETE SET NULL;

-- Business expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  amount numeric NOT NULL CHECK (amount >= 0),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_expense_date_idx ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS orders_order_source_idx ON public.orders(order_source);
CREATE INDEX IF NOT EXISTS orders_courier_id_idx ON public.orders(courier_id);

ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage couriers" ON public.couriers;
CREATE POLICY "Admins manage couriers"
  ON public.couriers
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage expenses" ON public.expenses;
CREATE POLICY "Admins manage expenses"
  ON public.expenses
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Backfill unit cost snapshot from current product unit cost where missing
UPDATE public.order_items oi
SET unit_cost = COALESCE(p.unit_cost, 0)
FROM public.products p
WHERE oi.product_id = p.id
  AND COALESCE(oi.unit_cost, 0) = 0;

-- Admin RPC to create POS/manual orders from dashboard
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
    v_total_items + COALESCE(_delivery_fee, 0),
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
    FROM public.products
    WHERE id = v_product_id;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      unit_cost
    )
    VALUES (
      v_order_id,
      v_product_id,
      COALESCE(v_product_name, 'Produit'),
      v_quantity,
      v_unit_price,
      COALESCE(v_unit_cost, 0)
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_manual_order_admin(
  text, text, text, numeric, jsonb, text, text, text
) TO authenticated;
