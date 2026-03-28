
CREATE TABLE public.product_variants (
  id bigint generated always as identity primary key,
  product_id bigint references public.products(id) on delete cascade not null,
  color text not null,
  size text not null,
  stock integer not null default 0,
  created_at timestamptz default now(),
  unique(product_id, color, size)
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_variants" ON public.product_variants
  FOR SELECT USING (true);

CREATE POLICY "admin_all_variants" ON public.product_variants
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
