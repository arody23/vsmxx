-- Ensure ambassador applications can be created publicly while
-- still allowing optional linkage to an authenticated user account.

ALTER TABLE public.ambassador_applications
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.ambassador_applications ENABLE ROW LEVEL SECURITY;

-- Recreate insert policy explicitly for both anon and authenticated users.
DROP POLICY IF EXISTS "Anyone can submit ambassador application" ON public.ambassador_applications;

CREATE POLICY "Anyone can submit ambassador application"
  ON public.ambassador_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NULL
    OR user_id = auth.uid()
  );


