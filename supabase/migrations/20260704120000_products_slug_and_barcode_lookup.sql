-- Slug produits (manquant en prod) + recherche code-barres robuste

-- 1) Colonne slug
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.products
SET slug = trim(both '-' from lower(regexp_replace(regexp_replace(coalesce(name, ''), '[^a-zA-Z0-9]+', '-', 'g'), '-+', '-', 'g')))
WHERE slug IS NULL OR slug = '';

UPDATE public.products
SET slug = 'produit-' || id::text
WHERE slug IS NULL OR slug = '';

UPDATE public.products p
SET slug = p.slug || '-' || p.id::text
FROM (
  SELECT slug
  FROM public.products
  GROUP BY slug
  HAVING count(*) > 1
) d
WHERE p.slug = d.slug
  AND EXISTS (
    SELECT 1 FROM public.products p2
    WHERE p2.slug = p.slug AND p2.id < p.id
  );

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON public.products (slug);

-- 2) Normalisation code-barres
CREATE OR REPLACE FUNCTION public.normalize_barcode_value(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(regexp_replace(btrim(coalesce(p_value, '')), '[^A-Za-z0-9]', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.parse_vsm_variant_id(p_barcode text)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_norm text := public.normalize_barcode_value(p_barcode);
  v_digits text;
BEGIN
  IF v_norm IS NULL OR v_norm = '' THEN
    RETURN NULL;
  END IF;

  IF v_norm ~ '^[0-9]+$' THEN
    RETURN v_norm::bigint;
  END IF;

  IF v_norm ~ '^VSM[0-9]+$' THEN
    v_digits := regexp_replace(v_norm, '^VSM0*', '');
    IF v_digits <> '' THEN
      RETURN v_digits::bigint;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_norm text := public.normalize_barcode_value(p_barcode);
  v_variant_id bigint := public.parse_vsm_variant_id(p_barcode);
BEGIN
  IF v_norm IS NULL OR v_norm = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
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
  WHERE public.normalize_barcode_value(pv.barcode) = v_norm
     OR (v_variant_id IS NOT NULL AND pv.id = v_variant_id)
  ORDER BY
    CASE WHEN public.normalize_barcode_value(pv.barcode) = v_norm THEN 0 ELSE 1 END
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_variant_by_barcode(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
