-- Admins can remove public product reviews

DROP POLICY IF EXISTS "Admins can delete product reviews" ON public.product_reviews;
CREATE POLICY "Admins can delete product reviews"
  ON public.product_reviews
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';
