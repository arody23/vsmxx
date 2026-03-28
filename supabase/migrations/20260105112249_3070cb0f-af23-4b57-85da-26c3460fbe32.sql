-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'client', 'ambassador');

-- Create ambassador_status enum
CREATE TYPE public.ambassador_status AS ENUM ('pending', 'approved', 'rejected');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create collections table
CREATE TABLE public.collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  original_price INTEGER,
  category TEXT NOT NULL,
  badge TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sizes TEXT[] DEFAULT ARRAY['S', 'M', 'L', 'XL', 'XXL'],
  colors TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product_images table
CREATE TABLE public.product_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ambassador_applications table
CREATE TABLE public.ambassador_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  instagram_handle TEXT,
  tiktok_handle TEXT,
  facebook_handle TEXT,
  followers_count INTEGER,
  motivation TEXT NOT NULL,
  status ambassador_status NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create promo_codes table
CREATE TABLE public.promo_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER,
  discount_fixed INTEGER,
  ambassador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  max_usage INTEGER,
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tracking_links table
CREATE TABLE public.tracking_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ambassador_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL UNIQUE,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  province TEXT NOT NULL,
  city TEXT,
  commune TEXT,
  delivery_date DATE,
  delivery_instructions TEXT,
  subtotal INTEGER NOT NULL,
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  promo_code_id UUID REFERENCES public.promo_codes(id),
  tracking_link_id UUID REFERENCES public.tracking_links(id),
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  size TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create delivery_fees table
CREATE TABLE public.delivery_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commune TEXT NOT NULL UNIQUE,
  zone TEXT NOT NULL,
  fee INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_fees ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
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

-- Create function to handle new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_delivery_fees_updated_at
  BEFORE UPDATE ON public.delivery_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Profiles: Users can view and edit their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- User roles: Only admins can view all roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Collections: Public read, admin write
CREATE POLICY "Collections are viewable by everyone"
  ON public.collections FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage collections"
  ON public.collections FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Products: Public read, admin write
CREATE POLICY "Products are viewable by everyone"
  ON public.products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage products"
  ON public.products FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Product images: Public read, admin write
CREATE POLICY "Product images are viewable by everyone"
  ON public.product_images FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage product images"
  ON public.product_images FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Ambassador applications: Public insert, admin view all
CREATE POLICY "Anyone can submit ambassador application"
  ON public.ambassador_applications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own application"
  ON public.ambassador_applications FOR SELECT
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage applications"
  ON public.ambassador_applications FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Promo codes: Public read active codes, admin manage
CREATE POLICY "Active promo codes are viewable"
  ON public.promo_codes FOR SELECT
  USING (is_active = true);

CREATE POLICY "Ambassadors can view own promo codes"
  ON public.promo_codes FOR SELECT
  USING (ambassador_id = auth.uid());

CREATE POLICY "Admins can manage promo codes"
  ON public.promo_codes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Tracking links: Ambassadors view own, admin view all
CREATE POLICY "Ambassadors can view own tracking links"
  ON public.tracking_links FOR SELECT
  USING (ambassador_id = auth.uid());

CREATE POLICY "Ambassadors can create own tracking links"
  ON public.tracking_links FOR INSERT
  WITH CHECK (ambassador_id = auth.uid());

CREATE POLICY "Admins can manage tracking links"
  ON public.tracking_links FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Orders: Users view own, admin view all
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage orders"
  ON public.orders FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Order items: Same as orders
CREATE POLICY "Users can view own order items"
  ON public.order_items FOR SELECT
  USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage order items"
  ON public.order_items FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Delivery fees: Public read, admin write
CREATE POLICY "Delivery fees are viewable by everyone"
  ON public.delivery_fees FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage delivery fees"
  ON public.delivery_fees FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert default delivery fees for Kinshasa communes
INSERT INTO public.delivery_fees (commune, zone, fee) VALUES
  ('Ngiri-Ngiri', 'proche', 8000),
  ('Kalamu', 'proche', 8000),
  ('Kasa-Vubu', 'proche', 8000),
  ('Bumbu', 'proche', 8500),
  ('Makala', 'proche', 9000),
  ('Selembao', 'moyenne', 10000),
  ('Bandalungwa', 'moyenne', 10000),
  ('Lingwala', 'moyenne', 10500),
  ('Kinshasa', 'moyenne', 10500),
  ('Barumbu', 'moyenne', 11000),
  ('Gombe', 'moyenne', 11000),
  ('Kintambo', 'moyenne', 11500),
  ('Lemba', 'moyenne', 12000),
  ('Limete', 'moyenne', 12000),
  ('Ngaba', 'moyenne', 12000),
  ('Matete', 'moyenne', 12500),
  ('Ngaliema', 'eloignee', 13000),
  ('Mont-Ngafula', 'eloignee', 14000),
  ('Kisenso', 'eloignee', 14000),
  ('N''djili', 'eloignee', 14500),
  ('Masina', 'eloignee', 14500),
  ('Kimbanseke', 'eloignee', 15000),
  ('N''sele', 'eloignee', 15000),
  ('Maluku', 'eloignee', 15000);