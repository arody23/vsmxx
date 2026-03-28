
-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);

-- Allow authenticated users (admins) to upload images
CREATE POLICY "Admin can upload images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'images' AND public.has_role(auth.uid(), 'admin')
);

-- Allow public read access to images
CREATE POLICY "Public can view images" ON storage.objects
FOR SELECT
USING (bucket_id = 'images');

-- Allow admin to delete images
CREATE POLICY "Admin can delete images" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'images' AND public.has_role(auth.uid(), 'admin')
);

-- Allow admin to update images
CREATE POLICY "Admin can update images" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'images' AND public.has_role(auth.uid(), 'admin')
);

-- Create triggers for auth (they were missing from db-triggers)
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_insert();

CREATE OR REPLACE TRIGGER on_auth_user_role_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();
