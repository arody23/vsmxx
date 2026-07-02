-- Fix staff password hashing: pgcrypto lives in extensions schema on Supabase

CREATE OR REPLACE FUNCTION public.admin_create_staff_member(
  p_badge text,
  p_password text,
  p_full_name text,
  p_role text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_id bigint;
  v_courier_id bigint;
  v_badge text := upper(trim(p_badge));
  v_role text := lower(trim(p_role));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acces reserve aux administrateurs';
  END IF;

  IF v_badge IS NULL OR length(v_badge) < 3 THEN
    RAISE EXCEPTION 'Badge invalide (minimum 3 caracteres)';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Mot de passe minimum 6 caracteres';
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) < 2 THEN
    RAISE EXCEPTION 'Nom requis';
  END IF;

  IF v_role NOT IN ('pos', 'courier') THEN
    RAISE EXCEPTION 'Role invalide (pos ou courier)';
  END IF;

  IF EXISTS (SELECT 1 FROM public.staff_members WHERE badge = v_badge) THEN
    RAISE EXCEPTION 'Ce badge existe deja';
  END IF;

  v_courier_id := NULL;
  IF v_role = 'courier' THEN
    INSERT INTO public.couriers (full_name, phone, notes, is_active)
    VALUES (trim(p_full_name), NULL, 'Compte livreur ' || v_badge, true)
    RETURNING id INTO v_courier_id;
  END IF;

  INSERT INTO public.staff_members (badge, full_name, role, password_hash, courier_id)
  VALUES (
    v_badge,
    trim(p_full_name),
    v_role,
    crypt(p_password, gen_salt('bf')),
    v_courier_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_authenticate(
  p_badge text,
  p_password text
)
RETURNS TABLE (
  id bigint,
  badge text,
  full_name text,
  role text,
  courier_id bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT sm.id, sm.badge, sm.full_name, sm.role, sm.courier_id
  FROM public.staff_members sm
  WHERE sm.badge = upper(trim(p_badge))
    AND sm.is_active = true
    AND sm.password_hash = crypt(p_password, sm.password_hash);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_staff_member(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_authenticate(text, text) TO anon, authenticated;
