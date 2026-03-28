
-- Fix security: Enable RLS on user_roles table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Fix recursive policy: "Admins can manage roles" references user_roles itself
-- Drop it and recreate using a security definer function
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Create a security definer function to check admin from user_roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Recreate admin policy using the function
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Also add triggers back since they were reported missing
CREATE OR REPLACE FUNCTION public.handle_auth_user_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, created_at, updated_at)
  SELECT NEW.id, NEW.email, 'client', now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  SELECT NEW.id, 'client'
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id);
  RETURN NEW;
END;
$$;

-- Recreate triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_insert();

DROP TRIGGER IF EXISTS on_auth_user_role_created ON auth.users;
CREATE TRIGGER on_auth_user_role_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();
