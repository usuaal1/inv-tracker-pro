-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  packages DECIMAL(10,2) DEFAULT 0,
  pieces_per_package INTEGER NOT NULL,
  total_pieces INTEGER DEFAULT 0,
  category TEXT DEFAULT 'finished_product',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create inventory movements table
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entry', 'exit')),
  quantity_packages DECIMAL(10,2),
  quantity_pieces INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create scrap records table
CREATE TABLE public.scrap_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  machine_name TEXT NOT NULL CHECK (machine_name IN (
    'ISBM 3', 'ISBM 4', 'ISBM 5', 'ISBM 6', 'ISBM 7', 'ISBM 8', 
    'ISBM 9', 'ISBM 10', 'ISBM 12', 'INY 1', 'INY 3', 'INY 4', 
    'INY 5', 'INY 6', 'INY 7', 'INY 8', 'INY 11'
  )),
  scrap_type TEXT NOT NULL CHECK (scrap_type IN ('SCRAP', 'PLASTA', 'PURGA', 'PREFORMA')),
  quantity INTEGER NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  record_date DATE DEFAULT CURRENT_DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrap_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for products (all authenticated users can manage)
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert products"
  ON public.products FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update products"
  ON public.products FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete products"
  ON public.products FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for inventory_movements
CREATE POLICY "Authenticated users can view movements"
  ON public.inventory_movements FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert movements"
  ON public.inventory_movements FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for scrap_records
CREATE POLICY "Authenticated users can view scrap records"
  ON public.scrap_records FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert scrap records"
  ON public.scrap_records FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update scrap records"
  ON public.scrap_records FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete scrap records"
  ON public.scrap_records FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Create function for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update product totals
CREATE OR REPLACE FUNCTION update_product_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_pieces = NEW.packages * NEW.pieces_per_package;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for product total calculation
CREATE TRIGGER calculate_product_total
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_total();