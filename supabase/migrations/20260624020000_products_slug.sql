-- Slug URL pour les pages produit (/produit/mon-hoodie-vsm)
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
