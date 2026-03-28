
-- Create order_items table
CREATE TABLE public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint references public.orders(id) on delete cascade not null,
  product_id bigint references public.products(id) on delete set null,
  product_name text not null,
  size text,
  color text,
  quantity integer not null default 1,
  unit_price numeric not null,
  created_at timestamptz default now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_order_items" ON public.order_items
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "customer_read_own_order_items" ON public.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.customer_id = auth.uid())
  );

CREATE POLICY "insert_order_items" ON public.order_items
  FOR INSERT WITH CHECK (true);

-- Add columns to orders for delivery info
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_date text,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric default 0,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS promo_discount numeric default 0;

-- Allow authenticated users to insert orders
CREATE POLICY "insert_orders_authenticated" ON public.orders
  FOR INSERT WITH CHECK (true);

-- Function to decrement stock when order is placed
CREATE OR REPLACE FUNCTION public.decrement_stock_on_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Decrement variant stock
  IF NEW.size IS NOT NULL AND NEW.color IS NOT NULL THEN
    UPDATE public.product_variants
    SET stock = GREATEST(stock - NEW.quantity, 0)
    WHERE product_id = NEW.product_id AND size = NEW.size AND color = NEW.color;
  END IF;

  -- Decrement total product stock
  UPDATE public.products
  SET stock = GREATEST(COALESCE(stock, 0) - NEW.quantity, 0)
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_decrement_stock
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_stock_on_order_item();

-- Increment promo code usage
CREATE OR REPLACE FUNCTION public.increment_promo_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.promo_code_id IS NOT NULL THEN
    UPDATE public.promo_codes
    SET usage_count = usage_count + 1
    WHERE id = NEW.promo_code_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_increment_promo_usage
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_promo_usage();
