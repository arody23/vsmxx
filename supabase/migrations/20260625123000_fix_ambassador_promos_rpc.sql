-- Fix ambassador dashboard promo retrieval with a resilient RPC.

CREATE OR REPLACE FUNCTION public.ambassador_dashboard_promo_codes()
RETURNS SETOF public.promo_codes
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pc.*
  FROM public.promo_codes pc
  WHERE auth.uid() IS NOT NULL
    AND (
      pc.ambassador_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.ambassador_links al
        WHERE al.ambassador_id = auth.uid()
          AND al.promo_code_id = pc.id
      )
    )
  ORDER BY pc.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.ambassador_dashboard_promo_codes() TO authenticated;
